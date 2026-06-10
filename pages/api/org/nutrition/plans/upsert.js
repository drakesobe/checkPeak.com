// pages/api/org/nutrition/plans/upsert.js
// POST { athleteToken, phase, status, daily, planJson, prescription, createdBy, metaEffectiveDate }
// Archives all existing active plans for athlete, creates a fresh active plan.

import { supabaseAdmin as db } from "@/lib/supabase";
import { requireOrg } from "@/lib/requireOrg";

/* ---------------- helpers ---------------- */

function asString(v) {
  if (v === 0) return "0";
  return String(v ?? "").trim();
}

function sanitizeForJson(obj) {
  if (typeof obj === "string") return obj.replace(/\\([^"\\\/bfnrtu])/g, "$1");
  if (Array.isArray(obj)) return obj.map(sanitizeForJson);
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = sanitizeForJson(v);
    return out;
  }
  return obj;
}

function safeJsonParse(s) {
  const raw = asString(s);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { /* fall through */ }
  try { return JSON.parse(raw.replace(/\\([^"\\\/bfnrtu])/g, "$1")); } catch { return null; }
}

function pickFirstNonEmptyString(...vals) {
  for (const v of vals) { const s = asString(v); if (s) return s; }
  return "";
}

function isISODateOnly(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}

function toISODateOnly(v) {
  const s = asString(v);
  if (!s) return "";
  if (isISODateOnly(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);
  return `${parts.find(p => p.type === "year")?.value}-${parts.find(p => p.type === "month")?.value}-${parts.find(p => p.type === "day")?.value}`;
}

function normalizePlanStatus(v) {
  const s = asString(v).toLowerCase();
  if (!s || s === "active") return "active";
  if (s === "no plan" || s === "no_plan" || s === "noplan") return "no_plan";
  if (s === "inactive") return "inactive";
  if (s === "draft")    return "draft";
  return s.replace(/\s+/g, "_");
}

/* ---------------- handler ---------------- */
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req, res);
  if (!auth?.ok) return;

  const orgToken = asString(auth?.org?.token);
  if (!orgToken) return res.status(401).json({ error: "Org token missing from session." });

  try {
    const body = req.body || {};

    const athleteToken = asString(body.athleteToken);
    const phase        = asString(body.phase || "Maintain");
    const status       = normalizePlanStatus(body.status || "active");
    const createdBy    = asString(body.createdBy || "");
    const prescription = asString(body.prescription || "");

    const daily       = body.daily && typeof body.daily === "object" ? body.daily : {};
    const planJsonRaw = body.planJson ?? null;
    const planJsonObj = planJsonRaw && typeof planJsonRaw === "object"
      ? planJsonRaw
      : safeJsonParse(planJsonRaw);

    if (!athleteToken) return res.status(400).json({ error: "athleteToken is required" });
    if (athleteToken.toUpperCase().startsWith("ORG-")) {
      return res.status(400).json({ error: "Expected AthleteToken (ATH-...), received an ORG- token." });
    }

    /* ── effective date ── */
    const effRaw =
      asString(body.metaEffectiveDate) ||
      asString(body.structured?.metaEffectiveDate) ||
      asString(body.planJson?.meta?.effectiveDate) ||
      asString(planJsonObj?.meta?.effectiveDate);
    const effectiveDate = toISODateOnly(effRaw);

    /* ── 1) find athlete (must belong to org) ── */
    const { data: athlete, error: athErr } = await db
      .from("athletes")
      .select("id, athlete_token, org_token")
      .eq("athlete_token", athleteToken)
      .eq("org_token", orgToken)
      .maybeSingle();

    if (athErr) throw athErr;
    if (!athlete) {
      return res.status(404).json({ error: "Athlete not found for this organization.", debug: { athleteToken, orgToken } });
    }

    /* ── 2) find all existing active plans for this athlete ── */
    const { data: existingActive, error: fetchErr } = await db
      .from("nutrition_plans")
      .select("id")
      .eq("athlete_token", athleteToken)
      .eq("status", "active");

    if (fetchErr) throw fetchErr;

    /* ── 3) archive all existing active plans ── */
    const now = new Date().toISOString();

    if (existingActive?.length) {
      const ids = existingActive.map(r => r.id);
      const { error: archiveErr } = await db
        .from("nutrition_plans")
        .update({ status: "archived", archived_at: now, updated_at: now })
        .in("id", ids);
      if (archiveErr) throw archiveErr;
    }

    /* ── 4) macro extraction ── */
    const pjDaily = planJsonObj?.daily && typeof planJsonObj.daily === "object"
      ? planJsonObj.daily : {};

    const dailyCalories    = pickFirstNonEmptyString(daily?.calories,    pjDaily?.calories);
    const dailyProtein     = pickFirstNonEmptyString(daily?.protein,     pjDaily?.protein);
    const dailyCarbs       = pickFirstNonEmptyString(daily?.carbs,       pjDaily?.carbs);
    const dailyFat         = pickFirstNonEmptyString(daily?.fat,         pjDaily?.fat);
    const dailyHydrationOz = pickFirstNonEmptyString(
      daily?.hydrationOz, daily?.hydration,
      pjDaily?.hydrationOz, pjDaily?.hydration, pjDaily?.waterOz, pjDaily?.water
    );

    /* ── 5) merge and sanitize PlanJson ── */
    const mergedPlanJson = planJsonObj && typeof planJsonObj === "object"
      ? {
          ...planJsonObj,
          meta: {
            ...(typeof planJsonObj.meta === "object" ? planJsonObj.meta : {}),
            ...(effectiveDate ? { effectiveDate } : {}),
          },
          daily: {
            ...(typeof pjDaily === "object" ? pjDaily : {}),
            ...(dailyCalories    ? { calories:    dailyCalories    } : {}),
            ...(dailyProtein     ? { protein:     dailyProtein     } : {}),
            ...(dailyCarbs       ? { carbs:       dailyCarbs       } : {}),
            ...(dailyFat         ? { fat:         dailyFat         } : {}),
            ...(dailyHydrationOz ? { hydrationOz: dailyHydrationOz, hydration: dailyHydrationOz } : {}),
          },
        }
      : {
          meta:  effectiveDate ? { effectiveDate } : {},
          daily: {
            calories: dailyCalories, protein: dailyProtein,
            carbs: dailyCarbs, fat: dailyFat,
            ...(dailyHydrationOz ? { hydrationOz: dailyHydrationOz, hydration: dailyHydrationOz } : {}),
          },
        };

    const safePlanJson = sanitizeForJson(mergedPlanJson);

    /* ── 6) create fresh active plan ── */
    const { data: saved, error: insertErr } = await db
      .from("nutrition_plans")
      .insert({
        athlete_token:   athleteToken,
        athlete_id:      athlete.id,
        org_token:       orgToken,
        status:          status || "active",
        phase,
        daily_calories:  dailyCalories  || null,
        daily_protein:   dailyProtein   || null,
        daily_carbs:     dailyCarbs     || null,
        daily_fat:       dailyFat       || null,
        daily_hydration: dailyHydrationOz || null,
        plan_json:       safePlanJson,
        prescription,
        created_by:      createdBy      || null,
        effective_date:  effectiveDate  || null,
        created_at:      now,
        updated_at:      now,
      })
      .select("id")
      .single();

    if (insertErr) throw insertErr;

    return res.status(200).json({
      ok:            true,
      plan:          { id: saved.id },
      effectiveDate: effectiveDate || "",
      archivedCount: existingActive?.length || 0,
      debug: {
        athleteToken,
        athleteId:    athlete.id,
        archivedPlanIds: (existingActive || []).map(r => r.id),
        status,
        effectiveDate,
        dailyHydrationOz,
      },
    });
  } catch (e) {
    console.error("[org/nutrition/plans/upsert] error:", e);
    return res.status(500).json({ error: e?.message || "Failed to upsert nutrition plan." });
  }
}
