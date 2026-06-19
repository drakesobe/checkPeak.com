// pages/api/film/video-url.js
// GET ?filmId=uuid
// Returns a presigned S3 GET URL so the tape room can stream the raw film
// when mux_playback_id is not yet set (ECS worker still processing or Mux skipped).
// URL is valid for 4 hours — enough for a full coaching session.

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@supabase/supabase-js";
import { readUserCookie } from "@/lib/requireUser";

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET      = process.env.FILM_S3_BUCKET ?? "checkpeak-film-raw-prod";
const EXPIRES_SEC = 60 * 60 * 4; // 4 hours

function parseUser(req) {
  const raw = req.query?._authUser;
  if (raw) { try { return JSON.parse(decodeURIComponent(String(raw))); } catch {} }
  return readUserCookie(req);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = parseUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  const orgId  = String(user.orgToken || user.Token || user.orgId || user.OrgId || "").trim();
  const filmId = String(req.query.filmId ?? "").trim();
  if (!filmId) return res.status(400).json({ error: "filmId required" });

  try {
    const { data: film, error } = await supabase
      .from("game_films")
      .select("id, org_id, s3_key_raw, mux_playback_id")
      .eq("id", filmId)
      .single();

    if (error || !film) return res.status(404).json({ error: "Film not found" });
    if (film.org_id !== orgId) return res.status(403).json({ error: "Not authorized" });

    // If Mux is available, the client should use that instead
    if (film.mux_playback_id) {
      return res.status(200).json({ ok: true, muxPlaybackId: film.mux_playback_id, videoUrl: null });
    }

    if (!film.s3_key_raw) {
      return res.status(404).json({ error: "No video file found for this film" });
    }

    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key:    film.s3_key_raw,
    });

    const videoUrl = await getSignedUrl(s3, command, { expiresIn: EXPIRES_SEC });

    return res.status(200).json({ ok: true, videoUrl, expiresIn: EXPIRES_SEC });

  } catch (err) {
    console.error("[film/video-url]", err);
    return res.status(500).json({ error: "Failed to generate video URL", details: err?.message });
  }
}
