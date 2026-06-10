// pages/api/athlete/today.js
// GET /api/athlete/today?date=YYYY-MM-DD
// Returns all daily_workouts + items + completions for the authenticated athlete on a given date.
// Also fetches org-assigned workouts from Airtable when env vars are present.

import { requireAthlete } from "@/lib/requireAthlete";
import { supabaseAdmin } from "@/lib/supabase";
import Airtable from "airtable";

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

  // ── Airtable org-assigned workouts ──────────────────────────────────────────
  const orgWorkouts = [];

  if (
    process.env.DAILYWORKOUTS_API_KEY &&
    process.env.DAILYWORKOUTS_BASE_ID &&
    process.env.DAILYWORKOUTS_TABLE_ID
  ) {
    try {
      const atBase        = new Airtable({ apiKey: process.env.DAILYWORKOUTS_API_KEY }).base(process.env.DAILYWORKOUTS_BASE_ID);
      const DailyWorkouts = atBase(process.env.DAILYWORKOUTS_TABLE_ID);

      const safeToken = athleteToken.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      const formula   = `AND({AthleteToken}="${safeToken}", IS_SAME({Date}, "${date}", "day"))`;

      const dwRows = await DailyWorkouts.select({ filterByFormula: formula, maxRecords: 50 }).firstPage();

      const workoutMeta = (dwRows || []).map(rec => {
        const f = rec.fields || {};
        return {
          id:      rec.id,
          Title:   String(f.Title || "Workout"),
          Status:  String(f.Status || "assigned"),
          itemIds: Array.isArray(f.WorkoutItems) ? f.WorkoutItems.filter(Boolean) : [],
        };
      });

      const itemsByWorkoutId = {};
      workoutMeta.forEach(w => { itemsByWorkoutId[w.id] = []; });

      const allItemIds = workoutMeta.flatMap(w => w.itemIds);

      if (allItemIds.length > 0) {
        const WorkoutItems = atBase(process.env.DAILYWORKOUT_ITEMS_TABLE_ID || "WorkoutItems");

        for (let i = 0; i < allItemIds.length; i += 10) {
          const batch    = allItemIds.slice(i, i + 10);
          const idFilter = `OR(${batch.map(id => `RECORD_ID()="${id.replace(/"/g, '\\"')}"`).join(",")})`;
          const rows     = await WorkoutItems.select({ filterByFormula: idFilter, maxRecords: 50 }).firstPage();

          (rows || []).forEach(rec => {
            const f        = rec.fields || {};
            const linkedId =
              (Array.isArray(f.DailyWorkout)       ? f.DailyWorkout[0]       : null) ||
              (Array.isArray(f["Daily Workouts"])   ? f["Daily Workouts"][0]  : null) ||
              (Array.isArray(f["Workout"])          ? f["Workout"][0]         : null) || "";

            if (linkedId && Array.isArray(itemsByWorkoutId[linkedId])) {
              itemsByWorkoutId[linkedId].push({
                id:               rec.id,
                exercise_name:    String(f.ExerciseName || f.Name || ""),
                sets:             f.Sets != null ? Number(f.Sets) : null,
                reps:             String(f.Reps         || ""),
                weight:           String(f.Weight       || ""),
                rpe:              String(f.RPE          || ""),
                rest:             String(f.Rest         || ""),
                instructions:     String(f.Instructions || ""),
                video_url:        String(f.VideoURL     || ""),
                evidence_required: String(f.EvidenceRequired || "none"),
                sort_order:       f.Order != null ? Number(f.Order) : 0,
                group_id:         String(f.GroupId || "") || null,
              });
            }
          });
        }
      }

      for (const wm of workoutMeta) {
        const sortedItems = [...itemsByWorkoutId[wm.id]].sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
        );

        orgWorkouts.push({
          dailyWorkout: {
            id:           `at:${wm.id}`,
            Date:         date,
            Title:        wm.Title,
            Status:       wm.Status,
            orgId:        null,
            orgToken:     null,
            AthleteToken: athleteToken,
            source:       "airtable",
          },
          items: sortedItems.map(item => ({
            id:               `at:${item.id}`,
            ExerciseName:     item.exercise_name,
            EvidenceRequired: item.evidence_required,
            Sets:             item.sets,
            Reps:             item.reps,
            Weight:           item.weight,
            RPE:              item.rpe,
            Rest:             item.rest,
            Instructions:     item.instructions,
            VideoURL:         item.video_url,
            GroupId:          item.group_id,
            Status:           "",
            CompletionStatus: null,
            CompletionId:     null,
            AttachmentSummary: null,
            ReviewNote:       null,
            dailyWorkoutId:   `at:${wm.id}`,
          })),
        });
      }
    } catch (atErr) {
      console.error("[athlete/today] airtable org workouts:", atErr?.message);
    }
  }

  return res.status(200).json({ workouts: [...workouts, ...orgWorkouts] });
}
