// pages/api/film/process.js
// POST { filmId }
// Called by the upload modal right after the S3 presigned PUT completes.
// Updates status to 'transcoding' immediately so the UI reflects processing.
// The actual ECS worker is triggered automatically via S3 → Lambda → SQS -
// no manual SQS send needed here (a duplicate send would cause double DB writes).

import { createClient } from "@supabase/supabase-js";
import { readUserCookie } from "@/lib/requireUser";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseUser(req) {
  const raw = req.body?._authUser;
  if (raw) { try { return JSON.parse(decodeURIComponent(String(raw))); } catch {} }
  return readUserCookie(req);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = parseUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  const orgId  = String(user.orgToken || user.Token || user.orgId || user.OrgId || "").trim();
  const filmId = String(req.body?.filmId ?? "").trim();
  if (!filmId) return res.status(400).json({ error: "filmId required" });

  try {
    // Verify org owns this film and get the s3 key
    const { data: film, error: fe } = await supabase
      .from("game_films")
      .select("id, org_id, s3_key_raw, status")
      .eq("id", filmId)
      .single();

    if (fe || !film) return res.status(404).json({ error: "Film not found" });
    if (film.org_id !== orgId) return res.status(403).json({ error: "Not authorized" });

    if (film.status !== "uploading") {
      return res.status(200).json({ ok: true, alreadyStarted: true, status: film.status });
    }

    // Mark as transcoding immediately so the lobby/tape room shows progress
    // without waiting up to 20s for the ECS worker's SQS long-poll cycle.
    await supabase
      .from("game_films")
      .update({ status: "transcoding", updated_at: new Date().toISOString() })
      .eq("id", filmId);

    console.log(`[film/process] status→transcoding filmId=${filmId} org=${orgId}`);
    return res.status(200).json({ ok: true, filmId });

  } catch (err) {
    console.error("[film/process]", err);
    return res.status(500).json({ error: err?.message ?? "Failed to queue film" });
  }
}
