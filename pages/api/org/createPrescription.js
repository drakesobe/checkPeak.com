// pages/api/org/createPrescription.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";
import { logAuditEvent } from "@/lib/audit";

/**
 * Create a Prescription / Plan record for an athlete UNDER the logged-in org.
 *
 * Security model:
 * - Uses requireOrg(req) cookie auth (org must be logged in)
 * - Does NOT trust any client-supplied token
 * - Writes "Organization Token" from org cookie only
 *
 * req.body inputs:
 * - athleteEmail (required)
 * - title (optional)
 * - prescription (optional; long text summary)
 * - createdBy (optional; fallback to org.email)
 * - organizationName (optional; fallback to org.name)
 * - structured (optional object; your new macro/supplement/meta fields)
 *
 * Airtable columns assumed (from your docstring):
 * Existing:
 * - Title
 * - Prescription
 * - Organization Token
 * - Athlete Email
 * - Organization
 * - CreatedAt
 * - CreatedBy
 *
 * New:
 * Macros:
 * - Calories
 * - Protein (g)
 * - Carbs (g)
 * - Fat (g)
 * - Hydration (oz)
 * - Notes (Macros)
 * Supplements:
 * - Protein Recommendation
 * - Creatine Recommendation
 * - BCAA/EAA Recommendation
 * - Electrolytes Recommendation
 * - Notes (Supplements)
 * Meta:
 * - Meta Status
 * - Meta Effective Date
 * - Meta Last Updated
 *
 * NOTE:
 * - If any of the “new” fields are Single Select, Airtable requires the value
 *   to match an existing option exactly (case/spelling).
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
  for (const k of Object.keys(out)) {
    if (out[k] === "" || out[k] === null || typeof out[k] === "undefined") {
      delete out[k];
    }
  }
  return out;
}

/**
 * Your UI may pass values as numbers, labels, or blanks.
 * For Airtable Single Select: pass a string label (or omit the field).
 * For text fields: passing a string is fine.
 */
function asChoiceOrText(v) {
  const s = cleanString(v);
  return s || "";
}

function hasAnyStructuredValue(structured = {}) {
  if (!structured || typeof structured !== "object") return false;
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
  return keys.some((k) => cleanString(structured[k]));
}

function getEnvOrExplain() {
  const API_KEY = process.env.PRESCRIPTIONS_API_KEY;
  const BASE_ID = process.env.PRESCRIPTIONS_BASE_ID;
  const TABLE_NAME = process.env.PRESCRIPTIONS_TABLE_NAME;

  const ok = !!(API_KEY && BASE_ID && TABLE_NAME);
  return {
    ok,
    API_KEY,
    BASE_ID,
    TABLE_NAME,
    missing: {
      PRESCRIPTIONS_API_KEY: !API_KEY,
      PRESCRIPTIONS_BASE_ID: !BASE_ID,
      PRESCRIPTIONS_TABLE_NAME: !TABLE_NAME,
    },
  };
}

function formatAirtableError(err) {
  const statusCode = err?.statusCode;
  const error = err?.error;
  const message = err?.message;

  // Common Airtable issues with actionable hints
  if (error === "UNKNOWN_FIELD_NAME") {
    return {
      statusCode: statusCode || 422,
      error,
      message,
      hint:
        'Airtable field name mismatch. Confirm the column exists EXACTLY (spelling/case) in the PRESCRIPTIONS table. Example: "Protein (g)" vs "Protein(g)".',
    };
  }

  if (
    error === "INVALID_MULTIPLE_CHOICE_OPTIONS" ||
    (typeof message === "string" && message.toLowerCase().includes("multiple choice"))
  ) {
    return {
      statusCode: statusCode || 422,
      error: error || "INVALID_MULTIPLE_CHOICE_OPTIONS",
      message,
      hint:
        "One of the single-select fields received a value that is not an allowed option. Ensure UI sends the exact option label configured in Airtable.",
    };
  }

  return {
    statusCode: statusCode || 500,
    error: error || "AIRTABLE_ERROR",
    message: message || "Unknown Airtable error",
  };
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
  if (!auth?.ok) {
    return res.status(401).json({ error: auth?.error || "Unauthorized" });
  }

  const { org } = auth;

  const {
    athleteEmail,
    prescription, // long-text summary (optional)
    title,
    organizationName,
    createdBy,
    structured, // optional object with your new fields
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

  // Airtable config
  const env = getEnvOrExplain();
  if (!env.ok) {
    return res.status(500).json({
      error:
        "Prescriptions Airtable not configured. Check PRESCRIPTIONS_API_KEY, PRESCRIPTIONS_BASE_ID, PRESCRIPTIONS_TABLE_NAME.",
      missing: env.missing,
    });
  }

  const base = new Airtable({ apiKey: env.API_KEY }).base(env.BASE_ID);

  try {
    const nowISO = new Date().toISOString();

    /**
     * Build Airtable fields:
     * - Only include non-empty values (stripEmpty)
     * - Use org.token from cookie (source of truth)
     */
    const fields = stripEmpty({
      // -----------------------
      // Existing columns
      // -----------------------
      Title: cleanString(title) || "Prescription",
      Prescription: text, // omitted if empty
      "Organization Token": cleanString(org?.token),
      "Athlete Email": email,
      Organization:
        cleanString(organizationName) ||
        cleanString(org?.name) ||
        "Organization",
      CreatedAt: nowISO,
      CreatedBy: cleanString(createdBy) || cleanString(org?.email),

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
      "Electrolytes Recommendation": asChoiceOrText(
        s.electrolytesRecommendation
      ),
      "Notes (Supplements)": asChoiceOrText(s.notesSupplements),

      // -----------------------
      // Meta
      // -----------------------
      "Meta Status": asChoiceOrText(s.metaStatus || "Active"),
      "Meta Effective Date": coerceMaybeDateISO(s.metaEffectiveDate) || nowISO,
      "Meta Last Updated": nowISO,
    });

    // Extra safety: ensure org token is present
    if (!fields["Organization Token"]) {
      return res.status(500).json({
        error:
          "Org token missing from cookie auth. Re-login to the org and try again.",
      });
    }

    const created = await base(env.TABLE_NAME).create(fields);

    // Best-effort audit log (should NEVER break creation)
    try {
      await logAuditEvent({
        action: "CREATE_PLAN",
        actorEmail: cleanString(org?.email),
        actorId: cleanString(org?.id),
        orgToken: cleanString(org?.token),
        orgName: cleanString(org?.name),
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
      id: created?.id,
      // Optional: returning minimal fields can help UI update instantly
      record: {
        id: created?.id,
        fields: created?.fields || {},
      },
    });
  } catch (err) {
    console.error("[createPrescription] Airtable error:", err);

    const formatted = formatAirtableError(err);

    return res.status(500).json({
      error: "Failed to create prescription",
      airtable: formatted,
    });
  }
}
