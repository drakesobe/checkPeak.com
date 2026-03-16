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

// Sanitise a product object — only keep the fields the athlete UI needs.
// Returns null if the value isn't a real product selection.
function safeProduct(v) {
  if (!v || typeof v !== "object" || !asString(v.id)) return null;
  return {
    id:              asString(v.id),
    name:            asString(v.name),
    affiliateLink:   asString(v.affiliateLink  || ""),
    imageUrl:        asString(v.imageUrl       || ""),
    category:        asString(v.category       || ""),
    pricePerServing: v.pricePerServing != null ? Number(v.pricePerServing) || null : null,
  };
}

/**
 * Build PlanJson consistently from "structured".
 *
 * supplements block now carries both:
 *   - legacy string fields (proteinRecommendation etc.) for backward compat
 *   - product objects (proteinProduct etc.) for the new affiliate card UI
 */
function buildPlanJson({ structured, title }) {
  const s = structured && typeof structured === "object" ? structured : {};

  const metaEffectiveDate = asString(s.metaEffectiveDate);
  const metaStatus        = asString(s.metaStatus || "active") || "active";

  const daily = {
    ...(asString(s.calories)     ? { calories:     safeNumOrString(s.calories)     } : {}),
    ...(asString(s.proteinGrams) ? { protein:      safeNumOrString(s.proteinGrams) } : {}),
    ...(asString(s.carbsGrams)   ? { carbs:        safeNumOrString(s.carbsGrams)   } : {}),
    ...(asString(s.fatsGrams)    ? { fat:          safeNumOrString(s.fatsGrams)    } : {}),
    ...(asString(s.hydrationOz)  ? { hydrationOz:  safeNumOrString(s.hydrationOz)  } : {}),
  };

  // ── Supplement string recommendations (legacy — kept for backward compat) ──
  const supplementStrings = {
    proteinRecommendation:      asString(s.proteinRecommendation      || ""),
    creatineRecommendation:     asString(s.creatineRecommendation     || ""),
    bcaaRecommendation:         asString(s.bcaaRecommendation         || ""),
    electrolytesRecommendation: asString(s.electrolytesRecommendation || ""),
    // new categories (string fallback)
    preWorkoutRecommendation:   asString(s.preWorkoutRecommendation   || ""),
    proteinBarRecommendation:   asString(s.proteinBarRecommendation   || ""),
  };

  // ── Product objects (new — what powers the affiliate card on athlete side) ──
  const supplementProducts = {};
  const productKeys = [
    "proteinProduct",
    "creatineProduct",
    "bcaaProduct",
    "preWorkoutProduct",
    "proteinBarProduct",
  ];
  for (const key of productKeys) {
    const p = safeProduct(s[key]);
    if (p) supplementProducts[key] = p;
  }

  const planJson = {
    title:    asString(title) || "Nutrition + Supplements Plan",
    meta: {
      ...(metaEffectiveDate ? { effectiveDate: metaEffectiveDate } : {}),
      status: metaStatus,
    },
    phase:              asString(s.phase || ""),
    daily,
    mealSplit:          safeJson(s.mealSplit          || {}),
    mealBlocks:         safeJson(s.mealBlocks         || {}),
    mealAutoSplitLocks: safeJson(s.mealAutoSplitLocks || {}),
    notes: {
      macros:       asString(s.notesMacros      || ""),
      supplements:  asString(s.notesSupplements || ""),
    },
    // Combined supplements block — strings + product objects together
    supplements: {
      ...supplementStrings,
      ...supplementProducts,
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
  markDone,
  markDoneFromPlanStatus,
  view,
  searchHistory,
  setHistoryOffset,
  setView,
  setError,
  advanceSafely,
  goToNextAthlete,
}) {
  const [createLoading, setCreateLoading] = useState(false);

  const createPlan = useCallback(
    async (e, { advance } = { advance: false }) => {
      if (e?.preventDefault) e.preventDefault();

      const vErr = typeof validateBuilder === "function" ? validateBuilder() : "";
      if (vErr) { setError?.(vErr); return; }

      const athleteEmail = normalizeEmail(selectedAthleteEmail);
      const athleteToken = asString(selectedAthleteToken);

      if (!athleteEmail) { setError?.("Select an athlete first."); return; }
      if (!athleteToken) { setError?.("Selected athlete is missing AthleteToken."); return; }

      setCreateLoading(true);
      setError?.("");

      try {
        const createdBy =
          asString(user?.Email || user?.email) ||
          asString(user?.name)                 ||
          asString(user?.id)                   ||
          "org";

        const planJson = buildPlanJson({
          structured,
          title: asString(structured?.title || ""),
        });

        const dailyPayload = {
          calories:    safeNumOrString(structured?.calories),
          protein:     safeNumOrString(structured?.proteinGrams),
          carbs:       safeNumOrString(structured?.carbsGrams),
          fat:         safeNumOrString(structured?.fatsGrams),
          hydrationOz: safeNumOrString(structured?.hydrationOz),
        };

        const metaEffectiveDate = asString(structured?.metaEffectiveDate);

        const body = {
          athleteEmail,
          athleteToken,
          phase:              asString(structured?.phase || "Maintain"),
          status:             asString(structured?.metaStatus || "active") || "active",
          createdBy,
          prescription:       asString(structured?.freeformNotes || ""),
          structured:         structured || {},
          daily:              dailyPayload,
          metaEffectiveDate:  metaEffectiveDate || "",
          planJson,
        };

        const resp = await fetch("/api/org/nutrition/plans/upsert", {
          method:  "POST",
          headers: { "Content-Type": "application/json", ...(orgAuthHeaders || {}) },
          body:    JSON.stringify(body),
        });

        const data = await resp.json().catch(() => ({}));

        if (!resp.ok || !data?.ok) {
          const msg = asString(data?.error) || asString(data?.message) || `Save failed (${resp.status})`;
          throw new Error(msg);
        }

        try { markDone?.(athleteEmail); }            catch {}
        try { markDoneFromPlanStatus?.(athleteEmail); } catch {}

        try {
          if (view === "history" && typeof searchHistory === "function") {
            setHistoryOffset?.(0);
            await searchHistory({ reset: true });
          }
        } catch {}

        if (advance) {
          try {
            if (typeof advanceSafely === "function") await advanceSafely();
            else if (typeof goToNextAthlete === "function") goToNextAthlete();
          } catch {}
        } else {
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
      orgAuthHeaders, user, selectedAthleteEmail, selectedAthleteToken,
      structured, validateBuilder, markDone, markDoneFromPlanStatus,
      view, searchHistory, setHistoryOffset, setView, setError,
      advanceSafely, goToNextAthlete,
    ]
  );

  return { createLoading, createPlan };
}