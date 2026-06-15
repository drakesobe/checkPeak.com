// pages/api/film/presign.js
// POST — generate an S3 presigned URL for direct video upload + create DB record.
// Mobile sends: { title, sport, gameDate?, opponent? }
// Returns:      { filmId, uploadUrl, s3Key, expiresIn }

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl }               from "@aws-sdk/s3-request-presigner";
import { createClient }               from "@supabase/supabase-js";
import { readUserCookie }             from "@/lib/requireUser";

const s3 = new S3Client({
  region:      process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET      = process.env.FILM_S3_BUCKET ?? "checkpeak-film-raw";
const EXPIRES_SEC = 900; // 15 min — enough for a 4GB upload on a good connection

function parseUser(req) {
  // Mobile: _authUser in body
  const raw = req.body?._authUser;
  if (raw) {
    try { return JSON.parse(decodeURIComponent(String(raw))); } catch {}
  }
  // Web: cookie
  return readUserCookie(req);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = parseUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  const role = String(user.role || user.Role || "").toLowerCase();
  if (!["organization", "admin", "trainer"].includes(role) && !role.includes("org") && !role.includes("coach") && !role.includes("trainer")) {
    return res.status(403).json({ error: "Coach account required" });
  }

  const orgId = String(user.orgToken || user.Token || user.orgId || user.OrgId || "").trim();
  if (!orgId) return res.status(400).json({ error: "Missing org identity on session" });

  const { title, sport = "football", gameDate, opponent } = req.body ?? {};
  if (!title?.trim()) return res.status(400).json({ error: "title is required" });

  try {
    // 1. Insert film record (status=uploading)
    const { data: film, error: dbErr } = await supabase
      .from("game_films")
      .insert({
        org_id:     orgId,
        title:      title.trim(),
        sport,
        game_date:  gameDate ?? null,
        opponent:   opponent?.trim() ?? null,
        status:     "uploading",
      })
      .select("id")
      .single();

    if (dbErr) throw dbErr;

    const filmId = film.id;
    const s3Key  = `raw/${orgId}/${filmId}.mp4`;

    // 2. Update record with s3_key_raw
    await supabase
      .from("game_films")
      .update({ s3_key_raw: s3Key })
      .eq("id", filmId);

    // 3. Generate presigned PUT URL
    const command    = new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         s3Key,
      ContentType: "video/mp4",
      Metadata:    { filmId, orgId },
    });
    const uploadUrl  = await getSignedUrl(s3, command, { expiresIn: EXPIRES_SEC });

    console.log(`[film/presign] filmId=${filmId} org=${orgId}`);
    return res.status(200).json({ ok: true, filmId, uploadUrl, s3Key, expiresIn: EXPIRES_SEC });

  } catch (err) {
    console.error("[film/presign]", err);
    return res.status(500).json({ error: "Failed to create presigned URL", details: err?.message });
  }
}
