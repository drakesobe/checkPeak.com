// pages/api/commercial/client-access.js
// Called by the client library page.
// Checks the user's subscription for this trainer and returns
// the published videos + their tier access.

import { getRequestUser } from "@/lib/commercial/getRequestUser";
import {
  getTrainerBySlug,
  getSubscriptionByClientAndTrainer,
  getVideosByTrainer,
} from "@/lib/commercial/airtable";

export default async function handler(req, res) {
  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: "Missing slug" });

  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const trainer = await getTrainerBySlug(slug);
  if (!trainer) return res.status(404).json({ error: "Trainer not found" });

  const clientEmail = user.email || user.Email;
  const sub = await getSubscriptionByClientAndTrainer(clientEmail, trainer.id);

  if (!sub || sub.fields?.status !== "active") {
    return res.status(403).json({ error: "No active subscription" });
  }

  const videos    = await getVideosByTrainer(trainer.id, { publishedOnly: true });
  const clientTier = sub.fields?.tier ?? "Basic";

  return res.status(200).json({ tier: clientTier, videos });
}