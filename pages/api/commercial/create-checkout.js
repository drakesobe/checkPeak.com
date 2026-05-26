// pages/api/commercial/create-checkout.js
import Stripe from "stripe";
import { getTrainerBySlug } from "@/lib/commercial/airtable";
import { getRequestUser } from "@/lib/commercial/getRequestUser";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-04-10",
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ error: "You must be logged in to subscribe." });

  const { slug, tier } = req.body;
  if (!slug || !tier) return res.status(400).json({ error: "Missing slug or tier." });
  if (!["Basic", "Premium", "Ultra"].includes(tier))
    return res.status(400).json({ error: "Invalid tier." });

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
      customer_email: clientEmail,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name:        `${tier} Plan — ${f.name}`,
            description: `Monthly ${tier} access to ${f.name}'s CheckPeak library`,
          },
          unit_amount: Math.round(priceAmount * 100),
          recurring: { interval: "month" },
        },
        quantity: 1,
      }],
      metadata: {
        trainerId:   trainer.id,
        trainerSlug: slug,
        trainerName: f.name || "",
        tier,
        clientEmail,
        clientName,
      },
      // Redirect to welcome screen instead of profile page
      success_url: `${siteUrl}/trainer/${slug}/welcome?tier=${encodeURIComponent(tier)}`,
      cancel_url:  `${siteUrl}/trainer/${slug}`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("[create-checkout]", err);
    return res.status(500).json({ error: "Failed to create checkout session." });
  }
}