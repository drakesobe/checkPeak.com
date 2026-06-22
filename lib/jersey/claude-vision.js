// lib/jersey/claude-vision.js
// Calls Claude Haiku Vision to detect jersey numbers from extracted play frames.
// Reads frames from S3 as base64 — works regardless of bucket public access settings.
//
// Returns: [{ jersey_number: 32, team: "home", confidence: 0.91, frame_index: 0 }]

import Anthropic                                    from "@anthropic-ai/sdk";
import { S3Client, GetObjectCommand }               from "@aws-sdk/client-s3";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const BUCKET = process.env.FILM_S3_BUCKET;

async function s3ToBase64(s3Key) {
  const { Body } = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: s3Key }));
  const chunks = [];
  for await (const chunk of Body) chunks.push(chunk);
  return Buffer.concat(chunks).toString("base64");
}

// roster: [{ jersey_number, player_name, position }]
// frameKeys: S3 keys of extracted JPEG frames
export async function detectJerseyNumbers({ frameKeys, homeRoster = [] }) {
  if (!frameKeys.length) return [];

  // Fetch all frames in parallel
  const b64Frames = await Promise.all(frameKeys.map(s3ToBase64));

  // Build roster lookup: jersey number → player name
  const homeNumbers = new Set(homeRoster.map(p => p.jersey_number).filter(Boolean));
  const rosterText  = homeRoster.length
    ? homeRoster.map(p => `#${p.jersey_number}${p.player_name ? ` ${p.player_name}` : ""}${p.position ? ` (${p.position})` : ""}`).join(", ")
    : "not provided";

  const imageBlocks = b64Frames.map(b64 => ({
    type:   "image",
    source: { type: "base64", media_type: "image/jpeg", data: b64 },
  }));

  const prompt = [
    `You are reading jersey numbers from ${b64Frames.length} frame(s) of a football game film.`,
    ``,
    `Known home team roster: ${rosterText}.`,
    `Home team roster numbers: ${homeNumbers.size ? Array.from(homeNumbers).sort((a, b) => a - b).join(", ") : "unknown"}.`,
    ``,
    `TEAM CLASSIFICATION RULE:`,
    `- If a jersey number matches the home roster list above → team = "home"`,
    `- If a jersey number does NOT match the home roster → team = "away"`,
    `- If you cannot determine which team the player is on → omit the detection`,
    ``,
    `For each jersey number you can read (even partially) in any frame:`,
    `- jersey_number: integer 1–99 only`,
    `- team: "home" or "away" (use roster rule above)`,
    `- confidence: 0.0–1.0`,
    `- frame_index: 0, 1, or 2 (which frame)`,
    ``,
    `Disambiguation: if you see a partial number like "3_" and the home roster has #32 but not #31 or #38, use #32.`,
    `Only report what is actually visible. Do not invent detections.`,
    ``,
    `Respond ONLY with valid JSON — no markdown, no explanation:`,
    `{"detections":[{"jersey_number":32,"team":"home","confidence":0.9,"frame_index":0}]}`,
  ].join("\n");

  let raw = "";
  try {
    const response = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages:   [{ role: "user", content: [...imageBlocks, { type: "text", text: prompt }] }],
    });
    raw = response.content[0]?.text ?? "{}";
  } catch (err) {
    console.error("[claude-vision] API error:", err.message);
    return [];
  }

  try {
    const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}";
    const parsed  = JSON.parse(jsonStr);
    const detections = parsed.detections ?? [];

    // Deduplicate by jersey_number + team — keep highest confidence
    const best = new Map();
    for (const d of detections) {
      if (!Number.isInteger(d.jersey_number) || d.jersey_number < 1 || d.jersey_number > 99) continue;
      if (!["home", "away"].includes(d.team)) continue;
      const key = `${d.team}:${d.jersey_number}`;
      const prev = best.get(key);
      if (!prev || (d.confidence ?? 0) > (prev.confidence ?? 0)) best.set(key, d);
    }

    return Array.from(best.values());
  } catch {
    return [];
  }
}
