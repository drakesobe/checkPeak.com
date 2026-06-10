// pages/api/org/reviewQueue/getReviewQueue.js
// GET — fetches workout completions (Supabase) + class attendance (Supabase/Airtable),
// merges them into a single list sorted by date desc.

import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";
import { requireActiveOrgSubscription } from "@/lib/requireActiveOrgSubscription";
import { supabaseAdmin as db } from "@/lib/supabase";

function asString(v) { return String(v ?? "").trim(); }
function esc(s = "") { return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').trim(); }

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

async function fetchWorkoutCompletions(orgToken) {
  // Only fetch completions that have an attachment (evidence submissions for review)
  const { data, error } = await db
    .from("workout_completions")
    .select(`
      id, status, review_note, attachment_url, attachment_type,
      completed_at, athlete_acknowledged, athlete_acknowledged_at,
      athlete_token, org_token,
      athlete:athletes ( id, name, email ),
      workout_item:workout_items (
        id, exercise_name,
        daily_workout:daily_workouts ( id, title, date )
      )
    `)
    .eq("org_token", orgToken)
    .not("attachment_url", "is", null)
    .order("completed_at", { ascending: false })
    .limit(200);

  if (error) { console.error("[getReviewQueue] supabase completions:", error); return []; }

  return (data ?? []).map(c => {
    const exerciseName = c.workout_item?.exercise_name || "";
    const title        = exerciseName || c.workout_item?.daily_workout?.title || "Workout Completion";
    return {
      id:           c.id,
      type:         "workout",
      title,
      exerciseName,
      date:         c.completed_at || "",
      status:       c.status || "pending_review",
      reviewStatus: reviewBucketFromCompletionStatus(c.status),
      coachNotes:        c.review_note || "",
      attachmentSummary: "",
      attachments:       [],
      photoUrl:          c.attachment_url || "",
      attachmentType:    c.attachment_type || "",
      athleteName:       c.athlete?.name  || "",
      athleteEmail:      c.athlete?.email || "",
      athleteToken:      c.athlete_token  || "",
      workoutItem:       c.workout_item?.id ? [c.workout_item.id] : [],
      athleteAcknowledged:   Boolean(c.athlete_acknowledged),
      athleteAcknowledgedAt: c.athlete_acknowledged_at || "",
      createdAt: c.completed_at || "",
      source: "supabase",
    };
  });
}

async function fetchClassAttendanceSupabase(orgToken) {
  const { data, error } = await db
    .from("class_attendance")
    .select("id, org_token, athlete_token, athlete_name, athlete_email, class_title, attended_at, review_status, coach_notes, photo_url, class_id")
    .eq("org_token", orgToken)
    .not("photo_url", "is", null)
    .order("attended_at", { ascending: false })
    .limit(200);

  if (error) { console.error("[getReviewQueue] supabase class_attendance:", error); return []; }

  return (data ?? []).map(r => ({
    id:           r.id,
    type:         "class",
    title:        r.class_title || "Class Attendance",
    exerciseName: "",
    date:         r.attended_at || "",
    status:       r.review_status || "pending",
    reviewStatus: reviewBucketFromClassStatus(r.review_status),
    coachNotes:        r.coach_notes || "",
    attachmentSummary: "",
    attachments:       [],
    photoUrl:          r.photo_url || "",
    athleteName:  r.athlete_name  || "",
    athleteEmail: r.athlete_email || "",
    athleteToken: r.athlete_token || "",
    classId:      r.class_id     || "",
    createdAt:    r.attended_at  || "",
    source: "supabase",
  }));
}

async function fetchClassAttendanceAirtable(orgToken) {
  if (!process.env.ORGANIZATIONS_API_KEY || !process.env.ORGANIZATIONS_BASE_ID) return [];
  try {
    const base  = new Airtable({ apiKey: process.env.ORGANIZATIONS_API_KEY }).base(process.env.ORGANIZATIONS_BASE_ID);
    const table = base(process.env.CLASSATTENDANCE_TABLE_ID || "tblgYFnNsVt1VhA4i");
    const filterByFormula = `AND({OrgToken}="${esc(orgToken)}", LEN(TRIM({PhotoUrl}&""))>0)`;
    let records = [];
    try {
      records = await table.select({ pageSize: 100, filterByFormula, sort: [{ field: "AttendedAt", direction: "desc" }] }).all()
        .catch(() => table.select({ pageSize: 100, filterByFormula }).all());
    } catch (e) {
      console.warn("[getReviewQueue] ClassAttendance airtable:", e?.message);
      return [];
    }
    return records.map(r => {
      const f = r.fields || {};
      return {
        id:           `at:${r.id}`,
        type:         "class",
        title:        asString(f?.ClassTitle || "Class Attendance"),
        exerciseName: "",
        date:         asString(f?.AttendedAt || f?.Date || ""),
        status:       asString(f?.ReviewStatus || "pending"),
        reviewStatus: reviewBucketFromClassStatus(f?.ReviewStatus),
        coachNotes:        asString(f?.CoachNotes || ""),
        attachmentSummary: "",
        attachments:       [],
        photoUrl:          asString(f?.PhotoUrl || ""),
        athleteName:  asString(f?.AthleteName || ""),
        athleteEmail: asString(f?.AthleteEmail || ""),
        athleteToken: asString(f?.AthleteToken || ""),
        classId:      asString(f?.ClassId || ""),
        createdAt:    r?._rawJson?.createdTime || asString(f?.Date || ""),
        source: "airtable",
      };
    });
  } catch (err) {
    console.error("[getReviewQueue] fetchClassAttendanceAirtable:", err?.message);
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const auth = requireOrg(req);
    if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

    const sub = await requireActiveOrgSubscription(req, res, auth);
    if (!sub) return;

    const orgToken = asString(auth?.org?.token || "");
    if (!orgToken) return res.status(401).json({ error: "Unauthorized (missing org token)." });

    const [workoutItems, classItemsSb, classItemsAt] = await Promise.all([
      fetchWorkoutCompletions(orgToken),
      fetchClassAttendanceSupabase(orgToken),
      fetchClassAttendanceAirtable(orgToken),
    ]);

    // Merge: deduplicate class attendance by source preference (Supabase wins)
    const sbClassIds = new Set(classItemsSb.map(c => c.id));
    const classItems = [...classItemsSb, ...classItemsAt.filter(c => !sbClassIds.has(c.id.replace("at:", "")))];

    const allItems = [...workoutItems, ...classItems].sort((a, b) => {
      const ta = new Date(a.date || a.createdAt || 0).getTime();
      const tb = new Date(b.date || b.createdAt || 0).getTime();
      return tb - ta;
    });

    return res.status(200).json({ items: allItems });
  } catch (err) {
    console.error("[getReviewQueue]", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
