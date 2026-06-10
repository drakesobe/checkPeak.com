// pages/api/athlete/workouts/completeItem.js
// POST (multipart/form-data) — athlete marks a workout item complete, optionally uploading evidence.

import formidable from "formidable";
import { requireAthlete } from "@/lib/requireAthlete";
import { supabaseAdmin as db } from "@/lib/supabase";

export const config = {
  api: { bodyParser: false },
};

function asString(v) {
  const x = Array.isArray(v) ? v[0] : v;
  return String(x ?? "").trim();
}

function requiresFileEvidence(raw) {
  const s = asString(raw).toLowerCase();
  if (s === "false" || s === "none" || s === "voluntary_activity_vara") return false;
  if (s === "true" || s === "photo" || s === "video" || s === "photo_or_video") return true;
  return s.length > 0;
}

async function parseMultipart(req) {
  const form = formidable({ multiples: false, keepExtensions: true, maxFileSize: 15 * 1024 * 1024 });
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

async function uploadToCloudinary({ blob, filename }) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) throw new Error("Missing Cloudinary env vars");

  const timestamp = Math.floor(Date.now() / 1000);
  const folder    = "checkpeak/workout-proof";
  const crypto    = await import("crypto");
  const signature = crypto.createHash("sha1")
    .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
    .digest("hex");

  const fd = new FormData();
  fd.append("file", blob, filename || "proof.jpg");
  fd.append("api_key", apiKey);
  fd.append("timestamp", String(timestamp));
  fd.append("folder", folder);
  fd.append("signature", signature);

  const r    = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: fd });
  let json   = {};
  try { json = await r.json(); } catch {}
  if (!r.ok) throw new Error(json?.error?.message || "Cloudinary upload failed");
  return { url: json.secure_url || json.url, bytes: json.bytes };
}

async function recomputeDailyWorkoutStatus(workoutId) {
  const { data: items } = await db
    .from("workout_items")
    .select("status")
    .eq("workout_id", workoutId);

  const statuses = (items ?? []).map(i => String(i.status || "assigned").toLowerCase());
  let status = "assigned";
  if (statuses.includes("rejected"))       status = "rejected";
  else if (statuses.includes("pending_review")) status = "pending_review";
  else if (statuses.length && statuses.every(s => s === "completed")) status = "completed";

  await db.from("daily_workouts").update({ status }).eq("id", workoutId);
  return status;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { fields, files } = await parseMultipart(req);

    // Mobile: may send user JSON as _authUser field when cookie is mangled
    const cookieMissingOrBroken = (() => {
      try {
        const raw = req?.cookies?.user || "";
        if (!raw) return true;
        const dec = raw.includes("%7B") || raw.includes("%22") ? decodeURIComponent(raw) : raw;
        JSON.parse(dec);
        return false;
      } catch { return true; }
    })();

    if (cookieMissingOrBroken) {
      const authUserField = asString(fields._authUser || fields.authUser || "");
      if (authUserField) {
        req.cookies        = req.cookies || {};
        req.cookies.user   = authUserField;
        req.headers.cookie = `user=${encodeURIComponent(authUserField)}`;
      }
    }

    const auth = requireAthlete(req);
    if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

    const workoutItemId  = asString(fields.workoutItemId);
    const evidenceRaw    = asString(fields.evidenceRequired);
    const isVARA         = evidenceRaw.toLowerCase() === "voluntary_activity_vara";
    const needsFile      = requiresFileEvidence(evidenceRaw);
    const dailyWorkoutId = asString(fields.dailyWorkoutId);

    if (!workoutItemId) {
      return res.status(400).json({ error: "Missing workoutItemId", debug: { fieldsKeys: Object.keys(fields || {}) } });
    }

    const athleteToken = String(auth.athlete?.AthleteToken || "").trim();
    if (!athleteToken) return res.status(400).json({ error: "Missing AthleteToken in session." });

    const f = (files?.file || files?.photo || files?.image);
    const fileEntry = Array.isArray(f) ? f[0] : f;
    if (needsFile && !isVARA && !fileEntry) {
      return res.status(400).json({ error: "Photo required", debug: { evidenceRaw } });
    }

    // Upload to Cloudinary
    let uploaded  = null;
    let attachUrl = "";

    if (fileEntry && !isVARA) {
      const fs       = await import("fs");
      const buff     = fs.readFileSync(fileEntry.filepath || fileEntry.path);
      const blob     = new Blob([buff], { type: fileEntry.mimetype || "image/jpeg" });
      const filename = fileEntry.originalFilename || "proof.jpg";
      uploaded  = await uploadToCloudinary({ blob, filename });
      attachUrl = uploaded.url || "";
    }

    const completionStatus = isVARA ? "completed" : (uploaded || needsFile) ? "pending_review" : "completed";

    // Look up workout_item to get workout_id if not provided
    let wId = dailyWorkoutId;
    if (!wId) {
      const { data: item } = await db
        .from("workout_items")
        .select("workout_id")
        .eq("id", workoutItemId)
        .maybeSingle();
      wId = item?.workout_id || "";
    }

    // Upsert completion
    const { data: completion, error: wcErr } = await db
      .from("workout_completions")
      .upsert(
        {
          workout_item_id: workoutItemId,
          workout_id:      wId || null,
          athlete_id:      auth.athlete?.id || null,
          athlete_token:   athleteToken,
          status:          completionStatus,
          ...(attachUrl ? { attachment_url: attachUrl, attachment_type: "photo" } : {}),
          completed_at:    new Date().toISOString(),
        },
        { onConflict: "workout_item_id,athlete_token", ignoreDuplicates: false }
      )
      .select("id, status")
      .single();

    if (wcErr) return res.status(500).json({ error: "Failed to save completion.", details: wcErr.message });

    // Update workout_item status
    await db.from("workout_items").update({ status: completionStatus }).eq("id", workoutItemId);

    // Recompute daily_workout status
    let dailyWorkoutStatus = "";
    if (wId) {
      try { dailyWorkoutStatus = await recomputeDailyWorkoutStatus(wId); } catch (e) {
        console.error("[completeItem] recompute failed:", e);
      }
    }

    return res.status(200).json({
      ok:                  true,
      workoutCompletionId: completion.id,
      status:              completion.status,
      isVARA,
      attachmentUrl:       attachUrl,
      dailyWorkoutStatus,
      athleteTokenSent:    athleteToken,
    });
  } catch (err) {
    console.error("[athlete/workouts/completeItem]", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
