// pages/api/commercial/purchase-checkout.js
// One-time purchase of a single video or workout.
// Mirrors create-checkout.js but uses mode: "payment" and carries
// kind: "purchase" in metadata so the shared webhook writes a purchase row.

import Stripe from "stripe";
import {
  getTrainerBySlug,
  getVideoById,
  getWorkoutById,
} from "@/lib/commercial/airtable";
import { getRequestUser } from "@/lib/commercial/getRequestUser";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-04-10",
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ error: "You must be logged in to buy." });

  const { slug, itemType, itemId, returnTo } = req.body;
  if (!slug || !itemType || !itemId)
    return res.status(400).json({ error: "Missing slug, itemType, or itemId." });
  if (!["video", "workout"].includes(itemType))
    return res.status(400).json({ error: "Invalid itemType." });

  const trainer = await getTrainerBySlug(slug);
  if (!trainer) return res.status(404).json({ error: "Trainer not found." });

  if ((trainer.fields ?? {}).libraryLocked) {
    return res.status(403).json({ error: "This library is closed to new members." });
  }

  // Fetch the item and re-derive the price server-side — never trust a client price.
  const record = itemType === "video"
    ? await getVideoById(itemId)
    : await getWorkoutById(itemId);

  const item = record?.fields;
  if (!item) return res.status(404).json({ error: "Item not found." });
  if (item.trainerId !== trainer.id)
    return res.status(400).json({ error: "Item does not belong to this trainer." });
  if (!item.published)
    return res.status(400).json({ error: "Item is not available." });

  const priceAmount = Number(item.price);
  if (!priceAmount || priceAmount <= 0)
    return res.status(400).json({ error: "This item is not sold individually." });

  const clientEmail = user.email || user.Email;
  const clientName  = user.name  || user.Name || "";
  const siteUrl     = process.env.NEXT_PUBLIC_SITE_URL || "https://checkpeak.com";
  const f           = trainer.fields ?? {};
  const label       = itemType === "video" ? "video" : "workout";

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: clientEmail,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name:        `${item.title} — ${f.name}`,
            description: `One-time ${label} purchase · ${f.name} on CheckPeak`,
          },
          unit_amount: Math.round(priceAmount * 100),
        },
        quantity: 1,
      }],
      metadata: {
        kind:        "purchase",
        trainerId:   trainer.id,
        trainerSlug: slug,
        trainerName: f.name || "",
        itemType,
        itemId,
        clientEmail,
        clientName,
      },
      success_url: `${siteUrl}/trainer/${slug}/library?purchased=${encodeURIComponent(itemId)}`,
      cancel_url:  returnTo === "profile" ? `${siteUrl}/trainer/${slug}` : `${siteUrl}/trainer/${slug}/library`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("[purchase-checkout]", err);
    return res.status(500).json({ error: "Failed to create checkout session." });
  }
}