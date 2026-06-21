// pages/api/film/submit.js
// POST { filmId }
// Coach has finished tagging plays and submits for AI analysis.
// Validates plays exist, queues the ECS worker with pre-tagged timestamps,
// and sets status=analyzing. The worker receives play windows so it runs
// Rekognition only on the coach-defined segments — no auto-segmentation.

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
      .select("id, org_id, s3_key_raw, status, play_count")
      .eq("id", filmId)
      .single();

    if (fe || !film) return res.status(404).json({ error: "Film not found" });
    if (film.org_id !== orgId) return res.status(403).json({ error: "Not authorized" });

    if (film.status === "analyzing") {
      return res.status(200).json({ ok: true, alreadySubmitted: true, status: "analyzing" });
    }
    if (film.status === "uploading") {
      return res.status(400).json({ error: "Film is still uploading — wait for it to finish" });
    }

    // Load all tagged plays with timestamps
    const { data: plays, error: pe } = await supabase
      .from("game_plays")
      .select("id, play_number, start_time_secs, end_time_secs, down, distance, play_type, formation")
      .eq("film_id", filmId)
      .order("play_number", { ascending: true });

    if (pe) throw pe;

    const taggedPlays = (plays ?? []).filter(p => p.start_time_secs != null);
    if (taggedPlays.length === 0) {
      return res.status(400).json({ error: "Tag at least one play before submitting for analysis" });
    }

    // Set film to analyzing
    await supabase
      .from("game_films")
      .update({
        status:        "analyzing",
        progress_pct:  0,
        error_message: null,
        updated_at:    new Date().toISOString(),
      })
      .eq("id", filmId);

    if (!QUEUE_URL) {
      console.warn("[film/submit] FILM_SQS_URL not set — skipping SQS send (dev mode)");
      return res.status(200).json({ ok: true, filmId, status: "analyzing", playCount: taggedPlays.length, devMode: true });
    }

    const s3Key = film.s3_key_raw ?? `raw/${orgId}/${filmId}.mp4`;

    // Send SQS message with play timestamps so the worker skips auto-segmentation
    // and runs Rekognition only on these specific time windows.
    await sqs.send(new SendMessageCommand({
      QueueUrl:    QUEUE_URL,
      MessageBody: JSON.stringify({
        film_id:   filmId,
        s3_key:    s3Key,
        bucket:    BUCKET,
        org_id:    orgId,
        mode:      "analyze_tagged",
        plays:     taggedPlays.map(p => ({
          id:              p.id,
          play_number:     p.play_number,
          start_time_secs: p.start_time_secs,
          end_time_secs:   p.end_time_secs ?? p.start_time_secs + 8,
          down:            p.down,
          distance:        p.distance,
          play_type:       p.play_type,
          formation:       p.formation,
        })),
      }),
    }));

    console.log(`[film/submit] filmId=${filmId} org=${orgId} plays=${taggedPlays.length}`);
    return res.status(200).json({ ok: true, filmId, status: "analyzing", playCount: taggedPlays.length });

  } catch (err) {
    console.error("[film/submit]", err);
    return res.status(500).json({ error: err?.message ?? "Submit failed" });
  }
}
