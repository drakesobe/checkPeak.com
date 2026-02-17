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

function normBool(v) {
  return asString(v).toLowerCase() === "true";
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

/**
 * ✅ Support both requireAthlete shapes:
 * - auth wrapper: { ok, athlete, user, email, ... }
 * - athlete directly
 */
function unwrapAuth(maybe) {
  if (!maybe) return { ok: false, athlete: null, user: null, raw: null };

  // wrapper style
  if (typeof maybe === "object" && "ok" in maybe) {
    return {
      ok: Boolean(maybe.ok),
      athlete: maybe.athlete || null,
      user: maybe.user || null,
      raw: maybe,
    };
  }

  // athlete direct style
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

  const tok = asString(candidates.find((x) => asString(x)));
  return tok;
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
  try {
    json = await res.json();
  } catch {}

  if (!res.ok) {
    throw new Error(json?.error?.message || "Cloudinary upload failed");
  }

  return {
    url: json.secure_url || json.url,
    bytes: json.bytes,
    public_id: json.public_id,
  };
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

    // ✅ support either requireAthlete(req) or requireAthlete(req,res)
    let authRaw = null;
    try {
      authRaw = requireAthlete.length >= 2 ? await requireAthlete(req, res) : requireAthlete(req);
    } catch (e) {
      return res.status(401).json({ error: e?.message || "Unauthorized" });
    }

    // If your requireAthlete(req,res) already responded, stop
    if (res.writableEnded) return;

    const auth = unwrapAuth(authRaw);
    if (!auth.ok) {
      return res.status(401).json({ error: auth?.raw?.error || "Unauthorized" });
    }

    const { fields, files } = await parseMultipart(req);

    const workoutItemId = asString(fields.workoutItemId);
    const evidenceRequired = normBool(fields.evidenceRequired);
    const dailyWorkoutId = asString(fields.dailyWorkoutId);
    const athleteNote = asString(fields.athleteNote || fields.note || "");

    if (!workoutItemId) {
      return res.status(400).json({
        error: "Missing workoutItemId",
        debug: { fieldsKeys: Object.keys(fields || {}) },
      });
    }

    const athleteToken = mustAthleteToken({ athlete: auth.athlete, user: auth.user, raw: auth.raw, fields });
    if (!athleteToken) {
      return res.status(400).json({
        error:
          "Missing AthleteToken in session. Confirm AthleteScans.AthleteToken is populated, then log out/in.",
        debug: {
          athleteKeys: Object.keys(auth.athlete || {}),
          userKeys: Object.keys(auth.user || {}),
          rawKeys: Object.keys(auth.raw || {}),
          fieldsKeys: Object.keys(fields || {}),
          tokenSample: {
            athlete_AthleteToken: auth?.athlete?.AthleteToken,
            user_AthleteToken: auth?.user?.AthleteToken,
          },
        },
      });
    }

    const f = pickFirst(files?.file || files?.photo || files?.image);
    if (evidenceRequired && !f) {
      return res.status(400).json({
        error: "Photo required",
        debug: { evidenceRequired, filesKeys: Object.keys(files || {}) },
      });
    }

    // Upload to Cloudinary if file exists
    let uploaded = null;
    let attachment = [];
    let attachmentSummary = "";

    if (f) {
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
    const completionStatus = evidenceRequired ? "pending_review" : "completed";

    // Athlete record id (if present)
    const athleteRecordId = asString(auth?.athlete?.id || auth?.raw?.athlete?.id || "");

    // 1) Create WorkoutCompletions
    const created = await base("WorkoutCompletions").create([
      {
        fields: {
          CompletedAt: nowIso,
          AthleteToken: athleteToken,
          ...(athleteRecordId ? { Athlete: [athleteRecordId] } : {}),
          WorkoutItem: [workoutItemId],
          Attachment: attachment.length ? attachment : undefined,
          AttachmentSummary: attachmentSummary || undefined,
          Status: completionStatus,
          // If you add a field for athlete notes:
          // AthleteNote: athleteNote || undefined,
        },
      },
    ]);

    const wcId = created?.[0]?.id || "";

    // 2) Update WorkoutItems.Status
    await base("WorkoutItems").update([{ id: workoutItemId, fields: { Status: completionStatus } }]);

    // 3) Recompute + update DailyWorkouts.Status
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
      attachmentUrl: uploaded?.url || "",
      dailyWorkoutStatus: daily?.status || "",
      noteReceived: Boolean(athleteNote),
      athleteTokenSent: athleteToken,
      athleteLinked: Boolean(athleteRecordId),
    });
  } catch (e) {
    console.error("completeItem error:", e);
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
