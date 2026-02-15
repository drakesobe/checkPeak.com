// components/org/prescriptions/planBuilder/PlanBuilderForm.jsx
"use client";

import { useMemo, useRef, useState } from "react";
import SearchSelect from "@/components/SearchSelect";
import MealBlockEditor from "./mealBlocks/MealBlockEditor";

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function StepCard({
  step,
  title,
  subtitle,
  isOpen,
  isComplete,
  onToggle,
  children,
  rightSlot,
}) {
  return (
    <div className="bg-white rounded-2xl shadow-md border border-blue-100 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className={cx(
          "w-full text-left px-4 sm:px-6 py-4 flex items-start justify-between gap-3",
          "hover:bg-gray-50 transition"
        )}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cx(
                "inline-flex items-center justify-center h-8 w-8 rounded-full text-sm font-extrabold",
                isComplete ? "bg-emerald-100 text-emerald-800" : "bg-blue-50 text-[#46769B]"
              )}
            >
              {step}
            </span>
            <h3 className="text-base sm:text-lg font-extrabold text-gray-900">{title}</h3>
            {isComplete ? (
              <span className="ml-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Ready
              </span>
            ) : (
              <span className="ml-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                Incomplete
              </span>
            )}
          </div>
          {subtitle ? (
            <p className="text-xs sm:text-sm text-gray-600 mt-1 break-words">{subtitle}</p>
          ) : null}
        </div>

        <div className="shrink-0 flex items-center gap-2">
          {rightSlot ? <div className="hidden sm:block">{rightSlot}</div> : null}
          <span className="text-xs font-semibold text-gray-500">{isOpen ? "Hide" : "Show"}</span>
        </div>
      </button>

      {isOpen ? <div className="px-4 sm:px-6 pb-6">{children}</div> : null}
    </div>
  );
}

