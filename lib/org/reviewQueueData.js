// lib/org/reviewQueueData.js
// Loads an org's review queue: workout completions + class attendance (both Supabase).
// Shared by the Review Queue page API and the nav counts endpoint so both count the same items.

import { supabaseAdmin as db } from "@/lib/supabase";

function asString(v) { return String(v ?? "").trim(); }

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

// Fingerprint for cross-source dedup: same athlete at the same minute = same attendance record
// Resolve org UUID from session, organizations table, or daily_workouts fallback
export async function resolveOrgId(auth) {
  const fromSession = asString(auth?.org?.id || "");
  if (fromSession) return fromSession;
  const token = asString(auth?.org?.token || "").toUpperCase();
  if (!token) return "";
  const { data } = await db.from("organizations").select("id").eq("token", token).maybeSingle();
  if (data?.id) return asString(data.id);
  // Fallback for mobile orgs: org_id is set on daily_workouts even when not in organizations table
  const { data: dw } = await db
    .from("daily_workouts").select("org_id").eq("org_token", token)
    .not("org_id", "is", null).limit(1).maybeSingle();
  return asString(dw?.org_id || "");
}

async function fetchWorkoutCompletions(orgId) {
  if (!orgId) return [];

  // Filter by org via daily_workouts.org_id (workout_completions.org_id is often null
  // because completeItem never wrote it - daily_workouts.org_id is the reliable path).
  // !inner on both join hops so PostgREST lets us filter on the nested column.
  const { data, error } = await db
    .from("workout_completions")
    .select(`
      id, status, review_note, completed_at, workout_item_id,
      athlete:athletes ( id, name, email ),
      workout_item:workout_items!inner (
        id, exercise_name, evidence_required,
        daily_workout:daily_workouts!inner ( id, title, date, org_id )
      ),
      evidence:completion_evidence ( id, url, evidence_type, submitted_at )
    `)
    .filter("workout_item.daily_workout.org_id", "eq", orgId)
    .not("status", "eq", "assigned")
    .order("completed_at", { ascending: false })
    .limit(200);

  if (error) { console.error("[getReviewQueue] supabase completions:", error); return []; }

  return (data ?? [])
    .filter(c => {
      // Only show evidence-required submissions (not VARA / auto-complete)
      const evReq = String(c.workout_item?.evidence_required || "none").toLowerCase();
      return evReq !== "none";
    })
    .map(c => {
      const exerciseName  = c.workout_item?.exercise_name || "";
      const title         = exerciseName || c.workout_item?.daily_workout?.title || "Workout Completion";
      const evidenceArr   = Array.isArray(c.evidence) ? c.evidence : [];
      const firstEvidence = evidenceArr[0] || null;
      const photoUrl     = firstEvidence?.url || "";
      const attachType   = firstEvidence?.evidence_type || "photo";
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
        photoUrl,
        attachmentType:    attachType,
        athleteName:       c.athlete?.name  || "",
        athleteEmail:      c.athlete?.email || "",
        athleteToken:      "",
        workoutItem:       c.workout_item?.id ? [c.workout_item.id] : [],
        evidenceRequired:  c.workout_item?.evidence_required || "none",
        athleteAcknowledged:   false,
        athleteAcknowledgedAt: "",
        createdAt: c.completed_at || "",
        source: "supabase",
      };
    });
}

async function fetchClassAttendanceSupabase(orgToken) {
  // class_attendance uses org_token (text), athlete info via join, review_status added by migration
  const { data, error } = await db
    .from("class_attendance")
    .select(`
      id, org_token, athlete_token, class_title, attended_at,
      review_status, coach_notes, photo_url, class_id,
      athlete:athletes ( name, email )
    `)
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
    athleteName:  r.athlete?.name  || "",
    athleteEmail: r.athlete?.email || "",
    athleteToken: r.athlete_token  || "",
    classId:      r.class_id       || "",
    createdAt:    r.attended_at    || "",
    source: "supabase",
  }));
}

// Merged list, newest first.
export async function loadReviewQueueItems({ orgId, orgToken }) {
  const [workoutItems, classItems] = await Promise.all([
    fetchWorkoutCompletions(orgId),
    orgToken ? fetchClassAttendanceSupabase(orgToken) : Promise.resolve([]),
  ]);

  return [...workoutItems, ...classItems].sort((a, b) => {
    const ta = new Date(a.date || a.createdAt || 0).getTime();
    const tb = new Date(b.date || b.createdAt || 0).getTime();
    return tb - ta;
  });
}
