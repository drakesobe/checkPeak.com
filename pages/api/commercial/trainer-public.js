// ─── pages/api/commercial/trainer-public.js ───────────────────────────────────
// Public - no auth needed. Returns trainer profile by slug.
// Used by the client library page to show trainer name/info.

import { getTrainerBySlug } from "@/lib/commercial/db";

export default async function handler(req, res) {
  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: "Missing slug" });

  const trainer = await getTrainerBySlug(slug);
  if (!trainer) return res.status(404).json({ error: "Trainer not found" });

  return res.status(200).json({ trainer });
}