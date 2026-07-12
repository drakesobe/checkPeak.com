// pages/api/athlete/pr-video.js
// POST (multipart): attach a video clip to a specific set_log row.
// The set must belong to the requesting athlete — enforced via athlete_token check.

import { requireAthlete } from "@/lib/requireAthlete";
import { supabaseAdmin as db } from "@/lib/supabase";
import { v2 as cloudinary } from "cloudinary";
import formidable from "formidable";

export const config = { api: { bodyParser: false } };

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function getAthleteToken(auth) {
  return String(auth?.athlete?.AthleteToken || auth?.user?.AthleteToken || "").trim();
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  const athleteToken = getAthleteToken(auth);
  if (!athleteToken) return res.status(401).json({ error: "Missing AthleteToken" });

  const form = formidable({
    multiples:   false,
    maxFileSize: 200 * 1024 * 1024, // 200 MB
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      const tooBig = err.message?.toLowerCase().includes("maxfilesize");
      return res.status(400).json({ error: tooBig ? "File must be under 200 MB" : "Upload error" });
    }

    const setLogId = String(fields?.setLogId ?? fields?.setlogid ?? "").trim();
    if (!setLogId) return res.status(400).json({ error: "Missing setLogId" });

    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) return res.status(400).json({ error: "No file provided" });

    const mime = file.mimetype || file.type || "";
    if (!mime.startsWith("video/")) return res.status(400).json({ error: "File must be a video" });

    // Verify ownership — the set_logs row must belong to this athlete
    const { data: existing, error: lookupErr } = await db
      .from("set_logs")
      .select("id, athlete_token")
      .eq("id", setLogId)
      .maybeSingle();

    if (lookupErr || !existing) return res.status(404).json({ error: "Set log not found" });
    if (existing.athlete_token !== athleteToken) return res.status(403).json({ error: "Not your set" });

    try {
      const result = await cloudinary.uploader.upload(file.filepath, {
        folder:        "pr-videos",
        resource_type: "video",
        // Generate a poster thumbnail as an eager transformation
        eager: [{ width: 640, height: 360, crop: "fill", format: "jpg", quality: 80 }],
        eager_async:  false,
      });

      const videoUrl    = result.secure_url;
      const thumbnailUrl = result.eager?.[0]?.secure_url || null;

      // Also stamp is_pr = true here so the row is queryable even if logSet
      // couldn't write the column (e.g. column added after initial deploy)
      const { error: dbErr } = await db
        .from("set_logs")
        .update({ video_url: videoUrl, is_pr: true })
        .eq("id", setLogId)
        .eq("athlete_token", athleteToken);

      if (dbErr) return res.status(500).json({ error: "DB update failed", details: dbErr.message });

      return res.status(200).json({ ok: true, url: videoUrl, thumbnailUrl });
    } catch (e) {
      console.error("[pr-video upload]", e);
      return res.status(500).json({ error: "Upload failed" });
    }
  });
}
