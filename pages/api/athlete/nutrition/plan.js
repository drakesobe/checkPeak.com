// pages/api/athlete/nutrition/plan.js
// GET /api/athlete/nutrition/plan?date=YYYY-MM-DD
// Returns the active nutrition plan effective on the given date.
// Response includes both `plan` (mobile shape) and `latestPlan` (legacy web shape).

import { requireAthlete } from "@/lib/requireAthlete";
import { supabaseAdmin } from "@/lib/supabase";

function asStr(v) { return String(v ?? "").trim(); }
function isISODate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s)); }
function nyTodayISO() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}
function safeJson(v) {
  if (v && typeof v === "object") return v;
  if (!v) return null;
  try { return JSON.parse(v); } catch { return null; }
}

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

  try {
    // Most recent active plan created on or before the requested date
    const { data: rows, error } = await supabaseAdmin
      .from("nutrition_plans")
      .select("*")
      .eq("athlete_token", athleteToken)
      .eq("status", "active")
      .lte("created_at", `${date}T23:59:59.999Z`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("[athlete/nutrition/plan] db error:", error);
      return res.status(500).json({ error: "Failed to load nutrition plan." });
    }

    const row = rows?.[0] ?? null;

    if (!row) {
      return res.status(200).json({ ok: true, athlete: { athleteToken }, latestPlan: null, plan: null });
    }

    const planJson = safeJson(row.plan_json);
    const effectiveDate = row.created_at ? row.created_at.split("T")[0] : null;

    const plan = {
      id:           row.id,
      phase:        asStr(row.phase),
      daily: {
        calories:    asStr(row.daily_calories),
        protein:     asStr(row.daily_protein),
        carbs:       asStr(row.daily_carbs),
        fat:         asStr(row.daily_fat),
        hydrationOz: asStr(row.daily_hydration),
      },
      planJson,
      prescription:  asStr(row.prescription),
      status:        asStr(row.status) || "active",
      createdAt:     row.created_at,
      effectiveDate,
    };

    // latestPlan keeps the shape the web app expects
    const latestPlan = {
      ...plan,
      planJsonRaw: typeof row.plan_json === "string" ? row.plan_json : JSON.stringify(row.plan_json ?? ""),
      createdBy:   asStr(row.created_by),
      archivedAt:  row.archived_at ?? null,
      archivedBy:  null,
    };

    return res.status(200).json({ ok: true, athlete: { athleteToken }, latestPlan, plan });

  } catch (e) {
    console.error("[athlete/nutrition/plan] unexpected:", e);
    return res.status(500).json({ error: e?.message || "Failed to load nutrition plan." });
  }
}
