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
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
function looksLikeAirtableRecordId(v) {
  const s = String(v || "").trim();
  return s.startsWith("rec") && s.length >= 10;
}
function isAthleteToken(v) {
  return /^ATH-/i.test(String(v || "").trim());
}

function assertNoUndefinedFieldKeys(fieldObj) {
  for (const k of Object.keys(fieldObj || {})) {
    if (!k || k === "undefined") {
      throw new Error(
        `Airtable field mapping error: attempted to write to an undefined field key. Check airtableOrgWorkoutConfig.js mappings (F.*).`
      );
    }
  }
}

/** Field mappings */
const DW = {
  ORG: F?.DW_ORG || "Organization",
  ATHLETE: F?.DW_ATHLETE || "Athlete",
  DATE: F?.DW_DATE || "Date",
  TITLE: F?.DW_TITLE || "Title",
  STATUS: F?.DW_STATUS || "Status",
  SPORT: F?.DW_SPORT || "Sport",
  CREATEDBY: F?.DW_CREATEDBY || "CreatedBy",
  ATHTOKEN: F?.DW_ATHTOKEN || "AthleteToken",

  // ✅ this MUST exist on DailyWorkouts (link to WorkoutItems)
  WORKOUTITEMS: F?.DW_WORKOUTITEMS || "WorkoutItems",
};

const WI = {
  ORG: F?.WI_ORG || "Organization",
  DW: F?.WI_DW || "DailyWorkout", // link -> DailyWorkouts (optional but fine to keep)
  ORDER: F?.WI_ORDER || "Order",
  NAME: F?.WI_NAME || "ExerciseName",
  SETS: F?.WI_SETS || "Sets",
  REPS: F?.WI_REPS || "Reps",
  WEIGHT: F?.WI_WEIGHT || "Weight",
  REST: F?.WI_REST || "Rest",
  INSTR: F?.WI_INSTR || "Instructions",
  VIDEO: F?.WI_VIDEO || "VideoURL",
  EVIDENCE: F?.WI_EVIDENCE || "EvidenceRequired",
  ATHTOKEN: F?.WI_ATHTOKEN || "AthleteToken",
  GROUPID:  F?.WI_GROUPID  || "GroupId",
};

function normalizeItem(it = {}, idx = 0) {
  const out = {
    order: toNumOrNull(it?.Order) ?? toNumOrNull(it?.order) ?? idx + 1,
    exerciseName: toTrimmed(it?.ExerciseName) || toTrimmed(it?.exerciseName) || toTrimmed(it?.name),
    sets: toNumOrNull(it?.Sets) ?? toNumOrNull(it?.sets),
    reps: toTrimmed(it?.Reps) || toTrimmed(it?.reps),
    weight: toTrimmed(it?.Weight) || toTrimmed(it?.weight),
    rest: toTrimmed(it?.Rest) || toTrimmed(it?.rest),
    instructions: toTrimmed(it?.Instructions) || toTrimmed(it?.instructions) || toTrimmed(it?.notes),
    videoUrl: toTrimmed(it?.VideoURL) || toTrimmed(it?.videoUrl),
    evidenceRequired: toTrimmed(it?.EvidenceRequired) || toTrimmed(it?.evidenceRequired) || "none",
    groupId:          toTrimmed(it?.groupId) || null,
  };

  const allowed = new Set(["none", "photo", "video", "photo_or_video", "voluntary_activity_vara"]);
  if (!allowed.has(out.evidenceRequired)) out.evidenceRequired = "none";
  return out;
}

