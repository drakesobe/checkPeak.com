// pages/api/org/reviewQueue/reviewQueueUpdate.js
// POST { id, type: "workout"|"class", reviewStatus, reviewedNotes?, coachNotes? }
// Updates a workout completion or class attendance review status.

import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";
import { requireActiveOrgSubscription } from "@/lib/requireActiveOrgSubscription";
import { supabaseAdmin as db } from "@/lib/supabase";

function asString(v)   { return String(v ?? "").trim(); }
function toLower(v)    { return asString(v).toLowerCase(); }

async function resolveOrgId(auth) {
  const fromSession = asString(auth?.org?.id || "");
  if (fromSession) return fromSession;
  const token = asString(auth?.org?.token || "").toUpperCase();
  if (!token) return "";
  const { data } = await db.from("organizations").select("id").eq("token", token).maybeSingle();
  return asString(data?.id || "");
}

function normalizeCompletionStatus(nextUi) {
  const s = toLower(nextUi);
  if (s === "approved")   return "completed";
  if (s === "needs_info") return "rejected";
  return "pending_review";
}

async function updateWorkoutCompletion({ recordId, nextUi, reviewNote, orgId }) {
  // Handle legacy Airtable IDs
  if (recordId.startsWith("at:")) {
    const airtableId = recordId.slice(3);
    if (!process.env.DAILYWORKOUTS_API_KEY || !process.env.DAILYWORKOUTS_BASE_ID) {
      throw new Error("DAILYWORKOUTS env vars missing");
    }
    const base               = new Airtable({ apiKey: process.env.DAILYWORKOUTS_API_KEY }).base(process.env.DAILYWORKOUTS_BASE_ID);
    const WorkoutCompletions = base(process.env.WORKOUTCOMPLETIONS_TABLE_ID || "WorkoutCompletions");
    const nextStatus         = normalizeCompletionStatus(nextUi);
    await WorkoutCompletions.update(airtableId, {
      Status:     nextStatus,
      ReviewNote: nextUi === "needs_info" ? reviewNote : "",
    });
    return { id: recordId, cascades: {} };
  }

  // Supabase path
  const nextStatus = normalizeCompletionStatus(nextUi);

  const { data: existing } = await db
    .from("workout_completions")
    .select("id, org_id, workout_item_id")
    .eq("id", recordId)
    .maybeSingle();

  if (!existing) throw Object.assign(new Error("Completion not found"), { statusCode: 404 });
  if (existing.org_id !== orgId) throw Object.assign(new Error("Forbidden"), { statusCode: 403 });

  // Always persist notes when provided; only wipe when explicitly clearing (empty + not needs_info)
  const noteUpdate = reviewNote ? { review_note: reviewNote } : (nextUi === "needs_info" ? { review_note: null } : {});
  await db.from("workout_completions").update({
    status:      nextStatus,
    reviewed_at: new Date().toISOString(),
    ...noteUpdate,
  }).eq("id", recordId);

  // Cascade to workout_items → daily_workouts
  let workoutItemUpdated = false;
  let dailyWorkoutUpdated = false;
  let dailyWorkoutStatus = "";

  if (existing.workout_item_id) {
    await db.from("workout_items").update({ status: nextStatus }).eq("id", existing.workout_item_id);
    workoutItemUpdated = true;

    const { data: wi } = await db
      .from("workout_items").select("daily_workout_id").eq("id", existing.workout_item_id).maybeSingle();

    if (wi?.daily_workout_id) {
      const { data: items } = await db
        .from("workout_items").select("status").eq("daily_workout_id", wi.daily_workout_id);

      const statuses = (items ?? []).map(i => toLower(i.status || "assigned"));
      let dwStatus = "assigned";
      if (statuses.includes("rejected"))            dwStatus = "rejected";
      else if (statuses.includes("pending_review")) dwStatus = "pending_review";
      else if (statuses.length && statuses.every(s => s === "completed")) dwStatus = "completed";

      await db.from("daily_workouts").update({ status: dwStatus }).eq("id", wi.daily_workout_id);
      dailyWorkoutUpdated = true;
      dailyWorkoutStatus  = dwStatus;
    }
  }

  return {
    id: recordId,
    cascades: { workoutItemUpdated, dailyWorkoutUpdated, dailyWorkoutStatus },
  };
}

async function updateClassAttendance({ recordId, nextUi, reviewNote, orgToken }) {
  if (recordId.startsWith("at:")) {
    const airtableId = recordId.slice(3);
    if (!process.env.ORGANIZATIONS_API_KEY || !process.env.ORGANIZATIONS_BASE_ID) {
      throw new Error("ORGANIZATIONS env vars missing");
    }
    const base  = new Airtable({ apiKey: process.env.ORGANIZATIONS_API_KEY }).base(process.env.ORGANIZATIONS_BASE_ID);
    const table = base(process.env.CLASSATTENDANCE_TABLE_ID || "tblgYFnNsVt1VhA4i");
    const reviewStatusMap = { approved: "approved", needs_info: "needs_info", pending: "pending" };
    const record = await table.find(airtableId);
    const f      = record?.fields || {};
    await table.update(airtableId, {
      ReviewStatus: reviewStatusMap[nextUi] || "pending",
      CoachNotes:   nextUi === "needs_info" ? reviewNote : asString(f?.CoachNotes || ""),
    });
    return { id: recordId, cascades: {} };
  }

  // Supabase path
  const { data: existing } = await db
    .from("class_attendance")
    .select("id, org_token")
    .eq("id", recordId)
    .maybeSingle();

  if (!existing) throw Object.assign(new Error("Class attendance not found"), { statusCode: 404 });
  if (existing.org_token !== orgToken) throw Object.assign(new Error("Forbidden"), { statusCode: 403 });

  const reviewStatusMap = { approved: "approved", needs_info: "needs_info", pending: "pending" };
  const classNoteUpdate = reviewNote ? { coach_notes: reviewNote } : (nextUi === "needs_info" ? { coach_notes: null } : {});
  await db
    .from("class_attendance")
    .update({ review_status: reviewStatusMap[nextUi] || "pending", ...classNoteUpdate })
    .eq("id", recordId);

  return { id: recordId, cascades: {} };
}

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
    const orgId    = await resolveOrgId(auth);
    if (!orgToken && !orgId) return res.status(401).json({ error: "Unauthorized." });

    const body       = req.body || {};
    const recordId   = asString(body?.id || "");
    const itemType   = toLower(body?.type || "workout");
    const nextUi     = toLower(body?.reviewStatus ?? body?.status ?? "");
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
      result = await updateWorkoutCompletion({ recordId, nextUi, reviewNote, orgId });
    }

    return res.status(200).json({
      ok:         true,
      id:         result.id,
      uiStatus:   nextUi,
      reviewNote: nextUi === "needs_info" ? reviewNote : "",
      cascades:   result.cascades || {},
    });
  } catch (err) {
    console.error("[reviewQueueUpdate]", err);
    const status = err?.statusCode || 500;
    return res.status(status).json({ error: err?.message || "Server error" });
  }
}
