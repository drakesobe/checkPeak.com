// pages/api/athlete/workouts/completeItem.js

import Airtable from "airtable";
import { requireAthlete } from "@/lib/requireAthlete";
import formidable from "formidable";

export const config = {
  api: { bodyParser: false },
};

function pickFirst(v) {
  return Array.isArray(v) ? v[0] : v;
}

function asString(v) {
  const x = pickFirst(v);
  return String(x ?? "").trim();
}

function requiresFileEvidence(rawEvidenceRequired) {
  const s = asString(rawEvidenceRequired).toLowerCase();
  if (s === "false" || s === "none" || s === "voluntary_activity_vara") return false;
  if (s === "true" || s === "photo" || s === "video" || s === "photo_or_video") return true;
  return s.length > 0;
}

function normalizeItemStatus(v) {
  const s = asString(v).toLowerCase();
  if (s === "completed")      return "completed";
  if (s === "pending_review") return "pending_review";
  if (s === "rejected")       return "rejected";
  return "assigned";
}

function deriveDailyWorkoutStatus(itemStatuses = []) {
  const statuses = (itemStatuses || []).map(normalizeItemStatus);
  if (statuses.includes("rejected"))       return "rejected";
  if (statuses.includes("pending_review")) return "pending_review";
  if (statuses.length > 0 && statuses.every((s) => s === "completed")) return "completed";
  return "assigned";
}

function unwrapAuth(maybe) {
  if (!maybe) return { ok: false, athlete: null, user: null, raw: null };
  if (typeof maybe === "object" && "ok" in maybe) {
    return { ok: Boolean(maybe.ok), athlete: maybe.athlete || null, user: maybe.user || null, raw: maybe };
  }
  return { ok: true, athlete: maybe, user: null, raw: maybe };
}

function mustAthleteToken({ athlete, user, raw, fields }) {
  const candidates = [
    athlete?.AthleteToken, athlete?.athleteToken, athlete?.Token, athlete?.token,
    user?.AthleteToken,    user?.athleteToken,    user?.Token,    user?.token,
    raw?.AthleteToken,     raw?.athleteToken,     raw?.Token,     raw?.token,
    raw?.athlete?.AthleteToken, raw?.athlete?.athleteToken,
    raw?.user?.AthleteToken,    raw?.user?.athleteToken,
    fields?.AthleteToken, fields?.athleteToken, fields?.token, fields?.Token,
  ];
  return asString(candidates.find((x) => asString(x)));
}

