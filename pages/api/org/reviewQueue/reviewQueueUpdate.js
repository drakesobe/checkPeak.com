// pages/api/org/reviewQueue/reviewQueueUpdate.js
// Handles both workout completions (type: "workout") and class attendance (type: "class").
// Routes to the correct Airtable table based on the `type` field in the request body.

import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";
import { requireActiveOrgSubscription } from "@/lib/requireActiveOrgSubscription";

function safeArray(v)  { return Array.isArray(v) ? v : []; }
function asString(v)   { return String(v ?? "").trim(); }
function toLowerStr(v) { return asString(v).toLowerCase(); }
function esc(str = "") { return String(str).replace(/\\/g, "\\\\").replace(/"/g, '\\"').trim(); }

function normalizeIdArray(v) {
  return safeArray(v).map(x => {
    if (!x) return "";
    if (typeof x === "string") return x.trim();
    if (typeof x === "object" && x.id) return String(x.id).trim();
    return String(x).trim();
  }).filter(Boolean);
}

function firstFromLookup(v) {
  if (Array.isArray(v)) return String(v?.[0] ?? "").trim();
  return String(v ?? "").trim();
}

function normalizeCompletionStatus(nextUiStatus) {
  const s = toLowerStr(nextUiStatus);
  if (s === "approved")   return "completed";
  if (s === "needs_info") return "rejected";
  return "pending_review";
}

function normalizeItemStatus(v) {
  const s = toLowerStr(v);
  if (s === "completed")     return "completed";
  if (s === "pending_review") return "pending_review";
  if (s === "rejected")      return "rejected";
  return "assigned";
}

function deriveDailyWorkoutStatus(itemStatuses = []) {
  const statuses = (itemStatuses || []).map(normalizeItemStatus);
  if (statuses.includes("rejected"))     return "rejected";
  if (statuses.includes("pending_review")) return "pending_review";
  if (statuses.length > 0 && statuses.every(s => s === "completed")) return "completed";
  return "assigned";
}

async function recomputeAndUpdateDailyWorkoutStatus({ base, dailyWorkoutId }) {
  if (!dailyWorkoutId) return { updated: false, status: "" };
  const dw      = await base("DailyWorkouts").find(dailyWorkoutId);
  const itemIds = safeArray(dw?.fields?.WorkoutItems).map(String).filter(Boolean);
  if (!itemIds.length) {
    await base("DailyWorkouts").update([{ id: dailyWorkoutId, fields: { Status: "assigned" } }]);
    return { updated: true, status: "assigned" };
  }
  const orFormula  = `OR(${itemIds.map(id => `RECORD_ID()='${String(id).replace(/'/g, "\\'")}'`).join(",")})`;
  const itemRecords = await base("WorkoutItems").select({ filterByFormula: orFormula, fields: ["Status"], pageSize: 100 }).all();
  const statuses    = (itemRecords || []).map(r => r?.fields?.Status || "assigned");
  const next        = deriveDailyWorkoutStatus(statuses);
  await base("DailyWorkouts").update([{ id: dailyWorkoutId, fields: { Status: next } }]);
  return { updated: true, status: next };
}

// ─── Update workout completion ────────────────────────────────────────────────

