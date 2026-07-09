// pages/api/org/nutrition/athlete.js
// GET ?athleteToken= - returns single athlete's nutrition profile (plans + completions).

import { requireOrg } from "@/lib/requireOrg";
import { supabaseAdmin as db } from "@/lib/supabase";

// Mobile clients (Expo RN) pass session as _authUser query/body param.
// Inject it into req.cookies before requireOrg reads it.
function injectMobileAuth(req) {
  const raw = req?.query?._authUser ?? req?.body?._authUser;
  if (!raw) return;
  const str = String(raw);
  req.cookies = req.cookies || {};
  req.cookies.user = str;
  req.headers = req.headers || {};
  req.headers.cookie = `user=${encodeURIComponent(str)}`;
}

function asString(v) { return String(v ?? "").trim(); }
function clampPct(n) {
  const x = Math.round(Number(n));
  return Number.isFinite(x) ? Math.max(0, Math.min(100, x)) : 0;
}
function safeJsonParse(v) {
  if (!v) return null;
  if (typeof v === "object") return v;
  try { return JSON.parse(v); } catch { return null; }
}
function completionToPcts(cj) {
  const c  = cj && typeof cj === "object" ? cj : {};
  const keys = ["breakfast", "lunch", "afternoon", "dinner"];
  let mealDone = 0;
  let waterDone = 0;
  for (const k of keys) {
    if (c?.[k]?.mealDone) mealDone++;
    if (c?.[k]?.hydrationDone) waterDone++;
  }
  return {
    mealPct:      clampPct((mealDone  / 4) * 100),
    hydrationPct: clampPct((waterDone / 4) * 100),
    totalPct:     clampPct(((mealDone + waterDone) / 8) * 100),
  };
}
function nyWeekStartISO(dateISO) {
  if (!dateISO || dateISO.length < 10) return "";
  const d = new Date(`${dateISO.slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  return d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  injectMobileAuth(req);
  const auth = requireOrg(req);
  if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

  const orgToken     = asString(auth?.org?.token);
  const athleteToken = asString(req.query?.athleteToken);

  if (!orgToken)     return res.status(401).json({ error: "Org token missing from session." });
  if (!athleteToken) return res.status(400).json({ error: "athleteToken is required" });
  if (athleteToken.toUpperCase().startsWith("ORG-")) {
    return res.status(400).json({ error: "Expected AthleteToken (ATH-...), not an ORG- token." });
  }

  try {
    // Verify athlete belongs to this org
    const { data: athleteRow } = await db
      .from("athletes")
      .select("id, name, email, athlete_token")
      .eq("athlete_token", athleteToken)
      .eq("org_token", orgToken)
      .maybeSingle();

    if (!athleteRow) return res.status(404).json({ error: "Athlete not found for this organization." });

    const athlete = {
      id:           athleteRow.id,
      name:         athleteRow.name  || "Athlete",
      email:        athleteRow.email || "",
      athleteToken: athleteRow.athlete_token,
    };

    // Fetch all plans + latest active plan in parallel
    const [allPlansResult, completionsResult] = await Promise.all([
      db.from("nutrition_plans")
        .select("id, status, phase, daily_calories, daily_protein, daily_carbs, daily_fat, daily_hydration, plan_json, prescription, created_by, created_at, archived_at")
        .eq("athlete_token", athleteToken)
        .order("created_at", { ascending: false })
        .limit(25),

      db.from("nutrition_completions")
        .select("id, date, completion_json, updated_at")
        .eq("athlete_token", athleteToken)
        .order("updated_at", { ascending: false })
        .limit(50),
    ]);

    const planRows = allPlansResult.data ?? [];
    const latestRec = planRows.find(p => p.status === "active") || null;

    function planShape(r) {
      const planJson = safeJsonParse(r.plan_json);
      return {
        id:    r.id,
        phase: asString(r.phase),
        daily: {
          calories:    asString(r.daily_calories),
          protein:     asString(r.daily_protein),
          carbs:       asString(r.daily_carbs),
          fat:         asString(r.daily_fat),
          hydrationOz: asString(r.daily_hydration),
        },
        planJsonRaw:  typeof r.plan_json === "string" ? r.plan_json : JSON.stringify(r.plan_json ?? ""),
        planJson,
        prescription: asString(r.prescription),
        status:       asString(r.status) || "",
        createdAt:    r.created_at,
        createdBy:    asString(r.created_by),
        archivedAt:   r.archived_at || null,
        archivedBy:   null,
      };
    }

    const latestPlan = latestRec ? planShape(latestRec) : null;
    const plans      = planRows.map(planShape);

    const checkins = (completionsResult.data ?? []).map(c => {
      const dateISO = c.date ? String(c.date).slice(0, 10) : "";
      const p = completionToPcts(safeJsonParse(c.completion_json));
      return {
        id:           c.id,
        weekStartISO: nyWeekStartISO(dateISO),
        createdAt:    c.updated_at || "",
        caloriesPct:  p.mealPct,
        proteinPct:   p.mealPct,
        carbsPct:     p.mealPct,
        hydrationPct: p.hydrationPct,
        notes:        "",
        _source:      "nutrition_completions",
        _dateISO:     dateISO,
        _totalPct:    p.totalPct,
      };
    });

    return res.status(200).json({ ok: true, athlete, latestPlan, plans, checkins });
  } catch (err) {
    console.error("[org/nutrition/athlete]", err);
    return res.status(500).json({ error: err?.message || "Failed to load athlete nutrition profile." });
  }
}
