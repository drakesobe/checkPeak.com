// pages/api/athlete/workouts/completeItem.js
import Airtable from "airtable";
import { requireAthlete } from "@/lib/requireAthlete";
import formidable from "formidable";

export const config = {
  api: { bodyParser: false },
};

/* ---------------- tiny helpers ---------------- */

function pickFirst(v) {
  return Array.isArray(v) ? v[0] : v;
}

function asString(v) {
  const x = pickFirst(v);
  return String(x ?? "").trim();
}

/**
 * Determines whether a workout item requires file evidence.
 * Conservative: anything that isn't explicitly "none", "false", or VARA
 * is treated as requiring a file. This prevents an empty/missing field
 * from silently bypassing the photo requirement.
 */
function requiresFileEvidence(rawEvidenceRequired) {
  const s = asString(rawEvidenceRequired).toLowerCase();
  // Explicit no-evidence values
  if (s === "false" || s === "none" || s === "voluntary_activity_vara") return false;
  // Explicit evidence values
  if (s === "true" || s === "photo" || s === "video" || s === "photo_or_video") return true;
  // Unknown or empty — fail safe: treat as requiring evidence
  // This prevents a missing/null field from bypassing the photo check
  return s.length > 0; // empty string → false (truly unknown), non-empty unknown → true
}

function normalizeItemStatus(v) {
  const s = asString(v).toLowerCase();
  if (s === "completed") return "completed";
  if (s === "pending_review") return "pending_review";
  if (s === "rejected") return "rejected";
  return "assigned";
}

function deriveDailyWorkoutStatus(itemStatuses = []) {
  const statuses = (itemStatuses || []).map(normalizeItemStatus);
  if (statuses.includes("rejected")) return "rejected";
  if (statuses.includes("pending_review")) return "pending_review";
  if (statuses.length > 0 && statuses.every((s) => s === "completed")) return "completed";
  return "assigned";
}

function unwrapAuth(maybe) {
  if (!maybe) return { ok: false, athlete: null, user: null, raw: null };
  if (typeof maybe === "object" && "ok" in maybe) {
    return {
      ok: Boolean(maybe.ok),
      athlete: maybe.athlete || null,
      user: maybe.user || null,
      raw: maybe,
    };
  }
  return { ok: true, athlete: maybe, user: null, raw: maybe };
}

function mustAthleteToken({ athlete, user, raw, fields }) {
  const candidates = [
    athlete?.AthleteToken,
    athlete?.athleteToken,
    athlete?.Token,
    athlete?.token,

    user?.AthleteToken,
    user?.athleteToken,
    user?.Token,
    user?.token,

    raw?.AthleteToken,
    raw?.athleteToken,
    raw?.Token,
    raw?.token,

    raw?.athlete?.AthleteToken,
    raw?.athlete?.athleteToken,
    raw?.user?.AthleteToken,
    raw?.user?.athleteToken,

    fields?.AthleteToken,
    fields?.athleteToken,
    fields?.token,
    fields?.Token,
  ];

  return asString(candidates.find((x) => asString(x)));
}

