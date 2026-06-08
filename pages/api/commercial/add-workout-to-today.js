// pages/api/commercial/add-workout-to-today.js
// Adds a published commercial workout to the athlete's Today page.
// Writes directly to DailyWorkouts + WorkoutItems tables using the same
// field mappings as /api/org/workouts/create — bypasses org auth entirely
// since this is an athlete-initiated action.

import { getRequestUser } from "@/lib/commercial/getRequestUser";
import { AT, base as getBase, F } from "@/lib/airtableOrgWorkoutConfig";

// ─── Field maps (mirrors /api/org/workouts/create) ────────────────────────────
const DW = {
  ORG:          F?.DW_ORG          || "Organization",
  ATHLETE:      F?.DW_ATHLETE      || "Athlete",
  DATE:         F?.DW_DATE         || "Date",
  TITLE:        F?.DW_TITLE        || "Title",
  STATUS:       F?.DW_STATUS       || "Status",
  ATHTOKEN:     F?.DW_ATHTOKEN     || "AthleteToken",
  WORKOUTITEMS: F?.DW_WORKOUTITEMS || "WorkoutItems",
};

const WI = {
  ORG:      F?.WI_ORG      || "Organization",
  DW:       F?.WI_DW       || "DailyWorkout",
  ORDER:    F?.WI_ORDER    || "Order",
  NAME:     F?.WI_NAME     || "ExerciseName",
  SETS:     F?.WI_SETS     || "Sets",
  REPS:     F?.WI_REPS     || "Reps",
  WEIGHT:   F?.WI_WEIGHT   || "Weight",
  REST:     F?.WI_REST     || "Rest",
  INSTR:    F?.WI_INSTR    || "Instructions",
  VIDEO:    F?.WI_VIDEO    || "VideoURL",
  EVIDENCE: F?.WI_EVIDENCE || "EvidenceRequired",
  ATHTOKEN: F?.WI_ATHTOKEN || "AthleteToken",
  GROUPID:  F?.WI_GROUPID  || "GroupId",
};

