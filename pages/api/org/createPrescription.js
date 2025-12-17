// pages/api/org/createPrescription.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

/**
 * Create a Prescription / Plan record for an athlete UNDER the logged-in org.
 *
 * Security:
 * - Uses requireOrg(req) cookie auth (org must be logged in)
 * - Does NOT trust client-supplied token
 * - Enforces org token match on the new record ("Organization Token")
 *
 * Inputs (req.body):
 * - athleteEmail (required)
 * - organizationName (optional; will fallback to org from cookie)
 * - title (optional)
 * - prescription (optional but recommended) -> long text fallback summary
 * - createdBy (optional; will fallback to org email)
 * - structured (optional) -> fields for new Airtable single-select columns
 *
 * Airtable columns you added (single select):
 * Macros:
 *  - Calories
 *  - Protein (g)
 *  - Carbs (g)
 *  - Fat (g)
 *  - Hydration (oz)
 *  - Notes (Macros)
 * Supplements:
 *  - Protein Recommendation
 *  - Creatine Recommendation
 *  - BCAA/EAA Recommendation
 *  - Electrolytes Recommendation
 *  - Notes (Supplements)
 * Meta:
 *  - Meta Status
 *  - Meta Effective Date
 *  - Meta Last Updated
 *
 * Existing columns:
 * - Title
 * - Prescription
 * - Organization Token
 * - Athlete Email
 * - Organization
 * - CreatedAt
 * - CreatedBy
 */

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function cleanString(v) {
  const s = String(v ?? "").trim();
  return s.length ? s : "";
}

function coerceMaybeDateISO(v) {
  // Airtable "Date" fields generally accept ISO strings (e.g. 2025-12-16T00:00:00.000Z)
  // If you send an empty string, remove field.
  const s = cleanString(v);
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

function stripEmpty(fields) {
  const out = { ...fields };
  Object.keys(out).forEach((k) => {
    if (out[k] === "" || out[k] === null || typeof out[k] === "undefined") {
      delete out[k];
    }
  });
  return out;
}

/**
 * IMPORTANT: Your new macro/supplement fields are SINGLE SELECT.
 * That means Airtable expects the value to be EXACTLY one of the allowed choices.
 *
 * This helper doesn't validate against the list (since we don't have it here),
 * but it ensures we don't send junk values like objects/arrays.
 */
function singleSelectValue(v) {
  const s = cleanString(v);
  return s || "";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ✅ Cookie auth: org must be logged in
  const auth = requireOrg(req);
  if (!auth.ok) {
    return res.status(401).json({ error: auth.error });
  }

  const { org } = auth;

  const {
    athleteEmail,
    prescription, // fallback long text summary
    title,
    organizationName,
    createdBy,
    structured, // new structured fields object
  } = req.body || {};

  const email = normalizeEmail(athleteEmail);
  if (!email) return res.status(400).json({ error: "Missing athleteEmail" });

  // Allow empty prescription text now since you may rely purely on structured fields
  const text = cleanString(prescription);

  const API_KEY = process.env.PRESCRIPTIONS_API_KEY;
  const BASE_ID = process.env.PRESCRIPTIONS_BASE_ID;
  const TABLE_ID = process.env.PRESCRIPTIONS_TABLE_NAME;

  if (!API_KEY || !BASE_ID || !TABLE_ID) {
    return res.status(500).json({
      error:
        "Prescriptions Airtable not configured. Check PRESCRIPTIONS_API_KEY, PRESCRIPTIONS_BASE_ID, PRESCRIPTIONS_TABLE_NAME.",
      missing: {
        PRESCRIPTIONS_API_KEY: !API_KEY,
        PRESCRIPTIONS_BASE_ID: !BASE_ID,
        PRESCRIPTIONS_TABLE_NAME: !TABLE_ID,
      },
    });
  }

  const base = new Airtable({ apiKey: API_KEY }).base(BASE_ID);

  try {
    const nowISO = new Date().toISOString();

    // Pull structured fields safely
    const s = structured && typeof structured === "object" ? structured : {};

    // Map structured fields -> your exact Airtable column names
    const fields = stripEmpty({
      // Existing columns
      Title: cleanString(title) || "Prescription",
      Prescription: text, // can be omitted if empty
      "Organization Token": org.token, // ✅ always from cookie
      "Athlete Email": email,
      Organization: cleanString(organizationName) || cleanString(org.name) || "Organization",
      CreatedAt: nowISO,
      CreatedBy: cleanString(createdBy) || cleanString(org.email),

      // -----------------------
      // NEW: Macros (Single select fields)
      // -----------------------
      Calories: singleSelectValue(s.calories),
      "Protein (g)": singleSelectValue(s.proteinGrams),
      "Carbs (g)": singleSelectValue(s.carbsGrams),
      "Fat (g)": singleSelectValue(s.fatsGrams),
      "Hydration (oz)": singleSelectValue(s.hydrationOz),
      "Notes (Macros)": singleSelectValue(s.notesMacros),

      // -----------------------
      // NEW: Supplements (Single select fields)
      // -----------------------
      "Protein Recommendation": singleSelectValue(s.proteinRecommendation),
      "Creatine Recommendation": singleSelectValue(s.creatineRecommendation),
      "BCAA/EAA Recommendation": singleSelectValue(s.bcaaRecommendation),
      "Electrolytes Recommendation": singleSelectValue(s.electrolytesRecommendation),
      "Notes (Supplements)": singleSelectValue(s.notesSupplements),

      // -----------------------
      // NEW: Meta
      // -----------------------
      "Meta Status": singleSelectValue(s.metaStatus || "Active"),
      "Meta Effective Date": coerceMaybeDateISO(s.metaEffectiveDate) || nowISO,
      "Meta Last Updated": nowISO,
    });

    /**
     * NOTE:
     * - If any of these are Single Select fields and you send a value not in the select options,
     *   Airtable will return 422 INVALID_VALUE_FOR_COLUMN.
     * - If your "Meta Effective Date" is a Date field and you prefer date-only,
     *   you can store `new Date().toISOString().slice(0, 10)` instead.
     */

    const created = await base(TABLE_ID).create(fields);

    return res.status(200).json({
      success: true,
      id: created.id,
    });
  } catch (err) {
    console.error("[createPrescription] Airtable error:", err);

    // Airtable gives helpful info in err.error / err.message
    return res.status(500).json({
      error: "Failed to create prescription",
      airtable: {
        statusCode: err?.statusCode,
        message: err?.message,
        error: err?.error,
      },
    });
  }
}
