// pages/api/org/reviewQueue/getReviewQueue.js
// GET — fetches workout completions (Supabase) + class attendance (Supabase/Airtable),
// merges them into a single list sorted by date desc.

import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";
import { requireActiveOrgSubscription } from "@/lib/requireActiveOrgSubscription";
import { readUserFromRequest } from "@/lib/requireUser";
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

// Fingerprint for cross-source dedup: same athlete at the same minute = same attendance record
function classFingerprint(athleteToken, dateStr) {
  if (!athleteToken || !dateStr) return null;
  try { return `${String(athleteToken).trim()}:${new Date(dateStr).toISOString().slice(0, 16)}`; }
  catch { return null; }
}

// Resolve org UUID from session, organizations table, or daily_workouts fallback
async function resolveOrgId(auth) {
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
  // because completeItem never wrote it — daily_workouts.org_id is the reliable path).
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
    let orgToken = "";
    let orgId    = "";

    // Mobile path: _authUser in query bypasses requireOrg + subscription check
    const mobileSession = req.query._authUser ? readUserFromRequest(req) : null;
    if (mobileSession) {
      orgToken = asString(mobileSession.Token || mobileSession.org_token || "").toUpperCase();
      if (!orgToken) return res.status(401).json({ error: "Unauthorized" });
      orgId = await resolveOrgId({ org: { id: "", token: orgToken } });
    } else {
      const auth = requireOrg(req);
      if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

      const sub = await requireActiveOrgSubscription(req, res, auth);
      if (!sub) return;

      orgToken = asString(auth?.org?.token || "");
      orgId    = await resolveOrgId(auth);
    }

    if (!orgId && !orgToken) return res.status(401).json({ error: "Unauthorized (missing org id/token)." });

    const [workoutItems, classItemsSb, classItemsAt] = await Promise.all([
      fetchWorkoutCompletions(orgId),
      orgToken ? fetchClassAttendanceSupabase(orgToken) : Promise.resolve([]),
      orgToken ? fetchClassAttendanceAirtable(orgToken) : Promise.resolve([]),
    ]);

    // Merge: deduplicate by athlete+minute fingerprint (Supabase wins over Airtable)
    const sbFingerprints = new Set(
      classItemsSb.map(c => classFingerprint(c.athleteToken, c.date)).filter(Boolean)
    );
    const classItems = [
      ...classItemsSb,
      ...classItemsAt.filter(c => {
        const fp = classFingerprint(c.athleteToken, c.date);
        return !fp || !sbFingerprints.has(fp);
      }),
    ];

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
