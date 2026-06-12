// components/org/prescriptions/planBuilder/PlanBuilderForm.jsx
"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import MealBlockEditor from "./mealBlocks/MealBlockEditor";
import PlanHistory from "../PlanHistory";
import {
  Zap, Save, ArrowRight, RotateCcw, User, ChevronDown,
  Trash2, RefreshCw, BookOpen, Clock,
} from "lucide-react";
import { getAthleteToken, DEFAULT_STRUCTURED } from "@/lib/org/prescriptions/prescriptions-utils";
import SupplementPicker, { SUPP_CATEGORIES } from "../SupplementPicker";

/* ── DS tokens ────────────────────────────────────────────────────────────────── */
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

/* ── Presets ──────────────────────────────────────────────────────────────────── */
const PRESETS = [
  { label: "Bulk",     cal: 4200, pro: 225, carbs: 480, fat: 110, phase: "Surplus",  desc: "Linemen / heavy skill" },
  { label: "Maintain", cal: 3200, pro: 185, carbs: 360, fat:  95, phase: "Maintain", desc: "Standard in-season"    },
  { label: "Cut",      cal: 2700, pro: 210, carbs: 270, fat:  75, phase: "Cut",      desc: "Weight management"     },
  { label: "Skill",    cal: 3600, pro: 195, carbs: 420, fat:  90, phase: "Maintain", desc: "Speed / skill spots"   },
];

/* SUPP_CATEGORIES imported from SupplementPicker */

/* ── Summary helpers ─────────────────────────────────────────────────────────── */

function dailySummary(s) {
  const cal   = s?.calories     || "";
  const pro   = s?.proteinGrams || "";
  const carbs = s?.carbsGrams   || "";
  const fat   = s?.fatsGrams    || "";
  if (!cal && !pro) return "Not set";
  const parts = [];
  if (cal)   parts.push(`${Number(cal).toLocaleString()} cal`);
  if (pro)   parts.push(`P ${pro}g`);
  if (carbs) parts.push(`C ${carbs}g`);
  if (fat)   parts.push(`F ${fat}g`);
  return parts.join(" · ");
}

function mealsSummary(s) {
  const keys = ["breakfast", "lunch", "afternoon", "dinner"];
  const cals = keys.map(k => s?.mealBlocks?.[k]?.targets?.calories).filter(Boolean);
  if (cals.length === 0) return "Not distributed yet";
  return cals.join(" / ") + " cal";
}

function suppSummary(s) {
  const picks = [];
  for (const c of SUPP_CATEGORIES) {
    const name = s?.[c.productKey]?.name || s?.[c.strKey] || "";
    if (name) picks.push(name);
  }
  if (picks.length === 0) return "None added";
  const shown = picks.slice(0, 2).join(", ");
  return picks.length > 2 ? `${shown} +${picks.length - 2} more` : shown;
}

function hasDailyData(s) {
  return Boolean(s?.calories || s?.proteinGrams);
}

function hasMealData(s) {
  return ["breakfast", "lunch", "afternoon", "dinner"].some(k => s?.mealBlocks?.[k]?.targets?.calories);
}

function hasSuppData(s) {
  return SUPP_CATEGORIES.some(c => s?.[c.productKey] || s?.[c.strKey]) || Boolean(s?.notesSupplements);
}

