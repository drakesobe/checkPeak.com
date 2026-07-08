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

  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  const athleteToken = String(auth?.athlete?.AthleteToken || auth?.user?.AthleteToken || "").trim();
  if (!athleteToken) return res.status(401).json({ error: "Missing AthleteToken" });

  console.log("==[AVATAR 1]== auth ok, token:", athleteToken.slice(0, 12));

  // ── 2. Parse multipart ─────────────────────────────────────────────────────
  const form = formidable({ multiples: false, maxFileSize: 20 * 1024 * 1024 });

  let files;
  try {
    [, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, f) => {
        if (err) reject(err);
        else resolve([fields, f]);
      });
    });
  } catch (parseErr) {
    console.error("==[AVATAR PARSE ERR]==", parseErr?.message ?? parseErr);
    return res.status(400).json({ error: "Parse error: " + String(parseErr?.message ?? parseErr) });
  }

  const file = Array.isArray(files?.file) ? files.file[0] : files?.file;
  console.log("==[AVATAR 2]== file keys:", file ? Object.keys(file).join(",") : "NULL");
  console.log("==[AVATAR 2]== filepath:", file?.filepath, "size:", file?.size, "mime:", file?.mimetype);

  if (!file) return res.status(400).json({ error: "No file received — field name must be 'file'" });

  const mime = file.mimetype || "";
  if (!mime.startsWith("image/")) return res.status(400).json({ error: "Not an image: " + mime });

  // ── 3. Cloudinary upload ───────────────────────────────────────────────────
  console.log("==[AVATAR 3]== uploading to Cloudinary, cloud:", process.env.CLOUDINARY_CLOUD_NAME);
  try {
    const result = await cloudinary.uploader.upload(file.filepath, {
      folder:        "athlete-avatars",
      resource_type: "image",
    });

    console.log("==[AVATAR 4]== uploaded, public_id:", result.public_id);

    const avatarUrl = cloudinary.url(result.public_id, {
      width: 400, height: 400, crop: "fill",
      fetch_format: "auto", quality: "auto",
      secure: true,
    });

    // ── 4. DB upsert ───────────────────────────────────────────────────────
    const { error: dbErr } = await db
      .from("athlete_profiles")
      .upsert(
        { athlete_token: athleteToken, avatar_url: avatarUrl, updated_at: new Date().toISOString() },
        { onConflict: "athlete_token" }
      );

    if (dbErr) {
      console.error("==[AVATAR DB ERR]==", dbErr.message);
      return res.status(500).json({ error: "DB update failed: " + dbErr.message });
    }

    console.log("==[AVATAR 5]== done, url:", avatarUrl.slice(0, 60));
    return res.status(200).json({ ok: true, url: avatarUrl });

  } catch (e) {
    console.error("==[AVATAR CLOUDINARY ERR]==", e?.message ?? e, "| http_code:", e?.http_code);
    return res.status(500).json({ error: String(e?.message ?? e), http_code: e?.http_code ?? null });
  }
}
