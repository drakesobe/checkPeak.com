// pages/api/stripe/webhook.js
import stripe from "@/lib/stripe";
import {
  findBillingRecordByStripeCustomerId,
  upsertBillingForOrgToken,
  F,
  isoDateFromUnixSeconds,
} from "@/lib/airtableBilling";

export const config = {
  api: {
    bodyParser: false,
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
  if (!s) return "";
  return s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function asString(v) {
  return String(v ?? "").trim();
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

    // Prefer string id
    const customerId =
      obj?.customer && typeof obj.customer === "string"
        ? obj.customer
        : obj?.customer?.id && typeof obj.customer.id === "string"
        ? obj.customer.id
        : "";

    if (!customerId) return res.json({ received: true });

    // Find Billing record by Stripe Customer ID
    const billingRec = await findBillingRecordByStripeCustomerId(customerId);

    // Token: prefer Airtable Billing.Token; fallback to Stripe metadata
    const tokenFromBilling = asString(billingRec?.fields?.[F.Token] || "").toUpperCase();
    const tokenFromStripe =
      asString(obj?.metadata?.orgToken || "") ||
      asString(obj?.subscription_data?.metadata?.orgToken || "") ||
      "";

    const token = (tokenFromBilling || tokenFromStripe).toUpperCase();
    if (!token) {
      // If we can’t resolve token, we can’t safely upsert token-canonically.
      // (We could update the Billing row directly by billingRec.id, but you don't have a helper for that.)
      return res.json({ received: true });
    }

    // Optional orgRecordId: link is nice but not required
    const orgRecordId = Array.isArray(billingRec?.fields?.[F.Organization])
      ? billingRec.fields[F.Organization]?.[0]
      : "";

    const patch = {};

    // ---- Checkout completed ----
    if (type === "checkout.session.completed") {
      const subId = obj?.subscription ? String(obj.subscription) : "";
      if (subId) patch[F.StripeSubscriptionId] = subId;
      patch[F.Plan] = "Organization";
      // Don't over-assume status here; subscription.updated will correct it.
    }

    // ---- Subscription lifecycle ----
    if (
      type === "customer.subscription.created" ||
      type === "customer.subscription.updated" ||
      type === "customer.subscription.deleted"
    ) {
      const sub = obj;

      patch[F.StripeSubscriptionId] = String(sub?.id || "");
      patch[F.BillingStatus] = mapSubStatusToBillingStatus(sub?.status);
      patch[F.Plan] = "Organization";

      patch[F.TrialEnds] = isoDateFromUnixSeconds(sub?.trial_end);
      patch[F.RenewalDate] = isoDateFromUnixSeconds(sub?.current_period_end);
      patch[F.CurrentPeriodEnd] = isoDateFromUnixSeconds(sub?.current_period_end);
    }

    // ---- Invoice signals ----
    if (type === "invoice.payment_failed") {
      patch[F.BillingStatus] = "Past Due";
    }

    if (type === "invoice.payment_succeeded") {
      patch[F.BillingStatus] = "Active";
    }

    if (Object.keys(patch).length) {
      // ✅ Token-canonical upsert; org link optional
      await upsertBillingForOrgToken(token, patch, orgRecordId);
    }

    return res.json({ received: true });
  } catch (e) {
    console.error("[stripe/webhook] handler error:", e);
    return res.status(500).send("Webhook handler failed");
  }
}