async function updateWorkoutCompletion({ recordId, nextUi, reviewNote, auth, orgToken, orgId }) {
  if (!process.env.DAILYWORKOUTS_API_KEY || !process.env.DAILYWORKOUTS_BASE_ID) {
    throw new Error("DAILYWORKOUTS env vars missing");
  }

  const base               = new Airtable({ apiKey: process.env.DAILYWORKOUTS_API_KEY }).base(process.env.DAILYWORKOUTS_BASE_ID);
  const WorkoutCompletions = base(process.env.WORKOUTCOMPLETIONS_TABLE_ID || "WorkoutCompletions");
  const WorkoutItems       = base(process.env.WORKOUTITEMS_TABLE_ID       || "WorkoutItems");
  const OrgMembers         = base(process.env.ORGMEMBERS_TABLE_ID         || "OrgMembers");

  const completion = await WorkoutCompletions.find(recordId);
  const cf         = completion?.fields || {};

  // Ownership check
  const recOrgToken = firstFromLookup(cf?.OrgToken);
  let owns = false;
  if (orgToken && recOrgToken) owns = asString(recOrgToken) === orgToken;
  if (!owns && orgId) owns = normalizeIdArray(cf?.Organization).includes(orgId);
  if (!owns) throw Object.assign(new Error("Forbidden"), { statusCode: 403 });

  // Reviewer lookup
  let reviewedByLinkId = asString(auth?.user?.memberId || auth?.user?.MemberId || "");
  const reviewerEmail  = asString(auth?.user?.Email || auth?.user?.email || "");
  if (!reviewedByLinkId && reviewerEmail) {
    try {
      const rows = await OrgMembers.select({
        maxRecords: 1,
        filterByFormula: orgId
          ? `AND(LOWER({Email}&"")="${esc(reviewerEmail.toLowerCase())}", FIND("${esc(orgId)}", ARRAYJOIN({Organization}&""))>0)`
          : `LOWER({Email}&"")="${esc(reviewerEmail.toLowerCase())}"`,
      }).firstPage();
      reviewedByLinkId = asString(rows?.[0]?.id || "");
    } catch {}
  }

  const nextCompletionStatus = normalizeCompletionStatus(nextUi);
  const updates = {
    Status:     nextCompletionStatus,
    ReviewNote: nextUi === "needs_info" ? reviewNote : "",
    ...(reviewedByLinkId ? { ReviewedBy: [reviewedByLinkId] } : {}),
  };

  const updated = await WorkoutCompletions.update(recordId, updates);

  // Cascade to WorkoutItems and DailyWorkouts
  const workoutItemId = asString(safeArray(cf?.WorkoutItem)?.[0] || "");
  if (workoutItemId) {
    await WorkoutItems.update([{ id: workoutItemId, fields: { Status: nextCompletionStatus } }]);
  }

  let dailyWorkoutId = "";
  try {
    if (workoutItemId) {
      const wi = await WorkoutItems.find(workoutItemId);
      dailyWorkoutId = asString(safeArray(wi?.fields?.DailyWorkout)?.[0] || "");
    }
  } catch {}

  let daily = { updated: false, status: "" };
  try {
    if (dailyWorkoutId) daily = await recomputeAndUpdateDailyWorkoutStatus({ base, dailyWorkoutId });
  } catch (e) {
    console.error("[reviewQueueUpdate] DailyWorkouts recompute failed:", e);
  }

  return {
    id: updated.id,
    cascades: {
      workoutItemUpdated:    Boolean(workoutItemId),
      dailyWorkoutUpdated:   Boolean(dailyWorkoutId && daily?.updated),
      dailyWorkoutStatus:    daily?.status || "",
    },
  };
}

// ─── Update class attendance ──────────────────────────────────────────────────

async function updateClassAttendance({ recordId, nextUi, reviewNote, orgToken }) {
  if (!process.env.ORGANIZATIONS_API_KEY || !process.env.ORGANIZATIONS_BASE_ID) {
    throw new Error("ORGANIZATIONS env vars missing");
  }

  const base  = new Airtable({ apiKey: process.env.ORGANIZATIONS_API_KEY }).base(process.env.ORGANIZATIONS_BASE_ID);
  const table = base(process.env.CLASSATTENDANCE_TABLE_ID || "tblgYFnNsVt1VhA4i");

  // Verify org ownership
  const record = await table.find(recordId);
  const f      = record?.fields || {};
  const recOrgToken = asString(f?.OrgToken || "");
  if (orgToken && recOrgToken && recOrgToken !== orgToken) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }

  // Map UI status to ClassAttendance ReviewStatus field values
  const reviewStatusMap = {
    approved:   "approved",
    needs_info: "needs_info",
    pending:    "pending",
  };

  const updated = await table.update(recordId, {
    ReviewStatus: reviewStatusMap[nextUi] || "pending",
    CoachNotes:   nextUi === "needs_info" ? reviewNote : (asString(f?.CoachNotes || "")),
  });

  return { id: updated.id, cascades: {} };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const auth = requireOrg(req);
    if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

    const sub = await requireActiveOrgSubscription(req, res, auth);
    if (!sub) return;

    const orgToken = asString(auth?.org?.token || "");
    const orgId    = asString(auth?.org?.id    || "");
    if (!orgToken && !orgId) return res.status(401).json({ error: "Unauthorized." });

    const body       = req.body || {};
    const recordId   = asString(body?.id || "");
    const itemType   = toLowerStr(body?.type || "workout"); // "workout" | "class"
    const incomingStatus = body?.reviewStatus ?? body?.status;
    const nextUi     = toLowerStr(incomingStatus);
    const reviewNote = asString(body?.reviewedNotes || body?.coachNotes || "");

    if (!recordId) return res.status(400).json({ error: "Missing id." });

    const allowedUi = new Set(["pending", "approved", "needs_info"]);
    if (!allowedUi.has(nextUi)) return res.status(400).json({ error: "Invalid status." });
    if (nextUi === "needs_info" && reviewNote.length < 3) {
      return res.status(400).json({ error: "A note is required for Needs Info." });
    }

    let result;
    if (itemType === "class") {
      result = await updateClassAttendance({ recordId, nextUi, reviewNote, orgToken });
    } else {
      result = await updateWorkoutCompletion({ recordId, nextUi, reviewNote, auth, orgToken, orgId });
    }

    return res.status(200).json({
      ok:         true,
      id:         result.id,
      uiStatus:   nextUi,
      reviewNote: nextUi === "needs_info" ? reviewNote : "",
      cascades:   result.cascades || {},
    });

  } catch (err) {
    console.error("[reviewQueueUpdate] error:", err);
    const status = err?.statusCode || 500;
    return res.status(status).json({ error: err?.message || "Server error" });
  }
}