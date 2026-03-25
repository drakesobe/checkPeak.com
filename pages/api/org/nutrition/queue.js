// pages/api/org/nutrition/queue.js
//
// Builds the full per-athlete nutrition queue for the current week.
// Uses /api/org/getAthletes internally for athlete fetching so org
// scoping and auth are handled consistently.
//
// Env vars used:
//   ATHLETE_API_KEY, ATHLETE_BASE_ID, ATHLETE_TABLE_NAME
//   NUTRITION_API_KEY, NUTRITION_BASE_ID
//   NUTRITION_TABLE_NAME        — NutritionPlans table ID
//   NUTRITION_TOKEN_FIELD       — "AthleteToken" (token field on plans)
//   NUTRITION_PLANS_LINK_FIELD  — "Athlete" (linked athlete field)
//   NUTRITION_STATUS_FIELD      — "Status" (active/inactive plan status)
//   NUTRITION_CREATEDAT_FIELD   — "CreatedAt"
//   NUTRITION_COMPLETIONS_TABLE — NutritionCompletions table ID

import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

// ── Env vars ──────────────────────────────────────────────────────────────────
const ATHLETE_API_KEY    = process.env.ATHLETE_API_KEY;
const ATHLETE_BASE_ID    = process.env.ATHLETE_BASE_ID;
const ATHLETE_TABLE_NAME = process.env.ATHLETE_TABLE_NAME;

const NUTRITION_API_KEY     = process.env.NUTRITION_API_KEY;
const NUTRITION_BASE_ID     = process.env.NUTRITION_BASE_ID;

// NutritionPlans — matches getByAthlete.js exactly
const PLANS_TABLE           = process.env.NUTRITION_PLANS_TABLE         || "tblbN4C6BWn6MNWzu";
const PLAN_TOKEN_FIELD      = process.env.NUTRITION_TOKEN_FIELD         || "AthleteToken";
const PLAN_CREATEDAT_FIELD  = process.env.NUTRITION_CREATED_AT_FIELD    || "CreatedAt";
const PLAN_PHASE_FIELD      = process.env.NUTRITION_PHASE_FIELD         || "Phase";
const PLAN_STATUS_FIELD     = process.env.NUTRITION_STATUS_FIELD        || "Status";
const PLAN_CAL_FIELD        = process.env.NUTRITION_DAILY_CAL_FIELD     || "DailyCalories";
const PLAN_PROTEIN_FIELD    = process.env.NUTRITION_DAILY_P_FIELD       || "DailyProtein";
const PLAN_CARBS_FIELD      = process.env.NUTRITION_DAILY_C_FIELD       || "DailyCarbs";
const PLAN_FAT_FIELD        = process.env.NUTRITION_DAILY_F_FIELD       || "DailyFat";

// NutritionCompletions
const COMPLETIONS_TABLE     = process.env.NUTRITION_COMPLETIONS_TABLE;

// Fields to pull from NutritionPlans
const PLAN_FIELDS = [
  PLAN_TOKEN_FIELD,
  PLAN_CREATEDAT_FIELD,
  PLAN_PHASE_FIELD,
  PLAN_STATUS_FIELD,
  PLAN_CAL_FIELD,
  PLAN_PROTEIN_FIELD,
  PLAN_CARBS_FIELD,
  PLAN_FAT_FIELD,
];

// Fields to pull from NutritionCompletions
// Update these to match your actual field names in the completions table
const COMPLETION_TOKEN_FIELD    = process.env.NUTRITION_TOKEN_FIELD || "AthleteToken";
const COMPLETION_WEEK_FIELD     = "WeekStart";   // ISO date "YYYY-MM-DD" — update if different
const COMPLETION_CALORIES_FIELD = "CaloriesLogged"; // update if different
const COMPLETION_TARGET_FIELD   = "CaloriesTarget"; // update if different

// Athlete table reminder fields (written by send-reminder.js)
const ATH_LAST_REMINDER  = "LastReminderSentAt";
const ATH_REMINDER_COUNT = "ReminderCount";

// ── Helpers ───────────────────────────────────────────────────────────────────
function asStr(v) { return String(v ?? "").trim(); }

function getAirtableTable(apiKey, baseId, tableId) {
  if (!apiKey || !baseId || !tableId) return null;
  return new Airtable({ apiKey }).base(baseId)(tableId);
}

