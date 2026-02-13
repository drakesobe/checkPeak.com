// components/org/prescriptions/PlanBuilderForm.jsx
"use client";

import SearchSelect from "@/components/SearchSelect";

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
  return (
    <form onSubmit={(e) => onSave(e)} className="space-y-6">
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
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-4">
        <div>
          <h4 className="font-semibold">Macros</h4>
          <p className="text-xs text-gray-500 mt-1">Phase + daily targets. Meal blocks come next.</p>
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
            label="Calories"
            options={OPTIONS.calories}
            value={structured.calories}
            onChange={(v) => onChange("calories", v)}
            onCommit={(v) => onChange("calories", v)}
            allowCustom
            placeholder="Type or search…"
          />

          <SearchSelect
            label="Protein (g)"
            options={OPTIONS.grams}
            value={structured.proteinGrams}
            onChange={(v) => onChange("proteinGrams", v)}
            onCommit={(v) => onChange("proteinGrams", v)}
            allowCustom
            placeholder="Type or search…"
          />

          <SearchSelect
            label="Carbs (g)"
            options={OPTIONS.grams}
            value={structured.carbsGrams}
            onChange={(v) => onChange("carbsGrams", v)}
            onCommit={(v) => onChange("carbsGrams", v)}
            allowCustom
            placeholder="Type or search…"
          />

          <SearchSelect
            label="Fat (g)"
            options={OPTIONS.grams}
            value={structured.fatsGrams}
            onChange={(v) => onChange("fatsGrams", v)}
            onCommit={(v) => onChange("fatsGrams", v)}
            allowCustom
            placeholder="Type or search…"
          />

          <SearchSelect
            label="Hydration (oz)"
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
        </div>
      </div>

      {/* Supplements */}
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-4">
        <div>
          <h4 className="font-semibold">Supplements</h4>
          <p className="text-xs text-gray-500 mt-1">
            (Next) we’ll attach SmartStack “safe picks” directly into PlanJson per meal block.
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
      <div>
        <p className="text-xs text-gray-500 mb-2">Coach Notes (optional)</p>
        <textarea
          className="w-full min-h-[140px] px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30"
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
          Tip: use <span className="font-semibold">Shift+Enter</span> for new lines.
        </p>
      </div>

      {/* Actions */}
      <div className="grid sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={onReset}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
        >
          Reset
        </button>

        <button
          type="button"
          onClick={(e) => onSave(e)}
          disabled={createLoading || !selectedAthleteEmail}
          className={`w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50 ${
            createLoading || !selectedAthleteEmail ? "opacity-70 cursor-not-allowed" : ""
          }`}
        >
          {createLoading ? "Saving…" : "Save"}
        </button>

        <button
          type="button"
          onClick={(e) => onSaveNext(e)}
          disabled={createLoading || !selectedAthleteEmail}
          className={`w-full px-4 py-3 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:brightness-110 transition ${
            createLoading || !selectedAthleteEmail ? "opacity-70 cursor-not-allowed" : ""
          }`}
        >
          {createLoading ? "Saving…" : "Save & Next"}
        </button>
      </div>

      <div className={subtleHint}>
        Built for speed: apply a template once, then Save & Next through the roster. Now also writes PlanJson into
        NutritionPlans for the athlete profile dashboard.
      </div>
    </form>
  );
}
