// pages/api/commercial/trainer-videos-public.js
import { getTrainerBySlug, getVideosByTrainer } from "@/lib/commercial/airtable";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: "Missing slug" });

  const record = await getTrainerBySlug(slug);
  if (!record) return res.status(404).json({ error: "Trainer not found" });

  const allVideos = await getVideosByTrainer(record.id, { publishedOnly: true });

  // Normalize records to plain objects
  const normalized = allVideos.map(v => ({
    id:     v.id,
    fields: v.fields ?? {},
  }));

  // Preview: Basic-tier only, max 4
  const preview = normalized
    .filter(v => v.fields?.tier === "Basic")
    .slice(0, 4);

  return res.status(200).json({
    videos: preview,
    total:  normalized.length,
  });
}