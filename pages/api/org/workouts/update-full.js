// pages/api/org/workouts/update-full.js
// POST { id, ids?, title?, date?, status?, sport?, items?, athleteIds? }

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
  ATHLETE:      F?.DW_ATHLETE      || "Athlete",
  TITLE:        F?.DW_TITLE        || "Title",
  STATUS:       F?.DW_STATUS       || "Status",
  SPORT:        F?.DW_SPORT        || "Sport",
  DATE:         F?.DW_DATE         || "Date",
  WORKOUTITEMS: F?.DW_WORKOUTITEMS || "WorkoutItems",
  ATHTOKEN:     F?.DW_ATHTOKEN     || "AthleteToken",
  SCHEDTIME: F?.DW_SCHEDTIME || "ScheduleTime",
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

async function resolveAthletes(b, incoming = []) {
  const raw        = (incoming || []).map(x => String(x || "").trim()).filter(Boolean);
  const recordIds  = raw.filter(looksLikeAirtableRecordId);
  const tokens     = raw.filter(x => !looksLikeAirtableRecordId(x));
  const tokenField = F?.ATH_TOKEN || "AthleteToken";
  const Athletes   = b(AT.tables.athletes);
  const found      = [];

  if (tokens.length) {
    for (const tkChunk of chunk(tokens, 30)) {
      const orParts = tkChunk.map(t => `{${tokenField}}='${escapeAirtableString(t)}'`).join(",");
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

  if (recordIds.length) {
    for (const ids of chunk(recordIds, 50)) {
      const orParts = ids.map(id => `RECORD_ID()='${escapeAirtableString(id)}'`).join(",");
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

  const map = new Map();
  for (const a of found) {
    if (!a?.athleteRecordId) continue;
    const prev = map.get(a.athleteRecordId);
    if (!prev || (!prev.athleteToken && a.athleteToken)) map.set(a.athleteRecordId, a);
  }
  return Array.from(map.values());
}

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
      ...(toNumOrNull(it.Sets) != null   ? { [WI.SETS]:   Number(it.Sets) }            : {}),
      ...(toTrimmed(it.Reps)             ? { [WI.REPS]:   toTrimmed(it.Reps) }         : {}),
      ...(toTrimmed(it.Weight)           ? { [WI.WEIGHT]: toTrimmed(it.Weight) }       : {}),
      ...(toTrimmed(it.Rest)             ? { [WI.REST]:   toTrimmed(it.Rest) }         : {}),
      ...(toTrimmed(it.Instructions)     ? { [WI.INSTR]:  toTrimmed(it.Instructions) } : {}),
      ...(toTrimmed(it.VideoURL)         ? { [WI.VIDEO]:  toTrimmed(it.VideoURL) }     : {}),
      [WI.EVIDENCE]: it.EvidenceRequired || "none",
      ...(WI.ATHTOKEN && athleteToken ? { [WI.ATHTOKEN]: String(athleteToken) } : {}),
      ...(it.groupId && WI.GROUPID ? { [WI.GROUPID]: String(it.groupId) } : {}),
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

  const { id, ids, title, date, status, sport, items, athleteIds, scheduledTime, scheduledDuration } = req.body || {};

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

  const primaryId = String(id).trim();
  const allIds    = Array.isArray(ids) && ids.length
    ? [...new Set([primaryId, ...ids.map(x => String(x).trim()).filter(Boolean)])]
    : [primaryId];

  try {
    const b     = base();
    const table = AT.tables.dailyWorkouts;

    const primary = await b(table).find(primaryId);
    const pf      = primary?.fields || {};
    const recordOrgId = (pf[DW.ORG] || [])[0] || pf.OrgId || pf.orgId || "";
    if (recordOrgId && String(recordOrgId) !== String(orgId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    // ── Scalar patch (title, date, status, sport) ─────────────────────────
    const scalarPatch = {};
    if (title  !== undefined) scalarPatch[DW.TITLE]  = toTrimmed(title) || "Daily Workout";
    if (date   !== undefined) scalarPatch[DW.DATE]   = String(date).trim();
    if (status !== undefined) scalarPatch[DW.STATUS] = normalizedStatus;
    if (sport  !== undefined) scalarPatch[DW.SPORT]  = String(sport).toLowerCase();
    if (scheduledTime !== undefined && scheduledTime !== "") {
      scalarPatch[DW.SCHEDTIME] = String(scheduledTime);
    } else if (scheduledTime === "") {
      scalarPatch[DW.SCHEDTIME] = null;
    }
    const DUR_FIELD = F?.DW_SCHEDDUR || "ScheduleDuration";
    if(scheduledDuration !== undefined && scheduledDuration !== null && scheduledDuration !== "") {
      scalarPatch[DUR_FIELD] = Number(scheduledDuration);
    }

    if (Object.keys(scalarPatch).length) {
      assertNoUndefinedKeys(scalarPatch);
      for (const batch of chunk(allIds, 10)) {
        const updates = batch.map(rid => ({ id: rid, fields: scalarPatch }));
        await b(table).update(updates);
      }
    }

    // ── Items replace ─────────────────────────────────────────────────────
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
        await b(table).update([{ id: primaryId, fields: { [DW.WORKOUTITEMS]: [] } }]);
        newItemIds = [];
      }
    }

    // ── Athlete reassignment ──────────────────────────────────────────────
    let athleteReassignResult = null;
    if (Array.isArray(athleteIds) && athleteIds.length) {
      const resolvedIncoming = await resolveAthletes(b, athleteIds);
      const usableIncoming   = resolvedIncoming.filter(a => a.athleteToken && isAthleteToken(a.athleteToken));

      if (!usableIncoming.length) {
        return res.status(400).json({
          error: "No selected athletes have a valid AthleteToken (ATH-XXXX).",
          debug: { athleteIds },
        });
      }

      // Find all sibling DailyWorkout records (same title + date + org)
      const existingTitle = toTrimmed(title) || toTrimmed(pf[DW.TITLE]) || "";
      const existingDate  = date ? String(date).trim() : toTrimmed(pf[DW.DATE]);

      const siblingsPage = await b(table).select({
        filterByFormula: `AND({${DW.TITLE}}='${escapeAirtableString(existingTitle)}', {${DW.DATE}}='${existingDate}')`,
        fields: [DW.ATHTOKEN, DW.WORKOUTITEMS, DW.ORG],
        maxRecords: 200,
      }).firstPage();

      // Only siblings that belong to this org
      const siblings = (siblingsPage || []).filter(r => {
        const rOrg = ((r?.fields?.[DW.ORG] || [])[0] || "");
        return String(rOrg) === String(orgId);
      });

      const existingTokens = new Set(
        siblings.map(r => String(r?.fields?.[DW.ATHTOKEN] || "").trim()).filter(Boolean)
      );
      const incomingTokens = new Set(usableIncoming.map(a => a.athleteToken));

      // Athletes to add
      const toAdd = usableIncoming.filter(a => !existingTokens.has(a.athleteToken));

      // Athletes to remove
      const toRemove = siblings.filter(r => {
        const t = String(r?.fields?.[DW.ATHTOKEN] || "").trim();
        return t && !incomingTokens.has(t);
      });

      // Delete removed athlete records + their items
      for (const r of toRemove) {
        const itemIds = (r?.fields?.[DW.WORKOUTITEMS] || []).filter(Boolean);
        await deleteExistingItems(b, itemIds);
        try { await b(table).destroy([r.id]); }
        catch (e) { console.warn("[update-full] remove athlete warning:", e?.message); }
      }

      // Create new DailyWorkout records for added athletes
      const addedWorkouts = [];
      const meaningfulItems = Array.isArray(items)
        ? items.filter(it => toTrimmed(it?.ExerciseName))
        : [];

      for (const a of toAdd) {
        const dwFields = {
          [DW.ORG]:      [orgId],
          [DW.ATHLETE]:  [a.athleteRecordId],
          [DW.DATE]:     existingDate,
          [DW.TITLE]:    existingTitle,
          [DW.STATUS]:   normalizedStatus || toTrimmed(pf[DW.STATUS]) || "assigned",
          [DW.ATHTOKEN]: a.athleteToken,
        };
        const sportVal = sport ? String(sport).toLowerCase() : toTrimmed(pf[DW.SPORT]);
        if (sportVal) dwFields[DW.SPORT] = sportVal;
        assertNoUndefinedKeys(dwFields);

        const created = await b(table).create([{ fields: dwFields }]);
        const newDWId = created?.[0]?.id;
        if (!newDWId) continue;

        // Copy items to new athlete's workout record
        if (meaningfulItems.length) {
          const copiedIds = await createWorkoutItems(b, {
            orgId,
            dailyWorkoutId: newDWId,
            athleteToken:   a.athleteToken,
            items:          meaningfulItems,
          });
          if (copiedIds.length) {
            await b(table).update([{ id: newDWId, fields: { [DW.WORKOUTITEMS]: copiedIds } }]);
          }
        }

        addedWorkouts.push({ id: newDWId, athleteToken: a.athleteToken });
      }

      athleteReassignResult = {
        added:   addedWorkouts.length,
        removed: toRemove.length,
        total:   incomingTokens.size,
      };
    }

    return res.status(200).json({
      ok:             true,
      id:             primaryId,
      updatedIds:     allIds,
      updatedFields:  Object.keys(scalarPatch),
      itemsReplaced:  Array.isArray(items),
      newItemCount:   newItemIds?.length ?? null,
      athleteChanges: athleteReassignResult,
    });

  } catch (e) {
    console.error("[workouts/update-full]", e?.message || e);
    if (e?.statusCode === 404 || String(e?.message || "").includes("not found"))
      return res.status(404).json({ error: "Workout not found" });
    return res.status(500).json({ error: e?.message || "Failed to update workout" });
  }
}