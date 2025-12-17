// lib/planTemplates.js

export const PLAN_TEMPLATES = [
  {
    id: "in-season-maintenance",
    name: "In-Season Maintenance",
    description: "Stable performance, recovery support, low risk.",
    structured: {
      // Supplements
      proteinRecommendation: "Whey Isolate",
      creatineRecommendation: "Creatine Monohydrate (5g daily)",
      eaaBCAARecommendation: "EAA",
      electrolytesRecommendation: "Low sugar electrolytes",
      notesSupplements: "Only NSF Certified for Sport",

      // Macros
      calories: "3200",
      proteinGrams: "200",
      carbsGrams: "400",
      fatsGrams: "80",
      hydrationOz: "120",
      notesMacros: "Training days: +50g carbs",

      // Meta
      metaStatus: "Active",
      metaEffectiveDate: "",
      freeformNotes:
        "Focus: consistency, recovery, hydration. Emphasize sleep + meal timing.",
    },
  },
  {
    id: "cut-weight",
    name: "Cut / Lean Out",
    description: "Reduce calories while preserving performance.",
    structured: {
      proteinRecommendation: "Whey Isolate",
      creatineRecommendation: "Creatine Monohydrate (3g daily)",
      eaaBCAARecommendation: "EAA",
      electrolytesRecommendation: "Low sugar electrolytes",
      notesSupplements: "Avoid stimulants",

      calories: "2800",
      proteinGrams: "220",
      carbsGrams: "300",
      fatsGrams: "70",
      hydrationOz: "120",
      notesMacros: "Rest days: -50g carbs",

      metaStatus: "Active",
      metaEffectiveDate: "",
      freeformNotes:
        "Focus: calorie control, high protein, keep training intensity. Watch recovery.",
    },
  },
  {
    id: "bulk-strength",
    name: "Bulk / Strength Phase",
    description: "Increase calories for mass + strength.",
    structured: {
      proteinRecommendation: "Mass gainer",
      creatineRecommendation: "Creatine Monohydrate (5g daily)",
      eaaBCAARecommendation: "BCAA 2:1:1",
      electrolytesRecommendation: "Standard electrolytes",
      notesSupplements: "Avoid proprietary blends",

      calories: "3800",
      proteinGrams: "240",
      carbsGrams: "450",
      fatsGrams: "100",
      hydrationOz: "140",
      notesMacros: "Adjust carbs based on weekly weight change",

      metaStatus: "Active",
      metaEffectiveDate: "",
      freeformNotes:
        "Focus: progressive overload + sleep. Track weekly weight change and adjust carbs.",
    },
  },
];

export function getTemplateById(id) {
  const t = PLAN_TEMPLATES.find((x) => x.id === id);
  return t || null;
}
