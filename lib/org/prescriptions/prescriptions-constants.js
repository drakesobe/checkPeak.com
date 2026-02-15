// /lib/org/prescriptions/prescriptions-constants.js
import { rangeOptions } from "@/lib/rangeOptions";

export const inputBase =
  "w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30";

export const subtleHint = "text-[11px] text-gray-500 mt-2 leading-relaxed";

export const PAGE_SIZE = 10;

export function buildOptions() {
  const calories = rangeOptions(0, 5000, 5);
  const grams = rangeOptions(0, 400, 1);
  const hydration = rangeOptions(0, 300, 1);

  const phases = ["Surplus", "Maintain", "Cut"];

  const proteinRec = [
    "",
    "Whey Isolate",
    "Whey Concentrate",
    "Casein (night)",
    "Plant-based",
    "Mass gainer",
    "Hydrolyzed whey",
    "None",
  ];
  const creatineRec = [
    "",
    "Creatine Monohydrate (3g daily)",
    "Creatine Monohydrate (5g daily)",
    "Creapure (5g daily)",
    "Loading phase (20g/day x 5–7d) then 5g/day",
    "None",
  ];
  const bcaaRec = ["", "BCAA 2:1:1", "EAA", "EAA (intra-workout)", "None"];
  const electrolytesRec = [
    "",
    "Low sugar electrolytes",
    "Standard electrolytes",
    "High sodium (two-a-days)",
    "Sweat test guided",
    "None",
  ];

  const notesMacros = [
    "",
    "Training days: +50g carbs",
    "Rest days: -50g carbs",
    "Weigh-in week: reduce sodium",
    "Increase calories gradually (+150/week)",
    "Increase hydration on travel days",
  ];
  const notesSupps = ["", "Only NSF Certified for Sport", "Avoid proprietary blends", "Avoid stimulants", "Third-party tested only"];
  const metaStatus = ["Active", "Draft", "Archived", "Paused"];

  return {
    calories,
    grams,
    hydration,
    phases,
    proteinRecommendation: proteinRec,
    creatineRecommendation: creatineRec,
    bcaaRecommendation: bcaaRec,
    electrolytesRecommendation: electrolytesRec,
    notesMacros,
    notesSupplements: notesSupps,
    metaStatus,
  };
}
