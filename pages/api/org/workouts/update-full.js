// pages/api/org/workouts/update-full.js
// POST { id, ids?, title?, date?, status?, sport?, items? }

import { requireOrgSideUser } from "@/lib/requireUser";
import { AT, base, F } from "@/lib/airtableOrgWorkoutConfig";

function toTrimmed(v)   { return (v == null ? "" : String(v)).trim(); }
function toNumOrNull(v) { if (v == null || v === "") return null; const n = Number(v); return Number.isFinite(n) ? n : null; }
function chunk(arr, n=10) { const out=[]; for (let i=0; i<(arr||[]).length; i+=n) out.push(arr.slice(i,i+n)); return out; }
function assertNoUndefinedKeys(obj) {
  for (const k of Object.keys(obj || {})) {
    if (!k || k === "undefined") throw new Error("Airtable field mapping error: undefined key. Check F.* in airtableOrgWorkoutConfig.js");
  }
}

function normalizeStatus(v) {
  const s = String(v || "").trim().toLowerCase();

  if (!s) return "";
  if (s === "assigned") return "assigned";
  if (s === "complete" || s === "completed") return "completed";
  if (s === "reject" || s === "rejected") return "rejected";
  if (s === "pending" || s === "pending_review" || s === "pending review") return "pending_review";

  return s;
}

const VALID_STATUSES = ["assigned", "completed", "rejected", "pending_review"];
const VALID_SPORTS   = ["soccer", "basketball", "xc", "football", "track", "swim", "tennis", "hockey", "baseball", "softball"];

const DW = {
  ORG:          F?.DW_ORG          || "Organization",
  TITLE:        F?.DW_TITLE        || "Title",
  STATUS:       F?.DW_STATUS       || "Status",
  SPORT:        F?.DW_SPORT        || "Sport",
  DATE:         F?.DW_DATE         || "Date",
  WORKOUTITEMS: F?.DW_WORKOUTITEMS || "WorkoutItems",
  ATHTOKEN:     F?.DW_ATHTOKEN     || "AthleteToken",
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
};

async function deleteExistingItems(b, itemIds = []) {
  if (!itemIds.length) return;
  for (const batch of chunk(itemIds, 10)) {
    try { await b(AT.tables.workoutItems).destroy(batch); }
    catch (e) { console.warn("[update-full] item delete warning:", e?.message); }
  }
}

