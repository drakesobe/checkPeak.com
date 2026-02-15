// pages/api/org/createPrescription.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";
import { logAuditEvent } from "@/lib/audit";

/* ---------------- Helpers ---------------- */

function asString(v) {
  return String(v ?? "").trim();
}

function normalizeEmail(email) {
  return asString(email).toLowerCase();
}

function cleanString(v) {
  const s = asString(v);
  return s.length ? s : "";
}

function escapeAirtableString(str = "") {
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function safeJsonStringify(obj) {
  try {
    return JSON.stringify(obj);
  } catch {
    return "";
  }
}

function safeJsonParseMaybe(v) {
  if (!v) return null;
  if (typeof v === "object") return v;
  const s = cleanString(v);
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function stripEmpty(fields) {
  const out = { ...fields };
  for (const k of Object.keys(out)) {
    if (out[k] === "" || out[k] === null || typeof out[k] === "undefined") {
      delete out[k];
    }
  }
  return out;
}

function toNumOrBlank(v) {
  const s = cleanString(v);
  if (!s) return "";
  const n = Number(s);
  return Number.isFinite(n) ? n : s; // supports number or single-line text columns safely
}

function isISODateOnly(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}

/**
 * Normalize a date input into YYYY-MM-DD (date-only)
 */
function toISODateOnly(v) {
  const s = cleanString(v);
  if (!s) return "";
  if (isISODateOnly(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function hasAnyStructuredValue(structured = {}) {
  if (!structured || typeof structured !== "object") return false;
  const keys = [
    "phase",
    "calories",
    "proteinGrams",
    "carbsGrams",
    "fatsGrams",
    "hydrationOz", // ✅ already included
    "notesMacros",
    "notesSupplements",
    "metaStatus",
    "metaEffectiveDate",
  ];
  return keys.some((k) => cleanString(structured[k]));
}

function formatAirtableError(err) {
  return {
    statusCode: err?.statusCode || 500,
    error: err?.error || "AIRTABLE_ERROR",
    message: err?.message || "Unknown Airtable error",
  };
}

/* ---------------- Main ---------------- */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req);
  if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

  const { org, user } = auth;

  const {
    athleteEmail,
    prescription,
    title, // optional
    createdBy, // optional
    structured,
    planJson, // object or string
  } = req.body || {};

  const email = normalizeEmail(athleteEmail);
  if (!email) return res.status(400).json({ error: "Missing athleteEmail" });

  const text = cleanString(prescription);
  const s = structured && typeof structured === "object" ? structured : {};

  if (!text && !hasAnyStructuredValue(s)) {
    return res.status(400).json({
      error: "Plan is empty. Provide prescription text or at least one structured selection.",
    });
  }

  // ✅ NutritionPlans Airtable config (WRITE TARGET)
  const NUTRITION_API_KEY = process.env.NUTRITION_API_KEY;
  const NUTRITION_BASE_ID = process.env.NUTRITION_BASE_ID;
  const NUTRITION_TABLE_NAME = process.env.NUTRITION_TABLE_NAME || process.env.NUTRITION_PLANS_TABLE;

  if (!NUTRITION_API_KEY || !NUTRITION_BASE_ID || !NUTRITION_TABLE_NAME) {
    return res.status(500).json({
      error:
        "NutritionPlans Airtable not configured. Check NUTRITION_API_KEY / NUTRITION_BASE_ID / NUTRITION_TABLE_NAME.",
      missing: {
        NUTRITION_API_KEY: !NUTRITION_API_KEY,
        NUTRITION_BASE_ID: !NUTRITION_BASE_ID,
        NUTRITION_TABLE_NAME: !NUTRITION_TABLE_NAME,
      },
    });
  }

  // Athlete table (to find the linked record id)
  const ATH_API_KEY = process.env.ATHLETE_API_KEY;
  const ATH_BASE_ID = process.env.ATHLETE_BASE_ID;
  const ATH_TABLE_NAME = process.env.ATHLETE_TABLE_NAME;

  if (!ATH_API_KEY || !ATH_BASE_ID || !ATH_TABLE_NAME) {
    return res.status(500).json({
      error:
        "Athletes Airtable not configured (needed to link NutritionPlans → Athlete). Check ATHLETE_API_KEY / ATHLETE_BASE_ID / ATHLETE_TABLE_NAME.",
      missing: {
        ATHLETE_API_KEY: !ATH_API_KEY,
        ATHLETE_BASE_ID: !ATH_BASE_ID,
        ATHLETE_TABLE_NAME: !ATH_TABLE_NAME,
      },
    });
  }

  // Field names (match your athlete API defaults)
  const F_ATHLETE_LINK = "Athlete";
  const F_STATUS = "Status";
  const F_CREATED_AT = "CreatedAt";
  const F_CREATED_BY = "CreatedBy";

  const F_PHASE = "Phase";
  const F_DCAL = "DailyCalories";
  const F_DPRO = "DailyProtein";
  const F_DCARB = "DailyCarbs";
  const F_DFAT = "DailyFat";

  // ✅ NEW: Daily Hydration (oz) summary field
  // Make sure your NutritionPlans table column is named exactly "DailyHydration"
  // (If your Airtable field is named differently, change this constant to match.)
  const F_DHYDRATION = "DailyHydration";

  const F_PLANJSON = "PlanJson";
  const F_PRESCRIPTION = "Prescription";

  const nutritionBase = new Airtable({ apiKey: NUTRITION_API_KEY }).base(NUTRITION_BASE_ID);
  const athleteBase = new Airtable({ apiKey: ATH_API_KEY }).base(ATH_BASE_ID);

  try {
    const nowISO = new Date().toISOString();

    // 1) Find athlete record id (linked field needs record id)
    const safeEmail = escapeAirtableString(email);
    const found = await athleteBase(ATH_TABLE_NAME)
      .select({
        filterByFormula: `LOWER({Email}&'')='${safeEmail}'`,
        maxRecords: 1,
      })
      .firstPage();

    const athleteRec = found?.[0] || null;
    if (!athleteRec?.id) {
      return res.status(404).json({
        error: `No athlete found in Athletes table for ${email}.`,
      });
    }

    // 2) Build effective date (DATE-ONLY) and inject into PlanJson.meta.effectiveDate
    const parsedPlanJson = safeJsonParseMaybe(planJson) || {};
    const effDateOnly =
      toISODateOnly(s?.metaEffectiveDate) ||
      toISODateOnly(s?.meta?.effectiveDate) ||
      toISODateOnly(parsedPlanJson?.meta?.effectiveDate) ||
      ""; // allow blank (legacy)

    // ✅ Normalize hydration (oz)
    const hydrationVal = cleanString(s?.hydrationOz) ? toNumOrBlank(s.hydrationOz) : null;

    const mergedPlanJson =
      parsedPlanJson && typeof parsedPlanJson === "object"
        ? {
            ...parsedPlanJson,
            meta: {
              ...(parsedPlanJson.meta && typeof parsedPlanJson.meta === "object" ? parsedPlanJson.meta : {}),
              ...(effDateOnly ? { effectiveDate: effDateOnly } : {}),
              status: cleanString(s?.metaStatus || parsedPlanJson?.meta?.status || "active") || "active",
            },
            // Helpful conveniences (optional)
            daily: {
              ...(parsedPlanJson.daily && typeof parsedPlanJson.daily === "object" ? parsedPlanJson.daily : {}),
              ...(cleanString(s?.calories) ? { calories: toNumOrBlank(s.calories) } : {}),
              ...(cleanString(s?.proteinGrams) ? { protein: toNumOrBlank(s.proteinGrams) } : {}),
              ...(cleanString(s?.carbsGrams) ? { carbs: toNumOrBlank(s.carbsGrams) } : {}),
              ...(cleanString(s?.fatsGrams) ? { fat: toNumOrBlank(s.fatsGrams) } : {}),

              // ✅ NEW: daily hydration stored in PlanJson
              ...(hydrationVal != null ? { hydrationOz: hydrationVal, hydration: hydrationVal } : {}),
            },
          }
        : {
            meta: {
              ...(effDateOnly ? { effectiveDate: effDateOnly } : {}),
              status: cleanString(s?.metaStatus || "active") || "active",
            },
            daily: {
              calories: toNumOrBlank(s?.calories),
              protein: toNumOrBlank(s?.proteinGrams),
              carbs: toNumOrBlank(s?.carbsGrams),
              fat: toNumOrBlank(s?.fatsGrams),

              // ✅ NEW: daily hydration stored in PlanJson
              ...(hydrationVal != null ? { hydrationOz: hydrationVal, hydration: hydrationVal } : {}),
            },
          };

    const planJsonString = safeJsonStringify(mergedPlanJson);

    // 3) Create NutritionPlans record
    const fields = stripEmpty({
      // Link to athlete
      [F_ATHLETE_LINK]: [athleteRec.id],

      // Meta
      [F_STATUS]: cleanString(s?.metaStatus || "active") || "active",
      [F_CREATED_AT]: nowISO,
      [F_CREATED_BY]: cleanString(createdBy) || cleanString(user?.Email || user?.email) || cleanString(org?.email),

      // Plan summary fields (optional but nice)
      [F_PHASE]: cleanString(s?.phase),

      // Daily macros fields (match your athlete api constants)
      [F_DCAL]: toNumOrBlank(s?.calories),
      [F_DPRO]: toNumOrBlank(s?.proteinGrams),
      [F_DCARB]: toNumOrBlank(s?.carbsGrams),
      [F_DFAT]: toNumOrBlank(s?.fatsGrams),

      // ✅ NEW: Daily hydration field saved to Airtable
      [F_DHYDRATION]: toNumOrBlank(s?.hydrationOz),

      // Plan payload
      [F_PLANJSON]: planJsonString,

      // Legacy / notes
      [F_PRESCRIPTION]: text || cleanString(title) || "",
    });

    const created = await nutritionBase(NUTRITION_TABLE_NAME).create(fields);

    // Audit (best effort)
    try {
      await logAuditEvent({
        action: "CREATE_NUTRITION_PLAN",
        actorEmail: cleanString(user?.Email || user?.email || org?.email),
        actorId: cleanString(user?.id || ""),
        orgToken: cleanString(org?.token || ""),
        orgName: cleanString(org?.name || ""),
        athleteEmail: email,
        entityType: "NutritionPlan",
        entityId: created?.id || "",
        meta: {
          effectiveDate: effDateOnly || "",
          status: fields[F_STATUS] || "",
          // ✅ helpful to log
          dailyHydrationOz: fields[F_DHYDRATION] ?? "",
        },
      });
    } catch (e) {
      console.warn("[createPrescription -> NutritionPlans] audit log failed:", e?.message || e);
    }

    return res.status(200).json({
      ok: true,
      id: created?.id,
      nutritionPlan: {
        id: created?.id,
        fields: created?.fields || {},
      },
      effectiveDate: effDateOnly || "",
      linkedAthleteId: athleteRec.id,
    });
  } catch (err) {
    console.error("[createPrescription -> NutritionPlans] Airtable error:", err);
    return res.status(500).json({
      error: "Failed to create nutrition plan",
      airtable: formatAirtableError(err),
    });
  }
}
