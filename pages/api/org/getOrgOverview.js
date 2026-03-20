// pages/api/org/getOrgOverview.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

/* ─── helpers ──────────────────────────────────────────────────────────── */

function escapeAirtableString(str = "") {
  return String(str).replace(/'/g, "\\'");
}

function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function sortByDateDesc(a, b) {
  const ad = safeDate(a?.createdAt)?.getTime?.() || 0;
  const bd = safeDate(b?.createdAt)?.getTime?.() || 0;
  return bd - ad;
}

/**
 * Fetch every page from an Airtable select query.
 * .firstPage() silently caps at 100 — use this for large tables.
 */
function fetchAllPages(query) {
  return new Promise((resolve, reject) => {
    const rows = [];
    query.eachPage(
      (records, next) => { rows.push(...records); next(); },
      (err) => { if (err) reject(err); else resolve(rows); }
    );
  });
}

/** Today as YYYY-MM-DD in New York time */
function todayNY() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find(p => p.type === "year")?.value;
  const m = parts.find(p => p.type === "month")?.value;
  const d = parts.find(p => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

/* ─── base connections ─────────────────────────────────────────────────── */

const athletesBase =
  process.env.ATHLETE_API_KEY && process.env.ATHLETE_BASE_ID
    ? new Airtable({ apiKey: process.env.ATHLETE_API_KEY }).base(process.env.ATHLETE_BASE_ID)
    : null;

// Workouts use their own env vars (DAILYWORKOUTS_*)
const workoutsBase =
  process.env.DAILYWORKOUTS_API_KEY && process.env.DAILYWORKOUTS_BASE_ID
    ? new Airtable({ apiKey: process.env.DAILYWORKOUTS_API_KEY }).base(process.env.DAILYWORKOUTS_BASE_ID)
    : null;

// Nutrition completions (same base as nutrition plans)
const nutritionBase =
  process.env.NUTRITION_API_KEY && process.env.NUTRITION_BASE_ID
    ? new Airtable({ apiKey: process.env.NUTRITION_API_KEY }).base(process.env.NUTRITION_BASE_ID)
    : null;

/* ─── handler ──────────────────────────────────────────────────────────── */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Route", "getOrgOverview");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ATHLETES_TABLE      = process.env.ATHLETE_TABLE_NAME;
  const NUTRITION_PLANS_TABLE  =
    process.env.NUTRITION_PLANS_TABLE ||
    process.env.NUTRITION_TABLE_NAME  ||
    "NutritionPlans";
  const WORKOUTS_TABLE      = process.env.DAILYWORKOUTS_TABLE_ID || process.env.AIRTABLE_WORKOUTS_TABLE || "DailyWorkouts";
  const NUTRITION_COMPLETIONS_TABLE =
    process.env.NUTRITION_COMPLETIONS_TABLE || "NutritionCompletions";

  if (!athletesBase || !ATHLETES_TABLE) {
    return res.status(500).json({
      error: "Athletes Airtable not configured. Check ATHLETE_API_KEY, ATHLETE_BASE_ID, ATHLETE_TABLE_NAME.",
    });
  }
  const auth = requireOrg(req);
  if (!auth?.ok) {
    return res.status(401).json({ error: auth?.error || "Unauthorized" });
  }

  // Support both modern (orgId) and legacy (token) auth — same pattern as requireOrg itself
  const orgId    = String(auth?.org?.id    || "").trim();
  const orgToken = String(auth?.org?.token || "").trim();

  // All Airtable filters use Token — it is required
  if (!orgToken) {
    return res.status(401).json({ error: "Organization token missing from session. Please log out and back in." });
  }

  const daysStale    = Math.max(7,  Math.min(180, Number(req.query?.daysStale    || 30)));
  const activityLimit = Math.max(5, Math.min(50,  Number(req.query?.activityLimit || 10)));

  try {
    const safeToken = orgToken ? escapeAirtableString(orgToken) : "";

    // Athletes table uses {Token} — there is no OrgId field on this table
    const athleteOrgFilter = `{Token}='${safeToken}'`;

    /* ── 1. Load ALL athletes for this org (eachPage avoids 100-record cap) ── */
    const athleteRecords = await fetchAllPages(
      athletesBase(ATHLETES_TABLE).select({
        filterByFormula: athleteOrgFilter,
        sort: [{ field: "CreatedAt", direction: "desc" }],
      })
    );

    const athletes = athleteRecords.map((r) => ({
      id:        r.id,
      name:      r.fields?.Name  || "",
      email:     String(r.fields?.Email || "").trim().toLowerCase(),
      createdAt: r.fields?.CreatedAt || "",
      status:    r.fields?.Status    || "Active",
      tags:      Array.isArray(r.fields?.Tags) ? r.fields.Tags : [],
    }));

    const emails = athletes.map(a => a.email).filter(Boolean);

    /* ── Early return when no athletes ── */
    const emptyStats = {
      totalAthletes: 0, totalPlans: 0, athletesWithPlans: 0,
      coveragePct: 0, coveragePercent: 0, needsPlan: 0,
      activeLast30: 0, staleCount: 0,
      workoutsTodayPercent: 0, nutritionTodayPercent: 0,
      workoutsTodayCompleted: 0, workoutsTodayTotal: 0,
      nutritionTodayCompleted: 0, nutritionTodayTotal: 0,
    };

    if (emails.length === 0) {
      return res.status(200).json({ stats: emptyStats, athletes: [], recentActivity: [] });
    }

    /* ── 2. Check nutrition plan coverage per athlete ─────────────────────
       Mirrors /api/org/nutrition/table.js exactly — individual lookups with
       concurrency limit of 8. Avoids batched OR formulas that fail silently
       when Airtable rejects overly-long formula strings.
    ── */

    // Build a stable recordId→athleteToken map from already-loaded athlete records
    const recIdToToken = new Map(
      athleteRecords.map(r => [r.id, String(r.fields?.AthleteToken || "").trim()])
    );

    // lookupSafeContains: works whether AthleteToken is a text or lookup/array field
    function lookupSafeContains(fieldName, value) {
      const safe = escapeAirtableString(value);
      return `FIND('${safe}', ARRAYJOIN({${fieldName}}&''))>0`;
    }

    // Concurrency-limited map — same as nutrition/table.js
    async function mapLimit(items, limit, fn) {
      const results = new Array(items.length);
      let i = 0;
      async function worker() {
        while (i < items.length) {
          const idx = i++;
          results[idx] = await fn(items[idx], idx);
        }
      }
      await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
      return results;
    }

    const activity = [];

    // Per-athlete plan lookup — concurrency 8, exactly like nutrition/table.js
    const planResultsByRecId = nutritionBase
      ? await mapLimit(athleteRecords, 8, async (athRec) => {
          const tok = String(athRec.fields?.AthleteToken || "").trim();
          if (!tok) return { recId: athRec.id, plans: [] };

          try {
            const filter = lookupSafeContains("AthleteToken", tok);
            const recs   = await nutritionBase(NUTRITION_PLANS_TABLE)
              .select({
                filterByFormula: filter,
                fields:          ["AthleteToken", "Status", "CreatedAt", "CreatedBy", "Prescription"],
                sort:            [{ field: "CreatedAt", direction: "desc" }],
                maxRecords:      50,
              })
              .firstPage();

            const plans = (recs || []).map(r => ({
              id:        r.id,
              title:     String(r.fields?.Prescription || "").slice(0, 80),
              status:    String(r.fields?.Status       || "").toLowerCase(),
              createdAt: r.fields?.CreatedAt || "",
              createdBy: r.fields?.CreatedBy || "",
            }));

            // Populate activity feed from this athlete's plans
            const email = String(athRec.fields?.Email || "").trim().toLowerCase();
            for (const p of plans) {
              activity.push({
                type:         "plan",
                athleteEmail: email,
                title:        p.title || "Nutrition Plan",
                createdAt:    p.createdAt,
                createdBy:    p.createdBy,
              });
            }

            return { recId: athRec.id, plans };
          } catch {
            return { recId: athRec.id, plans: [] };
          }
        })
      : athleteRecords.map(r => ({ recId: r.id, plans: [] }));

    // Index by record ID for fast lookup during enrichment
    const plansByRecId = new Map(planResultsByRecId.map(x => [x.recId, x.plans]));

    /* ── 3. Build per-athlete metrics ── */
    const now    = new Date();
    const staleMs = daysStale * 24 * 60 * 60 * 1000;

    let totalPlans = 0, athletesWithPlans = 0;
    let activeLast30 = 0, staleCount = 0, needsPlan = 0;

    const enrichedAthletes = athletes.map((a) => {
      // Match athlete to their Airtable record to get the plan lookup
      const athRec = athleteRecords.find(
        r => String(r.fields?.Email || "").trim().toLowerCase() === a.email
      );
      const plans    = (athRec ? plansByRecId.get(athRec.id) : null) || [];
      totalPlans    += plans.length;

      const hasPlan  = plans.length > 0;
      if (hasPlan) athletesWithPlans += 1;
      else needsPlan += 1;

      const last     = plans[0] || null;
      const lastDate = safeDate(last?.createdAt);

      const isActive30 = lastDate &&
        Math.abs(now.getTime() - lastDate.getTime()) <= 30 * 24 * 60 * 60 * 1000;
      if (isActive30) activeLast30 += 1;

      const isStale = lastDate ? now.getTime() - lastDate.getTime() > staleMs : true;
      if (isStale) staleCount += 1;

      return {
        ...a,
        plansCount:    plans.length,
        lastPlanAt:    last?.createdAt || "",
        lastPlanTitle: last?.title     || "",
        needsPlan:     !hasPlan,
        stale:         isStale,
      };
    });

    const totalAthletes = enrichedAthletes.length;
    const coveragePct   = totalAthletes
      ? Math.round((athletesWithPlans / totalAthletes) * 100)
      : 0;

    activity.sort(sortByDateDesc);
    const recentActivity = activity.slice(0, activityLimit);

    /* ── 4. Workouts today ─────────────────────────────────────────────── */
    // DailyWorkouts links to org via {Organization} linked record field.
    // Match by org name/token/id as primary values — same approach as workouts/range.js.
    let workoutsTodayCompleted = 0;
    let workoutsTodayTotal     = 0;

    if (workoutsBase) {
      try {
        const today = todayNY();

        // Build org candidates — name most reliable (linked primary), token/id as fallbacks
        const orgName = String(
          auth?.user?.OrgName || auth?.user?.organizationName ||
          auth?.user?.["Organization Name"] || auth?.org?.name || ""
        ).trim();

        const wOrgCandidates = [orgName, orgToken, orgId].filter(Boolean);

        if (wOrgCandidates.length > 0) {
          const orgJoin = `ARRAYJOIN({Organization}&"")`;
          const orgMatch = wOrgCandidates.length === 1
            ? `FIND("${wOrgCandidates[0].replace(/\\/g, "\\\\").replace(/"/g, '\\"')}", ${orgJoin})`
            : `OR(${wOrgCandidates.map(c =>
                `FIND("${c.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}", ${orgJoin})`
              ).join(",")})`;

          // Inclusive date range for today — same pattern as range.js
          const wFilter = `AND(${orgMatch}, OR(IS_SAME({Date}, "${today}", "day")))`;

          const workoutRecs = await fetchAllPages(
            workoutsBase(WORKOUTS_TABLE).select({
              filterByFormula: wFilter,
              fields: ["Status", "Date"],
              sort: [{ field: "Date", direction: "asc" }],
            })
          );

          workoutsTodayTotal     = workoutRecs.length;
          workoutsTodayCompleted = workoutRecs.filter(r => {
            const status = String(r.fields?.Status || "").toLowerCase();
            // "completed" = all items done, "pending_review" = submitted awaiting coach
            // Both count as done from the athlete's perspective (matches isAthleteDone in byDate.js)
            return status === "completed" || status === "pending_review";
          }).length;
        }
      } catch (wErr) {
        // Non-fatal — workouts stats degrade gracefully to 0
        console.warn("[getOrgOverview] workouts today query failed:", wErr?.message);
      }
    }

    /* ── 5. Nutrition completions today ────────────────────────────────── */
    // Uses AthleteToken — same approach as /api/org/nutrition/table.js
    let nutritionTodayCompleted = 0;
    let nutritionTodayTotal     = 0;

    if (nutritionBase && athletes.length > 0) {
      try {
        const today = todayNY();
        const MEAL_KEYS = ["breakfast", "lunch", "afternoon", "dinner"];

        const countChecked = (comp) => {
          let n = 0;
          for (const k of MEAL_KEYS) {
            if (comp?.[k]?.mealDone)      n++;
            if (comp?.[k]?.hydrationDone) n++;
          }
          return n;
        };

        // Collect AthleteTokens for every org athlete
        const athleteTokens = athleteRecords
          .map(r => String(r.fields?.AthleteToken || "").trim())
          .filter(Boolean);

        if (athleteTokens.length > 0) {
          const orgTokenSet = new Set(athleteTokens);

          // Batch into groups of 200 to stay within Airtable formula length limits
          const BATCH = 200;
          const allTodayRecs = [];

          for (let i = 0; i < athleteTokens.length; i += BATCH) {
            const batch = athleteTokens.slice(i, i + BATCH);
            const tokenOr = batch
              .map(t => `FIND('${escapeAirtableString(t)}', ARRAYJOIN({AthleteToken}&''))>0`)
              .join(", ");
            const batchFilter = `AND(IS_SAME({Date}, '${today}', 'day'), OR(${tokenOr}))`;

            const batchRecs = await fetchAllPages(
              nutritionBase(NUTRITION_COMPLETIONS_TABLE).select({
                filterByFormula: batchFilter,
                fields: ["Date", "CompletionJson", "AthleteToken"],
                sort: [{ field: "Date", direction: "desc" }],
              })
            );
            allTodayRecs.push(...batchRecs);
          }

          // Deduplicate by AthleteToken — pick record with most boxes checked if dupes
          const byToken = new Map();
          for (const r of allTodayRecs) {
            const tok = String(r.fields?.AthleteToken || "").trim();
            if (!tok || !orgTokenSet.has(tok)) continue;

            const raw  = r.fields?.CompletionJson || "{}";
            let   comp = {};
            try { comp = typeof raw === "string" ? JSON.parse(raw) : raw; } catch {}

            const existing = byToken.get(tok);
            if (!existing || countChecked(comp) > countChecked(existing)) {
              byToken.set(tok, comp);
            }
          }

          // Total  = all org athletes × 8 checkboxes (4 meals × meal + hydration)
          // Completed = every checked box across all athletes who have a record today
          nutritionTodayTotal     = athletes.length * 8;
          nutritionTodayCompleted = 0;
          for (const comp of byToken.values()) {
            nutritionTodayCompleted += countChecked(comp);
          }
        }
      } catch (nErr) {
        console.warn("[getOrgOverview] nutrition today query failed:", nErr?.message);
      }
    }

    const workoutsTodayPercent  = workoutsTodayTotal  > 0
      ? Math.round((workoutsTodayCompleted  / workoutsTodayTotal)  * 100) : 0;
    const nutritionTodayPercent = nutritionTodayTotal > 0
      ? Math.round((nutritionTodayCompleted / nutritionTodayTotal) * 100) : 0;

    /* ── 6. Respond ──────────────────────────────────────────────────────── */
    return res.status(200).json({
      stats: {
        totalAthletes,
        totalPlans,
        athletesWithPlans,
        coveragePct,
        coveragePercent: coveragePct,   // alias — grid reads coveragePercent
        needsPlan,
        activeLast30,
        staleCount,
        workoutsTodayPercent,
        nutritionTodayPercent,
        workoutsTodayCompleted,
        workoutsTodayTotal,
        nutritionTodayCompleted,
        nutritionTodayTotal,
      },
      athletes:       enrichedAthletes,
      recentActivity,
    });

  } catch (err) {
    console.error("[getOrgOverview] error:", err);
    return res.status(500).json({
      error: "Failed to build org overview",
      airtable: { statusCode: err?.statusCode, message: err?.message, error: err?.error },
    });
  }
}