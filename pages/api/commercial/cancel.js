// pages/api/commercial/cancel.js
// POST — cancel an active subscription for this athlete + trainer.
// Paid plans: cancel_at_period_end so they keep access through the billing cycle.
// Free plans: instant cancellation.

import Stripe from "stripe";
import { getRequestUser } from "@/lib/commercial/getRequestUser";
import {
  getTrainerBySlug,
  getSubscriptionByClientAndTrainer,
  updateSubscription,
} from "@/lib/commercial/db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-04-10" });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { slug } = req.body;
  if (!slug) return res.status(400).json({ error: "Missing slug" });

  const trainer = await getTrainerBySlug(slug);
  if (!trainer) return res.status(404).json({ error: "Trainer not found" });

  const clientEmail = user.email || user.Email;
  const sub = await getSubscriptionByClientAndTrainer(clientEmail, trainer.id);

  if (!sub) return res.status(404).json({ error: "No active subscription found" });

  const stripeSubId = sub.fields?.stripeSubscriptionId;

  try {
    let atPeriodEnd = false;

    if (stripeSubId) {
      // Paid plan — cancel at end of current billing period so they keep access
      await stripe.subscriptions.update(stripeSubId, { cancel_at_period_end: true });
      atPeriodEnd = true;
    }

    // Mark as cancelled in Airtable immediately
    await updateSubscription(sub.id, { status: "cancelled" });

    return res.status(200).json({ cancelled: true, atPeriodEnd });
  } catch (err) {
    console.error("[cancel]", err);
    return res.status(500).json({ error: "Failed to cancel subscription." });
  }
}