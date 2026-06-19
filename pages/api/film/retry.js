// pages/api/film/retry.js
// POST { filmId }
// Clears partial plays, resets status, and re-queues the ECS worker via SQS.
// Safe to call on failed or stuck-analyzing films.

import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { createClient } from "@supabase/supabase-js";
import { readUserCookie } from "@/lib/requireUser";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const sqs = new SQSClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const QUEUE_URL = process.env.FILM_SQS_URL;
const BUCKET    = process.env.FILM_S3_BUCKET ?? "checkpeak-film-raw-prod";

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
    const { data: film, error: fe } = await supabase
      .from("game_films")
      .select("id, org_id, s3_key_raw, status, mux_playback_id")
      .eq("id", filmId)
      .single();

    if (fe || !film) return res.status(404).json({ error: "Film not found" });
    if (film.org_id !== orgId) return res.status(403).json({ error: "Not authorized" });

    if (film.status === "ready") {
      return res.status(400).json({ error: "Film is already ready - no retry needed" });
    }
    if (film.status === "uploading") {
      return res.status(400).json({ error: "Film is still uploading - wait for upload to complete" });
    }

    // Clear any partial plays from the failed run
    await supabase.from("game_plays").delete().eq("film_id", filmId);

    // Reset film status
    await supabase
      .from("game_films")
      .update({
        status:        "transcoding",
        progress_pct:  0,
        play_count:    0,
        error_message: null,
        updated_at:    new Date().toISOString(),
      })
      .eq("id", filmId);

    // Re-queue the ECS worker
    if (!QUEUE_URL) throw new Error("FILM_SQS_URL not configured");

    const s3Key = film.s3_key_raw ?? `raw/${orgId}/${filmId}.mp4`;

    await sqs.send(new SendMessageCommand({
      QueueUrl:    QUEUE_URL,
      MessageBody: JSON.stringify({
        film_id:        filmId,
        s3_key:         s3Key,
        bucket:         BUCKET,
        org_id:         orgId,
        mux_playback_id: film.mux_playback_id ?? null,
        retried:        true,
      }),
    }));

    console.log(`[film/retry] queued filmId=${filmId} org=${orgId}`);
    return res.status(200).json({ ok: true, filmId, status: "transcoding" });

  } catch (err) {
    console.error("[film/retry]", err);
    return res.status(500).json({ error: err?.message ?? "Failed to retry film" });
  }
}
