// /pages/api/org/workouts/day.js
import Airtable from "airtable";
import { requireOrgSideUser } from "@/lib/requireUser";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toISODateLocal(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function safeJsonString(s) {
  return String(s ?? "").trim();
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function escFormulaString(s) {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .trim();
}

function normLower(v) {
  return String(v ?? "").trim().toLowerCase();
}

async function safeJson(res) {
  try { return await res.json(); }
  catch { return {}; }
}

function envMissing() {
  return {
    DAILYWORKOUTS_API_KEY:  !process.env.DAILYWORKOUTS_API_KEY,
    DAILYWORKOUTS_BASE_ID:  !process.env.DAILYWORKOUTS_BASE_ID,
    DAILYWORKOUTS_TABLE_ID: !process.env.DAILYWORKOUTS_TABLE_ID,
    ATHLETE_API_KEY:        !process.env.ATHLETE_API_KEY,
    ATHLETE_BASE_ID:        !process.env.ATHLETE_BASE_ID,
    ATHLETE_TABLE_NAME:     !process.env.ATHLETE_TABLE_NAME,
  };
}

function buildOrgCandidates(user) {
  const orgId = String(user?.org?.id || user?.orgId || user?.OrgId || "").trim();
  const orgToken = String(user?.org?.token || user?.Token || user?.token || "").trim();
  const orgName = String(
    user?.org?.name || user?.org?.Name || user?.orgName ||
    user?.OrgName   || user?.organizationName ||
    user?.["Organization Name"] || ""
  ).trim();
  const candidates = [orgName, orgToken, orgId].filter(Boolean);
  return { orgId, orgToken, orgName, candidates };
}

function uniqCI(list) {
  const out = [];
  const seen = new Set();
  (Array.isArray(list) ? list : []).forEach((x) => {
    const s = String(x || "").trim();
    if (!s) return;
    const k = s.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(s);
  });
  return out;
}

function chunk(arr, n = 10) {
  const out = [];
  for (let i = 0; i < (arr || []).length; i += n) {
    out.push(arr.slice(i, i + n));
  }
  return out;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const missing = envMissing();

  if (missing.DAILYWORKOUTS_API_KEY || missing.DAILYWORKOUTS_BASE_ID || missing.DAILYWORKOUTS_TABLE_ID) {
    return res.status(500).json({
      error: "DailyWorkouts Airtable env vars missing.",
      missing,
      debug: { cwd: process.cwd() },
    });
  }

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const date   = safeJsonString(req.query?.date) || toISODateLocal(new Date());
  const sportQ = normLower(req.query?.sport);
  const { orgId, orgToken, orgName, candidates } = buildOrgCandidates(user);

  const debug = {
    date,
    sport: sportQ,
    orgId,
    orgTokenPresent: Boolean(orgToken),
    orgName,
    orgCandidates: candidates,
    athleteQueryEnabled: !(missing.ATHLETE_API_KEY || missing.ATHLETE_BASE_ID || missing.ATHLETE_TABLE_NAME),
    formulas: {},
    counts: { workoutsAll: 0, workouts: 0, athletes: 0, workoutItems: 0, completions: 0 },
  };

  if (!candidates.length) {
    return res.status(400).json({
      error: "Missing org identity on session (need orgName or orgToken or orgId).",
      debug,
    });
  }

  const base          = new Airtable({ apiKey: process.env.DAILYWORKOUTS_API_KEY }).base(process.env.DAILYWORKOUTS_BASE_ID);
  const DailyWorkouts = base(process.env.DAILYWORKOUTS_TABLE_ID);

  /* ── 1a. Load today's DailyWorkout records for this org ── */
  let workoutsAll = [];
  try {
    const orgJoin  = `ARRAYJOIN({Organization}&"")`;
    const orgMatch = candidates.length === 1
      ? `FIND("${escFormulaString(candidates[0])}", ${orgJoin})`
      : `OR(${candidates.map(c => `FIND("${escFormulaString(c)}", ${orgJoin})`).join(",")})`;

    const formulaAll = `AND(${orgMatch}, IS_SAME({Date}, "${escFormulaString(date)}", "day"))`;
    debug.formulas.dailyWorkouts_allSports = formulaAll;

    const rows = await DailyWorkouts.select({
      filterByFormula: formulaAll,
      maxRecords: 200,
      sort: [{ field: "Date", direction: "asc" }],
    }).firstPage();

    workoutsAll = (rows || []).map((rec) => {
      const f       = rec.fields || {};
      const itemIds = safeArray(f.WorkoutItems).filter(Boolean);
      return {
        id:            rec.id,
        Title:         f.Title || "Workout",
        Date:          f.Date ? String(f.Date).slice(0, 10) : date,
        Status:        f.Status || "assigned",
        Sport:         f.Sport  || "",
        athleteCount:  safeArray(f.Athlete).length,
        athleteToken:  String(f.AthleteToken || "").trim(),
        itemCount:     itemIds.length,
        itemIds,
        _orgLink:      f.Organization,
      };
    });

    debug.counts.workoutsAll = workoutsAll.length;
  } catch (e) {
    console.error("[api/org/workouts/day] dailyWorkouts error:", e);
    return res.status(500).json({
      error: "Failed to load day workouts.",
      details: e?.message || String(e),
      debug,
    });
  }

  const availableSports = uniqCI(
    workoutsAll.map(w => String(w?.Sport || "").trim()).filter(Boolean)
  ).sort((a, b) => a.localeCompare(b));

  const workouts = sportQ
    ? workoutsAll.filter(w => normLower(w?.Sport) === sportQ)
    : workoutsAll;

  debug.counts.workouts = workouts.length;

  /* ── 1b. Hydrate WorkoutItems ── */
  const itemsByWorkoutId   = {};
  const completionByItemId = {};

  try {
    const workoutIds = workouts.map(w => String(w.id || "")).filter(Boolean);
    const itemIds    = uniqCI(workouts.flatMap(w => safeArray(w.itemIds || [])));

    workoutIds.forEach(wid => { itemsByWorkoutId[wid] = []; });

    if (itemIds.length > 0) {
      const WorkoutItems = base(process.env.DAILYWORKOUT_ITEMS_TABLE_ID || "WorkoutItems");

      for (const batch of chunk(itemIds, 10)) {
        const rows = await WorkoutItems.select({
          filterByFormula: `OR(${batch.map(id => `RECORD_ID()="${escFormulaString(id)}"`).join(",")})`,
          maxRecords: 50,
        }).firstPage();

        (rows || []).forEach((rec) => {
          const f              = rec.fields || {};
          const linkedWorkoutId =
            safeArray(f.DailyWorkout)[0]      ||
            safeArray(f["Daily Workouts"])[0] ||
            safeArray(f["Workout"])[0]        || "";

          // Initial status from WorkoutItems — will be overridden by completions below
          const status = String(
            f.Status || f["Completion Status"] || f["Review Status"] || ""
          ).trim();

          const item = {
            id:           rec.id,
            Status:       status,
            Order:        f.Order ?? null,
            ExerciseName: f.ExerciseName || f.Name || "",
          };

          if (linkedWorkoutId && Array.isArray(itemsByWorkoutId[linkedWorkoutId])) {
            itemsByWorkoutId[linkedWorkoutId].push(item);
          }

          if (status) {
            completionByItemId[rec.id] = { Status: status };
          }
        });
      }

      debug.counts.workoutItems = itemIds.length;
    }
  } catch (e) {
    console.error("[api/org/workouts/day] workout items query error:", e);
    debug.workoutItemsError = { message: e?.message || String(e) };
  }

  /* ── 1c. WorkoutCompletions — authoritative source for review queue ────────
     WorkoutItems.Status can be stale or incorrect (especially before the
     completeItem.js fix). The WorkoutCompletions table is written atomically
     on every submission and is always up to date.
     We fetch all completions for today, then overlay onto completionByItemId
     so the hook's pendingReviewCount reflects reality.
  ── */
  try {
    const WorkoutCompletions = base("WorkoutCompletions");

    // All item IDs we care about (from workouts returned)
    const trackedItemIds = new Set([
      ...Object.keys(completionByItemId),
      ...workouts.flatMap(w => safeArray(w.itemIds).map(String)),
    ]);

    if (trackedItemIds.size > 0) {
      const dateEsc  = escFormulaString(date);
      const wcFilter = `IS_SAME({CompletedAt}, "${dateEsc}", "day")`;

      const wcRows = await WorkoutCompletions.select({
        filterByFormula: wcFilter,
        fields:          ["WorkoutItem", "Status", "AthleteToken", "CompletedAt"],
        maxRecords:      500,
      }).firstPage();

      // Keep only the most recent completion per WorkoutItem
      // (edge case: athlete re-submitted after rejection)
      const latestByItemId = new Map();

      for (const r of wcRows || []) {
        const f       = r.fields || {};
        const iids    = safeArray(f.WorkoutItem).map(String);
        const status  = String(f.Status || "").toLowerCase();
        const ts      = new Date(f.CompletedAt || 0).getTime();

        for (const iid of iids) {
          if (!trackedItemIds.has(iid)) continue;
          const existing = latestByItemId.get(iid);
          if (!existing || ts >= existing.ts) {
            latestByItemId.set(iid, { status, ts });
          }
        }
      }

      // Overlay completions table status — wins over WorkoutItems.Status
      for (const [iid, { status }] of latestByItemId.entries()) {
        completionByItemId[iid] = { Status: status };
      }

      debug.counts.completions = latestByItemId.size;
    }
  } catch (wcErr) {
    // Non-fatal — hook falls back to WorkoutItems.Status already populated
    console.warn("[api/org/workouts/day] WorkoutCompletions query failed:", wcErr?.message);
    debug.completionsError = { message: wcErr?.message };
  }

  /* ── 2. Athletes roster (optional) ── */
  let athletes = [];
  if (!(missing.ATHLETE_API_KEY || missing.ATHLETE_BASE_ID || missing.ATHLETE_TABLE_NAME)) {
    try {
      const athleteBase  = new Airtable({ apiKey: process.env.ATHLETE_API_KEY }).base(process.env.ATHLETE_BASE_ID);
      const AthleteTable = athleteBase(process.env.ATHLETE_TABLE_NAME);

      // Athletes table links to org via {Token} — NOT via {Organization}
      const safeToken    = escFormulaString(orgToken);
      const athleteFilter = orgToken
        ? `FIND("${safeToken}", ARRAYJOIN({Token}&""))>0`
        : "";

      if (!athleteFilter) {
        debug.athletesError = { message: "No orgToken to filter athletes" };
      } else {
        debug.formulas.athletes = athleteFilter;

        const atRecs = await athleteBase(process.env.ATHLETE_TABLE_NAME)
          .select({
            filterByFormula: athleteFilter,
            fields: ["Name", "Email", "AthleteToken", "CreatedAt", "sport", "Team", "Status"],
            maxRecords: 2000,
          })
          .all();

        athletes = (atRecs || []).map(r => {
          const f = r.fields || {};
          return {
            id:           r.id,
            name:         String(f.Name         || "").trim(),
            email:        String(f.Email        || "").trim(),
            athleteToken: String(f.AthleteToken || "").trim(),
            createdAt:    String(f.CreatedAt    || "").trim(),
            sport:        String(f.sport        || "").trim(),
            team:         String(f.Team         || "").trim(),
            status:       String(f.Status       || "").trim(),
          };
        });
        debug.counts.athletes = athletes.length;
      }
    } catch (e) {
      console.error("[api/org/workouts/day] athletes query error:", e);
      debug.athletesError = { message: e?.message || String(e) };
    }
  }

  // Cross-reference: add athleteName to each workout using AthleteToken
  const tokenToName = new Map(
    athletes
      .filter(a => a.athleteToken && a.name)
      .map(a => [a.athleteToken, a.name])
  );

  const enrichWorkout = (w) => ({
    ...w,
    athleteName: (w.athleteToken ? tokenToName.get(w.athleteToken) : null) || null,
  });

  const enrichedWorkouts        = workouts.map(enrichWorkout);
  const enrichedWorkoutsAll     = workoutsAll.map(enrichWorkout);

  return res.status(200).json({
    workouts:           enrichedWorkouts,
    athletes,
    itemsByWorkoutId,
    completionByItemId,
    availableSports,
    debug,
  });
}