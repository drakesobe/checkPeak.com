// pages/api/commercial/client-access.js
// Returns the client's tier, published videos, and published workouts for a trainer.
// Both videos and workouts are filtered to the client's access tier.

import { getRequestUser } from "@/lib/commercial/getRequestUser";
import {
  getTrainerBySlug,
  getSubscriptionByClientAndTrainer,
  getVideosByTrainer,
  getWorkoutsByTrainer,
} from "@/lib/commercial/airtable";

const TIER_RANK = { Basic: 1, Premium: 2, Ultra: 3 };

function canAccess(clientTier, contentTier) {
  return (TIER_RANK[clientTier] ?? 0) >= (TIER_RANK[contentTier] ?? 1);
}

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

  const clientTier = sub.fields?.tier ?? "Basic";

  // Fetch all published videos and workouts in parallel
  const [allVideos, allWorkouts] = await Promise.all([
    getVideosByTrainer(trainer.id, { publishedOnly: true }),
    getWorkoutsByTrainer(trainer.id, { publishedOnly: true }),
  ]);

  // Return all — client-side and library page handle locked/accessible display
  return res.status(200).json({
    tier:     clientTier,
    videos:   allVideos,
    workouts: allWorkouts,
  });
}