function escapeAirtableString(str = "") {
  return String(str).replace(/'/g, "\\'");
}

/* ---------------- Airtable base ---------------- */

const base =
  process.env.DAILYWORKOUTS_API_KEY && process.env.DAILYWORKOUTS_BASE_ID
    ? new Airtable({ apiKey: process.env.DAILYWORKOUTS_API_KEY }).base(process.env.DAILYWORKOUTS_BASE_ID)
    : null;

/* ---------------- multipart parsing ---------------- */

async function parseMultipart(req) {
  const form = formidable({
    multiples: false,
    keepExtensions: true,
    maxFileSize: 15 * 1024 * 1024,
  });

  return await new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

/* ---------------- Cloudinary upload ---------------- */

async function uploadToCloudinary({ blob, filename }) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Missing Cloudinary env vars");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "checkpeak/workout-proof";

  const crypto = await import("crypto");
  const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash("sha1").update(toSign).digest("hex");

  const fd = new FormData();
  fd.append("file", blob, filename || "proof.jpg");
  fd.append("api_key", apiKey);
  fd.append("timestamp", String(timestamp));
  fd.append("folder", folder);
  fd.append("signature", signature);

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  const res = await fetch(endpoint, { method: "POST", body: fd });

  let json = {};
  try { json = await res.json(); } catch {}

  if (!res.ok) {
    throw new Error(json?.error?.message || "Cloudinary upload failed");
  }

  return {
    url: json.secure_url || json.url,
    bytes: json.bytes,
    public_id: json.public_id,
  };
}

/* ---------------- Org resolve ---------------- */

async function resolveOrgForCompletion({ base, auth, athleteToken, athleteRecordId }) {
  const orgId = asString(
    auth?.user?.orgId ||
      auth?.user?.OrgId ||
      auth?.raw?.orgId ||
      auth?.raw?.OrgId ||
      auth?.athlete?.orgId ||
      auth?.athlete?.OrgId ||
      ""
  );

  const orgToken = asString(
    auth?.user?.OrgToken ||
      auth?.user?.orgToken ||
      auth?.raw?.OrgToken ||
      auth?.raw?.orgToken ||
      auth?.athlete?.OrgToken ||
      auth?.athlete?.orgToken ||
      ""
  ).toUpperCase();

  if (orgId || orgToken) return { orgId, orgToken, source: "session" };

  try {
    let rec = null;

    if (athleteRecordId) {
      rec = await base("AthleteScans").find(athleteRecordId);
    } else if (athleteToken) {
      const tok = escapeAirtableString(athleteToken);
      const rows = await base("AthleteScans")
        .select({
          maxRecords: 1,
          filterByFormula: `{AthleteToken}='${tok}'`,
          fields: ["Organization", "OrgToken", "AthleteToken"],
        })
        .firstPage();
      rec = rows?.[0] || null;
    }

    const f = rec?.fields || {};
    const orgLinks = Array.isArray(f?.Organization) ? f.Organization : [];
    const orgId2 = asString(orgLinks?.[0] || "");
    const orgToken2 = asString(f?.OrgToken || "").toUpperCase();

    return { orgId: orgId2, orgToken: orgToken2, source: rec ? "athleteScans" : "none" };
  } catch {
    return { orgId: "", orgToken: "", source: "error" };
  }
}

/* ---------------- DailyWorkouts status recompute ---------------- */

async function recomputeAndUpdateDailyWorkoutStatus({ base, dailyWorkoutId }) {
  if (!dailyWorkoutId) return { updated: false, status: "" };

  const dw = await base("DailyWorkouts").find(dailyWorkoutId);
  const itemIds = Array.isArray(dw?.fields?.WorkoutItems) ? dw.fields.WorkoutItems : [];

  if (!itemIds.length) {
    await base("DailyWorkouts").update([{ id: dailyWorkoutId, fields: { Status: "assigned" } }]);
    return { updated: true, status: "assigned" };
  }

  const orFormula = `OR(${itemIds.map((id) => `RECORD_ID()='${String(id).replace(/'/g, "\\'")}'`).join(",")})`;

  const itemRecords = await base("WorkoutItems")
    .select({ filterByFormula: orFormula, fields: ["Status"], pageSize: 100 })
    .all();

  const statuses = itemRecords.map((r) => r?.fields?.Status || "assigned");
  const next = deriveDailyWorkoutStatus(statuses);

  await base("DailyWorkouts").update([{ id: dailyWorkoutId, fields: { Status: next } }]);
  return { updated: true, status: next };
}

