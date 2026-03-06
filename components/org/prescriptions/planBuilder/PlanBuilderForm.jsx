// components/org/prescriptions/planBuilder/PlanBuilderForm.jsx
"use client";

import { useMemo, useState } from "react";
import SearchSelect from "@/components/SearchSelect";
import MealBlockEditor from "./mealBlocks/MealBlockEditor";
import {
  ChevronDown, ChevronUp, Zap, Save, ArrowRight, RotateCcw,
} from "lucide-react";

const DS = {
  brand:         "#1E3A5F",
  brandLight:    "#2A4F7C",
  brandBg:       "#EEF3F9",
  brandBorder:   "#C0D0E0",
  safe:          "#00873E",
  safeBg:        "#F0FBF4",
  safeBorder:    "#A8DFB8",
  caution:       "#B86000",
  cautionBg:     "#FFFBF0",
  cautionBorder: "#FFD580",
  banned:        "#C8102E",
  bannedBg:      "#FFF0F0",
  bannedBorder:  "#FFC8C8",
  border:        "#E8ECF0",
  pageBg:        "#F4F7FB",
  cardBg:        "#FFFFFF",
  bodyText:      "#1A2535",
  labelText:     "#5A6A7D",
  dimText:       "#9BA8B4",
};

// ─── D2 football presets ──────────────────────────────────────────────────────
const PRESETS = [
  { label: "Bulk",     cal: 4200, pro: 225, carbs: 480, fat: 110, phase: "Surplus",  desc: "Linemen / heavy skill" },
  { label: "Maintain", cal: 3200, pro: 185, carbs: 360, fat: 95,  phase: "Maintain", desc: "Standard in-season"    },
  { label: "Cut",      cal: 2700, pro: 210, carbs: 270, fat: 75,  phase: "Cut",      desc: "Weight management"     },
  { label: "Skill",    cal: 3600, pro: 195, carbs: 420, fat: 90,  phase: "Maintain", desc: "Speed / skill spots"   },
];

// ─── Tiny primitives ──────────────────────────────────────────────────────────

function Label({ children }) {
  return (
    <p className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: DS.dimText }}>
      {children}
    </p>
  );
}

function DSInput({ value, onChange, placeholder, type = "text" }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full text-sm px-3 py-2 outline-none rounded-sm"
      style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: DS.cardBg, color: DS.bodyText }}
      onFocus={(e) => { e.currentTarget.style.borderColor = DS.brand; e.currentTarget.style.boxShadow = `0 0 0 2px ${DS.brand}18`; }}
      onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.boxShadow = "none"; }}
    />
  );
}

function DSSelect({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="w-full text-sm px-3 py-2 outline-none rounded-sm"
      style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: DS.brandBg, color: DS.bodyText }}
      onFocus={(e) => { e.currentTarget.style.borderColor = DS.brand; }}
      onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; }}
    >
      {children}
    </select>
  );
}