export default function PlanBuilderForm({
  inputBase,
  subtleHint,

  title,
  setTitle,

  structured,
  onChange,

  OPTIONS,

  createLoading,
  selectedAthleteEmail,

  onReset,
  onSave,
  onSaveNext,
}) {
  const [openStep, setOpenStep] = useState(1);

  const step1Ref = useRef(null);
  const step2Ref = useRef(null);
  const step3Ref = useRef(null);

  const dailyReady = useMemo(() => {
    // ✅ “Ready” if they've set calories OR any macro OR hydration
    const has =
      String(structured?.calories || "").trim() ||
      String(structured?.proteinGrams || "").trim() ||
      String(structured?.carbsGrams || "").trim() ||
      String(structured?.fatsGrams || "").trim() ||
      String(structured?.hydrationOz || "").trim(); // ✅ add hydration
    return Boolean(has);
  }, [structured]);

  const mealBlocksReady = useMemo(() => {
    const mb = structured?.mealBlocks;
    if (!mb || typeof mb !== "object") return false;
    const keys = ["breakfast", "lunch", "afternoon", "dinner"];
    for (const k of keys) {
      const t = mb?.[k]?.targets || {};
      const any =
        String(t.calories || "").trim() ||
        String(t.protein || "").trim() ||
        String(t.carbs || "").trim() ||
        String(t.fat || "").trim() ||
        String(t.hydrationOz || "").trim(); // ✅ include water per meal
      if (any) return true;
    }
    return false;
  }, [structured]);

  const notesReady = useMemo(() => {
    return Boolean(
      String(structured?.notesMacros || "").trim() ||
        String(structured?.notesSupplements || "").trim() ||
        String(structured?.freeformNotes || "").trim()
    );
  }, [structured]);

  const scrollTo = (ref) => {
    const el = ref?.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const canSave = Boolean(selectedAthleteEmail) && !createLoading;

  return (
    <form onSubmit={(e) => onSave(e)} className="space-y-6">
      {/* Quick header / progress */}
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-extrabold text-gray-900">Plan Builder</p>
            <p className="text-xs text-gray-600 mt-1">
              Simple workflow: <span className="font-semibold">Daily targets</span> →{" "}
              <span className="font-semibold">Meal plan</span> →{" "}
              <span className="font-semibold">Notes & Save</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onReset}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
            >
              Reset
            </button>

            <button
              type="button"
              onClick={(e) => onSave(e)}
              disabled={!canSave}
              className={cx(
                "px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50",
                !canSave ? "opacity-70 cursor-not-allowed" : ""
              )}
            >
              {createLoading ? "Saving…" : "Save"}
            </button>

            <button
              type="button"
              onClick={(e) => onSaveNext(e)}
              disabled={!canSave}
              className={cx(
                "px-4 py-2 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:brightness-110 transition",
                !canSave ? "opacity-70 cursor-not-allowed" : ""
              )}
            >
              {createLoading ? "Saving…" : "Save & Next"}
            </button>
          </div>
        </div>
      </div>

      {/* STEP 1 */}
      <div ref={step1Ref}>
        <StepCard
          step={1}
          title="Daily Targets"
          subtitle="Set phase + daily macros + daily water (oz). This unlocks quick auto-split for meals."
          isOpen={openStep === 1}
          isComplete={dailyReady}
          onToggle={() => setOpenStep(openStep === 1 ? 0 : 1)}
          rightSlot={
            <button
              type="button"
              onClick={() => {
                setOpenStep(2);
                setTimeout(() => scrollTo(step2Ref), 50);
              }}
              className={cx(
                "px-3 py-2 rounded-xl text-[12px] font-semibold border",
                dailyReady
                  ? "bg-[#46769B] text-white border-[#46769B] hover:brightness-110"
                  : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
              )}
              disabled={!dailyReady}
              title={dailyReady ? "Continue to Step 2" : "Set at least calories, a macro, or hydration first"}
            >
              Continue →
            </button>
          }
        >
          {/* Title + Meta */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <p className="text-xs text-gray-500 mb-2">Plan Title</p>
              <input
                className={inputBase}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. In-season maintenance plan"
              />
            </div>

            <div>
              <SearchSelect
                label="Meta Status"
                options={OPTIONS.metaStatus}
                value={structured.metaStatus}
                onChange={(v) => onChange("metaStatus", v)}
                onCommit={(v) => onChange("metaStatus", v)}
                allowCustom={false}
                placeholder="Search status…"
              />
            </div>

            <div className="md:col-span-3">
              <p className="text-xs text-gray-500 mb-2">Meta Effective Date</p>
              <input
                type="date"
                className={inputBase}
                value={structured.metaEffectiveDate}
                onChange={(e) => onChange("metaEffectiveDate", e.target.value)}
              />
              <p className={subtleHint}>If blank, the API can default to “now”.</p>
            </div>
          </div>

          {/* Macros + Phase */}
          <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-4">
            <div>
              <h4 className="font-semibold">Daily Targets</h4>
              <p className="text-xs text-gray-500 mt-1">
                Keep it simple: phase + daily macros + daily water. You can tweak meals in Step 2.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <SearchSelect
                label="Phase"
                options={OPTIONS.phases}
                value={structured.phase}
                onChange={(v) => onChange("phase", v)}
                onCommit={(v) => onChange("phase", v)}
                allowCustom={false}
                placeholder="Select phase…"
              />

              <SearchSelect
                label="Calories (Daily)"
                options={OPTIONS.calories}
                value={structured.calories}
                onChange={(v) => onChange("calories", v)}
                onCommit={(v) => onChange("calories", v)}
                allowCustom
                placeholder="Type or search…"
              />

              <SearchSelect
                label="Protein (g, Daily)"
                options={OPTIONS.grams}
                value={structured.proteinGrams}
                onChange={(v) => onChange("proteinGrams", v)}
                onCommit={(v) => onChange("proteinGrams", v)}
                allowCustom
                placeholder="Type or search…"
              />

              <SearchSelect
                label="Carbs (g, Daily)"
                options={OPTIONS.grams}
                value={structured.carbsGrams}
                onChange={(v) => onChange("carbsGrams", v)}
                onCommit={(v) => onChange("carbsGrams", v)}
                allowCustom
                placeholder="Type or search…"
              />

              <SearchSelect
                label="Fat (g, Daily)"
                options={OPTIONS.grams}
                value={structured.fatsGrams}
                onChange={(v) => onChange("fatsGrams", v)}
                onCommit={(v) => onChange("fatsGrams", v)}
                allowCustom
                placeholder="Type or search…"
              />

              {/* ✅ Daily Hydration used by MealBlockEditor to split into per-meal water */}
              <SearchSelect
                label="Daily Hydration (oz)"
                options={OPTIONS.hydration}
                value={structured.hydrationOz}
                onChange={(v) => onChange("hydrationOz", v)}
                onCommit={(v) => onChange("hydrationOz", v)}
                allowCustom
                placeholder="Type or search…"
              />

              <div className="md:col-span-3">
                <SearchSelect
                  label="Notes (Macros)"
                  options={OPTIONS.notesMacros}
                  value={structured.notesMacros}
                  onChange={(v) => onChange("notesMacros", v)}
                  onCommit={(v) => onChange("notesMacros", v)}
                  allowCustom
                  placeholder="Search or type notes…"
                />
              </div>

              <p className={cx("md:col-span-3", subtleHint)}>
                Trainer-friendly flow: set daily targets once → auto-split meals (including water) → tweak only what you need.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => {
                setOpenStep(2);
                setTimeout(() => scrollTo(step2Ref), 50);
              }}
              disabled={!dailyReady}
              className={cx(
                "px-4 py-3 rounded-xl text-sm font-semibold transition",
                dailyReady ? "bg-[#46769B] text-white hover:brightness-110" : "bg-gray-100 text-gray-400 cursor-not-allowed"
              )}
            >
              Continue to Step 2 →
            </button>
            {!dailyReady ? (
              <p className="text-xs text-gray-500 flex items-center">
                Set calories, a macro, or hydration to continue.
              </p>
            ) : null}
          </div>
        </StepCard>
      </div>

      {/* STEP 2 */}
      <div ref={step2Ref}>
        <StepCard
          step={2}
          title="Meal Plan"
          subtitle="Auto-split into meals. Expand a meal only if you need to adjust it (macros + water)."
          isOpen={openStep === 2}
          isComplete={mealBlocksReady}
          onToggle={() => setOpenStep(openStep === 2 ? 0 : 2)}
          rightSlot={
            <button
              type="button"
              onClick={() => {
                setOpenStep(3);
                setTimeout(() => scrollTo(step3Ref), 50);
              }}
              className={cx("px-3 py-2 rounded-xl text-[12px] font-semibold border", "bg-white border-gray-200 hover:bg-gray-50")}
              title="Continue to Step 3"
            >
              Continue →
            </button>
          }
        >
          <MealBlockEditor subtleHint={subtleHint} structured={structured} onChange={onChange} ui="guided" />

          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => {
                setOpenStep(3);
                setTimeout(() => scrollTo(step3Ref), 50);
              }}
              className="px-4 py-3 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:brightness-110 transition"
            >
              Continue to Step 3 →
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenStep(1);
                setTimeout(() => scrollTo(step1Ref), 50);
              }}
              className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
            >
              ← Back to Step 1
            </button>
          </div>
        </StepCard>
      </div>

      {/* STEP 3 */}
      <div ref={step3Ref}>
        <StepCard
          step={3}
          title="Supplements, Notes & Save"
          subtitle="Optional details + coach notes. Then save or Save & Next."
          isOpen={openStep === 3}
          isComplete={notesReady}
          onToggle={() => setOpenStep(openStep === 3 ? 0 : 3)}
        >
          {/* Supplements */}
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-4">
            <div>
              <h4 className="font-semibold">Supplements</h4>
              <p className="text-xs text-gray-500 mt-1">
                Keep it simple — pick a recommendation. You can add more detail later.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <SearchSelect
                label="Protein Recommendation"
                options={OPTIONS.proteinRecommendation}
                value={structured.proteinRecommendation}
                onChange={(v) => onChange("proteinRecommendation", v)}
                onCommit={(v) => onChange("proteinRecommendation", v)}
                allowCustom
                placeholder="Search protein…"
              />

              <SearchSelect
                label="Creatine Recommendation"
                options={OPTIONS.creatineRecommendation}
                value={structured.creatineRecommendation}
                onChange={(v) => onChange("creatineRecommendation", v)}
                onCommit={(v) => onChange("creatineRecommendation", v)}
                allowCustom
                placeholder="Search creatine…"
              />

              <SearchSelect
                label="BCAA/EAA Recommendation"
                options={OPTIONS.bcaaRecommendation}
                value={structured.bcaaRecommendation}
                onChange={(v) => onChange("bcaaRecommendation", v)}
                onCommit={(v) => onChange("bcaaRecommendation", v)}
                allowCustom
                placeholder="Search BCAA/EAA…"
              />

              <SearchSelect
                label="Electrolytes Recommendation"
                options={OPTIONS.electrolytesRecommendation}
                value={structured.electrolytesRecommendation}
                onChange={(v) => onChange("electrolytesRecommendation", v)}
                onCommit={(v) => onChange("electrolytesRecommendation", v)}
                allowCustom
                placeholder="Search electrolytes…"
              />

              <div className="md:col-span-2">
                <SearchSelect
                  label="Notes (Supplements)"
                  options={OPTIONS.notesSupplements}
                  value={structured.notesSupplements}
                  onChange={(v) => onChange("notesSupplements", v)}
                  onCommit={(v) => onChange("notesSupplements", v)}
                  allowCustom
                  placeholder="Search or type notes…"
                />
              </div>
            </div>
          </div>

          {/* Freeform notes */}
          <div className="mt-5">
            <p className="text-xs text-gray-500 mb-2">Coach Notes (optional)</p>
            <textarea
              className="w-full min-h-[140px] resize-y px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30"
              value={structured.freeformNotes}
              onChange={(e) => onChange("freeformNotes", e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  onSave(e);
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
                  e.preventDefault();
                  onSaveNext(e);
                }
              }}
              placeholder="Examples: lactose sensitive, practice days increase carbs… (Enter = Save & Next)"
            />
            <p className={subtleHint}>
              Tip: <span className="font-semibold">Shift+Enter</span> for new lines.{" "}
              <span className="font-semibold">Enter</span> = Save & Next.
            </p>
          </div>

          {/* Actions */}
          <div className="mt-5 grid sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => {
                setOpenStep(2);
                setTimeout(() => scrollTo(step2Ref), 50);
              }}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
            >
              ← Back
            </button>

            <button
              type="button"
              onClick={(e) => onSave(e)}
              disabled={!canSave}
              className={cx(
                "w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50",
                !canSave ? "opacity-70 cursor-not-allowed" : ""
              )}
            >
              {createLoading ? "Saving…" : "Save"}
            </button>

            <button
              type="button"
              onClick={(e) => onSaveNext(e)}
              disabled={!canSave}
              className={cx(
                "w-full px-4 py-3 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:brightness-110 transition",
                !canSave ? "opacity-70 cursor-not-allowed" : ""
              )}
            >
              {createLoading ? "Saving…" : "Save & Next"}
            </button>
          </div>

          <div className={cx("mt-4", subtleHint)}>
            Simple flow wins: most trainers should only touch Step 1 + Auto-split in Step 2.
          </div>
        </StepCard>
      </div>
    </form>
  );
}
