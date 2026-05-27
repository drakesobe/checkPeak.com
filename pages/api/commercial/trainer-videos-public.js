// pages/api/commercial/trainer-videos-public.js
// Public — no auth needed.
// Returns Basic-tier video preview (max 4) + total video and workout counts.

import { getTrainerBySlug, getVideosByTrainer, getWorkoutsByTrainer } from "@/lib/commercial/airtable";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: "Missing slug" });

  const record = await getTrainerBySlug(slug);
  if (!record) return res.status(404).json({ error: "Trainer not found" });

  // Fetch videos and workouts in parallel
  const [allVideos, allWorkouts] = await Promise.all([
    getVideosByTrainer(record.id, { publishedOnly: true }),
    getWorkoutsByTrainer(record.id, { publishedOnly: true }).catch(() => []),
  ]);

  // Normalize video records to plain objects
  const normalized = allVideos.map(v => ({
    id:     v.id,
    fields: v.fields ?? {},
  }));

  // Preview: Basic-tier only, max 4
  const preview = normalized
    .filter(v => v.fields?.tier === "Basic")
    .slice(0, 4);

  return res.status(200).json({
    videos:        preview,
    total:         normalized.length, // back-compat
    totalVideos:   normalized.length,
    totalWorkouts: allWorkouts.length,
  });
}