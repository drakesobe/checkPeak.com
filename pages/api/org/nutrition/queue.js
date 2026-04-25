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
//   NEXT_PUBLIC_SITE_URL        — your production domain e.g. https://checkpeak.com

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
const COMPLETION_TOKEN_FIELD = process.env.NUTRITION_TOKEN_FIELD || "AthleteToken";
const COMPLETION_DATE_FIELD  = "Date";
const COMPLETION_JSON_FIELD  = "CompletionJson";

// ── Athlete table reminder fields ─────────────────────────────────────────────
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
  return start.toISOString().slice(0, 10);
}

function escapeAirtable(str = "") {
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function fetchAllRecords(table, opts = {}) {
  const records = [];
  await table.select(opts).eachPage((page, next) => { records.push(...page); next(); });
  return records;
}

// ── Resolve the internal base URL for server-side self-calls ──────────────────
// Priority:
//   1. NEXT_PUBLIC_SITE_URL  — your custom domain (most reliable)
//   2. VERCEL_URL            — Vercel's auto-generated deployment URL
//   3. localhost fallback    — local dev
//
// IMPORTANT: VERCEL_URL does not include the protocol and may not match
// your auth cookie domain if you're using a custom domain. Always set
// NEXT_PUBLIC_SITE_URL=https://yourdomain.com in your Vercel env vars.
function getInternalBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return `http://localhost:${process.env.PORT || 3000}`;
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
    // ── 1. Fetch athletes ─────────────────────────────────────────────────────
    const baseUrl    = getInternalBaseUrl();
    const athleteUrl = `${baseUrl}/api/org/getAthletes`;

    console.log("[nutrition/queue] fetching athletes from:", athleteUrl);

    const athleteRes  = await fetch(athleteUrl, {
      method:  "GET",
      headers: {
        cookie: req.headers.cookie || "",
        ...(req.headers.authorization ? { authorization: req.headers.authorization } : {}),
      },
    });

    const athleteJson = await athleteRes.json().catch(() => ({}));

    console.log(
      "[nutrition/queue] getAthletes →",
      "status:", athleteRes.status,
      "athletes:", athleteJson?.athletes?.length ?? "missing key",
      "error:", athleteJson?.error ?? "none"
    );

    if (!athleteRes.ok) {
      return res.status(athleteRes.status).json({
        error:   "Failed to fetch athletes",
        details: athleteJson?.error || athleteJson,
      });
    }

    const athletes = Array.isArray(athleteJson?.athletes) ? athleteJson.athletes : [];

    if (!athletes.length) {
      console.warn("[nutrition/queue] getAthletes returned 0 athletes — check org scoping and auth cookie domain");
      return res.status(200).json({
        rows:   [],
        meta:   { weekStartISO: weekStart, sports: [], teams: [] },
        counts: { total: 0, withPlan: 0, missingPlan: 0, noCheckin: 0, lowAdherence: 0, onTrack: 0 },
      });
    }

    const athleteByToken = {};
    for (const a of athletes) {
      const tok = asStr(a.athleteToken);
      if (tok) athleteByToken[tok] = a;
    }
    const tokens = Object.keys(athleteByToken);

    console.log(`[nutrition/queue] ${tokens.length} athletes loaded`);

    // ── 2. Fetch reminder tally from AthleteScans ─────────────────────────────
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
            if (tok) {
              reminderByToken[tok] = {
                lastReminderSentAt: asStr(r.fields[ATH_LAST_REMINDER]) || null,
                reminderCount:      Number(r.fields[ATH_REMINDER_COUNT] || 0),
              };
            }
          }
        }
      } catch (e) {
        console.warn("[nutrition/queue] reminder fields unavailable:", e?.message);
      }
    }

    // ── 3. Fetch active nutrition plans ───────────────────────────────────────
    const plansByToken = {};
    const planTable    = getAirtableTable(NUTRITION_API_KEY, NUTRITION_BASE_ID, PLANS_TABLE);

    if (planTable && tokens.length) {
      try {
        const BATCH = 20;
        for (let i = 0; i < tokens.length; i += BATCH) {
          const batch = tokens.slice(i, i + BATCH);

          const formula = batch.length === 1
            ? `FIND('${escapeAirtable(batch[0])}', ARRAYJOIN({${PLAN_TOKEN_FIELD}}&''))>0`
            : `OR(${batch.map(t => `FIND('${escapeAirtable(t)}', ARRAYJOIN({${PLAN_TOKEN_FIELD}}&''))>0`).join(",")})`;

          const recs = await fetchAllRecords(planTable, {
            filterByFormula: formula,
            fields: PLAN_FIELDS.filter(Boolean),
            sort: [{ field: PLAN_CREATEDAT_FIELD, direction: "desc" }],
          });

          for (const r of recs) {
            const rawTok = r.fields[PLAN_TOKEN_FIELD];
            const tok = Array.isArray(rawTok) ? asStr(rawTok[0]) : asStr(rawTok);
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

    // ── 4. Fetch this week's completions ──────────────────────────────────────
    // CompletionJson shape: { breakfast: { mealDone, hydrationDone }, lunch: ... }
    // Adherence = (total toggles checked / 8 possible) * 100
    // We fetch all completions from this week (Sun–today) and pick the
    // most recent per athlete.
    const completionsByToken = {};
    const completionsTable   = getAirtableTable(NUTRITION_API_KEY, NUTRITION_BASE_ID, COMPLETIONS_TABLE);

    if (completionsTable) {
      try {
        // Date filter: anything >= this week's Sunday
        // Airtable Date field is stored as ISO datetime so IS_AFTER works
        const weekSunday = `${weekStart}T00:00:00.000Z`;
        const recs = await fetchAllRecords(completionsTable, {
          filterByFormula: `IS_AFTER({${COMPLETION_DATE_FIELD}}, '${escapeAirtable(weekSunday)}')`,
          fields: [COMPLETION_TOKEN_FIELD, COMPLETION_DATE_FIELD, COMPLETION_JSON_FIELD].filter(Boolean),
          sort: [{ field: COMPLETION_DATE_FIELD, direction: "desc" }],
        });

        for (const r of recs) {
          const tok = asStr(r.fields[COMPLETION_TOKEN_FIELD]);
          if (tok && athleteByToken[tok] && !completionsByToken[tok]) {
            // Take only the most recent record per athlete (already sorted desc)
            completionsByToken[tok] = { ...r.fields, _recordId: r.id };
          }
        }

        console.log(`[nutrition/queue] Completions this week: ${recs.length} records, ${Object.keys(completionsByToken).length} matched athletes`);
      } catch (e) {
        console.warn("[nutrition/queue] NutritionCompletions unavailable:", e?.message);
      }
    } else {
      console.warn("[nutrition/queue] NutritionCompletions table not configured");
    }

    // ── 5. Build queue rows ───────────────────────────────────────────────────
    const rows = tokens.map(token => {
      const ath        = athleteByToken[token];
      const plan       = plansByToken[token]       ?? null;
      const completion = completionsByToken[token] ?? null;
      const reminder   = reminderByToken[token]    ?? { lastReminderSentAt: null, reminderCount: 0 };

      const hasPlan        = Boolean(plan);
      const missingCheckin = hasPlan && !completion;

      // Adherence = checked toggles / 8 possible (4 meals × mealDone + hydrationDone)
      let adherenceAvg = null;
      if (completion) {
        try {
          const raw  = asStr(completion[COMPLETION_JSON_FIELD]);
          const json = raw ? JSON.parse(raw) : null;
          if (json && typeof json === "object") {
            const MEALS = ["breakfast", "lunch", "afternoon", "dinner"];
            let checked = 0;
            for (const meal of MEALS) {
              if (json[meal]?.mealDone)      checked++;
              if (json[meal]?.hydrationDone) checked++;
            }
            adherenceAvg = Math.round((checked / 8) * 100);
          }
        } catch {
          adherenceAvg = null;
        }
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

    console.log(`[nutrition/queue] Built ${rows.length} rows — withPlan:${withPlan} noCheckin:${noCheckin} lowAdherence:${lowAdherence} onTrack:${onTrack}`);

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