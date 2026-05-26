// pages/api/commercial/completions.js
// GET: returns completed video IDs for this athlete + trainer.
// Used by the library page to show checkmarks and progress bars.
//
// Requires VIDEO_COMPLETIONS_TABLE_ID in Vercel env vars.
// Add this field to your .env.local: VIDEO_COMPLETIONS_TABLE_ID=tblXXXXXXXX

import { getRequestUser } from "@/lib/commercial/getRequestUser";
import { getTrainerBySlug, getCompletionsByClientAndTrainer } from "@/lib/commercial/airtable";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: "Missing slug" });

  try {
    const trainer = await getTrainerBySlug(slug);
    if (!trainer) return res.status(404).json({ error: "Trainer not found" });

    const clientEmail = user.email || user.Email;
    const completions = await getCompletionsByClientAndTrainer(clientEmail, trainer.id);

    // Return array of completed videoIds
    const completedVideoIds = completions
      .map(c => c.fields?.videoId)
      .filter(Boolean);

    return res.status(200).json({
      completedVideoIds,
      count: completedVideoIds.length,
    });
  } catch (err) {
    console.error("[completions GET]", err);
    return res.status(500).json({ error: "Failed to load completions." });
  }
}