function SectionToggle({ label, sub, open, onToggle, badge }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 transition-colors text-left"
      style={{ backgroundColor: open ? DS.brandBg : DS.cardBg, borderBottom: `1px solid ${DS.border}` }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DS.brandBg; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = open ? DS.brandBg : DS.cardBg; }}
    >
      <div className="flex items-center gap-3">
        <span className="text-sm font-black uppercase tracking-wide" style={{ color: DS.bodyText }}>
          {label}
        </span>
        {badge && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-sm"
            style={{ backgroundColor: DS.safeBg, color: DS.safe, border: `1px solid ${DS.safeBorder}` }}
          >
            {badge}
          </span>
        )}
        {sub && <span className="text-xs hidden sm:inline" style={{ color: DS.dimText }}>{sub}</span>}
      </div>
      {open
        ? <ChevronUp   className="h-4 w-4 shrink-0" style={{ color: DS.dimText }} />
        : <ChevronDown className="h-4 w-4 shrink-0" style={{ color: DS.dimText }} />
      }
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

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
  const [activePreset,    setActivePreset]    = useState(null);
  const [showMeals,       setShowMeals]       = useState(false);
  const [showSupplements, setShowSupplements] = useState(false);
  const [showNotes,       setShowNotes]       = useState(false);
  const [showMeta,        setShowMeta]        = useState(false);

  const canSave = Boolean(selectedAthleteEmail) && !createLoading;

  const hasTargets = useMemo(() => Boolean(
    String(structured?.calories  || "").trim() ||
    String(structured?.proteinGrams || "").trim() ||
    String(structured?.carbsGrams   || "").trim() ||
    String(structured?.fatsGrams    || "").trim()
  ), [structured]);

  const hasMealBlocks = useMemo(() => {
    const mb = structured?.mealBlocks;
    if (!mb || typeof mb !== "object") return false;
    return ["breakfast", "lunch", "afternoon", "dinner"].some((k) => {
      const t = mb[k]?.targets || {};
      return String(t.calories || "").trim() || String(t.protein || "").trim();
    });
  }, [structured]);

  function applyPreset(p) {
    setActivePreset(p.label);
    onChange("calories",     String(p.cal));
    onChange("proteinGrams", String(p.pro));
    onChange("carbsGrams",   String(p.carbs));
    onChange("fatsGrams",    String(p.fat));
    onChange("phase",        p.phase);
  }

  function handleReset() {
    setActivePreset(null);
    onReset?.();
  }

  return (
    <div style={{ border: `1px solid ${DS.border}`, borderTop: `3px solid ${DS.brand}`, backgroundColor: DS.cardBg }}>

      {/* ── Presets ── */}
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: `1px solid ${DS.border}` }}>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-3.5 w-3.5" style={{ color: DS.brand }} />
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: DS.brand }}>
            Quick Presets
          </p>
          <span className="text-xs" style={{ color: DS.dimText }}>
            — click to fill targets instantly
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PRESETS.map((p) => {
            const active = activePreset === p.label;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p)}
                className="text-left p-3 rounded-sm transition-all"
                style={{
                  border:           `1px solid ${active ? DS.brand : DS.brandBorder}`,
                  backgroundColor:  active ? DS.brand    : DS.brandBg,
                  color:            active ? "#fff"      : DS.bodyText,
                }}
                onMouseEnter={(e) => { if (!active) { e.currentTarget.style.borderColor = DS.brand; e.currentTarget.style.backgroundColor = DS.brandBg; } }}
                onMouseLeave={(e) => { if (!active) { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.backgroundColor = DS.brandBg; } }}
              >
                <p
                  className="font-black text-sm"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  {p.label}
                </p>
                <p
                  className="font-black tabular-nums"
                  style={{ fontSize: "1.1rem", color: active ? "rgba(255,255,255,0.85)" : DS.brand, fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  {p.cal.toLocaleString()} cal
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: active ? "rgba(255,255,255,0.55)" : DS.dimText }}
                >
                  {p.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Daily Targets ── always visible ── */}
      <div className="px-4 py-4" style={{ borderBottom: `1px solid ${DS.border}` }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: DS.bodyText }}>
            Daily Targets
          </p>
          {hasTargets && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-sm"
              style={{ backgroundColor: DS.safeBg, color: DS.safe, border: `1px solid ${DS.safeBorder}` }}
            >
              ✓ Set
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {/* Phase */}
          <div className="sm:col-span-1">
            <Label>Phase</Label>
            <DSSelect value={structured.phase || ""} onChange={(e) => onChange("phase", e.target.value)}>
              <option value="">Phase…</option>
              <option value="Surplus">Surplus</option>
              <option value="Maintain">Maintain</option>
              <option value="Cut">Cut</option>
              <option value="Game Week">Game Week</option>
              <option value="Bye Week">Bye Week</option>
            </DSSelect>
          </div>

          {[
            { label: "Calories",   key: "calories",     placeholder: "e.g. 3200" },
            { label: "Protein g",  key: "proteinGrams", placeholder: "e.g. 185"  },
            { label: "Carbs g",    key: "carbsGrams",   placeholder: "e.g. 360"  },
            { label: "Fat g",      key: "fatsGrams",    placeholder: "e.g. 95"   },
            { label: "Water oz",   key: "hydrationOz",  placeholder: "e.g. 96"   },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <Label>{label}</Label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={structured[key] ?? ""}
                onChange={(e) => { onChange(key, e.target.value); setActivePreset(null); }}
                placeholder={placeholder}
                className="w-full text-sm px-3 py-2 outline-none rounded-sm tabular-nums"
                style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: DS.cardBg, color: DS.bodyText }}
                onFocus={(e) => { e.currentTarget.style.borderColor = DS.brand; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; }}
              />
            </div>
          ))}
        </div>

        {/* Macro notes — inline, compact */}
        {structured.notesMacros != null && (
          <div className="mt-2">
            <Label>Macro Notes</Label>
            <DSInput
              value={structured.notesMacros ?? ""}
              onChange={(e) => onChange("notesMacros", e.target.value)}
              placeholder="e.g. increase carbs on practice days"
            />
          </div>
        )}
      </div>

      {/* ── Meal Plan (collapsible) ── */}
      <div style={{ borderBottom: `1px solid ${DS.border}` }}>
        <SectionToggle
          label="Meal Plan"
          sub="Auto-split fills meals from daily targets"
          open={showMeals}
          onToggle={() => setShowMeals((v) => !v)}
          badge={hasMealBlocks ? "Configured" : null}
        />
        {showMeals && (
          <div className="px-4 py-4">
            <MealBlockEditor
              subtleHint={subtleHint}
              structured={structured}
              onChange={onChange}
              ui="guided"
            />
          </div>
        )}
      </div>

      {/* ── Supplements (collapsible) ── */}
      <div style={{ borderBottom: `1px solid ${DS.border}` }}>
        <SectionToggle
          label="Supplements"
          sub="Optional"
          open={showSupplements}
          onToggle={() => setShowSupplements((v) => !v)}
        />
        {showSupplements && (
          <div className="px-4 py-4 grid sm:grid-cols-2 gap-3">
            {[
              { label: "Protein",      key: "proteinRecommendation",      opts: OPTIONS.proteinRecommendation      },
              { label: "Creatine",     key: "creatineRecommendation",     opts: OPTIONS.creatineRecommendation     },
              { label: "BCAA / EAA",   key: "bcaaRecommendation",         opts: OPTIONS.bcaaRecommendation         },
              { label: "Electrolytes", key: "electrolytesRecommendation", opts: OPTIONS.electrolytesRecommendation },
            ].map(({ label, key, opts }) => (
              <SearchSelect
                key={key}
                label={label}
                options={opts}
                value={structured[key]}
                onChange={(v) => onChange(key, v)}
                onCommit={(v) => onChange(key, v)}
                allowCustom
                placeholder={`Search ${label.toLowerCase()}…`}
              />
            ))}
            <div className="sm:col-span-2">
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
        )}
      </div>

      {/* ── Coach Notes (collapsible) ── */}
      <div style={{ borderBottom: `1px solid ${DS.border}` }}>
        <SectionToggle
          label="Coach Notes"
          sub="Optional"
          open={showNotes}
          onToggle={() => setShowNotes((v) => !v)}
        />
        {showNotes && (
          <div className="px-4 py-4">
            <textarea
              className="w-full min-h-[100px] resize-y text-sm px-3 py-2 outline-none rounded-sm"
              style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: DS.cardBg, color: DS.bodyText }}
              value={structured.freeformNotes ?? ""}
              onChange={(e) => onChange("freeformNotes", e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onSave(e); return; }
                if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); onSaveNext(e); }
              }}
              placeholder="e.g. lactose sensitive, increase carbs on heavy practice days… (Enter = Save & Next)"
              onFocus={(e) => { e.currentTarget.style.borderColor = DS.brand; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; }}
            />
            <p className="text-xs mt-1" style={{ color: DS.dimText }}>
              Shift+Enter for new lines · Enter = Save & Next · Ctrl/Cmd+Enter = Save
            </p>
          </div>
        )}
      </div>

      {/* ── Plan meta (collapsible, rarely needed) ── */}
      <div style={{ borderBottom: `1px solid ${DS.border}` }}>
        <SectionToggle
          label="Plan Meta"
          sub="Title, status, effective date"
          open={showMeta}
          onToggle={() => setShowMeta((v) => !v)}
        />
        {showMeta && (
          <div className="px-4 py-4 grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Label>Plan Title</Label>
              <DSInput
                value={title ?? ""}
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
            <div>
              <Label>Effective Date</Label>
              <input
                type="date"
                value={structured.metaEffectiveDate ?? ""}
                onChange={(e) => onChange("metaEffectiveDate", e.target.value)}
                className="w-full text-sm px-3 py-2 outline-none rounded-sm"
                style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: DS.cardBg, color: DS.bodyText }}
                onFocus={(e) => { e.currentTarget.style.borderColor = DS.brand; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; }}
              />
              <p className="text-xs mt-1" style={{ color: DS.dimText }}>Blank defaults to now.</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Action bar ── sticky at bottom of form ── */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3"
        style={{ backgroundColor: DS.pageBg, borderTop: `1px solid ${DS.border}` }}
      >
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-sm transition-all"
          style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg, color: DS.labelText }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.color = DS.brand; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.color = DS.labelText; }}
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>

        {!selectedAthleteEmail && (
          <p className="text-xs flex-1 text-center" style={{ color: DS.caution }}>
            ← Select an athlete to save
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => onSave(e)}
            disabled={!canSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wide rounded-sm transition-all"
            style={{
              border: `1px solid ${canSave ? DS.border : DS.border}`,
              backgroundColor: canSave ? DS.cardBg : DS.pageBg,
              color: canSave ? DS.bodyText : DS.dimText,
              cursor: canSave ? "pointer" : "not-allowed",
            }}
            onMouseEnter={(e) => { if (canSave) { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.backgroundColor = DS.brandBg; } }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.backgroundColor = canSave ? DS.cardBg : DS.pageBg; }}
          >
            <Save className="h-3.5 w-3.5" />
            {createLoading ? "Saving…" : "Save"}
          </button>

          <button
            type="button"
            onClick={(e) => onSaveNext(e)}
            disabled={!canSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wide rounded-sm transition-all"
            style={{
              backgroundColor: canSave ? DS.brand : DS.pageBg,
              color: canSave ? "#fff" : DS.dimText,
              cursor: canSave ? "pointer" : "not-allowed",
            }}
            onMouseEnter={(e) => { if (canSave) e.currentTarget.style.backgroundColor = DS.brandLight; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = canSave ? DS.brand : DS.pageBg; }}
          >
            <ArrowRight className="h-3.5 w-3.5" />
            {createLoading ? "Saving…" : "Save & Next"}
          </button>
        </div>
      </div>
    </div>
  );
}