function escapeAirtableString(str = "") {
  return String(str).replace(/'/g, "\\'");
}

const base =
  process.env.DAILYWORKOUTS_API_KEY && process.env.DAILYWORKOUTS_BASE_ID
    ? new Airtable({ apiKey: process.env.DAILYWORKOUTS_API_KEY }).base(process.env.DAILYWORKOUTS_BASE_ID)
    : null;

async function parseMultipart(req) {
  const form = formidable({ multiples: false, keepExtensions: true, maxFileSize: 15 * 1024 * 1024 });
  return await new Promise((resolve, reject) => {
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

  const res  = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: fd });
  let json = {};
  try { json = await res.json(); } catch {}
  if (!res.ok) throw new Error(json?.error?.message || "Cloudinary upload failed");
  return { url: json.secure_url || json.url, bytes: json.bytes };
}

async function resolveOrgForCompletion({ base, auth, athleteToken, athleteRecordId }) {
  const orgId = asString(
    auth?.user?.orgId    || auth?.user?.OrgId    ||
    auth?.raw?.orgId     || auth?.raw?.OrgId     ||
    auth?.athlete?.orgId || auth?.athlete?.OrgId || ""
  );
  const orgToken = asString(
    auth?.user?.OrgToken    || auth?.user?.orgToken    ||
    auth?.raw?.OrgToken     || auth?.raw?.orgToken     ||
    auth?.athlete?.OrgToken || auth?.athlete?.orgToken || ""
  ).toUpperCase();

  if (orgId || orgToken) return { orgId, orgToken, source: "session" };

  try {
    let rec = null;
    if (athleteRecordId) {
      rec = await base("AthleteScans").find(athleteRecordId);
    } else if (athleteToken) {
      const rows = await base("AthleteScans")
        .select({ maxRecords: 1, filterByFormula: `{AthleteToken}='${escapeAirtableString(athleteToken)}'`, fields: ["Organization", "OrgToken", "AthleteToken"] })
        .firstPage();
      rec = rows?.[0] || null;
    }
    const f = rec?.fields || {};
    return {
      orgId:    asString((Array.isArray(f?.Organization) ? f.Organization : [])?.[0] || ""),
      orgToken: asString(f?.OrgToken || "").toUpperCase(),
      source:   rec ? "athleteScans" : "none",
    };
  } catch {
    return { orgId: "", orgToken: "", source: "error" };
  }
}

async function recomputeAndUpdateDailyWorkoutStatus({ base, dailyWorkoutId }) {
  if (!dailyWorkoutId) return { updated: false, status: "" };
  const dw      = await base("DailyWorkouts").find(dailyWorkoutId);
  const itemIds = Array.isArray(dw?.fields?.WorkoutItems) ? dw.fields.WorkoutItems : [];
  if (!itemIds.length) {
    await base("DailyWorkouts").update([{ id: dailyWorkoutId, fields: { Status: "assigned" } }]);
    return { updated: true, status: "assigned" };
  }
  const orFormula   = `OR(${itemIds.map((id) => `RECORD_ID()='${String(id).replace(/'/g, "\\'")}'`).join(",")})`;
  const itemRecords = await base("WorkoutItems").select({ filterByFormula: orFormula, fields: ["Status"], pageSize: 100 }).all();
  const statuses    = itemRecords.map((r) => r?.fields?.Status || "assigned");
  const next        = deriveDailyWorkoutStatus(statuses);
  await base("DailyWorkouts").update([{ id: dailyWorkoutId, fields: { Status: next } }]);
  return { updated: true, status: next };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!base) return res.status(500).json({ error: "Missing DAILYWORKOUTS Airtable env vars" });

    // Parse multipart FIRST so we can use _authUser as cookie fallback
    const { fields, files } = await parseMultipart(req);

    // Auth fallback: RN multipart requests mangle the Cookie header.
    // Mobile client sends user JSON as _authUser form field instead.
    const cookieMissingOrBroken = (() => {
      try {
        const raw = req?.cookies?.user || "";
        if (!raw) return true;
        const decoded = raw.includes("%7B") || raw.includes("%22") ? decodeURIComponent(raw) : raw;
        JSON.parse(decoded);
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

    let authRaw = null;
    try {
      authRaw = requireAthlete.length >= 2 ? await requireAthlete(req, res) : requireAthlete(req);
    } catch (e) {
      return res.status(401).json({ error: e?.message || "Unauthorized" });
    }
    if (res.writableEnded) return;

    const auth = unwrapAuth(authRaw);
    if (!auth.ok) return res.status(401).json({ error: auth?.raw?.error || "Unauthorized" });

    const workoutItemId  = asString(fields.workoutItemId);
    const evidenceRaw    = asString(fields.evidenceRequired);
    const needsFile      = requiresFileEvidence(evidenceRaw);
    const isVARA         = evidenceRaw.toLowerCase() === "voluntary_activity_vara";
    const dailyWorkoutId = asString(fields.dailyWorkoutId);

    if (!workoutItemId) {
      return res.status(400).json({ error: "Missing workoutItemId", debug: { fieldsKeys: Object.keys(fields || {}) } });
    }

    const athleteToken    = mustAthleteToken({ athlete: auth.athlete, user: auth.user, raw: auth.raw, fields });
    const athleteRecordId = asString(auth?.athlete?.id || auth?.raw?.athlete?.id || "");

    if (!athleteToken) {
      return res.status(400).json({ error: "Missing AthleteToken in session." });
    }

    const f = pickFirst(files?.file || files?.photo || files?.image);
    if (needsFile && !isVARA && !f) {
      return res.status(400).json({ error: "Photo required", debug: { evidenceRaw, filesKeys: Object.keys(files || {}) } });
    }

    const orgResolved = await resolveOrgForCompletion({ base, auth, athleteToken, athleteRecordId });

    // Upload to Cloudinary
    let uploaded          = null;
    let attachment        = [];
    let attachmentSummary = "";

    if (f && !isVARA) {
      const fs       = await import("fs");
      const buff     = fs.readFileSync(f.filepath || f.path);
      const blob     = new Blob([buff], { type: f.mimetype || "image/jpeg" });
      const filename = f.originalFilename || "proof.jpg";

      uploaded          = await uploadToCloudinary({ blob, filename });
      attachment        = [{ url: uploaded.url, filename }];
      const kb          = uploaded.bytes ? Math.round(uploaded.bytes / 1024) : null;
      attachmentSummary = kb ? `${filename} (${kb} KB)` : filename;
    }

    const completionStatus =
      isVARA    ? "completed"      :
      uploaded  ? "pending_review" :
      needsFile ? "pending_review" :
                  "completed";

    // Write to WorkoutCompletions — only fields that exist in the table
    const created = await base("WorkoutCompletions").create([{
      fields: {
        CompletedAt:  new Date().toISOString(),
        AthleteToken: athleteToken,
        ...(athleteRecordId     ? { Athlete:           [athleteRecordId]    } : {}),
        ...(orgResolved?.orgId  ? { Organization:      [orgResolved.orgId]  } : {}),
        ...(orgResolved?.orgToken ? { OrgToken:         orgResolved.orgToken } : {}),
        WorkoutItem:  [workoutItemId],
        ...(attachment.length   ? { Attachment:         attachment           } : {}),
        ...(attachmentSummary   ? { AttachmentSummary:  attachmentSummary    } : {}),
        Status: completionStatus,
      },
    }]);

    const wcId = created?.[0]?.id || "";

    await base("WorkoutItems").update([{ id: workoutItemId, fields: { Status: completionStatus } }]);

    let daily = { updated: false, status: "" };
    try {
      daily = await recomputeAndUpdateDailyWorkoutStatus({ base, dailyWorkoutId });
    } catch (e) {
      console.error("DailyWorkouts status recompute failed:", e);
    }

    return res.status(200).json({
      ok:                  true,
      workoutCompletionId: wcId,
      status:              completionStatus,
      isVARA,
      attachmentUrl:       uploaded?.url || "",
      dailyWorkoutStatus:  daily?.status || "",
      athleteTokenSent:    athleteToken,
      athleteLinked:       Boolean(athleteRecordId),
      orgLinked:           Boolean(orgResolved?.orgId),
    });
  } catch (e) {
    console.error("completeItem error:", e);
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}