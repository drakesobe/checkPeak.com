// pages/api/org/createPrescription.js
// POST { athleteEmail, prescription, title?, createdBy?, structured, planJson? }
// Creates a nutrition plan in Supabase nutrition_plans for the given athlete.

import { requireOrg } from "@/lib/requireOrg";
import { supabaseAdmin as db } from "@/lib/supabase";
import { sendNotification } from "@/lib/sendNotification";

function asString(v) { return String(v ?? "").trim(); }
function normEmail(v) { return asString(v).toLowerCase(); }

function toNumOrBlank(v) {
  const s = asString(v);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toISODateOnly(v) {
  const s = asString(v);
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const y  = d.getUTCFullYear();
  const m  = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function safeJsonParse(v) {
  if (!v) return null;
  if (typeof v === "object") return v;
  try { return JSON.parse(v); } catch { return null; }
}

function hasAnyStructuredValue(s = {}) {
  return ["phase","calories","proteinGrams","carbsGrams","fatsGrams","hydrationOz","notesMacros","notesSupplements","metaStatus","metaEffectiveDate"]
    .some(k => asString(s[k]));
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req);
  if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

  const { org, user } = auth;
  const orgToken = asString(org?.token);

  const { athleteEmail, prescription, title, createdBy, structured, planJson } = req.body || {};

  const email = normEmail(athleteEmail);
  if (!email) return res.status(400).json({ error: "Missing athleteEmail" });

  const text = asString(prescription);
  const s    = structured && typeof structured === "object" ? structured : {};

  if (!text && !hasAnyStructuredValue(s)) {
    return res.status(400).json({
      error: "Plan is empty. Provide prescription text or at least one structured selection.",
    });
  }

  try {
    // 1) Look up athlete by email, verify org membership
    const { data: athlete, error: athErr } = await db
      .from("athletes")
      .select("id, athlete_token, email, name")
      .eq("email", email)
      .eq("org_token", orgToken)
      .maybeSingle();

    if (athErr) throw athErr;
    if (!athlete) {
      return res.status(404).json({ error: `No athlete found for ${email} in this organization.` });
    }

    // 2) Build effective date + planJson
    const parsedPlanJson  = safeJsonParse(planJson) || {};
    const effDateOnly     =
      toISODateOnly(s?.metaEffectiveDate) ||
      toISODateOnly(s?.meta?.effectiveDate) ||
      toISODateOnly(parsedPlanJson?.meta?.effectiveDate) ||
      "";
    const hydrationVal    = asString(s?.hydrationOz) ? toNumOrBlank(s.hydrationOz) : null;

    const mergedPlanJson = {
      ...parsedPlanJson,
      meta: {
        ...(parsedPlanJson.meta || {}),
        ...(effDateOnly ? { effectiveDate: effDateOnly } : {}),
        status: asString(s?.metaStatus || parsedPlanJson?.meta?.status || "active") || "active",
      },
      daily: {
        ...(parsedPlanJson.daily || {}),
        ...(asString(s?.calories)     ? { calories: toNumOrBlank(s.calories)     } : {}),
        ...(asString(s?.proteinGrams) ? { protein:  toNumOrBlank(s.proteinGrams) } : {}),
        ...(asString(s?.carbsGrams)   ? { carbs:    toNumOrBlank(s.carbsGrams)   } : {}),
        ...(asString(s?.fatsGrams)    ? { fat:      toNumOrBlank(s.fatsGrams)    } : {}),
        ...(hydrationVal != null      ? { hydrationOz: hydrationVal, hydration: hydrationVal } : {}),
      },
    };

    // 3) Archive any existing active plans for this athlete
    await db.from("nutrition_plans")
      .update({ status: "archived", archived_at: new Date().toISOString() })
      .eq("athlete_token", athlete.athlete_token)
      .eq("status", "active");

    // 4) Insert new plan
    const nowISO  = new Date().toISOString();
    const creator = asString(createdBy) || asString(user?.Email || user?.email || org?.email);

    const { data: created, error: insertErr } = await db
      .from("nutrition_plans")
      .insert({
        athlete_token:   athlete.athlete_token,
        athlete_id:      athlete.id,
        org_token:       orgToken,
        status:          asString(s?.metaStatus || "active") || "active",
        phase:           asString(s?.phase),
        daily_calories:  toNumOrBlank(s?.calories),
        daily_protein:   toNumOrBlank(s?.proteinGrams),
        daily_carbs:     toNumOrBlank(s?.carbsGrams),
        daily_fat:       toNumOrBlank(s?.fatsGrams),
        daily_hydration: hydrationVal,
        plan_json:       mergedPlanJson,
        prescription:    text || asString(title) || "",
        created_by:      creator,
        created_at:      nowISO,
        effective_date:  effDateOnly || null,
      })
      .select("id")
      .single();

    if (insertErr) throw insertErr;

    // Notify athlete that their nutrition plan has been updated
    sendNotification([athlete.athlete_token], {
      title: "Nutrition Plan Updated",
      body:  "Your coach has saved a new nutrition plan for you.",
      type:  "nutrition_plan_updated",
      data:  { planId: created.id },
    });

    return res.status(200).json({
      ok:              true,
      id:              created.id,
      nutritionPlan:   { id: created.id },
      effectiveDate:   effDateOnly || "",
      linkedAthleteId: athlete.id,
    });
  } catch (err) {
    console.error("[createPrescription] error:", err);
    return res.status(500).json({ error: "Failed to create nutrition plan", detail: err?.message });
  }
}