async function createWorkoutItems(b, { orgId, dailyWorkoutId, athleteToken, items }) {
  if (!Array.isArray(items) || !items.length) return [];
  const creates = items.map((it, idx) => {
    const fields = {
      [WI.ORG]:      [orgId],
      [WI.DW]:       [dailyWorkoutId],
      [WI.ORDER]:    Number.isFinite(Number(it.Order)) ? Number(it.Order) : idx + 1,
      [WI.NAME]:     toTrimmed(it.ExerciseName),
      ...(toNumOrNull(it.Sets) != null       ? { [WI.SETS]:   Number(it.Sets) }             : {}),
      ...(toTrimmed(it.Reps)                 ? { [WI.REPS]:   toTrimmed(it.Reps) }          : {}),
      ...(toTrimmed(it.Weight)               ? { [WI.WEIGHT]: toTrimmed(it.Weight) }        : {}),
      ...(toTrimmed(it.Rest)                 ? { [WI.REST]:   toTrimmed(it.Rest) }          : {}),
      ...(toTrimmed(it.Instructions)         ? { [WI.INSTR]:  toTrimmed(it.Instructions) }  : {}),
      ...(toTrimmed(it.VideoURL)             ? { [WI.VIDEO]:  toTrimmed(it.VideoURL) }      : {}),
      [WI.EVIDENCE]: it.EvidenceRequired || "none",
      ...(WI.ATHTOKEN && athleteToken ? { [WI.ATHTOKEN]: String(athleteToken) } : {}),
    };
    assertNoUndefinedKeys(fields);
    return { fields };
  });
  const created = [];
  for (const batch of chunk(creates, 10)) {
    const rows = await b(AT.tables.workoutItems).create(batch);
    (rows || []).forEach(r => created.push(r.id));
  }
  return created;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const { id, ids, title, date, status, sport, items } = req.body || {};

  if (!id || !String(id).trim()) return res.status(400).json({ error: "id is required" });

  const normalizedStatus = status !== undefined ? normalizeStatus(status) : undefined;

  if (normalizedStatus !== undefined && !VALID_STATUSES.includes(normalizedStatus))
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
  if (sport !== undefined && sport !== "" && !VALID_SPORTS.includes(String(sport).toLowerCase()))
    return res.status(400).json({ error: `sport must be one of: ${VALID_SPORTS.join(", ")}` });
  if (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(date).trim()))
    return res.status(400).json({ error: "date must be YYYY-MM-DD" });
  if (items !== undefined && !Array.isArray(items))
    return res.status(400).json({ error: "items must be an array" });

  const orgId = user.orgId;
  if (!orgId) return res.status(400).json({ error: "Missing orgId on session." });

  const primaryId  = String(id).trim();
  const allIds     = Array.isArray(ids) && ids.length
    ? [...new Set([primaryId, ...ids.map(x => String(x).trim()).filter(Boolean)])]
    : [primaryId];

  try {
    const b = base();
    const table = AT.tables.dailyWorkouts;

    const primary = await b(table).find(primaryId);
    const pf = primary?.fields || {};
    const recordOrgId = (pf[DW.ORG] || [])[0] || pf.OrgId || pf.orgId || "";
    if (recordOrgId && String(recordOrgId) !== String(orgId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const scalarPatch = {};
    if (title  !== undefined) scalarPatch[DW.TITLE]  = toTrimmed(title) || "Daily Workout";
    if (date   !== undefined) scalarPatch[DW.DATE]   = String(date).trim();
    if (status !== undefined) scalarPatch[DW.STATUS] = normalizedStatus;
    if (sport  !== undefined) scalarPatch[DW.SPORT]  = String(sport).toLowerCase();

    if (Object.keys(scalarPatch).length) {
      assertNoUndefinedKeys(scalarPatch);
      for (const batch of chunk(allIds, 10)) {
        const updates = batch.map(rid => ({ id: rid, fields: scalarPatch }));
        await b(table).update(updates);
      }
    }

    let newItemIds = null;
    if (Array.isArray(items)) {
      const existingItemIds = (pf[DW.WORKOUTITEMS] || []).filter(Boolean);
      await deleteExistingItems(b, existingItemIds);

      const athleteToken = pf[DW.ATHTOKEN] || pf.AthleteToken || "";
      const meaningful   = items.filter(it => toTrimmed(it?.ExerciseName));

      if (meaningful.length) {
        newItemIds = await createWorkoutItems(b, {
          orgId,
          dailyWorkoutId: primaryId,
          athleteToken,
          items: meaningful,
        });
        const linkPatch = { [DW.WORKOUTITEMS]: newItemIds };
        assertNoUndefinedKeys(linkPatch);
        await b(table).update([{ id: primaryId, fields: linkPatch }]);
      } else {
        assertNoUndefinedKeys({ [DW.WORKOUTITEMS]: [] });
        await b(table).update([{ id: primaryId, fields: { [DW.WORKOUTITEMS]: [] } }]);
        newItemIds = [];
      }
    }

    return res.status(200).json({
      ok:            true,
      id:            primaryId,
      updatedIds:    allIds,
      updatedFields: Object.keys(scalarPatch),
      itemsReplaced: Array.isArray(items),
      newItemCount:  newItemIds?.length ?? null,
    });

  } catch (e) {
    console.error("[workouts/update-full]", e?.message || e);
    if (e?.statusCode === 404 || String(e?.message || "").includes("not found"))
      return res.status(404).json({ error: "Workout not found" });
    return res.status(500).json({ error: e?.message || "Failed to update workout" });
  }
}