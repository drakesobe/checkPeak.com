// lib/org/prescriptions/prescriptions-utils.js

function safeFirst(v) {
  if (Array.isArray(v)) return v[0] || "";
  return v || "";
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

export function dateToISO(dateStr) {
  const s = String(dateStr || "").trim();
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

export function getAthleteToken(a) {
  // Supports Airtable field casing + lookup arrays
  return String(
    safeFirst(
      a?.athleteToken ||
        a?.AthleteToken ||
        a?.["AthleteToken"] ||
        a?.fields?.AthleteToken ||
        a?.fields?.athleteToken
    ) || ""
  ).trim();
}

export function buildPlanSummaryText(plan) {
  const lines = [];

  lines.push("SUPPLEMENTS");
  lines.push(`- Protein: ${plan.proteinRecommendation || "—"}`);
  lines.push(`- Creatine: ${plan.creatineRecommendation || "—"}`);
  lines.push(`- BCAA/EAA: ${plan.bcaaRecommendation || "—"}`);
  lines.push(`- Electrolytes: ${plan.electrolytesRecommendation || "—"}`);
  lines.push(`- Notes (Supplements): ${plan.notesSupplements || "—"}`);

  lines.push("");
  lines.push("MACROS");
  lines.push(`- Phase: ${plan.phase || "—"}`);
  lines.push(`- Calories: ${plan.calories || "—"}`);
  lines.push(`- Protein (g): ${plan.proteinGrams || "—"}`);
  lines.push(`- Carbs (g): ${plan.carbsGrams || "—"}`);
  lines.push(`- Fat (g): ${plan.fatsGrams || "—"}`);
  lines.push(`- Hydration (oz): ${plan.hydrationOz || "—"}`);
  lines.push(`- Notes (Macros): ${plan.notesMacros || "—"}`);

  if (plan.freeformNotes?.trim()) {
    lines.push("");
    lines.push("COACH NOTES");
    lines.push(plan.freeformNotes.trim());
  }

  return lines.join("\n");
}

function numOrNull(v) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

export function buildNutritionPlanJson(structured, { createdBy = "" } = {}) {
  return {
    version: 1,
    phase: String(structured.phase || "Maintain"),
    daily: {
      calories: numOrNull(structured.calories),
      protein: numOrNull(structured.proteinGrams),
      carbs: numOrNull(structured.carbsGrams),
      fat: numOrNull(structured.fatsGrams),
    },
    meals: [],
    supplements: {
      protein: structured.proteinRecommendation || "",
      creatine: structured.creatineRecommendation || "",
      bcaaEaa: structured.bcaaRecommendation || "",
      electrolytes: structured.electrolytesRecommendation || "",
      notes: structured.notesSupplements || "",
    },
    notes: String(structured.freeformNotes || "").trim(),
    updatedAt: new Date().toISOString(),
    updatedBy: createdBy || "",
  };
}

export const DEFAULT_STRUCTURED = {
  phase: "Maintain",

  calories: "",
  proteinGrams: "",
  carbsGrams: "",
  fatsGrams: "",
  hydrationOz: "",
  notesMacros: "",

  proteinRecommendation: "",
  creatineRecommendation: "",
  bcaaRecommendation: "",
  electrolytesRecommendation: "",
  notesSupplements: "",

  metaStatus: "Active",
  metaEffectiveDate: "",

  freeformNotes: "",
};

export function getEmailFromAthlete(a) {
  return normalizeEmail(a?.email || a?.fields?.Email || a?.Email);
}