function relativeDate(iso) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const d  = Math.floor(ms / 86400000);
  if (d === 0)  return "today";
  if (d === 1)  return "yesterday";
  if (d < 7)   return `${d}d ago`;
  if (d < 30)  return `${Math.floor(d / 7)}w ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

/* ── Shared primitives ───────────────────────────────────────────────────────── */

function Label({ children }) {
  return (
    <p className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: DS.dimText }}>
      {children}
    </p>
  );
}

function NumField({ label, value, onChange, placeholder, step = 1 }) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type="number"
        inputMode="numeric"
        min="0"
        step={step}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm px-3 py-2 outline-none rounded-sm tabular-nums"
        style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: DS.cardBg, color: DS.bodyText }}
        onFocus={(e) => { e.currentTarget.style.borderColor = DS.brand; e.currentTarget.style.boxShadow = `0 0 0 2px ${DS.brand}18`; }}
        onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.boxShadow = "none"; }}
      />
    </div>
  );
}

/* ── Section header ──────────────────────────────────────────────────────────── */

function SectionHeader({ label, open, onToggle, summary, badge, accent, pill }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between gap-4 px-5 py-3 text-left"
      style={{
        backgroundColor:  open ? DS.brandBg : "transparent",
        borderBottom:     `1px solid ${DS.border}`,
        transition:       "background-color 0.12s",
      }}
      onMouseEnter={(e) => { if (!open) e.currentTarget.style.backgroundColor = DS.pageBg; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = open ? DS.brandBg : "transparent"; }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="shrink-0 h-2 w-2 rounded-full"
          style={{ backgroundColor: badge ? DS.safe : DS.dimText }}
        />
        <span
          className="text-xs font-black uppercase tracking-wider shrink-0"
          style={{ color: open ? DS.brand : DS.bodyText }}
        >
          {label}
        </span>
        {!open && summary && (
          <span className="text-xs truncate" style={{ color: DS.dimText }}>{summary}</span>
        )}
        {pill && (
          <span
            className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-sm"
            style={{ backgroundColor: DS.brandBg, color: DS.brand, border: `1px solid ${DS.brandBorder}` }}
          >
            {pill}
          </span>
        )}
      </div>
      <ChevronDown
        className="h-3.5 w-3.5 shrink-0"
        style={{ color: DS.dimText, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
      />
    </button>
  );
}

/* ── Templates strip ─────────────────────────────────────────────────────────── */

function TemplateStrip({ tpl }) {
  if (!tpl) return null;
  const {
    templateId, setTemplateId,
    templateName, setTemplateName,
    activeTemplates = [],
    templatesLoading = false,
    templatesError,
    onRefreshTemplates,
    applyTemplateToBuilder,
    openDeleteTemplateConfirm,
    saveAsTemplate,
  } = tpl;

  const hasName = Boolean(String(templateName || "").trim());

  return (
    <div
      className="px-5 py-3 space-y-2"
      style={{ backgroundColor: DS.pageBg, borderBottom: `1px solid ${DS.border}` }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <BookOpen className="h-3 w-3" style={{ color: DS.dimText }} />
        <span className="text-xs font-black uppercase tracking-wider" style={{ color: DS.dimText }}>Templates</span>
        {activeTemplates.length > 0 && (
          <span className="text-xs" style={{ color: DS.dimText }}>({activeTemplates.length})</span>
        )}
      </div>

      {templatesError && (
        <p className="text-xs px-2 py-1" style={{ backgroundColor: DS.bannedBg, color: DS.banned, border: `1px solid ${DS.bannedBorder}` }}>
          {templatesError}
        </p>
      )}

      {/* Apply row */}
      <div className="flex gap-2 items-center">
        <select
          className="flex-1 text-sm px-3 py-1.5 outline-none rounded-sm min-w-0"
          style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: DS.cardBg, color: DS.bodyText }}
          value={templateId || ""}
          onChange={(e) => setTemplateId(e.target.value)}
          onFocus={(e) => { e.currentTarget.style.borderColor = DS.brand; }}
          onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; }}
        >
          <option value="">Apply a saved template…</option>
          {activeTemplates.map((t) => (
            <option key={t.id} value={t.id}>{t.name || "Template"}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => applyTemplateToBuilder?.(templateId)}
          disabled={!templateId}
          className="shrink-0 px-3 py-1.5 text-xs font-black uppercase tracking-wide rounded-sm transition-all"
          style={{
            backgroundColor: templateId ? DS.brand : DS.border,
            color:           templateId ? "#fff"   : DS.dimText,
            cursor:          templateId ? "pointer" : "not-allowed",
          }}
          onMouseEnter={(e) => { if (templateId) e.currentTarget.style.backgroundColor = DS.brandLight; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = templateId ? DS.brand : DS.border; }}
        >
          Apply
        </button>

        <button
          type="button"
          onClick={() => openDeleteTemplateConfirm?.()}
          disabled={!templateId}
          title="Delete selected template"
          className="shrink-0 inline-flex items-center px-2 py-1.5 rounded-sm transition-all"
          style={{
            border: `1px solid ${templateId ? DS.bannedBorder : DS.border}`,
            backgroundColor: DS.cardBg,
            color: templateId ? DS.banned : DS.dimText,
            cursor: templateId ? "pointer" : "not-allowed",
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onRefreshTemplates?.()}
          disabled={templatesLoading}
          title="Refresh templates"
          className="shrink-0 p-1.5 rounded-sm transition-colors"
          style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg, color: DS.dimText }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.color = DS.brand; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.color = DS.dimText; }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${templatesLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Save-as row */}
      <div className="flex gap-2 items-center">
        <input
          className="flex-1 text-sm px-3 py-1.5 outline-none rounded-sm min-w-0"
          style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: DS.cardBg, color: DS.bodyText }}
          placeholder="Name this plan to save as template…"
          value={templateName || ""}
          onChange={(e) => setTemplateName(e.target.value)}
          onFocus={(e) => { e.currentTarget.style.borderColor = DS.brand; }}
          onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; }}
        />
        <button
          type="button"
          onClick={() => saveAsTemplate?.()}
          disabled={templatesLoading || !hasName}
          className="shrink-0 px-3 py-1.5 text-xs font-black uppercase tracking-wide rounded-sm whitespace-nowrap transition-all"
          style={{
            backgroundColor: hasName ? DS.brand : DS.border,
            color:           hasName ? "#fff"   : DS.dimText,
            cursor:          hasName ? "pointer" : "not-allowed",
          }}
          onMouseEnter={(e) => { if (hasName) e.currentTarget.style.backgroundColor = DS.brandLight; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = hasName ? DS.brand : DS.border; }}
        >
          {templatesLoading ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

/* ── Athlete header ──────────────────────────────────────────────────────────── */

function AthleteHeader({ selectedAthlete, selectedAthleteEmail, hist, tpl }) {
  const name    = String(selectedAthlete?.name  || "").trim();
  const email   = String(selectedAthleteEmail || selectedAthlete?.email || "").trim();
  const token   = String(selectedAthlete?.AthleteToken || selectedAthlete?.athleteToken || "").trim();
  const sport   = String(selectedAthlete?.sport || "").trim();
  const present = Boolean(name || email);

  const lastPlan = hist?.historyItems?.[0];
  const lastRaw  = lastPlan?._raw;

  // Build an inline macro snapshot from the most recent plan
  const lastMacros = lastRaw && (lastRaw.dailyCalories || lastRaw.dailyProtein)
    ? [
        lastRaw.dailyCalories ? `${Number(lastRaw.dailyCalories).toLocaleString()} cal` : null,
        lastRaw.dailyProtein  ? `P ${lastRaw.dailyProtein}g`  : null,
        lastRaw.dailyCarbs    ? `C ${lastRaw.dailyCarbs}g`    : null,
        lastRaw.dailyFat      ? `F ${lastRaw.dailyFat}g`      : null,
      ].filter(Boolean).join(" · ")
    : null;

  const lastPlanAge = lastPlan?.createdAt ? relativeDate(lastPlan.createdAt) : null;

  const histLabel = hist?.historyLoading
    ? "Loading…"
    : hist?.historyRequested && !lastPlan
      ? "No plans on record"
      : null;

  return (
    <div style={{ backgroundColor: DS.pageBg, borderBottom: `1px solid ${DS.border}` }}>
      {/* Identity row */}
      <div className="flex items-center gap-3 px-5 py-4">
        <span
          className="h-10 w-10 rounded-sm flex items-center justify-center shrink-0"
          style={{
            backgroundColor: present ? DS.brandBg : DS.pageBg,
            border: `1px solid ${present ? DS.brandBorder : DS.border}`,
          }}
        >
          <User className="h-4 w-4" style={{ color: present ? DS.brand : DS.dimText }} />
        </span>

        {present ? (
          <div className="min-w-0 flex-1">
            {/* Name + badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-base font-black" style={{ color: DS.bodyText }}>{name || email}</p>
              {sport && (
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-sm shrink-0"
                  style={{ backgroundColor: DS.brandBg, color: DS.brand, border: `1px solid ${DS.brandBorder}` }}
                >
                  {sport}
                </span>
              )}
              <span
                className="text-xs font-bold px-1.5 py-0.5 rounded-sm"
                style={token
                  ? { backgroundColor: DS.safeBg, color: DS.safe, border: `1px solid ${DS.safeBorder}` }
                  : { backgroundColor: DS.cautionBg, color: DS.caution, border: `1px solid ${DS.cautionBorder}` }
                }
              >
                {token ? "Token ✓" : "No token"}
              </span>
            </div>

            {name && email && (
              <p className="text-xs mt-0.5 truncate" style={{ color: DS.dimText }}>{email}</p>
            )}

            {/* Last plan inline macro snapshot */}
            {lastMacros ? (
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <Clock className="h-3 w-3 shrink-0" style={{ color: DS.dimText }} />
                <span className="text-xs font-bold" style={{ color: DS.labelText }}>{lastMacros}</span>
                {lastPlanAge && (
                  <span className="text-xs" style={{ color: DS.dimText }}>· {lastPlanAge}</span>
                )}
              </div>
            ) : histLabel ? (
              <div className="flex items-center gap-1.5 mt-1">
                <Clock className="h-3 w-3 shrink-0" style={{ color: DS.dimText }} />
                <p className="text-xs" style={{ color: DS.dimText }}>{histLabel}</p>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm" style={{ color: DS.dimText }}>
            ← Select an athlete from the roster to begin
          </p>
        )}
      </div>

      {/* Templates strip — always visible when athlete is selected */}
      {present && <TemplateStrip tpl={tpl} />}
    </div>
  );
}

/* CategoryPicker → replaced by imported SupplementPicker */

/* ── Macro math bar ──────────────────────────────────────────────────────────── */

function MacroMathBar({ structured }) {
  const pro    = Number(structured?.proteinGrams || 0);
  const carbs  = Number(structured?.carbsGrams   || 0);
  const fat    = Number(structured?.fatsGrams    || 0);
  const stated = Number(structured?.calories     || 0);

  const calcCal = Math.round(pro * 4 + carbs * 4 + fat * 9);
  if (!calcCal) return null;

  const total   = pro * 4 + carbs * 4 + fat * 9;
  const pctPro  = total ? Math.round((pro   * 4 / total) * 100) : 0;
  const pctCarb = total ? Math.round((carbs * 4 / total) * 100) : 0;
  const pctFat  = total ? Math.round((fat   * 9 / total) * 100) : 0;

  const diff       = stated ? calcCal - stated : null;
  const absDiff    = diff !== null ? Math.abs(diff) : null;
  const matchState = diff === null ? "info" : absDiff <= 50 ? "good" : absDiff <= 150 ? "warn" : "bad";

  const stateColors = {
    info: { text: DS.brand,   bg: DS.brandBg,   border: DS.brandBorder   },
    good: { text: DS.safe,    bg: DS.safeBg,     border: DS.safeBorder    },
    warn: { text: DS.caution, bg: DS.cautionBg,  border: DS.cautionBorder },
    bad:  { text: "#C8102E",  bg: "#FFF0F0",     border: "#FFC8C8"        },
  };
  const c = stateColors[matchState];

  return (
    <div
      className="px-3 py-2 rounded-sm"
      style={{ backgroundColor: c.bg, border: `1px solid ${c.border}` }}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-bold shrink-0" style={{ color: c.text }}>
          {calcCal.toLocaleString()} kcal from macros
        </span>
        <span className="text-xs" style={{ color: DS.dimText }}>
          P {pctPro}% · C {pctCarb}% · F {pctFat}%
        </span>
        {diff !== null && (
          <span className="text-xs font-bold ml-auto shrink-0" style={{ color: c.text }}>
            {matchState === "good"
              ? "✓ Matches calorie target"
              : `${diff > 0 ? "+" : ""}${diff} kcal vs ${stated.toLocaleString()} target`}
          </span>
        )}
      </div>
      <p className="text-xs mt-1" style={{ color: DS.dimText }}>
        1g protein = 4 kcal · 1g carbs = 4 kcal · 1g fat = 9 kcal
      </p>
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────────────────────────── */

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
      <div
        className="h-14 w-14 rounded-sm flex items-center justify-center mb-4"
        style={{ backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}` }}
      >
        <User className="h-6 w-6" style={{ color: DS.brand }} />
      </div>
      <p className="text-sm font-black uppercase tracking-wide mb-1" style={{ color: DS.bodyText }}>
        No Athlete Selected
      </p>
      <p className="text-xs max-w-xs leading-relaxed" style={{ color: DS.dimText }}>
        Select an athlete from the roster on the left to start building their nutrition plan.
      </p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   Main component
