// pages/api/org/reviewQueue/getReviewQueue.js
// Fetches both WorkoutCompletions and ClassAttendance in parallel,
// merges them into a single list sorted by date desc, and tags each
// item with type: "workout" | "class".

import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";
import { requireActiveOrgSubscription } from "@/lib/requireActiveOrgSubscription";

function missingEnv() {
  return {
    DAILYWORKOUTS_API_KEY:       !process.env.DAILYWORKOUTS_API_KEY,
    DAILYWORKOUTS_BASE_ID:       !process.env.DAILYWORKOUTS_BASE_ID,
    WORKOUTCOMPLETIONS_TABLE_ID: !process.env.WORKOUTCOMPLETIONS_TABLE_ID,
    ORGANIZATIONS_API_KEY:       !process.env.ORGANIZATIONS_API_KEY,
    ORGANIZATIONS_BASE_ID:       !process.env.ORGANIZATIONS_BASE_ID,
  };
}

function anyMissing(m) { return Object.values(m).some(Boolean); }
function safeArray(v)  { return Array.isArray(v) ? v : []; }
function asString(v)   { return String(v ?? "").trim(); }
function esc(str = "") { return String(str).replace(/\\/g, "\\\\").replace(/"/g, '\\"').trim(); }

function firstFromLookup(v) {
  if (Array.isArray(v)) return String(v?.[0] ?? "").trim();
  return String(v ?? "").trim();
}

function pick(fields, keys, fallback = "") {
  for (const k of keys) {
    const v = fields?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return fallback;
}

function reviewBucketFromCompletionStatus(status) {
  const st = asString(status).toLowerCase();
  if (st === "completed") return "approved";
  if (st === "rejected")  return "needs_info";
  return "pending";
}

function reviewBucketFromClassStatus(status) {
  const st = asString(status).toLowerCase();
  if (st === "approved")   return "approved";
  if (st === "needs_info") return "needs_info";
  return "pending";
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// ─── Fetch workout completions ────────────────────────────────────────────────

async function fetchWorkoutCompletions({ base, orgToken, orgId }) {
  const table = base(process.env.WORKOUTCOMPLETIONS_TABLE_ID || "WorkoutCompletions");

  // Detect available fields
  let fieldKeys = new Set();
  try {
    const sample = await table.select({ maxRecords: 1 }).firstPage();
    if (sample?.[0]?.fields) Object.keys(sample[0].fields).forEach(k => fieldKeys.add(k));
  } catch {}

  const hasOrgTokenField     = fieldKeys.size ? fieldKeys.has("OrgToken")     : true;
  const hasOrganizationField = fieldKeys.size ? fieldKeys.has("Organization") : true;

  const orgMatchParts = [];
  if (orgToken && hasOrgTokenField) {
    const t = esc(orgToken);
    orgMatchParts.push(`{OrgToken} = "${t}"`);
    orgMatchParts.push(`FIND("${t}", ARRAYJOIN({OrgToken}&"")) > 0`);
  }
  if (orgId && hasOrganizationField) {
    orgMatchParts.push(`FIND("${esc(orgId)}", ARRAYJOIN({Organization}&"")) > 0`);
  }
  if (!orgMatchParts.length) return [];

  const orgMatch        = orgMatchParts.length === 1 ? orgMatchParts[0] : `OR(${orgMatchParts.join(",")})`;
  const filterByFormula = `AND(${orgMatch}, OR(COUNTA({Attachment}) > 0, LEN(TRIM({AttachmentSummary}&"")) > 0))`;

  const records = await table.select({
    pageSize: 100,
    filterByFormula,
    sort: [{ field: "CompletedAt", direction: "desc" }],
  }).all().catch(() => table.select({ pageSize: 100, filterByFormula }).all());

  // Batch-fetch WorkoutItems for ExerciseName
  const allItemIds = [...new Set(
    records.flatMap(r => safeArray(r.fields?.WorkoutItem).map(String).filter(Boolean))
  )];
  const exerciseNameById = new Map();
  if (allItemIds.length > 0) {
    try {
      const WorkoutItems = base(process.env.WORKOUTITEMS_TABLE_ID || "WorkoutItems");
      for (const batch of chunk(allItemIds, 10)) {
        const formula = `OR(${batch.map(id => `RECORD_ID()="${esc(id)}"`).join(",")})`;
        const rows    = await WorkoutItems.select({ filterByFormula: formula, fields: ["ExerciseName", "Name"], maxRecords: batch.length }).firstPage();
        for (const row of rows || []) {
          const name = asString(row.fields?.ExerciseName || row.fields?.Name);
          if (name) exerciseNameById.set(row.id, name);
        }
      }
    } catch (e) {
      console.warn("[getReviewQueue] WorkoutItems fetch failed:", e?.message);
    }
  }

  return records.map(r => {
    const f               = r.fields || {};
    const completionStatus = pick(f, ["Status"], "pending_review");
    const workoutItemIds   = safeArray(f?.WorkoutItem).map(String).filter(Boolean);
    const exerciseName     = workoutItemIds.map(id => exerciseNameById.get(id)).filter(Boolean).join(", ");
    const title            = exerciseName || pick(f, ["WorkoutItemName", "ExerciseName", "Title", "Name"], "Workout Completion");

    return {
      id:           r.id,
      type:         "workout",
      title,
      exerciseName,
      date:         pick(f, ["CompletedAt", "Date"], ""),
      status:       completionStatus,
      reviewStatus: reviewBucketFromCompletionStatus(completionStatus),
      coachNotes:         pick(f, ["ReviewNote", "reviewNote"], ""),
      attachmentSummary:  pick(f, ["AttachmentSummary", "Attachment Summary"], ""),
      attachments:        safeArray(f?.Attachment),
      photoUrl:           "",   // workout completions use Attachment array, not URL
      athleteName:  firstFromLookup(f?.AthleteName),
      athleteEmail: firstFromLookup(f?.AthleteEmail),
      athlete:      safeArray(f?.Athlete),
      workoutItem:  workoutItemIds,
      organization: safeArray(f?.Organization),
      athleteAcknowledged:   Boolean(pick(f, ["AthleteAcknowledged"], false)),
      athleteAcknowledgedAt: pick(f, ["AthleteAcknowledgedAt"], ""),
      createdAt: r?._rawJson?.createdTime || "",
    };
  });
}

// ─── Fetch class attendance ───────────────────────────────────────────────────

async function fetchClassAttendance({ orgToken }) {
  if (!orgToken) return [];

  const base  = new Airtable({ apiKey: process.env.ORGANIZATIONS_API_KEY })
    .base(process.env.ORGANIZATIONS_BASE_ID);
  const table = base(process.env.CLASSATTENDANCE_TABLE_ID || "tblgYFnNsVt1VhA4i");

  // Only fetch records that belong to this org and have a photo
  const filterByFormula = `AND(
    {OrgToken} = "${esc(orgToken)}",
    LEN(TRIM({PhotoUrl}&"")) > 0
  )`;

  let records = [];
  try {
    records = await table.select({
      pageSize: 100,
      filterByFormula,
      sort: [{ field: "AttendedAt", direction: "desc" }],
    }).all().catch(() =>
      table.select({ pageSize: 100, filterByFormula }).all()
    );
  } catch (e) {
    console.warn("[getReviewQueue] ClassAttendance fetch failed:", e?.message);
    return [];
  }

  return records.map(r => {
    const f = r.fields || {};
    return {
      id:           r.id,
      type:         "class",
      title:        asString(f?.ClassTitle || "Class Attendance"),
      exerciseName: "",
      date:         asString(f?.AttendedAt || f?.Date || ""),
      status:       asString(f?.ReviewStatus || "pending"),
      reviewStatus: reviewBucketFromClassStatus(f?.ReviewStatus),
      coachNotes:        asString(f?.CoachNotes || ""),
      attachmentSummary: "",
      attachments:       [],    // class attendance uses PhotoUrl, not Airtable attachments
      photoUrl:          asString(f?.PhotoUrl || ""),
      athleteName:  asString(f?.AthleteName || ""),
      athleteEmail: asString(f?.AthleteEmail || ""),
      athleteToken: asString(f?.AthleteToken || ""),
      classId:      asString(f?.ClassId || ""),
      createdAt:    r?._rawJson?.createdTime || asString(f?.Date || ""),
    };
  });
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const missing = missingEnv();
  if (anyMissing(missing)) {
    return res.status(500).json({ error: "Airtable env vars missing.", missing });
  }

  try {
    const auth = requireOrg(req);
    if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

    const sub = await requireActiveOrgSubscription(req, res, auth);
    if (!sub) return;

    const orgToken = asString(auth?.org?.token || "");
    const orgId    = asString(auth?.org?.id    || "");
    if (!orgToken && !orgId) {
      return res.status(401).json({ error: "Unauthorized (missing org token/id)." });
    }

    const workoutsBase = new Airtable({ apiKey: process.env.DAILYWORKOUTS_API_KEY })
      .base(process.env.DAILYWORKOUTS_BASE_ID);

    // Fetch both sources in parallel
    const [workoutItems, classItems] = await Promise.all([
      fetchWorkoutCompletions({ base: workoutsBase, orgToken, orgId }),
      fetchClassAttendance({ orgToken }),
    ]);

    // Merge and sort by date desc
    const allItems = [...workoutItems, ...classItems].sort((a, b) => {
      const ta = new Date(a.date || a.createdAt || 0).getTime();
      const tb = new Date(b.date || b.createdAt || 0).getTime();
      return tb - ta;
    });

    return res.status(200).json({ items: allItems });

  } catch (err) {
    console.error("[getReviewQueue] error:", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}