async function resolveAthletes(b, incoming = []) {
  const raw = (incoming || []).map((x) => String(x || "").trim()).filter(Boolean);
  const recordIds = raw.filter(looksLikeAirtableRecordId);
  const tokens = raw.filter((x) => !looksLikeAirtableRecordId(x));

  const Athletes = b(AT.tables.athletes);
  const tokenField = F?.ATH_TOKEN || "AthleteToken";

  const found = [];

  // tokens -> records
  if (tokens.length) {
    for (const tkChunk of chunk(tokens, 30)) {
      const orParts = tkChunk.map((t) => `{${tokenField}}='${escapeAirtableString(t)}'`).join(",");
      const rows = await Athletes.select({
        filterByFormula: `OR(${orParts})`,
        maxRecords: 100,
      }).firstPage();

      for (const r of rows || []) {
        const t = String(r?.fields?.[tokenField] || "").trim();
        found.push({ athleteRecordId: r.id, athleteToken: t });
      }
    }
  }

  // recordIds -> token
  if (recordIds.length) {
    for (const ids of chunk(recordIds, 50)) {
      const orParts = ids.map((id) => `RECORD_ID()='${escapeAirtableString(id)}'`).join(",");
      const rows = await Athletes.select({
        filterByFormula: `OR(${orParts})`,
        maxRecords: 100,
      }).firstPage();

      for (const r of rows || []) {
        const t = String(r?.fields?.[tokenField] || "").trim();
        found.push({ athleteRecordId: r.id, athleteToken: t });
      }
    }
  }

  // de-dupe by recordId
  const map = new Map();
  for (const a of found) {
    if (!a?.athleteRecordId) continue;
    const prev = map.get(a.athleteRecordId);
    if (!prev || (!prev.athleteToken && a.athleteToken)) map.set(a.athleteRecordId, a);
  }

  return Array.from(map.values());
}

