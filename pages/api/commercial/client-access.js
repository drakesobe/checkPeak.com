// pages/api/commercial/client-access.js
// Returns the client's tier, purchased item ids, and published videos/workouts
// for a trainer. Access is granted by an active subscription OR any one-time
// purchase. The library page ORs purchasedIds into its per-item access check.

import { getRequestUser } from "@/lib/commercial/getRequestUser";
import {
  getTrainerBySlug,
  getSubscriptionByClientAndTrainer,
  getPurchasesByEmailAndTrainer,
  getVideosByTrainer,
  getWorkoutsByTrainer,
} from "@/lib/commercial/airtable";

export default async function handler(req, res) {
  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: "Missing slug" });

  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const trainer = await getTrainerBySlug(slug);
  if (!trainer) return res.status(404).json({ error: "Trainer not found" });

  const clientEmail = user.email || user.Email;

  // getSubscriptionByClientAndTrainer already filters to status="active"
  const sub  = await getSubscriptionByClientAndTrainer(clientEmail, trainer.id);
  const tier = sub?.fields?.tier ?? null;

  const purchases    = await getPurchasesByEmailAndTrainer(clientEmail, trainer.id);
  const purchasedIds = purchases.map(p => p.fields?.itemId).filter(Boolean);

  // No subscription AND no purchases -> no access at all.
  if (!tier && purchasedIds.length === 0) {
    return res.status(403).json({ error: "No access" });
  }

  // Fetch all published videos and workouts in parallel.
  // The client page handles locked/accessible display via tier + purchasedIds.
  const [videos, workouts] = await Promise.all([
    getVideosByTrainer(trainer.id, { publishedOnly: true }),
    getWorkoutsByTrainer(trainer.id, { publishedOnly: true }),
  ]);

  return res.status(200).json({ tier, purchasedIds, videos, workouts });
}