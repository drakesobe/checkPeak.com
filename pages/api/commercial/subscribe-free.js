// pages/api/commercial/subscribe-free.js
// Creates a subscription record for a free-tier plan, bypassing Stripe.
// Only works when the trainer has genuinely set that tier's price to 0.

import { getRequestUser } from "@/lib/commercial/getRequestUser";
import {
  getTrainerBySlug,
  createSubscription,
  getSubscriptionByClientAndTrainer,
} from "@/lib/commercial/db";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ ok: false, error: "Not logged in" });

  const { slug, tier } = req.body || {};
  if (!slug || !tier) {
    return res.status(400).json({ ok: false, error: "Missing slug or tier" });
  }

  let trainer;
  try {
    trainer = await getTrainerBySlug(slug);
  } catch (err) {
    console.error("[subscribe-free] getTrainerBySlug failed:", err);
    return res.status(500).json({ ok: false, error: "Could not look up trainer" });
  }

  if (!trainer) return res.status(404).json({ ok: false, error: "Trainer not found" });

  const f = trainer.fields ?? {};

  if (f.libraryLocked) {
    return res.status(403).json({ ok: false, error: "This library is closed to new members." });
  }

  const priceKeys = { Basic: "basicPrice", Premium: "premiumPrice", Ultra: "ultraPrice" };
  const price = Number(f[priceKeys[tier]] ?? 1);

  // Safety guard — only allow this route for genuinely free tiers
  if (price !== 0) {
    return res.status(400).json({ ok: false, error: "This tier is not free" });
  }

  const clientEmail = String(user.Email || user.email || "").trim().toLowerCase();
  if (!clientEmail) {
    return res.status(400).json({ ok: false, error: "No email on account" });
  }

  // Avoid duplicate subscriptions
  try {
    const existing = await getSubscriptionByClientAndTrainer(clientEmail, trainer.id);
    if (existing) {
      console.log("[subscribe-free] already subscribed:", clientEmail, trainer.id);
      return res.json({ ok: true, alreadySubscribed: true });
    }
  } catch (err) {
    // Non-fatal — proceed with creation attempt even if the duplicate check fails
    console.warn("[subscribe-free] duplicate check failed (non-fatal):", err?.message);
  }

  // Create the subscription record in Airtable
  let result;
  try {
    result = await createSubscription({
      trainerId:   trainer.id,
      clientEmail,
      clientName:  String(user.name || user.Name || "").trim(),
      tier,
      status:      "active",
      startDate:   new Date().toISOString().slice(0, 10),
    });
  } catch (err) {
    console.error("[subscribe-free] createSubscription threw:", err);
    return res.status(500).json({ ok: false, error: "Failed to create subscription", detail: err.message });
  }

  // Airtable returns { error: { type, message } } on failure — check for it
  if (result?.error) {
    console.error("[subscribe-free] Airtable rejected createSubscription:", result.error);
    return res.status(500).json({
      ok:     false,
      error:  "Airtable rejected the subscription record",
      detail: result.error?.message ?? JSON.stringify(result.error),
    });
  }

  // Confirm the record has an ID (Airtable returns { id, fields, createdTime } on success)
  if (!result?.id) {
    console.error("[subscribe-free] createSubscription returned no id:", result);
    return res.status(500).json({ ok: false, error: "Subscription record may not have been created", detail: JSON.stringify(result) });
  }

  console.log("[subscribe-free] created subscription:", result.id, { clientEmail, tier, trainerId: trainer.id });
  return res.json({ ok: true, subscriptionId: result.id });
}