async function createWorkoutItems(b, { orgId, dailyWorkoutId, athleteToken, items }) {
  if (!Array.isArray(items) || !items.length) return [];

  const itemCreates = items.map((it, idx) => {
    const fields = {
      [WI.ORG]: [orgId],

      // Optional but OK to keep:
      [WI.DW]: [dailyWorkoutId],

      [WI.ORDER]: Number.isFinite(Number(it.order)) ? Number(it.order) : idx + 1,
      [WI.NAME]: toTrimmed(it.exerciseName),
      ...(it.sets !== null && typeof it.sets !== "undefined" ? { [WI.SETS]: Number(it.sets) } : {}),
      ...(toTrimmed(it.reps) ? { [WI.REPS]: toTrimmed(it.reps) } : {}),
      ...(toTrimmed(it.weight) ? { [WI.WEIGHT]: toTrimmed(it.weight) } : {}),
      ...(toTrimmed(it.rest) ? { [WI.REST]: toTrimmed(it.rest) } : {}),
      ...(toTrimmed(it.instructions) ? { [WI.INSTR]: toTrimmed(it.instructions) } : {}),
      ...(toTrimmed(it.videoUrl) ? { [WI.VIDEO]: toTrimmed(it.videoUrl) } : {}),
      [WI.EVIDENCE]: it.evidenceRequired || "none",
      ...(WI.ATHTOKEN ? { [WI.ATHTOKEN]: String(athleteToken) } : {}),
      ...(it.groupId && WI.GROUPID ? { [WI.GROUPID]: String(it.groupId) } : {}),
    };

    assertNoUndefinedFieldKeys(fields);
    return { fields };
  });

  const createdAll = [];
  for (const batch of chunk(itemCreates, 10)) {
    const created = await b(AT.tables.workoutItems).create(batch);
    (created || []).forEach((r) => createdAll.push(r));
  }

  return createdAll.map((r) => r.id);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  try {
    const { athleteId, athleteIds, date, dates, title, sport, status, items = [] } = req.body || {};

    // Support multi-date creation: dates[] takes priority over single date
    const allDates = Array.isArray(dates) && dates.length
      ? dates.map(d => String(d).slice(0, 10)).filter(Boolean)
      : date
        ? [String(date).slice(0, 10)]
        : [];

    if (!allDates.length) return res.status(400).json({ error: "date or dates[] is required." });

    const incomingAthletes = Array.isArray(athleteIds)
      ? athleteIds.filter(Boolean)
      : athleteId
      ? [athleteId]
      : [];

    if (!incomingAthletes.length) return res.status(400).json({ error: "athleteId or athleteIds[] is required." });
    if (!date) return res.status(400).json({ error: "date is required (YYYY-MM-DD)." });
    if (items && !Array.isArray(items)) return res.status(400).json({ error: "items must be an array if provided." });

    const b = base();
    const orgId = user.orgId;
    const memberId = user.memberId;

    if (!orgId) return res.status(400).json({ error: "Missing orgId on session user." });
    if (!memberId) return res.status(400).json({ error: "Missing memberId on session user. Re-login." });

    const normalized = (Array.isArray(items) ? items : []).map((it, idx) => normalizeItem(it, idx));
    const meaningful = normalized.filter((it) => toTrimmed(it.exerciseName));

    const resolved = await resolveAthletes(b, incomingAthletes);
    const usable = resolved.filter((a) => a.athleteToken && isAthleteToken(a.athleteToken));

    if (!usable.length) {
      return res.status(400).json({
        error: "No selected athletes have a valid AthleteToken (ATH-XXXX) in the Athletes table.",
        debug: { incomingAthletes, resolved, tokenField: F?.ATH_TOKEN || "AthleteToken" },
      });
    }

    const createdDailyWorkouts = [];

    // ✅ One DailyWorkout per athlete (best for token matching)
    for (const a of usable) {
      const createdDailyWorkouts = [];

for (const targetDate of allDates) {
  for (const a of usable) {
    const dailyWorkoutFields = {
      [DW.ORG]:      [orgId],
      [DW.ATHLETE]:  [a.athleteRecordId],
      [DW.DATE]:     targetDate,       // ← use targetDate not date
      [DW.TITLE]:    String(title || "Daily Workout"),
      [DW.STATUS]:   String(status || "assigned"),
      ...(sport ? { [DW.SPORT]: String(sport) } : {}),
      [DW.CREATEDBY]: [memberId],
      [DW.ATHTOKEN]:  String(a.athleteToken),
    };

      assertNoUndefinedFieldKeys(dailyWorkoutFields);

      const createdDW = await b(AT.tables.dailyWorkouts).create([{ fields: dailyWorkoutFields }]);
      const dailyWorkoutId = createdDW?.[0]?.id;
      if (!dailyWorkoutId) throw new Error("Failed to create DailyWorkout (missing id).");

      // ✅ Create WorkoutItems rows
      let workoutItemIds = [];
      if (meaningful.length) {
        workoutItemIds = await createWorkoutItems(b, {
          orgId,
          dailyWorkoutId,
          athleteToken: a.athleteToken,
          items: meaningful,
        });

        // ✅ CRITICAL: write link field on DailyWorkouts -> WorkoutItems
        // This is what your athlete API/UI expects.
        if (workoutItemIds.length) {
          const patch = { [DW.WORKOUTITEMS]: workoutItemIds };
          assertNoUndefinedFieldKeys(patch);
          await b(AT.tables.dailyWorkouts).update([{ id: dailyWorkoutId, fields: patch }]);
        }
      }

      createdDailyWorkouts.push({
        dailyWorkoutId,
        athleteRecordId: a.athleteRecordId,
        athleteToken: a.athleteToken,
        workoutItemIds,
        createdItemCount: workoutItemIds.length,
      });
    }

    }

    }

    return res.status(200).json({
      ok: true,
      createdDailyWorkouts,
      warning:
        meaningful.length === 0
          ? "No workout items were created because no items had ExerciseName filled in."
          : null,
    });
  } catch (err) {
    console.error("[org/workouts/create] error:", err);
    return res.status(500).json({
      error: "Failed to create workout",
      details: err?.message || String(err),
    });
  }
}
