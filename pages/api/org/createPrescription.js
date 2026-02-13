// pages/api/org/createPrescription.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";
import { logAuditEvent } from "@/lib/audit";

/* ---------------- Helpers ---------------- */

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function cleanString(v) {
  const s = String(v ?? "").trim();
  return s.length ? s : "";
}

function escapeAirtableString(str = "") {
  return String(str).replace(/'/g, "\\'");
}

function coerceMaybeDateISO(v) {
  const s = cleanString(v);
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
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

function asChoiceOrText(v) {
  const s = cleanString(v);
  return s || "";
}

function hasAnyStructuredValue(structured = {}) {
  if (!structured || typeof structured !== "object") return false;
  const keys = [
    "phase",
    "calories",
    "proteinGrams",
    "carbsGrams",
    "fatsGrams",
    "hydrationOz",
    "notesMacros",
    "proteinRecommendation",
    "creatineRecommendation",
    "bcaaRecommendation",
    "electrolytesRecommendation",
    "notesSupplements",
    "metaStatus",
    "metaEffectiveDate",
  ];
  return keys.some((k) => cleanString(structured[k]));
}

function safeJsonStringify(obj) {
  try {
    return JSON.stringify(obj);
  } catch {
    return "";
  }
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

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = requireOrg(req);
  if (!auth?.ok) {
    return res.status(401).json({ error: auth?.error || "Unauthorized" });
  }

  const { org, user } = auth;

  const {
    athleteEmail,
    prescription,
    title,
    organizationName,
    createdBy,
    structured,
    // ✅ New optional payloads
    planJson, // object (recommended) OR string (ok)
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

  // ---- Prescriptions Airtable config
  const PRES_API_KEY = process.env.PRESCRIPTIONS_API_KEY;
  const PRES_BASE_ID = process.env.PRESCRIPTIONS_BASE_ID;
  const PRES_TABLE = process.env.PRESCRIPTIONS_TABLE_NAME;

  if (!PRES_API_KEY || !PRES_BASE_ID || !PRES_TABLE) {
    return res.status(500).json({
      error:
        "Prescriptions Airtable not configured. Check PRESCRIPTIONS_API_KEY, PRESCRIPTIONS_BASE_ID, PRESCRIPTIONS_TABLE_NAME.",
      missing: {
        PRESCRIPTIONS_API_KEY: !PRES_API_KEY,
        PRESCRIPTIONS_BASE_ID: !PRES_BASE_ID,
        PRESCRIPTIONS_TABLE_NAME: !PRES_TABLE,
      },
    });
  }

  // ✅ Optional: allow saving Phase / PlanJson into Prescriptions table *only if you configure field names*
  // This avoids Airtable "Unknown field names" hard failures.
  const PRES_PHASE_FIELD = cleanString(process.env.PRESCRIPTIONS_PHASE_FIELD); // e.g. "Phase"
  const PRES_PLANJSON_FIELD = cleanString(process.env.PRESCRIPTIONS_PLANJSON_FIELD); // e.g. "PlanJson"

  // ---- Athletes Airtable config (for linking AthleteScans)
  const ATH_API_KEY = process.env.ATHLETE_API_KEY;
  const ATH_BASE_ID = process.env.ATHLETE_BASE_ID;
  const ATH_TABLE = process.env.ATHLETE_TABLE_NAME;

  // We can still save without linking if this is missing.
  const canLinkAthleteScans = !!(ATH_API_KEY && ATH_BASE_ID && ATH_TABLE);

  const presBase = new Airtable({ apiKey: PRES_API_KEY }).base(PRES_BASE_ID);

  try {
    const nowISO = new Date().toISOString();
    const orgToken = cleanString(org?.token);

    if (!orgToken) {
      return res.status(500).json({
        error: "Org token missing from cookie auth. Re-login to the org and try again.",
      });
    }

    // ✅ FIX: Athlete is SINGLE LINE TEXT in your Prescriptions table
    // so we store email string there.
    // AthleteScans is the LINKED field, we will set that with [athleteRecordId].
    let athleteScansId = "";
    let linkWarning = "";

    if (canLinkAthleteScans) {
      try {
        const athBase = new Airtable({ apiKey: ATH_API_KEY }).base(ATH_BASE_ID);
        const safeEmail = escapeAirtableString(email);

        const found = await athBase(ATH_TABLE)
          .select({
            filterByFormula: `LOWER({Email})='${safeEmail}'`,
            maxRecords: 1,
          })
          .firstPage();

        if (found?.length) {
          athleteScansId = found[0].id; // ✅ record id from ATHLETE table
        } else {
          linkWarning = `No athlete record found in Athletes table for ${email}. Saved plan without AthleteScans link.`;
        }
      } catch (e) {
        linkWarning = `Failed to link AthleteScans (lookup error). Saved plan without link. ${String(
          e?.message || e
        )}`;
      }
    } else {
      linkWarning =
        "Athletes Airtable not configured (ATHLETE_API_KEY/ATHLETE_BASE_ID/ATHLETE_TABLE_NAME). Saved plan without AthleteScans link.";
    }

    // --- Build optional phase + planJson fields safely
    const phaseValue = cleanString(s?.phase);
    const planJsonString =
      typeof planJson === "string" ? cleanString(planJson) : safeJsonStringify(planJson);

    const optionalFields = {};
    if (PRES_PHASE_FIELD && phaseValue) optionalFields[PRES_PHASE_FIELD] = phaseValue;
    if (PRES_PLANJSON_FIELD && planJsonString) optionalFields[PRES_PLANJSON_FIELD] = planJsonString;

    const fields = stripEmpty({
      // -----------------------
      // Your columns
      // -----------------------
      Title: cleanString(title) || "Prescription",
      Prescription: text,

      // Keep these as you already do
      "Organization Token": orgToken,
      "Athlete Email": email,
      Organization: cleanString(organizationName) || cleanString(org?.name) || "Organization",
      CreatedAt: nowISO,
      CreatedBy: cleanString(createdBy) || cleanString(user?.Email || user?.email) || cleanString(org?.email),

      // ✅ Athlete (single-line text) gets a STRING, not an array
      Athlete: email,

      // ✅ AthleteScans is the linked record field
      ...(athleteScansId ? { AthleteScans: [athleteScansId] } : {}),

      // -----------------------
      // Macros
      // -----------------------
      Calories: asChoiceOrText(s.calories),
      "Protein (g)": asChoiceOrText(s.proteinGrams),
      "Carbs (g)": asChoiceOrText(s.carbsGrams),
      "Fat (g)": asChoiceOrText(s.fatsGrams),
      "Hydration (oz)": asChoiceOrText(s.hydrationOz),
      "Notes (Macros)": asChoiceOrText(s.notesMacros),

      // -----------------------
      // Supplements
      // -----------------------
      "Protein Recommendation": asChoiceOrText(s.proteinRecommendation),
      "Creatine Recommendation": asChoiceOrText(s.creatineRecommendation),
      "BCAA/EAA Recommendation": asChoiceOrText(s.bcaaRecommendation),
      "Electrolytes Recommendation": asChoiceOrText(s.electrolytesRecommendation),
      "Notes (Supplements)": asChoiceOrText(s.notesSupplements),

      // -----------------------
      // Meta
      // -----------------------
      "Meta Status": asChoiceOrText(s.metaStatus || "Active"),
      "Meta Effective Date": coerceMaybeDateISO(s.metaEffectiveDate) || nowISO,
      "Meta Last Updated": nowISO,

      // -----------------------
      // ✅ Optional Upgrades (only if env vars configured)
      // -----------------------
      ...optionalFields,
    });

    const created = await presBase(PRES_TABLE).create(fields);

    // Best-effort audit log
    try {
      await logAuditEvent({
        action: "CREATE_PLAN",
        actorEmail: cleanString(user?.Email || user?.email || org?.email),
        actorId: cleanString(user?.id || ""),
        orgToken,
        orgName: cleanString(org?.name),
        athleteEmail: email,
        entityType: "Prescription",
        entityId: created?.id || "",
        meta: {
          title: fields.Title || "",
          athleteScansLinked: !!athleteScansId,
          athleteScansId: athleteScansId || "",
          linkWarning: linkWarning || "",
          savedPhaseField: PRES_PHASE_FIELD || "",
          savedPlanJsonField: PRES_PLANJSON_FIELD || "",
        },
      });
    } catch (e) {
      console.warn("[createPrescription] audit log failed:", e?.message || e);
    }

    return res.status(200).json({
      success: true,
      id: created?.id,
      record: { id: created?.id, fields: created?.fields || {} },
      athleteScansId: athleteScansId || null,
      warning: linkWarning || null,
      upgrades: {
        phaseField: PRES_PHASE_FIELD || null,
        planJsonField: PRES_PLANJSON_FIELD || null,
      },
    });
  } catch (err) {
    console.error("[createPrescription] Airtable error:", err);
    return res.status(500).json({
      error: "Failed to create prescription",
      airtable: formatAirtableError(err),
    });
  }
}
