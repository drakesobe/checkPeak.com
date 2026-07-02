// pages/api/athlete/avatar.js
// POST: upload avatar via Cloudinary, update athlete_profiles.avatar_url

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

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  const athleteToken = String(auth?.athlete?.AthleteToken || auth?.user?.AthleteToken || "").trim();
  if (!athleteToken) return res.status(401).json({ error: "Missing AthleteToken" });

  const form = formidable({ multiples: false, maxFileSize: 5 * 1024 * 1024 });

  form.parse(req, async (err, _fields, files) => {
    if (err) return res.status(400).json({ error: "Upload error" });

    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) return res.status(400).json({ error: "No file provided" });

    const mime = file.mimetype || "";
    if (!mime.startsWith("image/")) return res.status(400).json({ error: "File must be an image" });

    try {
      const result = await cloudinary.uploader.upload(file.filepath, {
        folder:          "athlete-avatars",
        resource_type:   "image",
        transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }],
      });

      const { error: dbErr } = await db
        .from("athlete_profiles")
        .upsert(
          { athlete_token: athleteToken, avatar_url: result.secure_url, updated_at: new Date().toISOString() },
          { onConflict: "athlete_token" }
        );

      if (dbErr) return res.status(500).json({ error: "DB update failed", details: dbErr.message });

      return res.status(200).json({ ok: true, url: result.secure_url });
    } catch (e) {
      console.error("[avatar upload]", e);
      return res.status(500).json({ error: "Upload failed" });
    }
  });
}
