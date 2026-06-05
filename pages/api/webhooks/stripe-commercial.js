// pages/api/webhooks/stripe-commercial.js
// Handles: checkout.session.completed, customer.subscription.deleted
//
// checkout.session.completed branches on metadata.kind:
//   - "purchase"      -> write a one-time purchase row
//   - (anything else) -> subscription flow (with upgrade replacement)
//
// Upgrade flow: if client already has an active subscription for this trainer,
// cancel the old Stripe subscription and replace with the new one.

import Stripe from "stripe";
import { buffer } from "micro";
import {
  getSubscriptionByClientAndTrainer,
  createSubscription,
  updateSubscription,
  getPurchaseByEmailAndItem,
  createPurchase,
} from "@/lib/commercial/airtable";

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-04-10" });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const sig     = req.headers["stripe-signature"];
  const rawBody = await buffer(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_COMMERCIAL_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[stripe-commercial] signature error:", err.message);
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  // == checkout.session.completed ============================================

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const meta    = session.metadata ?? {};

    // -- One-time a la carte purchase -----------------------------------------
    if (meta.kind === "purchase") {
      const { trainerId, itemType, itemId, clientEmail, clientName } = meta;

      if (!trainerId || !itemId || !clientEmail) {
        console.error("[stripe-commercial] purchase missing metadata", meta);
        return res.status(200).json({ received: true });
      }

      try {
        // Idempotency: Stripe may deliver the event more than once.
        const existing = await getPurchaseByEmailAndItem(clientEmail, itemId);
        if (!existing) {
          await createPurchase({
            trainerId,
            clientEmail,
            clientName:      clientName ?? "",
            itemType:        itemType ?? "video",
            itemId,
            status:          "active",
            stripeSessionId: session.id ?? "",
            createdAt:       new Date().toISOString(),
          });
          console.log(`[stripe-commercial] purchase ${clientEmail} -> ${itemType}:${itemId}`);
        }
      } catch (err) {
        console.error("[stripe-commercial] create purchase error:", err);
      }

      return res.status(200).json({ received: true });
    }

    // -- Subscription (existing flow) -----------------------------------------
    const {
      trainerId,
      trainerName,
      tier,
      clientEmail,
      clientName,
    } = meta;

    if (!trainerId || !clientEmail || !tier) {
      console.error("[stripe-commercial] missing metadata", meta);
      return res.status(200).json({ received: true });
    }

    const stripeCustomerId     = session.customer;
    const stripeSubscriptionId = session.subscription;

    try {
      // Upgrade: cancel any existing active subscription first
      const existing = await getSubscriptionByClientAndTrainer(clientEmail, trainerId);
      if (existing) {
        const oldStripeSubId = existing.fields?.stripeSubscriptionId;
        if (oldStripeSubId && oldStripeSubId !== stripeSubscriptionId) {
          try {
            await stripe.subscriptions.cancel(oldStripeSubId);
          } catch (e) {
            console.warn("[stripe-commercial] could not cancel old sub:", e.message);
          }
        }
        await updateSubscription(existing.id, { status: "cancelled" });
      }

      await createSubscription({
        trainerId,
        clientEmail,
        clientName:            clientName ?? "",
        tier,
        status:                "active",
        startDate:             new Date().toISOString().slice(0, 10),
        stripeSubscriptionId:  stripeSubscriptionId ?? "",
        stripeCustomerId:      stripeCustomerId ?? "",
      });

      console.log(`[stripe-commercial] subscribed ${clientEmail} -> ${trainerName} (${tier})`);
    } catch (err) {
      console.error("[stripe-commercial] create subscription error:", err);
    }
  }

  // == customer.subscription.deleted =========================================

  if (event.type === "customer.subscription.deleted") {
    const sub   = event.data.object;
    const subId = sub.id;
    const email = sub.metadata?.clientEmail || sub.customer_email;

    if (email) {
      try {
        console.log(`[stripe-commercial] subscription deleted: ${subId} for ${email}`);
      } catch (err) {
        console.error("[stripe-commercial] deletion handler error:", err);
      }
    }
  }

  return res.status(200).json({ received: true });
}