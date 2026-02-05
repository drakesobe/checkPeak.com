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
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function envMissing() {
  return {
    DAILYWORKOUTS_API_KEY: !process.env.DAILYWORKOUTS_API_KEY,
    DAILYWORKOUTS_BASE_ID: !process.env.DAILYWORKOUTS_BASE_ID,
    DAILYWORKOUTS_TABLE_ID: !process.env.DAILYWORKOUTS_TABLE_ID,

    // AthleteScans (optional)
    ATHLETE_API_KEY: !process.env.ATHLETE_API_KEY,
    ATHLETE_BASE_ID: !process.env.ATHLETE_BASE_ID,
    ATHLETE_TABLE_NAME: !process.env.ATHLETE_TABLE_NAME,
  };
}

function buildOrgCandidates(user) {
  const orgId = String(user?.org?.id || user?.orgId || user?.OrgId || "").trim();
  const orgToken = String(user?.org?.token || user?.Token || user?.token || "").trim();
  const orgName = String(
    user?.org?.name ||
      user?.org?.Name ||
      user?.orgName ||
      user?.OrgName ||
      user?.organizationName ||
      user?.["Organization Name"] ||
      ""
  ).trim();

  // Most likely to match linked primary = orgName
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

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const missing = envMissing();

  if (
    missing.DAILYWORKOUTS_API_KEY ||
    missing.DAILYWORKOUTS_BASE_ID ||
    missing.DAILYWORKOUTS_TABLE_ID
  ) {
    return res.status(500).json({
      error: "DailyWorkouts Airtable env vars missing.",
      missing,
      debug: { cwd: process.cwd() },
    });
  }

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const date = safeJsonString(req.query?.date) || toISODateLocal(new Date());
  const sportQ = normLower(req.query?.sport); // may be ""
  const { orgId, orgToken, orgName, candidates } = buildOrgCandidates(user);

  const debug = {
    date,
    sport: sportQ,
    orgId,
    orgTokenPresent: Boolean(orgToken),
    orgName,
    orgCandidates: candidates,
    athleteQueryEnabled: !(
      missing.ATHLETE_API_KEY ||
      missing.ATHLETE_BASE_ID ||
      missing.ATHLETE_TABLE_NAME
    ),
    formulas: {},
    counts: { workoutsAll: 0, workouts: 0, athletes: 0 },
  };

  if (!candidates.length) {
    return res.status(400).json({
      error:
        "Missing org identity on session (need orgName or orgToken or orgId). Ensure requireOrgSideUser sets org.name/token in cookie session.",
      debug,
    });
  }

  const base = new Airtable({ apiKey: process.env.DAILYWORKOUTS_API_KEY }).base(
    process.env.DAILYWORKOUTS_BASE_ID
  );
  const DailyWorkouts = base(process.env.DAILYWORKOUTS_TABLE_ID);

  // --------------------------------------------------------------------------
  // 1) Workouts for org + day (NO sport filter here)
  //    We filter by sport in Node so we can compute availableSports reliably.
  // --------------------------------------------------------------------------
  let workoutsAll = [];
  try {
    const parts = [];

    const orgJoin = `ARRAYJOIN({Organization}&"")`;
    const orgMatch =
      candidates.length === 1
        ? `FIND("${escFormulaString(candidates[0])}", ${orgJoin})`
        : `OR(${candidates
            .map((c) => `FIND("${escFormulaString(c)}", ${orgJoin})`)
            .join(",")})`;

    parts.push(orgMatch);
    parts.push(`IS_SAME({Date}, "${escFormulaString(date)}", "day")`);

    const formulaAll = `AND(${parts.join(",")})`;
    debug.formulas.dailyWorkouts_allSports = formulaAll;

    const rows = await DailyWorkouts.select({
      filterByFormula: formulaAll,
      maxRecords: 200,
      sort: [{ field: "Date", direction: "asc" }],
    }).firstPage();

    workoutsAll = (rows || []).map((rec) => {
      const f = rec.fields || {};
      return {
        id: rec.id,
        Title: f.Title || "Workout",
        Date: f.Date ? String(f.Date).slice(0, 10) : date,
        Status: f.Status || "assigned",
        Sport: f.Sport || "",
        athleteCount: safeArray(f.Athlete).length,
        itemCount: safeArray(f.WorkoutItems).length,
        _orgLink: f.Organization,
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

  // ✅ availableSports derived from all workouts today (NOT just selected sport)
  const availableSports = uniqCI(
    workoutsAll
      .map((w) => String(w?.Sport || "").trim())
      .filter(Boolean)
  ).sort((a, b) => a.localeCompare(b));

  // Filter down to selected sport (if provided)
  const workouts = sportQ
    ? workoutsAll.filter((w) => String(w?.Sport || "").trim().toLowerCase() === sportQ)
    : workoutsAll;

  debug.counts.workouts = workouts.length;

  // --------------------------------------------------------------------------
  // 2) Athletes roster (AthleteScans) for org (+ optional sport)
  //    This is optional; it should NEVER break the endpoint.
  // --------------------------------------------------------------------------
  let athletes = [];
  if (
    !(
      missing.ATHLETE_API_KEY ||
      missing.ATHLETE_BASE_ID ||
      missing.ATHLETE_TABLE_NAME
    )
  ) {
    try {
      const athleteTable = encodeURIComponent(process.env.ATHLETE_TABLE_NAME);
      const athleteBaseUrl = `https://api.airtable.com/v0/${process.env.ATHLETE_BASE_ID}/${athleteTable}`;

      const athleteOrgJoin = `ARRAYJOIN({Organization}&"")`;

      // org candidates against linked primary values
      const orgClause =
        candidates.length === 1
          ? `FIND("${escFormulaString(candidates[0])}", ${athleteOrgJoin})`
          : `OR(${candidates
              .map((c) => `FIND("${escFormulaString(c)}", ${athleteOrgJoin})`)
              .join(",")})`;

      // Sport clause (optional) — assume field is {sport} like your previous code.
      // If your field is actually {Sport}, switch this line to {Sport}.
      let athleteFormula = orgClause;
      if (sportQ) {
        athleteFormula = `AND(${orgClause}, LOWER({sport}&"")="${escFormulaString(
          sportQ
        )}")`;
      }

      debug.formulas.athletes = athleteFormula;

      const qs = new URLSearchParams();
      qs.set("filterByFormula", athleteFormula);
      qs.set("sort[0][field]", "CreatedAt");
      qs.set("sort[0][direction]", "desc");

      ["Name", "Email", "CreatedAt", "Organization", "sport", "Team", "Status"].forEach((f) =>
        qs.append("fields[]", f)
      );

      const url = `${athleteBaseUrl}?${qs.toString()}`;

      const atRes = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.ATHLETE_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      const data = await safeJson(atRes);

      if (!atRes.ok) {
        console.error("[api/org/workouts/day] athletes airtable error:", atRes.status, data);
        debug.athletesError = { status: atRes.status, data };
      } else {
        const records = Array.isArray(data?.records) ? data.records : [];
        athletes = records.map((r) => {
          const f = r.fields || {};
          return {
            id: r.id,
            name: String(f.Name || "").trim(),
            email: String(f.Email || "").trim(),
            createdAt: String(f.CreatedAt || "").trim(),
            sport: String(f.sport || "").trim(),
            team: String(f.Team || "").trim(),
            status: String(f.Status || "").trim(),
            organization: f.Organization,
          };
        });
        debug.counts.athletes = athletes.length;
      }
    } catch (e) {
      console.error("[api/org/workouts/day] athletes query error:", e);
      debug.athletesError = { message: e?.message || String(e) };
    }
  }

  return res.status(200).json({
    workouts,
    athletes,
    itemsByWorkoutId: {},
    completionByItemId: {},
    availableSports, // ✅ NEW
    debug,
  });
}
