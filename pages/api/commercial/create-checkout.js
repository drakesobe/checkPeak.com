// pages/api/commercial/create-checkout.js
// Creates a Stripe Checkout session when a client clicks Subscribe on a trainer profile.
// Uses dynamic pricing (no pre-created Stripe products needed).
// Requires: npm install stripe, STRIPE_SECRET_KEY in Vercel env vars.

import Stripe from "stripe";
import { getTrainerBySlug } from "@/lib/commercial/airtable";
import { getRequestUser } from "@/lib/commercial/getRequestUser";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-04-10",
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Must be logged in to subscribe
  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ error: "You must be logged in to subscribe." });

  const { slug, tier } = req.body;
  if (!slug || !tier) return res.status(400).json({ error: "Missing slug or tier." });
  if (!["Basic", "Premium", "Ultra"].includes(tier)) {
    return res.status(400).json({ error: "Invalid tier." });
  }

  const trainer = await getTrainerBySlug(slug);
  if (!trainer) return res.status(404).json({ error: "Trainer not found." });

  const f = trainer.fields ?? {};
  const tierPriceMap = {
    Basic:   f.basicPrice,
    Premium: f.premiumPrice,
    Ultra:   f.ultraPrice,
  };

  const priceAmount = Number(tierPriceMap[tier]);
  if (!priceAmount || priceAmount <= 0) {
    return res.status(400).json({ error: "This tier is not available for purchase." });
  }

  const clientEmail = user.email || user.Email;
  const clientName  = user.name  || user.Name || "";
  const siteUrl     = process.env.NEXT_PUBLIC_SITE_URL || "https://checkpeak.com";

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",

      // Pre-fill client email in Stripe's form
      customer_email: clientEmail,

      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name:        `${tier} Plan — ${f.name}`,
            description: `Monthly ${tier} access to ${f.name}'s CheckPeak library`,
          },
          unit_amount: Math.round(priceAmount * 100), // Stripe expects cents
          recurring: { interval: "month" },
        },
        quantity: 1,
      }],

      // Metadata flows through to the webhook so we can create the subscription
      metadata: {
        trainerId:   trainer.id,
        trainerSlug: slug,
        trainerName: f.name || "",
        tier,
        clientEmail,
        clientName,
      },

      success_url: `${siteUrl}/trainer/${slug}?checkout=success&tier=${encodeURIComponent(tier)}`,
      cancel_url:  `${siteUrl}/trainer/${slug}`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("[create-checkout]", err);
    return res.status(500).json({ error: "Failed to create checkout session." });
  }
}