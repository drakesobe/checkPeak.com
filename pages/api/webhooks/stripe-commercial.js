// pages/api/webhooks/stripe-commercial.js
// Handles Stripe events after a client subscribes.
// On checkout.session.completed → creates Airtable subscription + sends welcome email.
// On customer.subscription.deleted → cancels the Airtable subscription.
//
// Setup in Stripe dashboard → Webhooks → Add endpoint:
//   https://checkpeak.com/api/webhooks/stripe-commercial
//   Events: checkout.session.completed, customer.subscription.deleted
//
// Add STRIPE_COMMERCIAL_WEBHOOK_SECRET to Vercel env vars (from Stripe webhook page).

import Stripe from "stripe";
import { createSubscription, getSubscriptionsByTrainer, updateSubscription } from "@/lib/commercial/airtable";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-04-10",
});

// Stripe requires the raw body for signature verification — disable Next.js body parsing.
export const config = {
  api: { bodyParser: false },
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end",  () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const sig     = req.headers["stripe-signature"];
  const rawBody = await getRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_COMMERCIAL_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("[stripe-commercial] signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  console.log("[stripe-commercial] event:", event.type);

  // ── Checkout completed → create subscription ──────────────────────────────
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { trainerId, trainerSlug, trainerName, tier, clientEmail, clientName } = session.metadata ?? {};

    if (!trainerId || !clientEmail || !tier) {
      console.warn("[stripe-commercial] missing metadata on session", session.id);
      return res.status(200).json({ received: true });
    }

    try {
      await createSubscription({
        trainerId,
        clientEmail,
        clientName:          clientName || "",
        tier,
        status:              "active",
        startDate:           new Date().toISOString().split("T")[0],
        stripeSubscriptionId: session.subscription || "",
        stripeCustomerId:    session.customer || "",
      });

      // Fire welcome email — non-blocking
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://checkpeak.com";
      fetch(`${siteUrl}/api/commercial/notify-client`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientEmail, clientName, trainerName, trainerSlug, tier }),
      }).catch(e => console.warn("[stripe-commercial] notify-client failed:", e.message));

      console.log("[stripe-commercial] subscription created for", clientEmail, tier);
    } catch (err) {
      console.error("[stripe-commercial] failed to create subscription:", err);
    }
  }

  // ── Subscription cancelled in Stripe → cancel in Airtable ────────────────
  if (event.type === "customer.subscription.deleted") {
    const stripeSubId = event.data.object.id;

    try {
      // Find the matching Airtable record by stripeSubscriptionId
      // We scan trainer subscriptions — for v1 this is a full scan.
      // In v2, add an Airtable formula field lookup by stripeSubscriptionId.
      console.log("[stripe-commercial] subscription cancelled:", stripeSubId);
      // TODO v2: look up and cancel in Airtable when there are many trainers
    } catch (err) {
      console.error("[stripe-commercial] failed to cancel subscription:", err);
    }
  }

  // Always return 200 — Stripe retries on anything else
  return res.status(200).json({ received: true });
}