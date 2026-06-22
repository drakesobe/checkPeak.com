// pages/api/film/jersey-scan.js
// POST { filmId }
// Runs Claude Vision on extracted frames for every tagged play to detect jersey numbers.
// Called automatically when film status transitions to "complete".
//
// Pipeline per play:
//   1. Invoke extract-frames Lambda → 3 JPEG frames at snap, snap+0.5s, snap+1.0s
//   2. Call Claude Haiku Vision with frames + home roster → detected jersey numbers
//   3. Write detections back to player_tracks:
//      a. Boost confidence on tracks Rekognition already numbered (Claude confirms)
//      b. Fill jersey_number where Rekognition got null AND it's a clean 1-to-1 match
//
// Vercel timeout: maxDuration 300s (set below). ~120 plays completes in ~60-90s.
//
// Required env:
//   ANTHROPIC_API_KEY, AWS_LAMBDA_EXTRACT_FRAMES_ARN, FILM_S3_BUCKET
//   AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

export const config = { maxDuration: 300 };

import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { createClient }                from "@supabase/supabase-js";
import { readUserCookie }              from "@/lib/requireUser";
import { detectJerseyNumbers }         from "@/lib/jersey/claude-vision";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const lambda = new LambdaClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const LAMBDA_ARN = process.env.AWS_LAMBDA_EXTRACT_FRAMES_ARN;

function parseUser(req) {
  const raw = req.body?._authUser;
  if (raw) { try { return JSON.parse(decodeURIComponent(String(raw))); } catch {} }
  return readUserCookie(req);
}

// Invoke Lambda synchronously; returns array of { timestamp, s3Key, success }
async function extractFrames(s3Key, filmId, playId, startTimeSecs) {
  const timestamps = [startTimeSecs, startTimeSecs + 0.5, startTimeSecs + 1.0];

  const { Payload, FunctionError } = await lambda.send(new InvokeCommand({
    FunctionName:   LAMBDA_ARN,
    InvocationType: "RequestResponse",
    Payload:        Buffer.from(JSON.stringify({ filmId, playId, s3Key, timestamps })),
  }));

  if (FunctionError) {
    const err = JSON.parse(Buffer.from(Payload).toString());
    throw new Error(err.errorMessage ?? "Lambda error");
  }

  const result = JSON.parse(Buffer.from(Payload).toString());
  if (!result.ok) throw new Error(result.error ?? "Frame extraction failed");
  return result.frames.filter(f => f.success).map(f => f.s3Key);
}

// Apply Claude detections to a play's player_tracks.
// Strategy A: if Claude confirms a Rekognition-detected number → boost confidence.
// Strategy B: if exactly 1 null-jersey track + exactly 1 new Claude detection for that team → assign.
async function applyDetections(playId, orgId, detections, tracks) {
  let updated = 0;

  for (const side of ["home", "away"]) {
    const sideDetections = detections.filter(d => d.team === side);
    const sideTracks     = tracks.filter(t => t.team === side);
    if (!sideDetections.length || !sideTracks.length) continue;

    const numberedTracks = sideTracks.filter(t => t.jersey_number != null);
    const nullTracks     = sideTracks.filter(t => t.jersey_number == null && !t.jersey_confirmed);

    // Strategy A — validate & boost Rekognition readings
    for (const track of numberedTracks) {
      const match = sideDetections.find(d => d.jersey_number === track.jersey_number);
      if (!match) continue;
      if ((match.confidence ?? 0) > (track.jersey_confidence ?? 0)) {
        await supabase
          .from("player_tracks")
          .update({ jersey_confidence: match.confidence })
          .eq("id", track.id);
        updated++;
      }
    }

    // Strategy B — 1-to-1 safe assignment
    const alreadyNumbered = new Set(numberedTracks.map(t => t.jersey_number));
    const newDetections   = sideDetections.filter(d => !alreadyNumbered.has(d.jersey_number));

    if (nullTracks.length === 1 && newDetections.length === 1) {
      const det = newDetections[0];
      await supabase
        .from("player_tracks")
        .update({
          jersey_number:    det.jersey_number,
          jersey_confidence: Math.min(det.confidence * 0.85, 0.84), // cap below auto-confirm threshold
          confirmed_by:     "claude_vision",
        })
        .eq("id", nullTracks[0].id);
      updated++;
    }
  }

  return updated;
}