/* ---------------- handler ---------------- */

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    if (!base) {
      return res.status(500).json({ error: "Missing DAILYWORKOUTS Airtable env vars" });
    }

    let authRaw = null;
    try {
      authRaw = requireAthlete.length >= 2 ? await requireAthlete(req, res) : requireAthlete(req);
    } catch (e) {
      return res.status(401).json({ error: e?.message || "Unauthorized" });
    }

    if (res.writableEnded) return;

    const auth = unwrapAuth(authRaw);
    if (!auth.ok) {
      return res.status(401).json({ error: auth?.raw?.error || "Unauthorized" });
    }

    const { fields, files } = await parseMultipart(req);

    const workoutItemId  = asString(fields.workoutItemId);
    // Client sends the raw EvidenceRequired string (e.g. "voluntary_activity_vara")
    // Fall back to legacy boolean "true"/"false" for older clients
    const evidenceRaw    = asString(fields.evidenceRequired);
    const needsFile      = requiresFileEvidence(evidenceRaw);
    const isVARA         = evidenceRaw.toLowerCase() === "voluntary_activity_vara";
    const dailyWorkoutId = asString(fields.dailyWorkoutId);
    const athleteNote    = asString(fields.athleteNote || fields.note || "");

    if (!workoutItemId) {
      return res.status(400).json({
        error: "Missing workoutItemId",
        debug: { fieldsKeys: Object.keys(fields || {}) },
      });
    }

    const athleteToken = mustAthleteToken({ athlete: auth.athlete, user: auth.user, raw: auth.raw, fields });
    if (!athleteToken) {
      return res.status(400).json({
        error: "Missing AthleteToken in session. Log out/in after AthleteScans.AthleteToken is populated.",
        debug: {
          athleteKeys: Object.keys(auth.athlete || {}),
          userKeys: Object.keys(auth.user || {}),
          rawKeys: Object.keys(auth.raw || {}),
          fieldsKeys: Object.keys(fields || {}),
        },
      });
    }

    const athleteRecordId = asString(auth?.athlete?.id || auth?.raw?.athlete?.id || "");

    const f = pickFirst(files?.file || files?.photo || files?.image);

    // VARA: self-report only, no file required or accepted
    // Other evidence types: file required if needsFile is true
    if (needsFile && !isVARA && !f) {
      return res.status(400).json({
        error: "Photo required",
        debug: { evidenceRaw, needsFile, filesKeys: Object.keys(files || {}) },
      });
    }

    const orgResolved = await resolveOrgForCompletion({
      base,
      auth,
      athleteToken,
      athleteRecordId,
    });

    // Upload to Cloudinary only if a file was actually provided (and not VARA)
    let uploaded = null;
    let attachment = [];
    let attachmentSummary = "";

    if (f && !isVARA) {
      const fs = await import("fs");
      const path = f.filepath || f.path;
      const buff = fs.readFileSync(path);
      const mime = f.mimetype || "image/jpeg";
      const filename = f.originalFilename || "proof.jpg";

      const blob = new Blob([buff], { type: mime });
      uploaded = await uploadToCloudinary({ blob, filename });

      attachment = [{ url: uploaded.url, filename }];
      const kb = uploaded.bytes ? Math.round(uploaded.bytes / 1024) : null;
      attachmentSummary = kb ? `${filename} (${kb} KB)` : filename;
    }

    const nowIso = new Date().toISOString();

    // Completion status logic:
    // - VARA => completed immediately (self-report, no coach review)
    // - evidence required (photo/video) => pending_review
    // - no evidence => completed immediately
    const completionStatus = needsFile && !isVARA ? "pending_review" : "completed";

    const created = await base("WorkoutCompletions").create([
      {
        fields: {
          CompletedAt: nowIso,

          AthleteToken: athleteToken,
          ...(athleteRecordId ? { Athlete: [athleteRecordId] } : {}),

          ...(orgResolved?.orgId ? { Organization: [orgResolved.orgId] } : {}),
          ...(orgResolved?.orgToken ? { OrgToken: orgResolved.orgToken } : {}),

          WorkoutItem: [workoutItemId],

          ...(attachment.length ? { Attachment: attachment } : {}),
          ...(attachmentSummary ? { AttachmentSummary: attachmentSummary } : {}),

          Status: completionStatus,
        },
      },
    ]);

    const wcId = created?.[0]?.id || "";

    await base("WorkoutItems").update([{ id: workoutItemId, fields: { Status: completionStatus } }]);

    let daily = { updated: false, status: "" };
    try {
      daily = await recomputeAndUpdateDailyWorkoutStatus({ base, dailyWorkoutId });
    } catch (e) {
      console.error("DailyWorkouts status recompute failed:", e);
    }

    return res.status(200).json({
      ok: true,
      workoutCompletionId: wcId,
      status: completionStatus,
      isVARA,
      attachmentUrl: uploaded?.url || "",
      dailyWorkoutStatus: daily?.status || "",
      noteReceived: Boolean(athleteNote),
      athleteTokenSent: athleteToken,
      athleteLinked: Boolean(athleteRecordId),
      orgLinked: Boolean(orgResolved?.orgId),
      orgTokenSet: Boolean(orgResolved?.orgToken),
      orgSource: orgResolved?.source || "",
    });
  } catch (e) {
    console.error("completeItem error:", e);
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}