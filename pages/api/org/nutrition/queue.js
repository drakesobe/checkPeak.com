// pages/api/org/nutrition/queue.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

/* ---------------- helpers ---------------- */

function asString(v) {
  return String(v ?? "").trim();
}

function escapeAirtableString(str = "") {
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
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

/* ---------------- Airtable: NutritionCheckins ---------------- */

const NUTRITIONCHECKINS_API_KEY = process.env.NUTRITIONCHECKINS_API_KEY;
const NUTRITIONCHECKINS_BASE_ID = process.env.NUTRITIONCHECKINS_BASE_ID;
const NUTRITIONCHECKINS_TABLE = process.env.NUTRITIONCHECKINS_TABLE || "NutritionCheckins";

function getCheckinsTable() {
  if (!NUTRITIONCHECKINS_API_KEY || !NUTRITIONCHECKINS_BASE_ID) return null;
  const base = new Airtable({ apiKey: NUTRITIONCHECKINS_API_KEY }).base(NUTRITIONCHECKINS_BASE_ID);
  return base(NUTRITIONCHECKINS_TABLE);
}

/* ---------------- Airtable: NutritionPlans (NEW) ---------------- */

const NUTRITION_API_KEY = process.env.NUTRITION_API_KEY;
const NUTRITION_BASE_ID = process.env.NUTRITION_BASE_ID;
const NUTRITION_PLANS_TABLE = process.env.NUTRITION_PLANS_TABLE || "NutritionPlans";

function getPlansTable() {
  if (!NUTRITION_API_KEY || !NUTRITION_BASE_ID || !NUTRITION_PLANS_TABLE) return null;
  const base = new Airtable({ apiKey: NUTRITION_API_KEY }).base(NUTRITION_BASE_ID);
  return base(NUTRITION_PLANS_TABLE);
}

/* ---------------- STRICT FIELD NAMES ---------------- */

// Athletes (from /api/org/getAthletes output)
const ATHLETE_TOKEN_FIELD = "AthleteToken"; // for checkins matching
const CHECKIN_WEEK_FIELD = "WeekStartISO";
const CHECKIN_CREATED_FIELD = "CreatedAt";
const CHECKIN_CAL_FIELD = "CaloriesAdherencePct";
const CHECKIN_PRO_FIELD = "ProteinAdherencePct";
const CHECKIN_HYD_FIELD = "HydrationAdherencePct";
const CHECKIN_NOTES_FIELD = "Notes";

// NutritionPlans
const PLAN_LINK_FIELD = "Athlete"; // linked record -> AthleteScans
const PLAN_STATUS_FIELD = "Status";
const PLAN_CREATED_FIELD = "CreatedAt";

/* ---------------- main handler ---------------- */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const org = requireOrg(req, res);
  if (!org?.ok) return;

  try {
    // 1) Load athletes via internal endpoint (uses cookie session)
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

    // STRICT: only athletes with AthleteToken are included (no email fallback)
    // ALSO: we keep their AthleteScans record id (needed to match NutritionPlans linked record)
    const athletes = athletesRaw
      .map((a) => {
        const athleteToken = asString(a?.athleteToken || a?.AthleteToken || a?.ATHLETETOKEN);
        return {
          id: asString(a?.id || a?.athleteId), // this should be AthleteScans record id
          name: asString(a?.name || a?.Name) || "Athlete",
          athleteToken,
        };
      })
      .filter((a) => Boolean(a.athleteToken) && Boolean(a.id));

    const thisWeek = weekStartISO(new Date());

    /* -------- 2) Latest check-in per athlete (STRICT AthleteToken) -------- */

    const checkinsByToken = {};
    const chkTable = getCheckinsTable();

    if (chkTable && athletes.length) {
      const minWeek = daysAgoISO(21);
      const tokens = athletes.map((a) => a.athleteToken);

      for (const group of chunk(tokens, 40)) {
        const filter = `AND(
          IS_AFTER({${CHECKIN_WEEK_FIELD}}, '${minWeek}'),
          ${makeOrEquals(ATHLETE_TOKEN_FIELD, group)}
        )`;

        const recs = await chkTable
          .select({
            filterByFormula: filter,
            pageSize: 100,
            sort: [{ field: CHECKIN_CREATED_FIELD, direction: "desc" }],
          })
          .all();

        recs.forEach((r) => {
          const tok = asString(r.get(ATHLETE_TOKEN_FIELD));
          if (!tok) return;

          const createdAt = asString(r.get(CHECKIN_CREATED_FIELD)) || asString(r._rawJson?.createdTime);
          const week = asString(r.get(CHECKIN_WEEK_FIELD)).slice(0, 10);

          const row = {
            weekStartISO: week,
            createdAt,
            caloriesPct: clampPct(r.get(CHECKIN_CAL_FIELD)),
            proteinPct: clampPct(r.get(CHECKIN_PRO_FIELD)),
            hydrationPct: clampPct(r.get(CHECKIN_HYD_FIELD)),
            notes: asString(r.get(CHECKIN_NOTES_FIELD)),
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

    /* -------- 3) Latest ACTIVE NutritionPlan per athlete (by linked record id) -------- */

    const latestPlanCreatedAtByAthleteId = {};
    const plansTable = getPlansTable();

    if (plansTable && athletes.length) {
      // We query plans in groups by matching linked athlete record ids
      const athleteIds = athletes.map((a) => a.id);

      for (const group of chunk(athleteIds, 25)) {
        // Airtable linked field is an array of record ids.
        // We can match if the record id appears inside ARRAYJOIN({Athlete}&'')
        const ors = group
          .map((id) => asString(id))
          .filter(Boolean)
          .map((id) => `FIND('${escapeAirtableString(id)}', ARRAYJOIN({${PLAN_LINK_FIELD}}&''))>0`);

        if (!ors.length) continue;

        const filter = `AND(
          LOWER({${PLAN_STATUS_FIELD}}&'')='active',
          OR(${ors.join(",")})
        )`;

        const recs = await plansTable
          .select({
            filterByFormula: filter,
            pageSize: 100,
            sort: [{ field: PLAN_CREATED_FIELD, direction: "desc" }],
          })
          .all();

        // For each plan record, map it to its linked athlete(s), taking newest createdAt
        recs.forEach((r) => {
          const createdAt = asString(r.get(PLAN_CREATED_FIELD)) || asString(r._rawJson?.createdTime);
          const linked = safeArr(r.get(PLAN_LINK_FIELD)); // array of record ids

          linked.forEach((aid) => {
            const athleteId = asString(aid);
            if (!athleteId) return;

            const prev = latestPlanCreatedAtByAthleteId[athleteId];
            if (!prev) latestPlanCreatedAtByAthleteId[athleteId] = createdAt;
            else {
              const pt = prev ? new Date(prev).getTime() : 0;
              const nt = createdAt ? new Date(createdAt).getTime() : 0;
              if (nt >= pt) latestPlanCreatedAtByAthleteId[athleteId] = createdAt;
            }
          });
        });
      }
    }

    /* -------- 4) Build rows -------- */

    const rows = athletes.map((a) => {
      const tok = a.athleteToken;

      const latestPlanCreatedAt = latestPlanCreatedAtByAthleteId[a.id] || "";
      const hasPlan = Boolean(latestPlanCreatedAt);

      const lastCheckin = checkinsByToken[tok] || null;
      const missingCheckin = !lastCheckin || lastCheckin.weekStartISO !== thisWeek;

      const adherenceAvg = lastCheckin
        ? Math.round((lastCheckin.caloriesPct + lastCheckin.proteinPct + lastCheckin.hydrationPct) / 3)
        : 0;

      const lowAdherence = lastCheckin ? adherenceAvg < 70 : false;
      const needsAction = !hasPlan || missingCheckin || lowAdherence;

      const priority = !hasPlan ? 1 : missingCheckin ? 2 : lowAdherence ? 3 : 9;

      return {
        athleteId: a.id,
        athleteName: a.name,
        athleteToken: tok,

        hasPlan,
        latestPlanCreatedAt,

        lastCheckin,
        missingCheckin,
        adherenceAvg,
        lowAdherence,

        needsAction,
        priority,
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
      meta: { weekStartISO: thisWeek, mode: "strict_AthleteToken_only + NutritionPlans(active)" },
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
