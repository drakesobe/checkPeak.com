// pages/api/org/createPrescription.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";
import { logAuditEvent } from "@/lib/audit";

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
 * Airtable expects the value to be EXACTLY one of the allowed choices.
 */
function singleSelectValue(v) {
  const s = cleanString(v);
  return s || "";
}

function hasAnyStructuredValue(s = {}) {
  if (!s || typeof s !== "object") return false;
  const keys = [
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
  return keys.some((k) => cleanString(s[k]));
}

export default async function handler(req, res) {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
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
    structured, // optional structured fields object
  } = req.body || {};

  const email = normalizeEmail(athleteEmail);
  if (!email) return res.status(400).json({ error: "Missing athleteEmail" });

  const text = cleanString(prescription);
  const s = structured && typeof structured === "object" ? structured : {};

  // Prevent saving an entirely empty plan
  if (!text && !hasAnyStructuredValue(s)) {
    return res.status(400).json({
      error:
        "Plan is empty. Provide prescription text or at least one structured selection.",
    });
  }

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

    // Map structured fields -> your exact Airtable column names
    const fields = stripEmpty({
      // Existing columns
      Title: cleanString(title) || "Prescription",
      Prescription: text, // stripped if empty
      "Organization Token": org.token, // ✅ always from cookie
      "Athlete Email": email,
      Organization:
        cleanString(organizationName) ||
        cleanString(org.name) ||
        "Organization",
      CreatedAt: nowISO,
      CreatedBy: cleanString(createdBy) || cleanString(org.email),

      // -----------------------
      // Macros (Single select fields)
      // -----------------------
      Calories: singleSelectValue(s.calories),
      "Protein (g)": singleSelectValue(s.proteinGrams),
      "Carbs (g)": singleSelectValue(s.carbsGrams),
      "Fat (g)": singleSelectValue(s.fatsGrams),
      "Hydration (oz)": singleSelectValue(s.hydrationOz),
      "Notes (Macros)": singleSelectValue(s.notesMacros),

      // -----------------------
      // Supplements (Single select fields)
      // -----------------------
      "Protein Recommendation": singleSelectValue(s.proteinRecommendation),
      "Creatine Recommendation": singleSelectValue(s.creatineRecommendation),
      "BCAA/EAA Recommendation": singleSelectValue(s.bcaaRecommendation),
      "Electrolytes Recommendation": singleSelectValue(
        s.electrolytesRecommendation
      ),
      "Notes (Supplements)": singleSelectValue(s.notesSupplements),

      // -----------------------
      // Meta
      // -----------------------
      "Meta Status": singleSelectValue(s.metaStatus || "Active"),
      "Meta Effective Date": coerceMaybeDateISO(s.metaEffectiveDate) || nowISO,
      "Meta Last Updated": nowISO,
    });

    const created = await base(TABLE_ID).create(fields);

    // Best-effort audit log (should NEVER break creation)
    try {
      await logAuditEvent({
        action: "CREATE_PLAN",
        actorEmail: cleanString(org.email),
        actorId: cleanString(org.id),
        orgToken: cleanString(org.token),
        orgName: cleanString(org.name),
        athleteEmail: email,
        entityType: "Prescription",
        entityId: created?.id || "",
        meta: {
          title: fields.Title || "",
          hasText: !!text,
          hasStructured: hasAnyStructuredValue(s),
        },
      });
    } catch (e) {
      console.warn("[createPrescription] audit log failed:", e?.message || e);
    }

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