function toTrimmed(v) { return String(v ?? "").trim(); }
function toNumOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function chunk(arr, size = 10) {
  const out = [];
  for (let i = 0; i < (arr || []).length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).end();

  const user = getRequestUser(req);
  // Mobile fallback: cookie auth doesn't work in RN — accept athleteToken from body
  const mobileToken = String(
    req.body?.athleteToken ?? req.headers?.["x-athlete-token"] ?? ""
  ).trim();

  if (!user && !mobileToken) {
    return res.status(401).json({ ok: false, error: "Not logged in" });
  }

  const { workoutId } = req.body ?? {};
  if (!workoutId) return res.status(400).json({ ok: false, error: "Missing workoutId" });

  const email = user ? String(user.Email || user.email || "").trim().toLowerCase() : "";
  if (!email && !mobileToken) return res.status(400).json({ ok: false, error: "No email on account" });

  const b = getBase();

  // ── 1. Fetch commercial workout ───────────────────────────────────────────
  const { default: Airtable } = await import("airtable");
  const commercialBase = new Airtable({ apiKey: process.env.COMMERCIAL_TRAINERS_API_KEY })
    .base(process.env.COMMERCIAL_TRAINERS_BASE_ID);

  let workout;
  try {
    workout = await commercialBase(process.env.WORKOUT_PROGRAMS_TABLE_ID).find(workoutId);
  } catch (err) {
    console.error("[add-workout-to-today] find workout:", err?.message);
    return res.status(404).json({ ok: false, error: "Workout not found" });
  }

  if (!workout.fields.published) {
    return res.status(403).json({ ok: false, error: "Workout not available" });
  }

  // ── 2. Parse exercises ────────────────────────────────────────────────────
  let exercises = [];
  try { exercises = JSON.parse(workout.fields.exercises || "[]"); } catch {}

  const meaningful = exercises
    .filter(ex => toTrimmed(ex.ExerciseName))
    .map((ex, i) => ({
      order:            toNumOrNull(ex.Order) ?? i + 1,
      exerciseName:     toTrimmed(ex.ExerciseName),
      sets:             toNumOrNull(ex.Sets),
      reps:             toTrimmed(ex.Reps)   || null,
      weight:           toTrimmed(ex.Weight) || null,
      rest:             toTrimmed(ex.Rest)   || null,
      instructions:     toTrimmed(ex.Instructions) || null,
      videoUrl:         toTrimmed(ex.VideoURL) || null,
      evidenceRequired: "voluntary_activity_vara", // athlete-initiated
      groupId:          toTrimmed(ex.groupId) || null,
    }));

  // ── 3. Look up athlete by email → get recordId, token, orgId ─────────────
  const tokenField = F?.ATH_TOKEN || "AthleteToken";
  let athleteRecordId = null;
  let athleteToken    = null;
  let orgId           = null;

  try {
    const formula = email
      ? `LOWER({Email}) = "${email.replace(/"/g, '\\"')}"`
      : `{${tokenField}} = "${mobileToken.replace(/"/g, '\\"')}"`;

    const rows = await b(AT.tables.athletes)
      .select({ filterByFormula: formula, maxRecords: 1 })
      .firstPage();

    if (rows.length > 0) {
      const r = rows[0];
      athleteRecordId = r.id;
      athleteToken    = String(r.fields?.[tokenField] || "").trim();
      // Organization is a linked field — grab first linked record ID
      const orgField  = r.fields?.Organization || r.fields?.organization;
      orgId           = Array.isArray(orgField) ? orgField[0] : (orgField || null);
    }
  } catch (err) {
    console.error("[add-workout-to-today] athlete lookup:", err?.message);
  }

  if (!athleteRecordId || !athleteToken) {
    return res.status(400).json({
      ok:    false,
      error: "Your account isn't linked to an athlete profile. Ask your coach to add you to the org program.",
    });
  }

  if (!orgId) {
    return res.status(400).json({
      ok:    false,
      error: "Your athlete profile isn't linked to an organization.",
    });
  }

  if (!/^ATH-/i.test(athleteToken)) {
    return res.status(400).json({
      ok:    false,
      error: "Invalid athlete token format.",
    });
  }

  // ── 4. Create DailyWorkout record ─────────────────────────────────────────
  function nyDateISO() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find(p => p.type === "year")?.value;
  const m = parts.find(p => p.type === "month")?.value;
  const d = parts.find(p => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

const today = nyDateISO();

  let dailyWorkoutId;
  try {
    const dwFields = {
      [DW.ORG]:      [orgId],
      [DW.ATHLETE]:  [athleteRecordId],
      [DW.DATE]:     today,
      [DW.TITLE]:    String(workout.fields.title || "Workout"),
      [DW.STATUS]:   "assigned",
      [DW.ATHTOKEN]: athleteToken,
    };

    const created = await b(AT.tables.dailyWorkouts).create([{ fields: dwFields }]);
    dailyWorkoutId = created?.[0]?.id;
    if (!dailyWorkoutId) throw new Error("No id returned from DailyWorkouts create");
  } catch (err) {
    console.error("[add-workout-to-today] create DailyWorkout:", err?.message);
    return res.status(500).json({ ok: false, error: "Failed to create workout record" });
  }

  // ── 5. Create WorkoutItems ────────────────────────────────────────────────
  let workoutItemIds = [];
  if (meaningful.length > 0) {
    try {
      const itemCreates = meaningful.map((it, idx) => ({
        fields: {
          [WI.ORG]:      [orgId],
          [WI.DW]:       [dailyWorkoutId],
          [WI.ORDER]:    it.order ?? idx + 1,
          [WI.NAME]:     it.exerciseName,
          ...(it.sets !== null ? { [WI.SETS]: Number(it.sets) } : {}),
          ...(it.reps         ? { [WI.REPS]:   it.reps         } : {}),
          ...(it.weight       ? { [WI.WEIGHT]: it.weight       } : {}),
          ...(it.rest         ? { [WI.REST]:   it.rest         } : {}),
          ...(it.instructions ? { [WI.INSTR]:  it.instructions } : {}),
          ...(it.videoUrl     ? { [WI.VIDEO]:  it.videoUrl     } : {}),
          [WI.EVIDENCE]:   it.evidenceRequired,
          [WI.ATHTOKEN]:   athleteToken,
          ...(it.groupId && WI.GROUPID ? { [WI.GROUPID]: it.groupId } : {}),
        },
      }));

      for (const batch of chunk(itemCreates, 10)) {
        const created = await b(AT.tables.workoutItems).create(batch);
        (created || []).forEach(r => workoutItemIds.push(r.id));
      }

      // Link items back to the DailyWorkout
      if (workoutItemIds.length > 0) {
        await b(AT.tables.dailyWorkouts).update([{
          id:     dailyWorkoutId,
          fields: { [DW.WORKOUTITEMS]: workoutItemIds },
        }]);
      }
    } catch (err) {
      console.error("[add-workout-to-today] create WorkoutItems:", err?.message);
      // Workout was created — don't fail the whole request, just warn
    }
  }

  console.log("[add-workout-to-today] success:", { dailyWorkoutId, athleteToken, today, items: workoutItemIds.length });
  return res.json({ ok: true, dailyWorkoutId, itemCount: workoutItemIds.length });
}