function getWeekStart() {
  const now   = new Date();
  const start = new Date(now);
  start.setUTCDate(now.getUTCDate() - now.getUTCDay());
  start.setUTCHours(0, 0, 0, 0);
  return start.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function escapeAirtable(str = "") {
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function fetchAllRecords(table, opts = {}) {
  const records = [];
  await table.select(opts).eachPage((page, next) => { records.push(...page); next(); });
  return records;
}

// A plan exists if the athlete's token is present in the NutritionPlans table.
// Status = "Active" confirms it — but presence alone is sufficient.
// No need to filter by status value.
function hasPlanRecord(fields) {
  return Boolean(asStr(fields[NUTRITION_TOKEN_FIELD]));
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req, res);
  if (!auth?.ok) return;

  const weekStart = getWeekStart();

  try {
    // ── 1. Fetch athletes via existing getAthletes endpoint ───────────────────
    const protocol   = process.env.VERCEL_URL ? "https" : "http";
    const host       = process.env.VERCEL_URL || `localhost:${process.env.PORT || 3000}`;

    const athleteRes  = await fetch(`${protocol}://${host}/api/org/getAthletes`, {
      method:  "GET",
      headers: {
        cookie: req.headers.cookie || "",
        ...(req.headers.authorization ? { authorization: req.headers.authorization } : {}),
      },
    });

    const athleteJson = await athleteRes.json().catch(() => ({}));

    if (!athleteRes.ok) {
      return res.status(athleteRes.status).json({
        error:   "Failed to fetch athletes",
        details: athleteJson?.error || athleteJson,
      });
    }

    const athletes = Array.isArray(athleteJson?.athletes) ? athleteJson.athletes : [];

    if (!athletes.length) {
      return res.status(200).json({
        rows:   [],
        meta:   { weekStartISO: weekStart, sports: [], teams: [] },
        counts: { total: 0, withPlan: 0, missingPlan: 0, noCheckin: 0, lowAdherence: 0, onTrack: 0 },
      });
    }

    // Build token → athlete lookup
    const athleteByToken = {};
    for (const a of athletes) {
      const tok = asStr(a.athleteToken);
      if (tok) athleteByToken[tok] = a;
    }
    const tokens = Object.keys(athleteByToken);

    // ── 2. Fetch reminder tally from AthleteScans ─────────────────────────────
    // These two fields are written by send-reminder.js and aren't in getAthletes
    const reminderByToken = {};

    if (ATHLETE_API_KEY && ATHLETE_BASE_ID && ATHLETE_TABLE_NAME && tokens.length) {
      try {
        const athTable = getAirtableTable(ATHLETE_API_KEY, ATHLETE_BASE_ID, ATHLETE_TABLE_NAME);
        const BATCH = 100;

        for (let i = 0; i < tokens.length; i += BATCH) {
          const batch   = tokens.slice(i, i + BATCH);
          const formula = batch.length === 1
            ? `{AthleteToken}='${escapeAirtable(batch[0])}'`
            : `OR(${batch.map(t => `{AthleteToken}='${escapeAirtable(t)}'`).join(",")})`;

          const recs = await fetchAllRecords(athTable, {
            filterByFormula: formula,
            fields: ["AthleteToken", ATH_LAST_REMINDER, ATH_REMINDER_COUNT],
          });

          for (const r of recs) {
            const tok = asStr(r.fields["AthleteToken"]);
            if (tok) reminderByToken[tok] = {
              lastReminderSentAt: asStr(r.fields[ATH_LAST_REMINDER]) || null,
              reminderCount:      Number(r.fields[ATH_REMINDER_COUNT] || 0),
            };
          }
        }
      } catch (e) {
        console.warn("[nutrition/queue] reminder fields unavailable:", e?.message);
      }
    }

    // ── 3. Fetch active nutrition plans from NutritionPlans ───────────────────
    // Uses same lookup pattern as getByAthlete.js — FIND() on AthleteToken field
    const plansByToken = {};
    const planTable    = getAirtableTable(NUTRITION_API_KEY, NUTRITION_BASE_ID, PLANS_TABLE);

    if (planTable && tokens.length) {
      try {
        // Batch tokens into groups of 20 — FIND() OR formulas get long fast
        const BATCH = 20;
        for (let i = 0; i < tokens.length; i += BATCH) {
          const batch = tokens.slice(i, i + BATCH);

          // Use FIND() exactly like getByAthlete.js for reliable linked field lookup
          const formula = batch.length === 1
            ? `FIND('${escapeAirtable(batch[0])}', ARRAYJOIN({${PLAN_TOKEN_FIELD}}&''))>0`
            : `OR(${batch.map(t => `FIND('${escapeAirtable(t)}', ARRAYJOIN({${PLAN_TOKEN_FIELD}}&''))>0`).join(",")})`;

          const recs = await fetchAllRecords(planTable, {
            filterByFormula: formula,
            fields: PLAN_FIELDS.filter(Boolean),
            sort: [{ field: PLAN_CREATEDAT_FIELD, direction: "desc" }],
          });

          for (const r of recs) {
            // AthleteToken may be an array (linked field) or a string
            const rawTok = r.fields[PLAN_TOKEN_FIELD];
            const tok = Array.isArray(rawTok)
              ? asStr(rawTok[0])
              : asStr(rawTok);

            // Token present + athlete in our roster = has a plan
            // Keep most recent only (sort is desc)
            if (tok && athleteByToken[tok] && !plansByToken[tok]) {
              plansByToken[tok] = { ...r.fields, _recordId: r.id };
            }
          }
        }

        console.log(`[nutrition/queue] Plans: ${Object.keys(plansByToken).length}/${tokens.length} athletes matched`);
      } catch (e) {
        console.warn("[nutrition/queue] NutritionPlans fetch failed:", e?.message);
      }
    } else if (!planTable) {
      console.warn("[nutrition/queue] NutritionPlans not configured — check NUTRITION_API_KEY, NUTRITION_BASE_ID, NUTRITION_PLANS_TABLE");
    }

    // ── 4. Fetch this week's completions from NutritionCompletions ────────────
    const completionsByToken = {};
    const completionsTable   = getAirtableTable(NUTRITION_API_KEY, NUTRITION_BASE_ID, COMPLETIONS_TABLE);

    if (completionsTable) {
      try {
        // Try filtering by week — if COMPLETION_WEEK_FIELD doesn't exist this
        // will throw and we fall through gracefully
        const safeWeek = escapeAirtable(weekStart);
        const recs     = await fetchAllRecords(completionsTable, {
          filterByFormula: `{${COMPLETION_WEEK_FIELD}} = '${safeWeek}'`,
          fields: [
            COMPLETION_TOKEN_FIELD,
            COMPLETION_WEEK_FIELD,
            COMPLETION_CALORIES_FIELD,
            COMPLETION_TARGET_FIELD,
          ].filter(Boolean),
        });

        for (const r of recs) {
          const tok = asStr(r.fields[COMPLETION_TOKEN_FIELD]);
          if (tok && athleteByToken[tok]) {
            completionsByToken[tok] = { ...r.fields, _recordId: r.id };
          }
        }

        console.log(`[nutrition/queue] Completions this week (${weekStart}): ${recs.length} records, ${Object.keys(completionsByToken).length} matched athletes`);
      } catch (e) {
        console.warn("[nutrition/queue] NutritionCompletions unavailable:", e?.message);
        console.warn("  → Check NUTRITION_COMPLETIONS_TABLE and field names (COMPLETION_WEEK_FIELD etc.)");
      }
    } else {
      console.warn("[nutrition/queue] NutritionCompletions table not configured — check NUTRITION_COMPLETIONS_TABLE");
    }

    // ── 5. Build queue rows ───────────────────────────────────────────────────
    const rows = tokens.map(token => {
      const ath        = athleteByToken[token];
      const plan       = plansByToken[token]       ?? null;
      const completion = completionsByToken[token] ?? null;
      const reminder   = reminderByToken[token]    ?? { lastReminderSentAt: null, reminderCount: 0 };

      const hasPlan        = Boolean(plan);
      const missingCheckin = hasPlan && !completion;

      // Adherence: logged calories vs target for the week
      let adherenceAvg = null;
      if (completion) {
        const logged = Number(completion[COMPLETION_CALORIES_FIELD] || 0);
        const target = Number(
          completion[COMPLETION_TARGET_FIELD] ||
          plan?.[PLAN_CAL_FIELD] ||
          0
        );
        adherenceAvg = target > 0 ? Math.min(100, Math.round((logged / target) * 100)) : null;
      }

      return {
        athleteToken:       token,
        athleteName:        asStr(ath.name)  || "Athlete",
        position:           asStr(ath.role)  || "",
        team:               asStr(ath.team)  || "",
        sport:              asStr(ath.sport) || "",
        hasPlan,
        missingCheckin,
        adherenceAvg,
        // Plan details — useful for the assign/edit panel
        plan: plan ? {
          calories: Number(plan[PLAN_CAL_FIELD]     || 0),
          protein:  Number(plan[PLAN_PROTEIN_FIELD] || 0),
          carbs:    Number(plan[PLAN_CARBS_FIELD]   || 0),
          fat:      Number(plan[PLAN_FAT_FIELD]     || 0),
          phase:    asStr(plan[PLAN_PHASE_FIELD]),
          status:   asStr(plan[PLAN_STATUS_FIELD]),
          recordId: plan._recordId,
        } : null,
        lastReminderSentAt: reminder.lastReminderSentAt,
        reminderCount:      reminder.reminderCount,
        lastSeen:           null,
      };
    });

    // ── 6. Counts ─────────────────────────────────────────────────────────────
    const total        = rows.length;
    const withPlan     = rows.filter(r => r.hasPlan).length;
    const missingPlan  = rows.filter(r => !r.hasPlan).length;
    const noCheckin    = rows.filter(r => r.hasPlan && r.missingCheckin).length;
    const lowAdherence = rows.filter(r => r.adherenceAvg != null && r.adherenceAvg < 65).length;
    const onTrack      = rows.filter(r =>
      r.hasPlan && !r.missingCheckin &&
      (r.adherenceAvg == null || r.adherenceAvg >= 65)
    ).length;

    return res.status(200).json({
      rows,
      meta: {
        weekStartISO: weekStart,
        sports:       athleteJson.sports || [],
        teams:        athleteJson.teams  || [],
      },
      counts: { total, withPlan, missingPlan, noCheckin, lowAdherence, onTrack },
    });

  } catch (e) {
    console.error("[nutrition/queue] error:", e);
    return res.status(500).json({ error: e?.message || "Failed to load nutrition queue." });
  }
}