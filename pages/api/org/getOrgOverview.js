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

const prescriptionsBase =
  process.env.PRESCRIPTIONS_API_KEY && process.env.PRESCRIPTIONS_BASE_ID
    ? new Airtable({ apiKey: process.env.PRESCRIPTIONS_API_KEY }).base(process.env.PRESCRIPTIONS_BASE_ID)
    : null;

// Workouts live in a separate base (same one used by workouts-calendar)
const workoutsBase =
  process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID
    ? new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID)
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
  const PRESCRIPTIONS_TABLE = process.env.PRESCRIPTIONS_TABLE_NAME;
  const WORKOUTS_TABLE      = process.env.AIRTABLE_WORKOUTS_TABLE || "DailyWorkouts";
  const NUTRITION_COMPLETIONS_TABLE =
    process.env.NUTRITION_COMPLETIONS_TABLE || "NutritionCompletions";

  if (!athletesBase || !ATHLETES_TABLE) {
    return res.status(500).json({
      error: "Athletes Airtable not configured. Check ATHLETE_API_KEY, ATHLETE_BASE_ID, ATHLETE_TABLE_NAME.",
    });
  }
  if (!prescriptionsBase || !PRESCRIPTIONS_TABLE) {
    return res.status(500).json({
      error: "Prescriptions Airtable not configured. Check PRESCRIPTIONS_API_KEY, PRESCRIPTIONS_BASE_ID, PRESCRIPTIONS_TABLE_NAME.",
    });
  }

  const auth = requireOrg(req);
  if (!auth?.ok) {
    return res.status(401).json({ error: auth?.error || "Unauthorized" });
  }

  // Support both modern (orgId) and legacy (token) auth — same pattern as requireOrg itself
  const orgId    = String(auth?.org?.id    || "").trim();
  const orgToken = String(auth?.org?.token || "").trim();

  if (!orgId && !orgToken) {
    return res.status(401).json({ error: "Organization session missing orgId/token" });
  }

  const daysStale    = Math.max(7,  Math.min(180, Number(req.query?.daysStale    || 30)));
  const activityLimit = Math.max(5, Math.min(50,  Number(req.query?.activityLimit || 10)));

  try {
    const safeToken = orgToken ? escapeAirtableString(orgToken) : "";
    const safeOrgId = orgId    ? escapeAirtableString(orgId)    : "";

    // Build org filter — prefer orgId, fall back to Token field
    const athleteOrgFilter = orgId
      ? `{OrgId}='${safeOrgId}'`
      : `{Token}='${safeToken}'`;

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

    /* ── 2. Load ALL prescriptions for this org ── */
    const rxOrgFilter = orgId
      ? `{OrgId}='${safeOrgId}'`
      : `{Organization Token}='${safeToken}'`;

    const rxRecords = await fetchAllPages(
      prescriptionsBase(PRESCRIPTIONS_TABLE).select({
        filterByFormula: rxOrgFilter,
        sort: [{ field: "CreatedAt", direction: "desc" }],
      })
    );

    // Group by athlete email
    const byEmail = {};
    const activity = [];

    for (const r of rxRecords) {
      const f     = r.fields || {};
      const email = String(f["Athlete Email"] || f.AthleteEmail || "").trim().toLowerCase();
      if (!email) continue;

      const item = {
        id:           r.id,
        athleteEmail: email,
        title:        f.Title        || "",
        createdAt:    f.CreatedAt    || "",
        createdBy:    f.CreatedBy    || "",
        organization: f.Organization || "",
        prescription: f.Prescription || "",
      };

      byEmail[email] = byEmail[email] || [];
      byEmail[email].push(item);
      activity.push({
        type:         "plan",
        athleteEmail: email,
        title:        item.title || "Plan",
        createdAt:    item.createdAt,
        createdBy:    item.createdBy,
      });
    }

    for (const email of Object.keys(byEmail)) {
      byEmail[email].sort(sortByDateDesc);
    }

    /* ── 3. Build per-athlete metrics ── */
    const now    = new Date();
    const staleMs = daysStale * 24 * 60 * 60 * 1000;

    let totalPlans = 0, athletesWithPlans = 0;
    let activeLast30 = 0, staleCount = 0, needsPlan = 0;

    const enrichedAthletes = athletes.map((a) => {
      const plans   = byEmail[a.email] || [];
      totalPlans   += plans.length;

      const hasPlan = plans.length > 0;
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
    let workoutsTodayCompleted = 0;
    let workoutsTodayTotal     = 0;

    if (workoutsBase) {
      try {
        const today       = todayNY();
        // Filter: records for this org where date = today
        // DailyWorkouts stores OrgId and a Date field
        const wFilter = orgId
          ? `AND({OrgId}='${safeOrgId}', IS_SAME({Date}, '${today}', 'day'))`
          : `AND({Token}='${safeToken}', IS_SAME({Date}, '${today}', 'day'))`;

        const workoutRecs = await fetchAllPages(
          workoutsBase(WORKOUTS_TABLE).select({
            filterByFormula: wFilter,
            fields: ["Status", "Date", "OrgId"],
          })
        );

        workoutsTodayTotal     = workoutRecs.length;
        workoutsTodayCompleted = workoutRecs.filter(r =>
          String(r.fields?.Status || "").toLowerCase() === "complete"
        ).length;
      } catch (wErr) {
        // Non-fatal — workouts stats degrade gracefully
        console.warn("[getOrgOverview] workouts today query failed:", wErr?.message);
      }
    }

    /* ── 5. Nutrition completions today ────────────────────────────────── */
    let nutritionTodayCompleted = 0;
    let nutritionTodayTotal     = 0;

    if (nutritionBase && emails.length > 0) {
      try {
        const today = todayNY();
        // NutritionCompletions has a Date field and links to Athlete record
        // We count: how many athletes have a completion record for today,
        // and of those, how many have all meals done (totalPct = 100 or mealDone = true for all)
        const ncFilter = `IS_SAME({Date}, '${today}', 'day')`;

        const ncRecs = await fetchAllPages(
          nutritionBase(NUTRITION_COMPLETIONS_TABLE).select({
            filterByFormula: ncFilter,
            fields: ["Date", "CompletionJson", "Athlete"],
          })
        );

        // Get the set of athlete record IDs for this org
        const orgAthleteIds = new Set(athleteRecords.map(r => r.id));

        // Only count completions for athletes in this org
        const orgNcRecs = ncRecs.filter(r => {
          const links = r.fields?.Athlete || [];
          return Array.isArray(links) && links.some(id => orgAthleteIds.has(id));
        });

        nutritionTodayTotal = orgAthleteIds.size; // denominator = all athletes in org

        for (const r of orgNcRecs) {
          try {
            const raw  = r.fields?.CompletionJson || "{}";
            const comp = typeof raw === "string" ? JSON.parse(raw) : raw;
            const keys = ["breakfast", "lunch", "afternoon", "dinner"];
            // Count as "done" if at least one meal is checked
            const anyDone = keys.some(k => comp?.[k]?.mealDone || comp?.[k]?.hydrationDone);
            if (anyDone) nutritionTodayCompleted += 1;
          } catch { /* malformed JSON — skip */ }
        }
      } catch (nErr) {
        // Non-fatal — nutrition stats degrade gracefully
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