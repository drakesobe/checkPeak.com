// pages/api/athlete/today.js
// GET /api/athlete/today?date=YYYY-MM-DD
// Returns all daily_workouts + items + completions for the authenticated athlete on a given date.

import { requireAthlete } from "@/lib/requireAthlete";
import { supabaseAdmin } from "@/lib/supabase";

function asStr(v) { return String(v ?? "").trim(); }
function isISODate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s)); }
function nyTodayISO() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

// React Native auth fallback: iOS/Android native cookie stores can inject
// stale cookies that corrupt requireAthlete. Override with the explicit
// _authUser query param when the cookie is missing or unparseable.
function cookieMissingOrBroken(req) {
  try {
    const raw = req?.cookies?.user || "";
    if (!raw) return true;
    const decoded = raw.includes("%7B") || raw.includes("%22")
      ? decodeURIComponent(raw) : raw;
    JSON.parse(decoded);
    return false;
  } catch { return true; }
}

function injectAuthFromField(req, authUserField) {
  if (!authUserField) return;
  req.cookies      = req.cookies || {};
  req.cookies.user = authUserField;
  req.headers      = req.headers || {};
  req.headers.cookie = `user=${encodeURIComponent(authUserField)}`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (cookieMissingOrBroken(req)) {
    const authUserField = asStr(req.query?._authUser || "");
    if (authUserField) injectAuthFromField(req, authUserField);
  }

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  const athleteToken = asStr(auth.athlete?.AthleteToken);
  if (!athleteToken) return res.status(401).json({ error: "AthleteToken missing from session" });

  const date = asStr(req.query.date) || nyTodayISO();
  if (!isISODate(date)) return res.status(400).json({ error: "Invalid date. Use YYYY-MM-DD." });

  // Resolve athlete UUID - daily_workouts uses athlete_id (UUID FK), not token
  const { data: athRow, error: athErr } = await supabaseAdmin
    .from("athletes")
    .select("id")
    .eq("athlete_token", athleteToken)
    .maybeSingle();

  if (athErr) {
    console.error("[athlete/today] athletes lookup:", athErr);
    return res.status(500).json({ error: "Database error looking up athlete." });
  }
  if (!athRow) return res.status(404).json({ error: "Athlete not found." });

  const athleteId = athRow.id;

  const { data: rows, error: wErr } = await supabaseAdmin
    .from("daily_workouts")
    .select(`
      id, date, title, status, org_id, org_token,
      workout_items (
        id, exercise_name, sets, reps, weight, rpe, rest,
        instructions, video_url, evidence_required, sort_order, group_id,
        workout_completions (
          id, status, review_note, athlete_id,
          completion_evidence ( id, evidence_type, url )
        )
      )
    `)
    .eq("athlete_id", athleteId)
    .eq("date", date);

  if (wErr) {
    console.error("[athlete/today] workouts query:", wErr);
    return res.status(500).json({ error: "Failed to fetch workouts." });
  }

  const workouts = (rows ?? []).map(dw => {
    const sortedItems = [...(dw.workout_items ?? [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );

    return {
      dailyWorkout: {
        id:           dw.id,
        Date:         dw.date ?? "",
        Title:        dw.title ?? "",
        Status:       dw.status ?? "assigned",
        orgId:        dw.org_id,
        orgToken:     dw.org_token,
        AthleteToken: athleteToken,
      },
      items: sortedItems.map(item => {
        const completions = item.workout_completions ?? [];
        const mine = completions.find(c => c.athlete_id === athleteId) ?? null;
        const evidence = mine?.completion_evidence ?? [];
        const attachmentSummary = evidence.length > 0
          ? `${evidence.length} ${evidence[0].evidence_type ?? "file"}${evidence.length > 1 ? "s" : ""}`
          : null;

        return {
          id:               item.id,
          ExerciseName:     item.exercise_name ?? "",
          EvidenceRequired: item.evidence_required ?? "none",
          Sets:             item.sets ?? null,
          Reps:             item.reps ?? "",
          Weight:           item.weight ?? "",
          RPE:              item.rpe ?? "",
          Rest:             item.rest ?? "",
          Instructions:     item.instructions ?? "",
          VideoURL:         item.video_url ?? "",
          GroupId:          item.group_id ?? null,
          Status:           mine?.status ?? "",
          CompletionStatus: mine?.status ?? null,
          CompletionId:     mine?.id ?? null,
          AttachmentSummary: attachmentSummary,
          ReviewNote:       mine?.review_note ?? null,
          dailyWorkoutId:   dw.id,
        };
      }),
    };
  });

  return res.status(200).json({ workouts });
}
