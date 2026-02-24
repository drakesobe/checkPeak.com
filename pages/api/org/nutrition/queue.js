// pages/api/org/nutrition/queue.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

/* ---------------- helpers ---------------- */

function asString(v) {
  return String(v ?? "").trim();
}

function safeArr(v) {
  return Array.isArray(v) ? v : [];
}

function chunk(arr, size = 25) {
  const out = [];
  const a = Array.isArray(arr) ? arr : [];
  for (let i = 0; i < a.length; i += size) out.push(a.slice(i, i + size));
  return out;
}

function makeOrEquals(fieldName, values) {
  const safe = (v) => String(v).replace(/'/g, "\\'");
  const parts = (Array.isArray(values) ? values : [])
    .map((v) => asString(v))
    .filter(Boolean)
    .map((v) => `{${fieldName}}='${safe(v)}'`);

  if (!parts.length) return "";
  if (parts.length === 1) return parts[0];
  return `OR(${parts.join(",")})`;
}

function clampPct(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function weekStartISO(d = new Date()) {
  // Sunday-start week
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  const day = x.getDay(); // 0=Sun
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
}

function daysAgoISO(n) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function normalizePlanStatus(raw) {
  const s = asString(raw).toLowerCase();
  if (!s) return "no_plan";
  if (s === "active") return "active";
  if (s === "no plan" || s === "no_plan" || s === "noplan") return "no_plan";
  return s.replace(/\s+/g, "_");
}

function labelPlanStatus(norm) {
  if (norm === "active") return "Active";
  if (norm === "no_plan") return "No Plan";
  return norm
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

/* ---------------- Airtable: NutritionCheckins ---------------- */

const NUTRITIONCHECKINS_API_KEY = process.env.NUTRITIONCHECKINS_API_KEY;
const NUTRITIONCHECKINS_BASE_ID = process.env.NUTRITIONCHECKINS_BASE_ID;
const NUTRITIONCHECKINS_TABLE = process.env.NUTRITIONCHECKINS_TABLE || "NutritionCheckins";

function getCheckinsTable() {
  if (!NUTRITIONCHECKINS_API_KEY || !NUTRITIONCHECKINS_BASE_ID) return null;
  const base = new Airtable({ apiKey: NUTRITIONCHECKINS_API_KEY }).base(NUTRITIONCHECKINS_BASE_ID);
  return base(NUTRITIONCHECKINS_TABLE);
}

/* ---------------- Airtable: NutritionPlans ---------------- */

const NUTRITION_API_KEY = process.env.NUTRITION_API_KEY;
const NUTRITION_BASE_ID = process.env.NUTRITION_BASE_ID;
const NUTRITION_PLANS_TABLE = process.env.NUTRITION_PLANS_TABLE || "NutritionPlans";

function getPlansTable() {
  if (!NUTRITION_API_KEY || !NUTRITION_BASE_ID || !NUTRITION_PLANS_TABLE) return null;
  const base = new Airtable({ apiKey: NUTRITION_API_KEY }).base(NUTRITION_BASE_ID);
  return base(NUTRITION_PLANS_TABLE);
}

/* ---------------- STRICT FIELD NAMES ---------------- */

// NutritionCheckins
const CHECKIN_TOKEN_FIELD = "AthleteToken"; // lookup
const CHECKIN_WEEK_FIELD = "WeekStartISO";
const CHECKIN_CREATED_FIELD = "CreatedAt";
const CHECKIN_CAL_FIELD = "CaloriesAdherencePct";
const CHECKIN_PRO_FIELD = "ProteinAdherencePct";
const CHECKIN_HYD_FIELD = "HydrationAdherencePct";
const CHECKIN_NOTES_FIELD = "Notes";
const CHECKIN_STATUS_FIELD = "Status"; // lookup

// NutritionPlans
const PLAN_TOKEN_FIELD = "AthleteToken"; // lookup
const PLAN_STATUS_FIELD = "Status"; // text
const PLAN_CREATED_FIELD = "CreatedAt";

/* ---------------- main handler ---------------- */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const org = requireOrg(req, res);
  if (!org?.ok) return;

  try {
    // 1) Load athletes via internal endpoint (cookie session)
    const host = req.headers.host;
    const proto = (req.headers["x-forwarded-proto"] || "http").toString();

    const athletesRes = await fetch(`${proto}://${host}/api/org/getAthletes`, {
      method: "GET",
      headers: { cookie: req.headers.cookie || "" },
    });

    const athletesJson = await safeJson(athletesRes);
    if (!athletesRes.ok) {
      return res.status(athletesRes.status).json({
        error: athletesJson?.error || "Failed to load athletes for nutrition queue.",
      });
    }

    const athletesRaw = Array.isArray(athletesJson?.athletes) ? athletesJson.athletes : [];

    // ✅ Source of truth: getAthletes already returns sport/team from AthleteScans
    const athletes = athletesRaw
      .map((a) => {
        const athleteToken = asString(a?.athleteToken);
        return {
          id: asString(a?.id || a?.athleteId),
          name: asString(a?.name) || "Athlete",
          email: asString(a?.email),
          sport: asString(a?.sport), // single select in AthleteScans
          team: asString(a?.team),   // Team field in AthleteScans
          athleteToken,
        };
      })
      .filter((a) => Boolean(a.athleteToken) && Boolean(a.id));

    // ✅ Build dropdown options
    const sports = Array.from(new Set(athletes.map((a) => asString(a.sport)).filter(Boolean))).sort();
    const teams = Array.from(new Set(athletes.map((a) => asString(a.team)).filter(Boolean))).sort();

    // ✅ sport -> teams map (for narrowing dropdown on sport selection)
    const teamsBySport = athletes.reduce((acc, a) => {
      const s = asString(a.sport);
      const t = asString(a.team);
      if (!s || !t) return acc;
      if (!acc[s]) acc[s] = [];
      acc[s].push(t);
      return acc;
    }, {});

    for (const k of Object.keys(teamsBySport)) {
      teamsBySport[k] = Array.from(new Set(teamsBySport[k])).sort();
    }

    const thisWeek = weekStartISO(new Date());

    /* -------- 2) Latest check-in per athlete (by AthleteToken) -------- */

    const checkinsByToken = {};
    const chkTable = getCheckinsTable();

    if (chkTable && athletes.length) {
      const minWeek = daysAgoISO(21);
      const tokens = athletes.map((a) => a.athleteToken);

      for (const group of chunk(tokens, 40)) {
        const filter = `AND(
          IS_AFTER(
            DATETIME_PARSE({${CHECKIN_WEEK_FIELD}} & ''),
            DATETIME_PARSE('${minWeek}')
          ),
          ${makeOrEquals(CHECKIN_TOKEN_FIELD, group)}
        )`;

        const recs = await chkTable
          .select({
            filterByFormula: filter,
            pageSize: 100,
            sort: [{ field: CHECKIN_CREATED_FIELD, direction: "desc" }],
          })
          .all();

        recs.forEach((r) => {
          const tok = asString(r.get(CHECKIN_TOKEN_FIELD));
          if (!tok) return;

          const createdAt = asString(r.get(CHECKIN_CREATED_FIELD)) || asString(r._rawJson?.createdTime);
          const week = asString(r.get(CHECKIN_WEEK_FIELD)).slice(0, 10);

          const statusLookup = r.get(CHECKIN_STATUS_FIELD);
          const status = Array.isArray(statusLookup) ? asString(statusLookup[0]) : asString(statusLookup);

          const row = {
            weekStartISO: week,
            createdAt,
            caloriesPct: clampPct(r.get(CHECKIN_CAL_FIELD)),
            proteinPct: clampPct(r.get(CHECKIN_PRO_FIELD)),
            hydrationPct: clampPct(r.get(CHECKIN_HYD_FIELD)),
            notes: asString(r.get(CHECKIN_NOTES_FIELD)),
            status,
          };

          const prev = checkinsByToken[tok];
          if (!prev) checkinsByToken[tok] = row;
          else {
            const pt = prev.createdAt ? new Date(prev.createdAt).getTime() : 0;
            const nt = createdAt ? new Date(createdAt).getTime() : 0;
            if (nt >= pt) checkinsByToken[tok] = row;
          }
        });
      }
    }

    /* -------- 3) Latest plan per athlete (by AthleteToken) -------- */

    const plansByToken = {};
    const plansTable = getPlansTable();

    if (plansTable && athletes.length) {
      const tokens = athletes.map((a) => a.athleteToken);

      for (const group of chunk(tokens, 40)) {
        const filter = `${makeOrEquals(PLAN_TOKEN_FIELD, group)}`;
        if (!filter) continue;

        const recs = await plansTable
          .select({
            filterByFormula: filter,
            pageSize: 100,
            sort: [{ field: PLAN_CREATED_FIELD, direction: "desc" }],
          })
          .all();

        recs.forEach((r) => {
          const tok = asString(r.get(PLAN_TOKEN_FIELD));
          if (!tok) return;

          const createdAt = asString(r.get(PLAN_CREATED_FIELD)) || asString(r._rawJson?.createdTime);
          const statusRaw = asString(r.get(PLAN_STATUS_FIELD));
          const statusNorm = normalizePlanStatus(statusRaw);

          const next = { createdAt, statusRaw, statusNorm };

          const prev = plansByToken[tok];
          if (!prev) plansByToken[tok] = next;
          else {
            const pt = prev.createdAt ? new Date(prev.createdAt).getTime() : 0;
            const nt = createdAt ? new Date(createdAt).getTime() : 0;
            if (nt >= pt) plansByToken[tok] = next;
          }
        });
      }
    }

    /* -------- 4) Build rows -------- */

    const rows = athletes.map((a) => {
      const tok = a.athleteToken;

      const plan = plansByToken[tok] || null;
      const planStatusNorm = plan?.statusNorm || "no_plan";
      const planStatusLabel = labelPlanStatus(planStatusNorm);

      // hasPlan means ACTIVE only
      const hasPlan = planStatusNorm === "active";
      const latestPlanCreatedAt = plan?.createdAt || "";

      const lastCheckin = checkinsByToken[tok] || null;
      const missingCheckin = !lastCheckin || lastCheckin.weekStartISO !== thisWeek;

      const adherenceAvg = lastCheckin
        ? Math.round((lastCheckin.caloriesPct + lastCheckin.proteinPct + lastCheckin.hydrationPct) / 3)
        : 0;

      const lowAdherence = lastCheckin ? adherenceAvg < 70 : false;

      const needsAction = !hasPlan || missingCheckin || lowAdherence;
      const priority = !hasPlan ? 1 : missingCheckin ? 2 : lowAdherence ? 3 : 9;

      const reasons = [];
      if (!hasPlan) reasons.push("No active plan");
      if (missingCheckin) reasons.push("Missing this week’s check-in");
      if (lowAdherence) reasons.push("Adherence below 70%");

      const priorityLabel =
        !hasPlan ? "No Plan" : missingCheckin ? "Missing Check-in" : lowAdherence ? "Low Adherence" : "Good";

      return {
        athleteId: a.id,
        athleteName: a.name,
        athleteEmail: a.email,
        athleteToken: tok,

        // ✅ used by filters/table
        sport: a.sport,
        team: a.team,

        planStatus: planStatusLabel,
        planStatusRaw: plan?.statusRaw || "",
        planStatusNorm,

        hasPlan,
        latestPlanCreatedAt,

        lastCheckin,
        missingCheckin,
        adherenceAvg,
        lowAdherence,

        needsAction,
        priority,
        reasons,
        priorityLabel,
      };
    });

    rows.sort((x, y) => (x.priority || 9) - (y.priority || 9));

    const counts = {
      total: rows.length,
      needsAction: rows.filter((r) => r.needsAction).length,
      missingCheckin: rows.filter((r) => r.missingCheckin).length,
      lowAdherence: rows.filter((r) => r.lowAdherence).length,
      noPlan: rows.filter((r) => !r.hasPlan).length,
    };

    return res.status(200).json({
      ok: true,
      rows,
      counts,
      meta: {
        weekStartISO: thisWeek,
        generatedAt: new Date().toISOString(),
        athletesCount: rows.length,
        mode: "AthleteToken matching for Plans + Checkins",

        // ✅ these feed NutritionControls dropdowns
        sports,
        teams,
        teamsBySport,
      },
    });
  } catch (e) {
    console.error("[nutrition/queue] error:", e);
    return res.status(500).json({
      error: e?.message || "Failed to build nutrition queue.",
      airtable: {
        statusCode: e?.statusCode,
        message: e?.message,
        error: e?.error,
      },
    });
  }
}