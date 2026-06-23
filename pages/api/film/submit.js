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
    if (film.status === "complete") {
      return res.status(400).json({ error: "This film already has analysis data. To re-analyze, contact support — re-submitting reruns the full Rekognition pipeline." });
    }
    if (film.status === "uploading") {
      return res.status(400).json({ error: "Film is still uploading — wait for it to finish" });
    }

    if (!film.s3_key_raw) {
      return res.status(400).json({ error: "No video file found for this film. Try re-uploading." });
    }

    // Load all tagged plays with timestamps
    const { data: plays, error: pe } = await supabase
      .from("game_plays")
      .select("id, play_number, start_time_secs, end_time_secs, down, distance, play_type, formation")
      .eq("film_id", filmId)
      .order("play_number", { ascending: true });

    if (pe) throw pe;

    const allPlays    = plays ?? [];
    const taggedPlays = allPlays.filter(p => p.start_time_secs != null);
    const excluded    = allPlays.length - taggedPlays.length;

    if (taggedPlays.length === 0) {
      return res.status(400).json({ error: "Tag at least one play with a snap timestamp before submitting for analysis" });
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
      return res.status(200).json({ ok: true, filmId, status: "analyzing", playCount: taggedPlays.length, excludedCount: excluded, devMode: true });
    }

    const s3Key = film.s3_key_raw;

    // Send ONE message for the whole film with all play windows included.
    // The ECS worker runs full-film Rekognition regardless of per-play mode,
    // so sending N messages would trigger N full pipeline runs at $12 each.
    // plays array gives the worker the coach-tagged timestamps to slice results.
    await sqs.send(new SendMessageCommand({
      QueueUrl:    QUEUE_URL,
      MessageBody: JSON.stringify({
        mode:      "analyze_tagged",
        film_id:   filmId,
        s3_key:    s3Key,
        bucket:    BUCKET,
        org_id:    orgId,
        plays:     taggedPlays.map(play => ({
          play_id:         play.id,
          play_number:     play.play_number,
          start_time_secs: play.start_time_secs,
          end_time_secs:   play.end_time_secs ?? play.start_time_secs + 8,
          down:            play.down,
          distance:        play.distance,
          play_type:       play.play_type,
          formation:       play.formation,
        })),
      }),
    }));

    console.log(`[film/submit] filmId=${filmId} org=${orgId} plays=${taggedPlays.length} excluded=${excluded} messages_sent=1`);
    return res.status(200).json({ ok: true, filmId, status: "analyzing", playCount: taggedPlays.length, excludedCount: excluded });

  } catch (err) {
    console.error("[film/submit]", err);
    return res.status(500).json({ error: err?.message ?? "Submit failed" });
  }
}