══════════════════════════════════════════════════════════════════════════════ */

export default function PlanBuilderForm({
  title,
  setTitle,
  structured,
  onChange,
  setStructured,
  OPTIONS,
  createLoading,
  selectedAthleteEmail,
  onReset,
  onSave,
  onSaveNext,
  selectedAthlete,
  tpl,
  hist,
  products = [],
  onOpenGroupBlast,
  planSavedAt,
}) {
  const [activePreset,  setActivePreset]  = useState(null);
  const [confirmReset,  setConfirmReset]  = useState(false);
  const [flashSaved,    setFlashSaved]    = useState(false);

  /* ── Save flash ── */
  useEffect(() => {
    if (!planSavedAt) return;
    setFlashSaved(true);
    const t = setTimeout(() => setFlashSaved(false), 2500);
    return () => clearTimeout(t);
  }, [planSavedAt]);

  /* ── Reset confirmation auto-cancel ── */
  useEffect(() => {
    if (!confirmReset) return;
    const t = setTimeout(() => setConfirmReset(false), 3000);
    return () => clearTimeout(t);
  }, [confirmReset]);

  /* ── Section open/close state ── */
  const [open, setOpen] = useState({
    meals:       true,
    supplements: false,
    notes:       true,
    history:     false,
  });

  function toggle(key) {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
    if (key === "history" && !open.history && hist && !hist.historyRequested) {
      hist.searchHistory?.({ reset: true });
    }
  }

  /* ── Auto-load history when athlete changes ── */
  const prevTokenRef = useRef("");
  const selectedAthleteToken = getAthleteToken(selectedAthlete);

  useEffect(() => {
    if (!selectedAthleteToken) return;
    if (selectedAthleteToken === prevTokenRef.current) return;
    prevTokenRef.current = selectedAthleteToken;
    hist?.searchHistory?.({ reset: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAthleteToken]);

  /* ── Global keyboard shortcuts ── */
  useEffect(() => {
    function onKeyDown(e) {
      const ready = Boolean(selectedAthleteEmail) && !createLoading;
      // Ctrl/Cmd+S → Save
      if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (ready) onSave?.(e);
        return;
      }
      // Ctrl/Cmd+Enter → Save & Next (skip textareas — they handle it themselves)
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        if ((e.target?.tagName || "").toLowerCase() === "textarea") return;
        e.preventDefault();
        if (ready) onSaveNext?.(e);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAthleteEmail, createLoading, onSave, onSaveNext]);

  /* ── Section badges ── */
  const mealBadge = hasMealData(structured);
  const suppBadge = hasSuppData(structured);
  const notesBadge = Boolean(String(structured?.freeformNotes || "").trim());

  /* ── Preset apply ── */
  function applyPreset(p) {
    setActivePreset(p.label);
    onChange("calories",     String(p.cal));
    onChange("proteinGrams", String(p.pro));
    onChange("carbsGrams",   String(p.carbs));
    onChange("fatsGrams",    String(p.fat));
    onChange("phase",        p.phase);
  }

  /* ── Load a full history plan into the builder ── */
  function handleCopyFromHistory(p) {
    const raw  = p?._raw || {};
    const pj   = raw?.planJson && typeof raw.planJson === "object" ? raw.planJson : null;
    const supp = pj?.supplements || {};

    if (typeof setStructured === "function") {
      setStructured({
        ...DEFAULT_STRUCTURED,
        phase:        String(raw.phase || pj?.phase || DEFAULT_STRUCTURED.phase),
        calories:     String(raw.dailyCalories  ?? pj?.daily?.calories  ?? ""),
        proteinGrams: String(raw.dailyProtein   ?? pj?.daily?.protein   ?? ""),
        carbsGrams:   String(raw.dailyCarbs     ?? pj?.daily?.carbs     ?? ""),
        fatsGrams:    String(raw.dailyFat       ?? pj?.daily?.fat       ?? ""),
        hydrationOz:  String(raw.dailyHydration ?? pj?.hydrationOz ?? pj?.daily?.hydrationOz ?? ""),
        notesMacros:  String(pj?.notesMacros || pj?.notes?.macros || ""),
        mealSplit:    pj?.mealSplit  && typeof pj.mealSplit  === "object" ? pj.mealSplit  : DEFAULT_STRUCTURED.mealSplit,
        mealBlocks:   pj?.mealBlocks && typeof pj.mealBlocks === "object" ? pj.mealBlocks : DEFAULT_STRUCTURED.mealBlocks,
        proteinRecommendation:      String(supp.proteinRecommendation      || supp.protein      || ""),
        creatineRecommendation:     String(supp.creatineRecommendation     || supp.creatine     || ""),
        bcaaRecommendation:         String(supp.bcaaRecommendation         || supp.bcaaEaa      || ""),
        electrolytesRecommendation: String(supp.electrolytesRecommendation || supp.electrolytes || ""),
        preWorkoutRecommendation:   String(supp.preWorkoutRecommendation   || ""),
        proteinBarRecommendation:   String(supp.proteinBarRecommendation   || ""),
        notesSupplements:           String(supp.notes || pj?.notes?.supplements || ""),
        ...(supp.proteinProduct    ? { proteinProduct:    supp.proteinProduct    } : {}),
        ...(supp.creatineProduct   ? { creatineProduct:   supp.creatineProduct   } : {}),
        ...(supp.bcaaProduct       ? { bcaaProduct:       supp.bcaaProduct       } : {}),
        ...(supp.preWorkoutProduct ? { preWorkoutProduct: supp.preWorkoutProduct } : {}),
        ...(supp.proteinBarProduct ? { proteinBarProduct: supp.proteinBarProduct } : {}),
        metaStatus:        String(pj?.meta?.status        || DEFAULT_STRUCTURED.metaStatus),
        metaEffectiveDate: String(pj?.meta?.effectiveDate || ""),
        freeformNotes:     String(raw.prescription || pj?.freeformNotes || ""),
      });
    }

    setTitle(String(pj?.title || p?.title || "Nutrition + Supplements Plan"));
    setOpen((prev) => ({ ...prev, history: false, macros: true }));
  }

  /* ── Supplement grouped products ── */
  const suppGrouped = useMemo(() => {
    const out = {};
    for (const cat of SUPP_CATEGORIES) {
      out[cat.productKey] = (products ?? []).filter((p) => cat.match(p.category ?? ""));
    }
    return out;
  }, [products]);

  const anySuppSelected = SUPP_CATEGORIES.some((cat) => structured[cat.productKey] != null);

  const canSave = Boolean(selectedAthleteEmail) && !createLoading;
  const selectedAthleteName = String(selectedAthlete?.name || "").trim();

  /* ── Renders ── */

  if (!selectedAthleteEmail) {
    return (
      <div
        className="flex flex-col h-full"
        style={{ border: `1px solid ${DS.border}`, borderTop: `3px solid ${DS.brand}`, backgroundColor: DS.cardBg }}
      >
        <EmptyState />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col"
      style={{ border: `1px solid ${DS.border}`, borderTop: `3px solid ${DS.brand}`, backgroundColor: DS.cardBg }}
    >

      {/* ── Athlete header + templates ── */}
      <AthleteHeader
        selectedAthlete={selectedAthlete}
        selectedAthleteEmail={selectedAthleteEmail}
        hist={hist}
        tpl={tpl}
      />

      {/* ═══════════════════════════════════
          DAILY TARGETS — always visible
      ═══════════════════════════════════ */}
      <div style={{ borderBottom: `1px solid ${DS.border}` }}>

        {/* Section header (non-interactive label) */}
        <div
          className="flex items-center gap-3 px-5 py-3"
          style={{ backgroundColor: DS.cardBg, borderBottom: `1px solid ${DS.border}` }}
        >
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: hasDailyData(structured) ? DS.safe : DS.dimText }} />
          <span className="text-xs font-black uppercase tracking-wider" style={{ color: DS.bodyText }}>Daily Targets</span>
          {hasDailyData(structured) && (
            <span className="text-xs" style={{ color: DS.dimText }}>{dailySummary(structured)}</span>
          )}
        </div>

        <div className="px-5 pt-4 pb-5 space-y-5">

          {/* Quick presets */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <Zap className="h-3.5 w-3.5" style={{ color: DS.brand }} />
              <span className="text-xs font-black uppercase tracking-wider" style={{ color: DS.brand }}>Quick Presets</span>
              <span className="text-xs" style={{ color: DS.dimText }}>— fills all targets instantly</span>
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
                      border:          `1px solid ${active ? DS.brand : DS.brandBorder}`,
                      backgroundColor: active ? DS.brand : DS.brandBg,
                      color:           active ? "#fff"   : DS.bodyText,
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.borderColor = DS.brand; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = DS.brandBorder; }}
                  >
                    <p className="font-black text-sm">{p.label}</p>
                    <p className="font-black tabular-nums mt-0.5" style={{ fontSize: "1.05rem", color: active ? "rgba(255,255,255,0.9)" : DS.brand }}>
                      {p.cal.toLocaleString()} cal
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: active ? "rgba(255,255,255,0.55)" : DS.dimText }}>{p.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Macro inputs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <div>
              <Label>Phase</Label>
              <select
                value={structured.phase || ""}
                onChange={(e) => onChange("phase", e.target.value)}
                className="w-full text-sm px-3 py-2 outline-none rounded-sm"
                style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: DS.brandBg, color: DS.bodyText }}
                onFocus={(e) => { e.currentTarget.style.borderColor = DS.brand; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; }}
              >
                <option value="">Phase…</option>
                {["Surplus","Maintain","Cut","Game Week","Bye Week"].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            {[
              { label: "Calories",  key: "calories",     ph: "e.g. 3200" },
              { label: "Protein g", key: "proteinGrams", ph: "e.g. 185"  },
              { label: "Carbs g",   key: "carbsGrams",   ph: "e.g. 360"  },
              { label: "Fat g",     key: "fatsGrams",    ph: "e.g. 95"   },
              { label: "Water oz",  key: "hydrationOz",  ph: "e.g. 96"   },
            ].map(({ label, key, ph }) => (
              <NumField
                key={key}
                label={label}
                value={structured[key] ?? ""}
                onChange={(v) => { onChange(key, v); setActivePreset(null); }}
                placeholder={ph}
                step={key === "calories" ? 50 : key === "hydrationOz" ? 1 : 5}
              />
            ))}
          </div>

          {/* Live macro math */}
          <MacroMathBar structured={structured} />

          {/* Macro notes */}
          <div>
            <Label>Macro Notes</Label>
            <input
              type="text"
              className="w-full text-sm px-3 py-2 outline-none rounded-sm"
              style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: DS.cardBg, color: DS.bodyText }}
              value={structured.notesMacros ?? ""}
              onChange={(e) => onChange("notesMacros", e.target.value)}
              placeholder="e.g. increase carbs on practice days, prioritize protein within 30 min post-practice"
              onFocus={(e) => { e.currentTarget.style.borderColor = DS.brand; e.currentTarget.style.boxShadow = `0 0 0 2px ${DS.brand}18`; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.boxShadow = "none"; }}
            />
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════
          MEAL DISTRIBUTION — collapsible
      ═══════════════════════════════════ */}
      <SectionHeader
        label="Meal Distribution"
        open={open.meals}
        onToggle={() => toggle("meals")}
        summary={mealsSummary(structured)}
        badge={mealBadge}
        pill={hasDailyData(structured) && !mealBadge ? "Auto-split ready" : null}
      />
      {open.meals && (
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${DS.border}` }}>
          <MealBlockEditor structured={structured} onChange={onChange} />
        </div>
      )}

      {/* ═══════════════════════════════════
          SUPPLEMENTS — collapsible
      ═══════════════════════════════════ */}
      <SectionHeader
        label="Supplements"
        open={open.supplements}
        onToggle={() => toggle("supplements")}
        summary={suppSummary(structured)}
        badge={suppBadge}
      />
      {open.supplements && (
        <div className="px-5 py-5 space-y-5" style={{ borderBottom: `1px solid ${DS.border}` }}>

          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: DS.bodyText }}>
              Supplement Recommendations
            </p>
            {anySuppSelected && (
              <button
                type="button"
                className="text-xs font-bold"
                style={{ color: DS.dimText }}
                onClick={() => {
                  for (const cat of SUPP_CATEGORIES) {
                    onChange(cat.productKey, null);
                    onChange(cat.strKey, "");
                  }
                }}
              >
                Clear all
              </button>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {SUPP_CATEGORIES.map((cat) => (
              <SupplementPicker
                key={cat.productKey}
                catDef={cat}
                products={suppGrouped[cat.productKey] ?? []}
                structured={structured}
                onChange={onChange}
              />
            ))}
          </div>

          <div style={{ borderTop: `1px solid ${DS.border}`, paddingTop: "1rem" }}>
            <Label>Dosing Notes</Label>
            <textarea
              className="w-full min-h-[80px] resize-y text-sm px-3 py-2 outline-none rounded-sm leading-relaxed"
              style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: DS.cardBg, color: DS.bodyText }}
              value={structured.notesSupplements ?? ""}
              onChange={(e) => onChange("notesSupplements", e.target.value)}
              placeholder="e.g. take creatine within 30 min post-workout, cycle pre-workout off every 8 weeks…"
              onFocus={(e) => { e.currentTarget.style.borderColor = DS.brand; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; }}
            />
          </div>

          <div className="px-3 py-2.5 text-xs" style={{ backgroundColor: DS.pageBg, border: `1px solid ${DS.border}`, color: DS.dimText }}>
            <span className="font-bold" style={{ color: DS.labelText }}>NSF reminder: </span>
            All SmartStack products are pre-screened against the banned substances database.
            Athletes should still confirm with training staff before use.
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════
          COACH NOTES — collapsible
      ═══════════════════════════════════ */}
      <SectionHeader
        label="Coach Notes"
        open={open.notes}
        onToggle={() => toggle("notes")}
        summary={structured.freeformNotes ? `${String(structured.freeformNotes).slice(0, 60).trim()}…` : "No notes yet"}
        badge={notesBadge}
      />
      {open.notes && (
        <div className="px-5 py-5 space-y-4" style={{ borderBottom: `1px solid ${DS.border}` }}>
          <div>
            <textarea
              className="w-full min-h-[120px] resize-y text-sm px-3 py-2.5 outline-none rounded-sm leading-relaxed"
              style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: DS.cardBg, color: DS.bodyText }}
              value={structured.freeformNotes ?? ""}
              onChange={(e) => onChange("freeformNotes", e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  if (e.shiftKey) onSave?.(e);
                  else onSaveNext?.(e);
                }
              }}
              placeholder="e.g. lactose sensitive — avoid whey. Increase carbs on heavy practice days. Prioritize sleep and avoid fast food during the season…"
              onFocus={(e) => { e.currentTarget.style.borderColor = DS.brand; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; }}
            />
            <p className="text-xs mt-1" style={{ color: DS.dimText }}>
              Ctrl+S = Save · Ctrl+Enter = Save &amp; Next
            </p>
          </div>

          {/* Plan meta */}
          <div className="grid sm:grid-cols-3 gap-3" style={{ borderTop: `1px solid ${DS.border}`, paddingTop: "1rem" }}>
            <div className="sm:col-span-2">
              <Label>Plan Title</Label>
              <input
                type="text"
                className="w-full text-sm px-3 py-2 outline-none rounded-sm"
                style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: DS.cardBg, color: DS.bodyText }}
                value={title ?? ""}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. In-season maintenance plan"
                onFocus={(e) => { e.currentTarget.style.borderColor = DS.brand; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; }}
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
              <p className="text-xs mt-1" style={{ color: DS.dimText }}>Blank = today</p>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════
          PLAN HISTORY — collapsible, auto-loads
      ═══════════════════════════════════ */}
      <SectionHeader
        label="Plan History"
        open={open.history}
        onToggle={() => toggle("history")}
        summary={
          hist?.historyLoading ? "Loading…"
          : hist?.historyItems?.length
            ? `${hist.historyItems.length} plan${hist.historyItems.length !== 1 ? "s" : ""} on record`
            : hist?.historyRequested
              ? "No previous plans"
              : "Click to load"
        }
        badge={hist?.historyItems?.length > 0}
      />
      {open.history && (
        <div className="p-3" style={{ borderBottom: `1px solid ${DS.border}` }}>
          <PlanHistory
            prescriptions={hist?.historyRequested ? (hist.historyItems ?? []) : []}
            selectedAthleteToken={selectedAthleteToken}
            selectedAthleteEmail={selectedAthleteEmail}
            selectedAthleteName={selectedAthleteName}
            historyRequested={hist?.historyRequested ?? false}
            loading={hist?.historyLoading ?? false}
            hasMore={hist?.historyHasMore ?? false}
            onSearch={() => hist?.searchHistory?.({ reset: true })}
            onLoadMore={hist?.loadMoreHistory}
            onCopyNotesToBuilder={handleCopyFromHistory}
          />
        </div>
      )}

      {/* ═══════════════════════════════════
          STICKY SAVE BAR
      ═══════════════════════════════════ */}
      <div
        className="flex items-center gap-3 px-5 py-3 sticky bottom-0"
        style={{
          backgroundColor: DS.pageBg,
          borderTop:       `1px solid ${DS.border}`,
          boxShadow:       "0 -4px 12px rgba(0,0,0,0.06)",
          zIndex:          10,
        }}
      >
        {/* Left actions */}
        <button
          type="button"
          onClick={() => {
            if (confirmReset) {
              setConfirmReset(false);
              setActivePreset(null);
              onReset?.();
            } else {
              setConfirmReset(true);
            }
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-sm transition-all shrink-0"
          style={{
            border:           `1px solid ${confirmReset ? "#C8102E" : DS.border}`,
            backgroundColor:  confirmReset ? "#FFF0F0"  : DS.cardBg,
            color:            confirmReset ? "#C8102E"  : DS.labelText,
          }}
          onMouseEnter={(e) => { if (!confirmReset) { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.color = DS.brand; }}}
          onMouseLeave={(e) => { if (!confirmReset) { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.color = DS.labelText; }}}
        >
          <RotateCcw className="h-3 w-3" />
          {confirmReset ? "Confirm reset?" : "Reset"}
        </button>

        {onOpenGroupBlast && (
          <button
            type="button"
            onClick={onOpenGroupBlast}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-sm transition-all shrink-0"
            style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg, color: DS.labelText }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.color = DS.brand; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.color = DS.labelText; }}
          >
            <Zap className="h-3 w-3" />
            Group Blast
          </button>
        )}

        {/* Warning */}
        {!selectedAthleteEmail && (
          <p className="flex-1 text-center text-xs font-semibold" style={{ color: DS.caution }}>
            Select an athlete to save
          </p>
        )}

        {/* Right actions */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={(e) => onSave?.(e)}
            disabled={!canSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wide rounded-sm transition-all"
            style={{
              border:          `1px solid ${flashSaved ? DS.safeBorder : DS.border}`,
              backgroundColor: flashSaved ? DS.safeBg : canSave ? DS.cardBg : DS.pageBg,
              color:           flashSaved ? DS.safe   : canSave ? DS.bodyText : DS.dimText,
              cursor:          canSave ? "pointer" : "not-allowed",
            }}
            onMouseEnter={(e) => { if (canSave && !flashSaved) { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.backgroundColor = DS.brandBg; } }}
            onMouseLeave={(e) => { if (!flashSaved) { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.backgroundColor = canSave ? DS.cardBg : DS.pageBg; } }}
          >
            <Save className="h-3.5 w-3.5" />
            {createLoading ? "Saving…" : flashSaved ? "✓ Saved" : "Save"}
          </button>

          <button
            type="button"
            onClick={(e) => onSaveNext?.(e)}
            disabled={!canSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wide rounded-sm transition-all"
            style={{
              backgroundColor: canSave ? DS.brand  : DS.pageBg,
              color:           canSave ? "#fff"    : DS.dimText,
              cursor:          canSave ? "pointer" : "not-allowed",
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
