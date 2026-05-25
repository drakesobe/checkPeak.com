// pages/api/commercial/trainer-videos-public.js
// No auth required — returns Basic-tier published videos as a preview (max 4)
// plus the total published video count for the trainer profile page.

import { getTrainerBySlug, getVideosByTrainer } from "@/lib/commercial/airtable";

export default async function handler(req, res) {
  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: "Missing slug" });

  const trainer = await getTrainerBySlug(slug);
  if (!trainer) return res.status(404).json({ error: "Trainer not found" });

  const allVideos = await getVideosByTrainer(trainer.id, { publishedOnly: true });

  // Preview: Basic-tier videos only, max 4
  const preview = allVideos
    .filter(v => v.fields?.tier === "Basic")
    .slice(0, 4);

  return res.status(200).json({
    videos: preview,
    total:  allVideos.length,
  });
}