// Process a batch of plays in parallel
async function processBatch(plays, film, roster, orgId) {
  const results = await Promise.allSettled(
    plays.map(async (play) => {
      try {
        const frameKeys = await extractFrames(
          film.s3_key_raw,
          film.id,
          play.id,
          play.start_time_secs
        );
        if (!frameKeys.length) return { playId: play.id, framesFailed: true };

        const detections = await detectJerseyNumbers({
          frameKeys,
          homeRoster: roster,
        });

        if (!detections.length) return { playId: play.id, detected: 0 };

        // Fetch current tracks for this play
        const { data: tracks } = await supabase
          .from("player_tracks")
          .select("id, jersey_number, jersey_confidence, jersey_confirmed, team")
          .eq("play_id", play.id)
          .eq("org_id", orgId);

        const updated = await applyDetections(play.id, orgId, detections, tracks ?? []);

        return { playId: play.id, detected: detections.length, updated };
      } catch (err) {
        console.error(`[jersey-scan] play ${play.id}:`, err.message);
        return { playId: play.id, error: err.message };
      }
    })
  );

  return results.map(r => r.status === "fulfilled" ? r.value : { error: r.reason?.message });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = parseUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });
  const orgId  = String(user.orgToken || user.Token || "").trim();
  const filmId = String(req.body?.filmId ?? "").trim();
  if (!filmId) return res.status(400).json({ error: "filmId required" });

  if (!LAMBDA_ARN) {
    return res.status(503).json({ error: "Frame extraction not configured (AWS_LAMBDA_EXTRACT_FRAMES_ARN missing)" });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: "Claude API not configured (ANTHROPIC_API_KEY missing)" });
  }

  try {
    // 1. Verify film ownership
    const { data: film } = await supabase
      .from("game_films")
      .select("id, org_id, s3_key_raw, status, home_team, away_team")
      .eq("id", filmId)
      .single();

    if (!film || film.org_id !== orgId) return res.status(404).json({ error: "Film not found" });
    if (!film.s3_key_raw) return res.status(400).json({ error: "No video file found for this film" });

    // 2. Fetch tagged plays
    const { data: plays } = await supabase
      .from("game_plays")
      .select("id, play_number, start_time_secs")
      .eq("film_id", filmId)
      .not("start_time_secs", "is", null)
      .order("play_number");

    if (!plays?.length) return res.status(400).json({ error: "No tagged plays to scan" });

    // 3. Fetch home roster for disambiguation
    const { data: roster } = await supabase
      .from("roster")
      .select("id, jersey_number, player_name, position")
      .eq("org_id", orgId);

    // 4. Process in batches of 20 — respects Claude rate limits (~100k tokens/batch)
    const BATCH = 20;
    const allResults = [];

    for (let i = 0; i < plays.length; i += BATCH) {
      const batch   = plays.slice(i, i + BATCH);
      const results = await processBatch(batch, film, roster ?? [], orgId);
      allResults.push(...results);
    }

    const scanned  = allResults.length;
    const detected = allResults.reduce((s, r) => s + (r.detected ?? 0), 0);
    const updated  = allResults.reduce((s, r) => s + (r.updated  ?? 0), 0);
    const errors   = allResults.filter(r => r.error).length;

    console.log(`[jersey-scan] filmId=${filmId} scanned=${scanned} detected=${detected} updated=${updated} errors=${errors}`);

    return res.status(200).json({ ok: true, scanned, detected, updated, errors });

  } catch (err) {
    console.error("[jersey-scan]", err);
    // (no status column to update — UI state handles scan progress)
    return res.status(500).json({ error: err?.message ?? "Scan failed" });
  }
}
