// /hooks/org/prescriptions/usePlanCreator.js
"use client";

import { useCallback, useState } from "react";

/* ---------------- tiny helpers ---------------- */

function asString(v) {
  if (v === 0) return "0";
  return String(v ?? "").trim();
}

function normalizeEmail(v) {
  return asString(v).toLowerCase();
}

function safeNumOrString(v) {
  // keep Airtable-friendly: numbers become numbers, blanks become "", strings pass through
  const s = asString(v);
  if (!s) return "";
  const n = Number(s);
  return Number.isFinite(n) ? n : s;
}

function safeJson(obj) {
  try {
    return JSON.parse(JSON.stringify(obj ?? {}));
  } catch {
    return {};
  }
}

/**
 * Build PlanJson consistently from "structured"
 * - meta: effectiveDate/status
 * - daily: calories/protein/carbs/fat/hydrationOz
 * - mealSplit, mealBlocks, locks, phase, notes, supplements
 */
function buildPlanJson({ structured, title }) {
  const s = structured && typeof structured === "object" ? structured : {};

  const metaEffectiveDate = asString(s.metaEffectiveDate); // date-only preferred
  const metaStatus = asString(s.metaStatus || "active") || "active";

  const daily = {
    ...(asString(s.calories) ? { calories: safeNumOrString(s.calories) } : {}),
    ...(asString(s.proteinGrams) ? { protein: safeNumOrString(s.proteinGrams) } : {}),
    ...(asString(s.carbsGrams) ? { carbs: safeNumOrString(s.carbsGrams) } : {}),
    ...(asString(s.fatsGrams) ? { fat: safeNumOrString(s.fatsGrams) } : {}),
    // ✅ DAILY HYDRATION (oz)
    ...(asString(s.hydrationOz) ? { hydrationOz: safeNumOrString(s.hydrationOz) } : {}),
  };

  const planJson = {
    title: asString(title) || "Nutrition + Supplements Plan",
    meta: {
      ...(metaEffectiveDate ? { effectiveDate: metaEffectiveDate } : {}),
      status: metaStatus,
    },
    phase: asString(s.phase || ""),
    daily,
    // these let the athlete UI render meal-level targets
    mealSplit: safeJson(s.mealSplit || {}),
    mealBlocks: safeJson(s.mealBlocks || {}),
    // keeps your lock UX state stored in template/plan
    mealAutoSplitLocks: safeJson(s.mealAutoSplitLocks || {}),

    // optional convenience fields
    notes: {
      macros: asString(s.notesMacros || ""),
      supplements: asString(s.notesSupplements || ""),
    },
    supplements: {
      proteinRecommendation: asString(s.proteinRecommendation || ""),
      creatineRecommendation: asString(s.creatineRecommendation || ""),
      bcaaRecommendation: asString(s.bcaaRecommendation || ""),
      electrolytesRecommendation: asString(s.electrolytesRecommendation || ""),
    },
    freeformNotes: asString(s.freeformNotes || ""),
  };

  return planJson;
}

/* ---------------- hook ---------------- */

export function usePlanCreator({
  orgAuthHeaders,
  user,
  selectedAthleteEmail,
  selectedAthleteToken,
  structured,
  validateBuilder,

  // roster helpers
  markDone,
  markDoneFromPlanStatus,

  // history helpers (optional)
  view,
  searchHistory,
  setHistoryOffset,
  setView,
  setError,

  // Save & Next helpers
  advanceSafely,
  goToNextAthlete,
}) {
  const [createLoading, setCreateLoading] = useState(false);

  const createPlan = useCallback(
    async (e, { advance } = { advance: false }) => {
      if (e?.preventDefault) e.preventDefault();

      const vErr = typeof validateBuilder === "function" ? validateBuilder() : "";
      if (vErr) {
        setError?.(vErr);
        return;
      }

      const athleteEmail = normalizeEmail(selectedAthleteEmail);
      const athleteToken = asString(selectedAthleteToken);

      if (!athleteEmail) {
        setError?.("Select an athlete first.");
        return;
      }
      if (!athleteToken) {
        setError?.("Selected athlete is missing AthleteToken.");
        return;
      }

      setCreateLoading(true);
      setError?.("");

      try {
        const createdBy =
          asString(user?.Email || user?.email) ||
          asString(user?.name) ||
          asString(user?.id) ||
          "org";

        // ✅ Build PlanJson (single source of truth)
        const planJson = buildPlanJson({
          structured,
          title: asString(structured?.title || "") || "",
        });

        // ✅ Daily payload (so API can write summary columns)
        const dailyPayload = {
          calories: safeNumOrString(structured?.calories),
          protein: safeNumOrString(structured?.proteinGrams),
          carbs: safeNumOrString(structured?.carbsGrams),
          fat: safeNumOrString(structured?.fatsGrams),
          // ✅ DAILY HYDRATION (oz)
          hydrationOz: safeNumOrString(structured?.hydrationOz),
        };

        // Prefer metaEffectiveDate at top-level too (API supports multiple sources)
        const metaEffectiveDate = asString(structured?.metaEffectiveDate);

        const body = {
          athleteEmail,
          athleteToken, // upsert expects athleteToken (ATH-...)
          phase: asString(structured?.phase || "Maintain"),
          status: asString(structured?.metaStatus || "active") || "active",
          createdBy,
          prescription: asString(structured?.freeformNotes || ""), // legacy notes field
          structured: structured || {},
          daily: dailyPayload,
          metaEffectiveDate: metaEffectiveDate || "",
          planJson,
        };

        const resp = await fetch("/api/org/nutrition/plans/upsert", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(orgAuthHeaders || {}),
          },
          body: JSON.stringify(body),
        });

        const data = await resp.json().catch(() => ({}));

        if (!resp.ok || !data?.ok) {
          const msg =
            asString(data?.error) ||
            asString(data?.message) ||
            `Save failed (${resp.status})`;
          throw new Error(msg);
        }

        // ✅ mark completed for roster UX
        try {
          markDone?.(athleteEmail);
        } catch {}
        try {
          markDoneFromPlanStatus?.(athleteEmail);
        } catch {}

        // ✅ refresh history list if they're on history view
        try {
          if (view === "history" && typeof searchHistory === "function") {
            setHistoryOffset?.(0);
            await searchHistory({ reset: true });
          }
        } catch {}

        // ✅ advance if Save & Next
        if (advance) {
          try {
            if (typeof advanceSafely === "function") {
              await advanceSafely();
            } else if (typeof goToNextAthlete === "function") {
              goToNextAthlete();
            }
          } catch {}
        } else {
          // keep them in builder view after save
          setView?.("builder");
        }
      } catch (err) {
        console.error("[usePlanCreator] createPlan error:", err);
        setError?.(asString(err?.message) || "Failed to save plan.");
      } finally {
        setCreateLoading(false);
      }
    },
    [
      orgAuthHeaders,
      user,
      selectedAthleteEmail,
      selectedAthleteToken,
      structured,
      validateBuilder,
      markDone,
      markDoneFromPlanStatus,
      view,
      searchHistory,
      setHistoryOffset,
      setView,
      setError,
      advanceSafely,
      goToNextAthlete,
    ]
  );

  return { createLoading, createPlan };
}
