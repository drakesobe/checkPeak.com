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

// Prefer your config mappings; fallback to literal Airtable column names
const DW = {
  ORG: F?.DW_ORG || "Organization",
  ATHLETE: F?.DW_ATHLETE || "Athlete",
  DATE: F?.DW_DATE || "Date",
  TITLE: F?.DW_TITLE || "Title",
  STATUS: F?.DW_STATUS || "Status",
  SPORT: F?.DW_SPORT || "Sport",
  CREATEDBY: F?.DW_CREATEDBY || "CreatedBy",
};

const WI = {
  ORG: F?.WI_ORG || "Organization",
  DW: F?.WI_DW || "DailyWorkout",
  ORDER: F?.WI_ORDER || "Order",
  NAME: F?.WI_NAME || "ExerciseName",
  SETS: F?.WI_SETS || "Sets",
  REPS: F?.WI_REPS || "Reps",
  WEIGHT: F?.WI_WEIGHT || "Weight",
  REST: F?.WI_REST || "Rest",
  INSTR: F?.WI_INSTR || "Instructions",
  VIDEO: F?.WI_VIDEO || "VideoURL",
  EVIDENCE: F?.WI_EVIDENCE || "EvidenceRequired",
};

function assertNoUndefinedFieldKeys(fieldObj) {
  // Prevent Airtable "Unknown field name: undefined"
  for (const k of Object.keys(fieldObj || {})) {
    if (!k || k === "undefined") {
      throw new Error(
        `Airtable field mapping error: attempted to write to an undefined field key. Check airtableOrgWorkoutConfig.js mappings (F.*).`
      );
    }
  }
}

function getMissingMappings() {
  // These are the mappings you *expect* to exist if you're relying on config
  const requiredKeys = [
    "DW_ORG",
    "DW_ATHLETE",
    "DW_DATE",
    "DW_TITLE",
    "DW_STATUS",
    "DW_CREATEDBY",
    // DW_SPORT is optional but recommended
    "WI_ORG",
    "WI_DW",
    "WI_ORDER",
    "WI_NAME",
    "WI_SETS",
    "WI_REPS",
    "WI_WEIGHT",
    "WI_REST",
    "WI_INSTR",
    "WI_VIDEO",
    "WI_EVIDENCE",
  ];

  const missing = requiredKeys.filter((k) => typeof F?.[k] === "undefined");
  return missing;
}

// Map either payload style into normalized items that match Airtable columns
function normalizeItem(it = {}, idx = 0) {
  // New (Airtable-ish) keys
  const Order = toNumOrNull(it?.Order);
  const ExerciseName = toTrimmed(it?.ExerciseName);
  const Sets = toNumOrNull(it?.Sets);
  const Reps = toTrimmed(it?.Reps);
  const Weight = toTrimmed(it?.Weight);
  const Rest = toTrimmed(it?.Rest);
  const Instructions = toTrimmed(it?.Instructions);
  const VideoURL = toTrimmed(it?.VideoURL);
  const EvidenceRequired = toTrimmed(it?.EvidenceRequired);

  // Legacy keys (camelCase)
  const order = toNumOrNull(it?.order);
  const exerciseName = toTrimmed(it?.exerciseName) || toTrimmed(it?.name);
  const sets = toNumOrNull(it?.sets);
  const reps = toTrimmed(it?.reps);
  const weight = toTrimmed(it?.weight) || toTrimmed(it?.load); // tolerate old "load"
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

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  try {
    const { athleteId, athleteIds, date, title, sport, status, items = [] } = req.body || {};

    const finalAthleteIds = Array.isArray(athleteIds)
      ? athleteIds.filter(Boolean).map(String)
      : athleteId
      ? [String(athleteId)]
      : [];

    if (!finalAthleteIds.length) {
      return res.status(400).json({ error: "athleteId or athleteIds[] is required." });
    }

    if (!date) return res.status(400).json({ error: "date is required (YYYY-MM-DD)." });

    // items optional
    if (items && !Array.isArray(items)) {
      return res.status(400).json({ error: "items must be an array if provided." });
    }

    // If you're expecting config mappings, help yourself debug quickly:
    const missing = getMissingMappings();
    // We do NOT hard-fail because we have fallbacks, but we include debug in response on error.
    const b = base();

    const orgId = user.orgId;
    const memberId = user.memberId;

    if (!orgId) return res.status(400).json({ error: "Missing orgId on session user." });
    if (!memberId) return res.status(400).json({ error: "Missing memberId on session user. Re-login." });

    // 1) Create DailyWorkout
    const dailyWorkoutFields = {
      [DW.ORG]: [orgId],
      [DW.ATHLETE]: finalAthleteIds,
      [DW.DATE]: String(date).slice(0, 10),
      [DW.TITLE]: String(title || "Daily Workout"),
      [DW.STATUS]: String(status || "assigned"),
      ...(sport ? { [DW.SPORT]: String(sport) } : {}),
      [DW.CREATEDBY]: [memberId],
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
      });
    }

    const itemCreates = meaningful.map((it, idx) => {
      const fields = {
        [WI.ORG]: [orgId],
        [WI.DW]: [dailyWorkoutId],
        [WI.ORDER]: Number.isFinite(Number(it.order)) ? Number(it.order) : idx + 1,
        [WI.NAME]: toTrimmed(it.exerciseName),
        ...(it.sets !== null ? { [WI.SETS]: Number(it.sets) } : {}),
        ...(toTrimmed(it.reps) ? { [WI.REPS]: toTrimmed(it.reps) } : {}),
        ...(toTrimmed(it.weight) ? { [WI.WEIGHT]: toTrimmed(it.weight) } : {}),
        ...(toTrimmed(it.rest) ? { [WI.REST]: toTrimmed(it.rest) } : {}),
        ...(toTrimmed(it.instructions) ? { [WI.INSTR]: toTrimmed(it.instructions) } : {}),
        ...(toTrimmed(it.videoUrl) ? { [WI.VIDEO]: toTrimmed(it.videoUrl) } : {}),
        [WI.EVIDENCE]: it.evidenceRequired || "none",
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
    });
  } catch (err) {
    console.error("[org/workouts/create] error:", err);

    // Help debug mapping problems quickly:
    const missing = getMissingMappings();

    return res.status(500).json({
      error: "Failed to create workout",
      details: err?.message || String(err),
      debug: {
        missingFieldMappings: missing,
        // if missingFieldMappings includes WI_WEIGHT, that's the most common cause of "undefined"
        hint:
          missing.length > 0
            ? "One or more F.* mappings are undefined in airtableOrgWorkoutConfig.js. Add the missing keys or rely on the literal fallback names."
            : "If all mappings exist, then one of the mapped names may not match the Airtable column name exactly.",
      },
    });
  }
}
