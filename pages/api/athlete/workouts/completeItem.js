// pages/api/athlete/workouts/completeItem.js
// POST (multipart/form-data) - athlete marks a workout item complete, optionally uploading evidence.

import formidable from "formidable";
import { requireAthlete } from "@/lib/requireAthlete";
import { supabaseAdmin as db } from "@/lib/supabase";
import { sendNotificationToToken } from "@/lib/sendNotification";

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
    const timer = setTimeout(() => reject(new Error("Multipart parsing timed out after 45s — Content-Type may be missing")), 45_000);
    form.parse(req, (err, fields, files) => {
      clearTimeout(timer);
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  let r;
  try {
    r = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: fd, signal: controller.signal });
  } catch (e) {
    if (e?.name === "AbortError") throw new Error("Cloudinary upload timed out after 30s");
    throw e;
  } finally {
    clearTimeout(timer);
  }
  let json   = {};
  try { json = await r.json(); } catch {}
  if (!r.ok) throw new Error(json?.error?.message || `Cloudinary error ${r.status}`);
  return { url: json.secure_url || json.url, bytes: json.bytes };
}

async function recomputeDailyWorkoutStatus(dailyWorkoutId) {
  const { data: items } = await db
    .from("workout_items")
    .select("status")
    .eq("daily_workout_id", dailyWorkoutId);

  const statuses = (items ?? []).map(i => String(i.status || "assigned").toLowerCase());
  let status = "assigned";
  if (statuses.includes("rejected"))            status = "rejected";
  else if (statuses.includes("pending_review")) status = "pending_review";
  else if (statuses.length && statuses.every(s => s === "completed")) status = "completed";

  await db.from("daily_workouts").update({ status }).eq("id", dailyWorkoutId);
  return status;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    console.log("[completeItem] parsing multipart");
    const { fields, files } = await parseMultipart(req);
    console.log("[completeItem] fields:", Object.keys(fields || {}), "files:", Object.keys(files || {}));

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
    console.log("[completeItem] auth ok:", auth.ok, auth.ok ? "" : auth.error);
    if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

    const workoutItemId  = asString(fields.workoutItemId);
    const evidenceRaw    = asString(fields.evidenceRequired);
    const isVARA         = evidenceRaw.toLowerCase() === "voluntary_activity_vara";
    const needsFile      = requiresFileEvidence(evidenceRaw);
    const dailyWorkoutId = asString(fields.dailyWorkoutId);

    console.log("[completeItem] itemId:", workoutItemId, "evidenceRaw:", evidenceRaw, "needsFile:", needsFile);

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
      console.log("[completeItem] uploading to Cloudinary, size:", fileEntry.size, "type:", fileEntry.mimetype);
      const fs       = await import("fs");
      const buff     = fs.readFileSync(fileEntry.filepath || fileEntry.path);
      const blob     = new Blob([buff], { type: fileEntry.mimetype || "image/jpeg" });
      const filename = fileEntry.originalFilename || "proof.jpg";
      uploaded  = await uploadToCloudinary({ blob, filename });
      attachUrl = uploaded.url || "";
      console.log("[completeItem] Cloudinary upload done, url:", attachUrl);
    }

    const completionStatus = isVARA ? "completed" : (uploaded || needsFile) ? "pending_review" : "completed";

    // Look up workout_item to get daily_workout_id + org_id
    let dwId  = dailyWorkoutId;
    let orgId = "";
    {
      const { data: item } = await db
        .from("workout_items")
        .select("daily_workout_id")
        .eq("id", workoutItemId)
        .maybeSingle();
      if (item?.daily_workout_id) {
        dwId = item.daily_workout_id;
        const { data: dw } = await db
          .from("daily_workouts")
          .select("org_id")
          .eq("id", dwId)
          .maybeSingle();
        orgId = dw?.org_id || "";
      }
    }

    // Find or create completion record — avoids relying on a non-existent unique constraint
    const athleteDbId = auth.athlete?.id || null;
    const { data: existingRows } = await db
      .from("workout_completions")
      .select("id, status")
      .eq("workout_item_id", workoutItemId)
      .limit(1);
    const existing = existingRows?.[0] ?? null;

    let completion;
    let wcErr;

    if (existing) {
      const { data: updated, error: upErr } = await db
        .from("workout_completions")
        .update({ status: completionStatus, completed_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select("id, status")
        .single();
      completion = updated;
      wcErr      = upErr;
    } else {
      const { data: inserted, error: inErr } = await db
        .from("workout_completions")
        .insert({
          workout_item_id: workoutItemId,
          athlete_id:      athleteDbId,
          org_id:          orgId || null,
          status:          completionStatus,
          completed_at:    new Date().toISOString(),
        })
        .select("id, status")
        .single();
      completion = inserted;
      wcErr      = inErr;
    }

    if (wcErr) return res.status(500).json({ error: "Failed to save completion.", details: wcErr.message });
    console.log("[completeItem] completion id:", completion?.id, "status:", completion?.status);

    // Store evidence in completion_evidence (normalized - not on the completion row)
    if (attachUrl && completion?.id) {
      const evidenceType = String(fileEntry?.mimetype || "").startsWith("video") ? "video" : "photo";
      await db.from("completion_evidence").insert({
        workout_completion_id: completion.id,
        athlete_id:            athleteDbId,
        url:                   attachUrl,
        evidence_type:         evidenceType,
      });
    }

    // Update workout_item status
    await db.from("workout_items").update({ status: completionStatus }).eq("id", workoutItemId);

    // Recompute daily_workout status
    let dailyWorkoutStatus = "";
    if (dwId) {
      try { dailyWorkoutStatus = await recomputeDailyWorkoutStatus(dwId); } catch (e) {
        console.error("[completeItem] recompute failed:", e);
      }
    }

    // Notify coach when workout requires their review
    if (completionStatus === "pending_review" && orgId) {
      try {
        const { data: orgRow } = await db
          .from("organizations")
          .select("push_token")
          .eq("id", orgId)
          .maybeSingle();
        if (orgRow?.push_token) {
          const athleteName = String(auth.athlete?.name || auth.athlete?.Name || "An athlete");
          sendNotificationToToken(orgRow.push_token, {
            title: "Workout Submitted for Review",
            body:  `${athleteName} submitted workout evidence — tap to review.`,
            type:  "workout_review_submitted",
            data:  { orgId, athleteId: athleteDbId, dwId },
          });
        }
      } catch (e) {
        console.error("[completeItem] coach notification failed:", e);
      }
    }

    return res.status(200).json({
      ok:                  true,
      workoutCompletionId: completion.id,
      status:              completion.status,
      isVARA,
      attachmentUrl:       attachUrl,
      dailyWorkoutId:      dwId,
      dailyWorkoutStatus,
    });
  } catch (err) {
    console.error("[athlete/workouts/completeItem]", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
