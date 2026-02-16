// pages/api/org/workouts/create.js
import { requireOrgSideUser } from "@/lib/requireUser";
import { AT, base, F } from "@/lib/airtableOrgWorkoutConfig";

function toStr(v) {
  if (v === null || typeof v === "undefined") return "";
  return String(v);
}
function toTrimmed(v) {
  return toStr(v).trim();
}
function toNumOrNull(v) {
  if (v === null || typeof v === "undefined" || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function chunk(arr, size = 10) {
  const out = [];
  for (let i = 0; i < (arr || []).length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
function escapeAirtableString(str = "") {
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}
function looksLikeAirtableRecordId(v) {
  const s = String(v || "").trim();
  return s.startsWith("rec") && s.length >= 10;
}

/** Field mappings (prefer config, fallback to literal column names) */
const DW = {
  ORG: F?.DW_ORG || "Organization",
  ATHLETE: F?.DW_ATHLETE || "Athlete", // Link -> Athletes (org base)
  DATE: F?.DW_DATE || "Date",
  TITLE: F?.DW_TITLE || "Title",
  STATUS: F?.DW_STATUS || "Status",
  SPORT: F?.DW_SPORT || "Sport",
  CREATEDBY: F?.DW_CREATEDBY || "CreatedBy",

  // ✅ Token mirror for token-first athlete APIs
  ATHTOKEN: F?.DW_ATHTOKEN || "AthleteToken",
};

const WI = {
  ORG: F?.WI_ORG || "Organization",
  DW: F?.WI_DW || "DailyWorkout", // Link -> DailyWorkouts
  ORDER: F?.WI_ORDER || "Order",
  NAME: F?.WI_NAME || "ExerciseName",
  SETS: F?.WI_SETS || "Sets",
  REPS: F?.WI_REPS || "Reps",
  WEIGHT: F?.WI_WEIGHT || "Weight",
  REST: F?.WI_REST || "Rest",
  INSTR: F?.WI_INSTR || "Instructions",
  VIDEO: F?.WI_VIDEO || "VideoURL",
  EVIDENCE: F?.WI_EVIDENCE || "EvidenceRequired",

  // Optional mirror token on items (nice for debugging / filtering)
  ATHTOKEN: F?.WI_ATHTOKEN || "AthleteToken",
};

function assertNoUndefinedFieldKeys(fieldObj) {
  for (const k of Object.keys(fieldObj || {})) {
    if (!k || k === "undefined") {
      throw new Error(
        `Airtable field mapping error: attempted to write to an undefined field key. Check airtableOrgWorkoutConfig.js mappings (F.*).`
      );
    }
  }
}

// Map payload item into normalized item
function normalizeItem(it = {}, idx = 0) {
  const Order = toNumOrNull(it?.Order);
  const ExerciseName = toTrimmed(it?.ExerciseName);
  const Sets = toNumOrNull(it?.Sets);
  const Reps = toTrimmed(it?.Reps);
  const Weight = toTrimmed(it?.Weight);
  const Rest = toTrimmed(it?.Rest);
  const Instructions = toTrimmed(it?.Instructions);
  const VideoURL = toTrimmed(it?.VideoURL);
  const EvidenceRequired = toTrimmed(it?.EvidenceRequired);

  const order = toNumOrNull(it?.order);
  const exerciseName = toTrimmed(it?.exerciseName) || toTrimmed(it?.name);
  const sets = toNumOrNull(it?.sets);
  const reps = toTrimmed(it?.reps);
  const weight = toTrimmed(it?.weight) || toTrimmed(it?.load);
  const rest = toTrimmed(it?.rest);
  const instructions = toTrimmed(it?.instructions) || toTrimmed(it?.notes);
  const videoUrl = toTrimmed(it?.videoUrl);
  const evidenceRequired = toTrimmed(it?.evidenceRequired);

  const out = {
    order: Order ?? order ?? idx + 1,
    exerciseName: ExerciseName || exerciseName,
    sets: Sets ?? sets,
    reps: Reps || reps,
    weight: Weight || weight,
    rest: Rest || rest,
    instructions: Instructions || instructions,
    videoUrl: VideoURL || videoUrl,
    evidenceRequired: EvidenceRequired || evidenceRequired || "none",
  };

  const allowed = new Set(["none", "photo", "video", "photo_or_video"]);
  if (!allowed.has(out.evidenceRequired)) out.evidenceRequired = "none";

  return out;
}

/**
 * Resolve incoming athlete identifiers to org-base Athletes record IDs.
 * Accepts:
 * - "rec..." (already record IDs) OR
 * - AthleteToken strings (preferred)
 */
async function resolveAthleteRecordIdsAndTokens(b, incoming = []) {
  const raw = (incoming || []).map((x) => String(x || "").trim()).filter(Boolean);

  const recordIds = raw.filter(looksLikeAirtableRecordId);
  const tokens = raw.filter((x) => !looksLikeAirtableRecordId(x));

  const Athletes = b(AT.tables.athletes);

  let resolvedIds = [...recordIds];
  let resolvedTokens = [...tokens];

  if (tokens.length) {
    // Athletes token field is literally "AthleteToken"
    const tokenField = F?.ATH_TOKEN || "AthleteToken";

    // Query in chunks to keep formula length safe
    const tokenChunks = chunk(tokens, 30);

    const foundByToken = [];
    for (const tkChunk of tokenChunks) {
      const orParts = tkChunk
        .map((t) => `{${tokenField}}='${escapeAirtableString(t)}'`)
        .join(",");
      const formula = `OR(${orParts})`;

      const rows = await Athletes.select({
        filterByFormula: formula,
        maxRecords: 50,
      }).firstPage();

      (rows || []).forEach((r) => foundByToken.push(r));
    }

    const foundIds = foundByToken.map((r) => r.id);
    resolvedIds = Array.from(new Set([...resolvedIds, ...foundIds]));

    // If caller passed record IDs only, derive tokens for mirroring if possible
    // (optional; not required to create)
    if (!resolvedTokens.length && recordIds.length) {
      // attempt to fetch those athlete records to read AthleteToken
      const idChunks = chunk(recordIds, 50);
      const recs = [];
      for (const ids of idChunks) {
        const orParts = ids.map((id) => `RECORD_ID()='${escapeAirtableString(id)}'`).join(",");
        const formula = `OR(${orParts})`;
        const rows = await Athletes.select({ filterByFormula: formula, maxRecords: 50 }).firstPage();
        recs.push(...(rows || []));
      }
      resolvedTokens = recs
        .map((r) => String(r?.fields?.[tokenField] || "").trim())
        .filter(Boolean);
    }
  }

  // If they provided recordIds but no tokens, we can still create the workout.
  // Token mirroring is best-effort.
  resolvedTokens = Array.from(new Set(resolvedTokens));

  return { athleteRecordIds: resolvedIds, athleteTokens: resolvedTokens };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  try {
    const { athleteId, athleteIds, date, title, sport, status, items = [] } = req.body || {};

    const incomingAthletes = Array.isArray(athleteIds)
      ? athleteIds.filter(Boolean)
      : athleteId
      ? [athleteId]
      : [];

    if (!incomingAthletes.length) {
      return res.status(400).json({ error: "athleteId or athleteIds[] is required." });
    }

    if (!date) return res.status(400).json({ error: "date is required (YYYY-MM-DD)." });

    if (items && !Array.isArray(items)) {
      return res.status(400).json({ error: "items must be an array if provided." });
    }

    const b = base();

    const orgId = user.orgId;
    const memberId = user.memberId;

    if (!orgId) return res.status(400).json({ error: "Missing orgId on session user." });
    if (!memberId) return res.status(400).json({ error: "Missing memberId on session user. Re-login." });

    // ✅ Resolve AthleteToken(s) -> org-base Athletes record IDs
    const { athleteRecordIds, athleteTokens } = await resolveAthleteRecordIdsAndTokens(
      b,
      incomingAthletes
    );

    if (!athleteRecordIds.length) {
      return res.status(400).json({
        error: "Could not resolve athletes to Org Athletes record IDs.",
        hint:
          "Send AthleteToken(s) (preferred) or Athletes record IDs (rec...). Ensure org-base Athletes table contains AthleteToken values.",
        debug: {
          incomingAthletes,
          athletesTable: AT.tables.athletes,
          tokenField: F?.ATH_TOKEN || "AthleteToken",
        },
      });
    }

    // ✅ Decide what token to mirror onto the workout.
    // If multiple athletes are assigned to one DailyWorkout (not recommended),
    // we store a comma-joined token list.
    const tokenMirror =
      athleteTokens.length > 1
        ? athleteTokens.join(",")
        : athleteTokens.length === 1
        ? athleteTokens[0]
        : ""; // best-effort

    // 1) Create DailyWorkout (drives assignment)
    const dailyWorkoutFields = {
      [DW.ORG]: [orgId],
      [DW.ATHLETE]: athleteRecordIds, // ✅ must be Athletes record IDs
      [DW.DATE]: String(date).slice(0, 10),
      [DW.TITLE]: String(title || "Daily Workout"),
      [DW.STATUS]: String(status || "assigned"),
      ...(sport ? { [DW.SPORT]: String(sport) } : {}),
      [DW.CREATEDBY]: [memberId],
      ...(tokenMirror ? { [DW.ATHTOKEN]: tokenMirror } : {}),
    };

    assertNoUndefinedFieldKeys(dailyWorkoutFields);

    const createdDW = await b(AT.tables.dailyWorkouts).create([{ fields: dailyWorkoutFields }]);

    const dailyWorkoutId = createdDW?.[0]?.id;
    if (!dailyWorkoutId) {
      return res.status(500).json({ error: "Failed to create DailyWorkout (missing id)." });
    }

    // 2) Create WorkoutItems (optional)
    const rawItems = Array.isArray(items) ? items : [];
    const normalized = rawItems.map((it, idx) => normalizeItem(it, idx));
    const meaningful = normalized.filter((it) => toTrimmed(it.exerciseName));

    if (!meaningful.length) {
      return res.status(200).json({
        ok: true,
        dailyWorkoutId,
        workoutItemIds: [],
        debug: { athleteRecordIds, tokenMirror },
      });
    }

    const itemCreates = meaningful.map((it, idx) => {
      const fields = {
        [WI.ORG]: [orgId],
        [WI.DW]: [dailyWorkoutId], // ✅ link to DailyWorkouts
        [WI.ORDER]: Number.isFinite(Number(it.order)) ? Number(it.order) : idx + 1,
        [WI.NAME]: toTrimmed(it.exerciseName),
        ...(it.sets !== null ? { [WI.SETS]: Number(it.sets) } : {}),
        ...(toTrimmed(it.reps) ? { [WI.REPS]: toTrimmed(it.reps) } : {}),
        ...(toTrimmed(it.weight) ? { [WI.WEIGHT]: toTrimmed(it.weight) } : {}),
        ...(toTrimmed(it.rest) ? { [WI.REST]: toTrimmed(it.rest) } : {}),
        ...(toTrimmed(it.instructions) ? { [WI.INSTR]: toTrimmed(it.instructions) } : {}),
        ...(toTrimmed(it.videoUrl) ? { [WI.VIDEO]: toTrimmed(it.videoUrl) } : {}),
        [WI.EVIDENCE]: it.evidenceRequired || "none",
        ...(tokenMirror ? { [WI.ATHTOKEN]: tokenMirror } : {}),
      };

      assertNoUndefinedFieldKeys(fields);
      return { fields };
    });

    const batches = chunk(itemCreates, 10);
    const createdAll = [];

    for (const batch of batches) {
      const created = await b(AT.tables.workoutItems).create(batch);
      (created || []).forEach((r) => createdAll.push(r));
    }

    return res.status(200).json({
      ok: true,
      dailyWorkoutId,
      workoutItemIds: createdAll.map((r) => r.id),
      debug: {
        athleteRecordIds,
        tokenMirror,
        createdItems: createdAll.length,
      },
    });
  } catch (err) {
    console.error("[org/workouts/create] error:", err);
    return res.status(500).json({
      error: "Failed to create workout",
      details: err?.message || String(err),
    });
  }
}
