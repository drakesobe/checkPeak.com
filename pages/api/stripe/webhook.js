// pages/api/stripe/webhook.js
import { stripe } from "@/lib/stripe";
import {
  findBillingRecordByStripeCustomerId,
  upsertBillingForOrg,
  F,
  isoDateFromUnixSeconds,
} from "@/lib/airtableBilling";

export const config = {
  api: {
    bodyParser: false, // REQUIRED for Stripe signature verification
  },
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function mapSubStatusToBillingStatus(subStatus) {
  const s = String(subStatus || "").toLowerCase();

  if (s === "trialing") return "Trial";
  if (s === "active") return "Active";
  if (s === "past_due") return "Past Due";
  if (s === "canceled") return "Canceled";
  if (s === "unpaid") return "Suspended";

  // fallback (still write something useful)
  if (!s) return "";
  return s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const sig = req.headers["stripe-signature"];
  const whsec = process.env.STRIPE_WEBHOOK_SECRET;

  if (!whsec) return res.status(500).send("Missing STRIPE_WEBHOOK_SECRET");

  let event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, whsec);
  } catch (err) {
    console.error("[stripe/webhook] signature error:", err?.message || err);
    return res.status(400).send(`Webhook Error: ${err?.message || "Bad signature"}`);
  }

  try {
    const type = event.type;
    const obj = event.data.object;

    // Many billing events include a customer; prefer string id
    const customerId =
      obj?.customer && typeof obj.customer === "string"
        ? obj.customer
        : obj?.customer?.id && typeof obj.customer.id === "string"
        ? obj.customer.id
        : "";

    // If no customer, nothing to sync in Billing table
    if (!customerId) return res.json({ received: true });

    // Find billing record by Stripe Customer ID
    const rec = await findBillingRecordByStripeCustomerId(customerId);
    const orgRecordId = rec?.fields?.[F.Organization]?.[0]; // linked org record id

    // If not linked yet, we can't upsert (Billing table should always link to Org)
    if (!orgRecordId) return res.json({ received: true });

    const patch = {};

    // ---- Checkout completed (subscription checkout) ----
    if (type === "checkout.session.completed") {
      const subId = obj?.subscription ? String(obj.subscription) : "";
      if (subId) patch[F.StripeSubscriptionId] = subId;

      // If checkout completes, we consider it started (Stripe will also send subscription.updated)
      // If it’s a trial checkout, subscription.updated will set Trial.
      patch[F.BillingStatus] = "Active";
      patch[F.Plan] = "Org";
    }

    // ---- Subscription lifecycle ----
    if (type === "customer.subscription.created" || type === "customer.subscription.updated" || type === "customer.subscription.deleted") {
      const sub = obj;

      patch[F.StripeSubscriptionId] = String(sub?.id || "");
      patch[F.BillingStatus] = mapSubStatusToBillingStatus(sub?.status);
      patch[F.Plan] = "Org";

      // Stripe unix seconds -> ISO -> Airtable date
      patch[F.RenewalDate] = isoDateFromUnixSeconds(sub?.current_period_end);
      patch[F.TrialEnds] = isoDateFromUnixSeconds(sub?.trial_end);
    }

    // ---- Invoice signals ----
    if (type === "invoice.payment_failed") {
      patch[F.BillingStatus] = "Past Due";
    }

    if (type === "invoice.payment_succeeded") {
      // Usually subscription.updated handles it, but safe bump
      // If still trialing, subscription.updated will override back to Trial
      patch[F.BillingStatus] = "Active";
    }

    // Optional: pull payment method brand/last4 if you want
    // (This is more complex because invoice may not include default payment method details directly.
    // We'll keep those fields editable or populated elsewhere if needed.)

    // Apply update if there is anything to write
    if (Object.keys(patch).length) {
      await upsertBillingForOrg(orgRecordId, patch);
    }

    return res.json({ received: true });
  } catch (e) {
    console.error("[stripe/webhook] handler error:", e);
    return res.status(500).send("Webhook handler failed");
  }
}
