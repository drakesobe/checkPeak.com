// pages/api/org/workouts/detail.js
// GET /api/org/workouts/detail?id=recXXXXXXXXXXXXXX
//
// Returns:
//   workout  - full DailyWorkout + expanded WorkoutItems
//   siblings - every record sharing the same title + date + org,
//              each shaped as { id, athleteToken, athleteName, isSelf }
//
// Athlete names come from a direct Airtable query on the Athletes table
// using the tokens collected from the sibling records. No mock-response
// tricks - just a straightforward fetch with the env vars that already exist.

import { requireOrgSideUser } from "@/lib/requireUser";
import { AT, base, F } from "@/lib/airtableOrgWorkoutConfig";

// ── Field maps ─────────────────────────────────────────────────────────────────
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
  ORDER:    F?.WI_ORDER    || "Order",
  NAME:     F?.WI_NAME     || "ExerciseName",
  SETS:     F?.WI_SETS     || "Sets",
  REPS:     F?.WI_REPS     || "Reps",
  WEIGHT:   F?.WI_WEIGHT   || "Weight",
  REST:     F?.WI_REST     || "Rest",
  INSTR:    F?.WI_INSTR    || "Instructions",
  VIDEO:    F?.WI_VIDEO    || "VideoURL",
  EVIDENCE: F?.WI_EVIDENCE || "EvidenceRequired",
};

function safeArray(v) { return Array.isArray(v) ? v : []; }
function escStr(s)    { return String(s ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'").trim(); }
function chunk(arr, n = 30) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// ── Resolve athlete names from the Athletes (AthleteScans) table ───────────────
// Uses the same env vars as getAthletes.js - no session needed, just the API key.
async function resolveNames(tokens) {
  if (!tokens.length) return {};

  const API_KEY = process.env.ATHLETE_API_KEY;
  const BASE_ID = process.env.ATHLETE_BASE_ID;
  const TABLE   = process.env.ATHLETE_TABLE_NAME;

  if (!API_KEY || !BASE_ID || !TABLE) {
    console.warn("[detail] resolveNames: ATHLETE env vars not set, names will be blank");
    return {};
  }

  const nameMap = {};

  try {
    for (const batch of chunk(tokens, 30)) {
      // Build OR filter: OR({AthleteToken}='tok1', {AthleteToken}='tok2', ...)
      const orParts = batch.map(t => `{AthleteToken}='${escStr(t)}'`).join(",");
      const formula = batch.length === 1 ? orParts : `OR(${orParts})`;

      const qs = new URLSearchParams();
      qs.set("filterByFormula", formula);
      qs.append("fields[]", "AthleteToken");
      qs.append("fields[]", "Name");
      qs.set("pageSize", "100");

      const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}?${qs}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${API_KEY}` },
      });

      if (!res.ok) {
        console.warn("[detail] resolveNames: Airtable returned", res.status);
        continue;
      }

      const data = await res.json().catch(() => ({}));
      for (const rec of (data?.records || [])) {
        const token = String(rec?.fields?.AthleteToken || "").trim();
        const name  = String(rec?.fields?.Name         || "").trim();
        if (token && name) nameMap[token] = name;
      }
    }
  } catch (e) {
    console.warn("[detail] resolveNames error:", e?.message);
  }

  return nameMap;
}

// ── Handler ────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const id = String(req.query?.id || "").trim();
  if (!id) return res.status(400).json({ error: "id query param is required" });

  const orgId = user.orgId;

  try {
    const b     = base();
    const table = AT.tables.dailyWorkouts;

    // ── 1. Fetch primary record ──────────────────────────────────────────────
    const record = await b(table).find(id);
    if (!record) return res.status(404).json({ error: "Workout not found" });

    const f = record.fields || {};
    const recordOrgId = safeArray(f[DW.ORG])[0] || f.OrgId || f.orgId || "";

    if (recordOrgId && String(recordOrgId) !== String(orgId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const title   = String(f[DW.TITLE]  || "Workout");
    const dateISO = String(f[DW.DATE]   || "").slice(0, 10);
    const status  = String(f[DW.STATUS] || "assigned");
    const sport   = String(f[DW.SPORT]  || "");

    // ── 2. Fetch linked WorkoutItems ─────────────────────────────────────────
    const itemIds = safeArray(f[DW.WORKOUTITEMS]);
    let items = [];

    if (itemIds.length) {
      const fetched = await Promise.all(
        itemIds.map(iid => b(AT.tables.workoutItems).find(iid).catch(() => null))
      );
      items = fetched
        .filter(Boolean)
        .map(r => {
          const wf = r.fields || {};
          return {
            id:               r.id,
            Order:            Number(wf[WI.ORDER] ?? 0),
            ExerciseName:     String(wf[WI.NAME]     || ""),
            Sets:             wf[WI.SETS] != null ? Number(wf[WI.SETS]) : "",
            Reps:             String(wf[WI.REPS]     || ""),
            Weight:           String(wf[WI.WEIGHT]   || ""),
            Rest:             String(wf[WI.REST]      || ""),
            Instructions:     String(wf[WI.INSTR]    || ""),
            VideoURL:         String(wf[WI.VIDEO]    || ""),
            EvidenceRequired: String(wf[WI.EVIDENCE] || "none"),
          };
        })
        .sort((a, b) => a.Order - b.Order);
    }

    // ── 3. Fetch sibling records (same title + date + org) ───────────────────
    const orgJoin = `ARRAYJOIN({${DW.ORG}}&"")`;
    const formula = `AND(
      FIND("${escStr(recordOrgId || orgId)}", ${orgJoin}),
      {${DW.TITLE}}="${escStr(title)}",
      IS_SAME({${DW.DATE}}, "${escStr(dateISO)}", "day")
    )`;

    const siblingRows = await b(table).select({
      filterByFormula: formula,
      fields:          [DW.ATHTOKEN],
      maxRecords:      200,
    }).firstPage();

    // ── 4. Resolve athlete names directly from Athletes table ────────────────
    const tokens  = (siblingRows || [])
      .map(r => String(r.fields?.[DW.ATHTOKEN] || "").trim())
      .filter(Boolean);

    const nameMap = await resolveNames(tokens);

    const siblings = (siblingRows || []).map(r => {
      const token = String(r.fields?.[DW.ATHTOKEN] || "").trim();
      return {
        id:           r.id,
        athleteToken: token,
        athleteName:  nameMap[token] || "",
        isSelf:       r.id === id,
      };
    });

    return res.status(200).json({
      ok: true,
      workout: {
        id,
        Title:        title,
        Date:         dateISO,
        Status:       status,
        Sport:        sport,
        athleteCount: siblings.length,
        itemCount:    items.length,
        items,
      },
      siblings,
    });

  } catch (e) {
    console.error("[workouts/detail]", e?.message || e);
    if (e?.statusCode === 404 || String(e?.message || "").includes("not found"))
      return res.status(404).json({ error: "Workout not found" });
    return res.status(500).json({ error: e?.message || "Failed to load workout" });
  }
}