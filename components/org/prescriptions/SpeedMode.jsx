// components/org/prescriptions/SpeedMode.jsx
"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import {
  DEFAULT_STRUCTURED,
  getAthleteToken,
  normalizeEmail,
} from "@/lib/org/prescriptions/prescriptions-utils";
import { X, ChevronRight, Zap, RotateCcw } from "lucide-react";
import SupplementPicker, { SUPP_CATEGORIES } from "./SupplementPicker";

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
  border:        "#E8ECF0",
  pageBg:        "#F4F7FB",
  cardBg:        "#FFFFFF",
  bodyText:      "#1A2535",
  labelText:     "#5A6A7D",
  dimText:       "#9BA8B4",
};

const PHASES = ["Maintain", "Bulk", "Cut", "Surplus", "Deficit"];

// Suggested macro starting points per phase - trainer adjusts from here
const PHASE_PRESETS = {
  Maintain: { calories: "3200", proteinGrams: "185", carbsGrams: "360", fatsGrams: "95"  },
  Bulk:     { calories: "4200", proteinGrams: "225", carbsGrams: "480", fatsGrams: "110" },
  Cut:      { calories: "2700", proteinGrams: "210", carbsGrams: "270", fatsGrams: "75"  },
  Surplus:  { calories: "4000", proteinGrams: "210", carbsGrams: "450", fatsGrams: "105" },
  Deficit:  { calories: "2500", proteinGrams: "200", carbsGrams: "240", fatsGrams: "70"  },
};


function isDone(a, doneTokens, completedEmails) {
  const tok   = String(getAthleteToken(a) || "").trim();
  const email = normalizeEmail(a?.email);
  return (tok && doneTokens?.has?.(tok)) || (email && completedEmails?.has?.(email));
}

function relativeDate(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  const d  = Math.floor(ms / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 7)  return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

/* ── Two-column macro comparison row ── */
function MacroRow({ label, unit, value, onChange, lastValue }) {
  const hasLast = String(lastValue ?? "").trim() !== "";
  return (
    <div
      className="grid items-center gap-3 py-2.5"
      style={{
        gridTemplateColumns: "120px 1fr auto 1fr 36px",
        borderBottom: `1px solid ${DS.border}`,
      }}
    >
      <span className="text-xs font-bold truncate" style={{ color: DS.labelText }}>
        {label}
      </span>
      <span
        className="text-right text-xs tabular-nums"
        style={{ color: hasLast ? DS.dimText : "transparent", userSelect: "none" }}
      >
        {hasLast ? lastValue : "-"}
      </span>
      <ChevronRight className="h-3 w-3 shrink-0" style={{ color: DS.dimText }} />
      <input
        type="number"
        min="0"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={hasLast ? String(lastValue) : "0"}
        className="w-full text-sm px-3 py-1.5 outline-none rounded-sm tabular-nums text-right"
        style={{
          border: `1px solid ${DS.brandBorder}`,
          backgroundColor: DS.cardBg,
          color: DS.bodyText,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = DS.brand;
          e.currentTarget.style.boxShadow  = `0 0 0 2px ${DS.brand}18`;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = DS.brandBorder;
          e.currentTarget.style.boxShadow  = "none";
        }}
      />
      <span className="text-xs text-right shrink-0" style={{ color: DS.dimText }}>
        {unit}
      </span>
    </div>
  );
}

/* ── Supplement text field ── */
function SuppRow({ label, value, onChange, lastValue }) {
  const hasLast = String(lastValue ?? "").trim() !== "";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold truncate" style={{ color: DS.labelText }}>
          {label}
        </p>
        {hasLast && !value && (
          <button
            type="button"
            onClick={() => onChange(lastValue)}
            className="text-xs shrink-0 font-bold"
            style={{ color: DS.brand }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
          >
            ↑ carry
          </button>
        )}
      </div>
      <input
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={hasLast ? lastValue : "e.g. 25g whey protein"}
        className="w-full text-sm px-3 py-1.5 outline-none rounded-sm"
        style={{
          border: `1px solid ${DS.brandBorder}`,
          backgroundColor: DS.cardBg,
          color: DS.bodyText,
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = DS.brand; }}
        onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; }}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Main component
══════════════════════════════════════════════════════════ */
export default function SpeedMode({
  filteredAthletes = [],
  selectedAthlete,
  selectedAthleteEmail,
  selectedAthleteToken,
  structured,
  onChange,
  setStructured,
  setTitle,
  hist,
  products = [],
  createLoading,
  onSave,
  onSaveNext,
  onSkip,
  onExit,
  error,
  setError,
  completedEmails,
  doneTokens = new Set(),
  planSavedAt,
}) {
  const [showNotes,   setShowNotes]   = useState(false);
  const [flashSaved,  setFlashSaved]  = useState(false);
  const [carryFlash,  setCarryFlash]  = useState(false);
  const [hoveredPhase, setHoveredPhase] = useState(null);

  /* ── Save flash ── */
  useEffect(() => {
    if (!planSavedAt) return;
    setFlashSaved(true);
    const t = setTimeout(() => setFlashSaved(false), 2000);
    return () => clearTimeout(t);
  }, [planSavedAt]);

  /* ── Athlete info ── */
  const athleteName  = String(selectedAthlete?.name  || "").trim() || "Athlete";
  const athleteEmail = String(selectedAthlete?.email || selectedAthleteEmail || "").trim();
  const athleteSport = String(selectedAthlete?.sport || "").trim();
  const initials     = athleteName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?";

  const currentIndex = useMemo(() => {
    if (!selectedAthleteEmail && !selectedAthleteToken) return -1;
    return filteredAthletes.findIndex((a) => {
      const tok   = String(getAthleteToken(a) || "").trim();
      const email = normalizeEmail(a?.email);
      return (
        (selectedAthleteToken && tok   === String(selectedAthleteToken).trim()) ||
        (selectedAthleteEmail && email === normalizeEmail(selectedAthleteEmail))
      );
    });
  }, [filteredAthletes, selectedAthleteEmail, selectedAthleteToken]);

  const total     = filteredAthletes.length;
  const doneCount = useMemo(
    () => filteredAthletes.filter((a) => isDone(a, doneTokens, completedEmails)).length,
    [filteredAthletes, doneTokens, completedEmails]
  );
  const progressPct   = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const isCurrentDone = selectedAthlete ? isDone(selectedAthlete, doneTokens, completedEmails) : false;

  /* ── Last plan data ── */
  const lastRaw  = hist?.historyItems?.[0]?._raw || null;
  const lastPj   = lastRaw?.planJson && typeof lastRaw.planJson === "object" ? lastRaw.planJson : null;
  const lastSupp = lastPj?.supplements || {};
  const hasLastPlan = Boolean(
    lastRaw?.dailyCalories || lastRaw?.dailyProtein ||
    lastPj?.daily?.calories || lastPj?.daily?.protein
  );

  const lastCal  = String(lastRaw?.dailyCalories  ?? lastPj?.daily?.calories     ?? "").trim();
  const lastPro  = String(lastRaw?.dailyProtein   ?? lastPj?.daily?.protein      ?? "").trim();
  const lastCarb = String(lastRaw?.dailyCarbs     ?? lastPj?.daily?.carbs        ?? "").trim();
  const lastFat  = String(lastRaw?.dailyFat       ?? lastPj?.daily?.fat          ?? "").trim();
  const lastHyd  = String(
    lastRaw?.dailyHydration ?? lastPj?.hydrationOz ?? lastPj?.daily?.hydrationOz ?? ""
  ).trim();

  /* ── Products grouped by supplement category ── */
  const suppGrouped = useMemo(() => {
    const out = {};
    for (const cat of SUPP_CATEGORIES) {
      out[cat.productKey] = (products ?? []).filter((p) => cat.match(p.category ?? ""));
    }
    return out;
  }, [products]);

  const [suppScans, setSuppScans] = useState({});
  const handleScanResult = useCallback((key, result) => {
    setSuppScans((prev) => ({ ...prev, [key]: result }));
  }, []);
  const anySuppFlagged = Object.values(suppScans).some((s) => s?.status === "flagged");

  /* ── Carry all from last plan ── */
  function carryAll() {
    if (!lastRaw) return;
    const supp = lastPj?.supplements || {};
    setStructured({
      ...DEFAULT_STRUCTURED,
      phase:        String(lastRaw.phase || lastPj?.phase || DEFAULT_STRUCTURED.phase),
      calories:     String(lastRaw.dailyCalories  ?? lastPj?.daily?.calories  ?? ""),
      proteinGrams: String(lastRaw.dailyProtein   ?? lastPj?.daily?.protein   ?? ""),
      carbsGrams:   String(lastRaw.dailyCarbs     ?? lastPj?.daily?.carbs     ?? ""),
      fatsGrams:    String(lastRaw.dailyFat       ?? lastPj?.daily?.fat       ?? ""),
      hydrationOz:  String(lastRaw.dailyHydration ?? lastPj?.hydrationOz ?? lastPj?.daily?.hydrationOz ?? ""),
      notesMacros:  String(lastPj?.notesMacros || lastPj?.notes?.macros || ""),
      mealSplit:    lastPj?.mealSplit  && typeof lastPj.mealSplit  === "object" ? lastPj.mealSplit  : DEFAULT_STRUCTURED.mealSplit,
      mealBlocks:   lastPj?.mealBlocks && typeof lastPj.mealBlocks === "object" ? lastPj.mealBlocks : DEFAULT_STRUCTURED.mealBlocks,
      proteinRecommendation:      String(supp.proteinRecommendation      || supp.protein      || ""),
      creatineRecommendation:     String(supp.creatineRecommendation     || supp.creatine     || ""),
      bcaaRecommendation:         String(supp.bcaaRecommendation         || supp.bcaaEaa      || ""),
      electrolytesRecommendation: String(supp.electrolytesRecommendation || supp.electrolytes || ""),
      preWorkoutRecommendation:   String(supp.preWorkoutRecommendation   || ""),
      proteinBarRecommendation:   String(supp.proteinBarRecommendation   || ""),
      notesSupplements:           String(supp.notes || lastPj?.notes?.supplements || ""),
      ...(supp.proteinProduct    ? { proteinProduct:    supp.proteinProduct    } : {}),
      ...(supp.creatineProduct   ? { creatineProduct:   supp.creatineProduct   } : {}),
      ...(supp.bcaaProduct       ? { bcaaProduct:       supp.bcaaProduct       } : {}),
      ...(supp.preWorkoutProduct ? { preWorkoutProduct: supp.preWorkoutProduct } : {}),
      ...(supp.proteinBarProduct ? { proteinBarProduct: supp.proteinBarProduct } : {}),
      metaStatus:        String(lastPj?.meta?.status        || DEFAULT_STRUCTURED.metaStatus),
      metaEffectiveDate: String(lastPj?.meta?.effectiveDate || ""),
      freeformNotes:     String(lastRaw.prescription || lastPj?.freeformNotes || ""),
    });
    setTitle(String(lastPj?.title || hist?.historyItems?.[0]?.title || "Nutrition + Supplements Plan"));
    setCarryFlash(true);
    setTimeout(() => setCarryFlash(false), 1800);
  }

  /* ── Macro math ── */
  const pro     = Number(structured?.proteinGrams || 0);
  const carb    = Number(structured?.carbsGrams   || 0);
  const fat     = Number(structured?.fatsGrams    || 0);
  const stated  = Number(structured?.calories     || 0);
  const calcCal = Math.round(pro * 4 + carb * 4 + fat * 9);
  const macroTotal = pro * 4 + carb * 4 + fat * 9;
  const diff    = stated && calcCal ? calcCal - stated : null;
  const absDiff = diff !== null ? Math.abs(diff) : null;
  const mathState =
    !calcCal    ? "empty" :
    diff === null         ? "info"  :
    absDiff <= 50         ? "good"  :
    absDiff <= 150        ? "warn"  : "bad";
  const MC = {
    empty: { text: DS.dimText,  bg: DS.pageBg,    border: DS.border        },
    info:  { text: DS.brand,    bg: DS.brandBg,   border: DS.brandBorder   },
    good:  { text: DS.safe,     bg: DS.safeBg,    border: DS.safeBorder    },
    warn:  { text: DS.caution,  bg: DS.cautionBg, border: DS.cautionBorder },
    bad:   { text: "#C8102E",   bg: "#FFF0F0",    border: "#FFC8C8"        },
  }[mathState];

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    function onKeyDown(e) {
      const ready = Boolean(selectedAthleteEmail) && !createLoading;
      if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (ready) onSave?.(e);
        return;
      }
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        if ((e.target?.tagName || "").toLowerCase() === "textarea") return;
        e.preventDefault();
        if (ready) onSaveNext?.(e);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedAthleteEmail, createLoading, onSave, onSaveNext]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: DS.pageBg }}>

      {/* ══════════════════════════════════════
          Top bar
      ══════════════════════════════════════ */}
      <div
        className="sticky top-0 z-20 flex items-center gap-4 px-5 py-2.5"
        style={{ backgroundColor: DS.brand, boxShadow: "0 2px 8px rgba(0,0,0,0.18)" }}
      >
        {/* Exit button */}
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-sm shrink-0 transition-all"
          style={{ backgroundColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.2)" }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.22)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.12)"; }}
        >
          <X className="h-3.5 w-3.5" />
          Exit Speed Mode
        </button>

        {/* Progress bar */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="flex-1 max-w-sm h-1.5 rounded-full overflow-hidden"
            style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                backgroundColor: progressPct === 100 ? "#4ADE80" : "#93C5FD",
              }}
            />
          </div>
          <span className="text-xs shrink-0" style={{ color: "rgba(255,255,255,0.7)" }}>
            <span style={{ color: "#fff", fontWeight: 700 }}>{doneCount}</span>
            <span> / {total} done</span>
          </span>
        </div>

        {/* Speed Mode badge */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Zap className="h-3.5 w-3.5" style={{ color: "#FCD34D" }} />
          <span className="text-xs font-black uppercase tracking-widest" style={{ color: "#FCD34D" }}>
            Speed Mode
          </span>
        </div>
      </div>

      {/* ══════════════════════════════════════
          Main card
      ══════════════════════════════════════ */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div
          style={{
            border: `1px solid ${DS.border}`,
            borderTop: `3px solid ${DS.brand}`,
            backgroundColor: DS.cardBg,
          }}
        >

          {/* ── Athlete header ── */}
          <div
            className="px-5 py-4 flex items-center gap-4"
            style={{ borderBottom: `1px solid ${DS.border}`, backgroundColor: DS.pageBg }}
          >
            {/* Initials avatar */}
            <div
              className="h-12 w-12 rounded-sm flex items-center justify-center shrink-0 text-sm font-black"
              style={{
                backgroundColor: isCurrentDone ? DS.safeBg  : DS.brandBg,
                color:           isCurrentDone ? DS.safe    : DS.brand,
                border:          `1px solid ${isCurrentDone ? DS.safeBorder : DS.brandBorder}`,
              }}
            >
              {initials}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-base font-black" style={{ color: DS.bodyText }}>{athleteName}</p>
                {athleteSport && (
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-sm"
                    style={{ backgroundColor: DS.brandBg, color: DS.brand, border: `1px solid ${DS.brandBorder}` }}
                  >
                    {athleteSport}
                  </span>
                )}
                {isCurrentDone && (
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-sm"
                    style={{ backgroundColor: DS.safeBg, color: DS.safe, border: `1px solid ${DS.safeBorder}` }}
                  >
                    ✓ Plan active
                  </span>
                )}
              </div>
              <p className="text-xs mt-0.5" style={{ color: DS.dimText }}>
                {athleteEmail || "No email"}
              </p>
              {lastRaw?.createdAt && (
                <p className="text-xs mt-0.5" style={{ color: DS.dimText }}>
                  Last plan: {relativeDate(lastRaw.createdAt)}
                  {lastRaw.phase ? ` · ${lastRaw.phase}` : ""}
                  {lastRaw.dailyCalories ? ` · ${Number(lastRaw.dailyCalories).toLocaleString()} cal` : ""}
                </p>
              )}
            </div>

            {/* Position + skip nav */}
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              {currentIndex >= 0 && (
                <span className="text-xs tabular-nums" style={{ color: DS.dimText }}>
                  {currentIndex + 1} / {total}
                </span>
              )}
              <button
                type="button"
                onClick={onSkip}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-sm transition-all"
                style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg, color: DS.labelText }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.color = DS.brand; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.color = DS.labelText; }}
              >
                Skip <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* ── Error banner ── */}
          {error && (
            <div
              className="mx-5 mt-4 flex items-center justify-between gap-3 px-3 py-2.5 text-xs"
              style={{ backgroundColor: "#FFF0F0", borderLeft: "3px solid #C8102E", color: "#C8102E" }}
            >
              <span>{error}</span>
              <button type="button" onClick={() => setError("")} className="font-bold shrink-0">✕</button>
            </div>
          )}

          <div className="px-5 py-5 space-y-6">

            {/* ── Phase chips ── */}
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-xs font-black uppercase tracking-widest" style={{ color: DS.dimText }}>Phase</p>
                <p className="text-xs" style={{ color: DS.dimText }}>Loads suggested macros - adjust to fit the athlete</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {PHASES.map((ph) => {
                  const active  = (structured?.phase || "Maintain") === ph;
                  const hovered = hoveredPhase === ph;
                  const preset  = PHASE_PRESETS[ph];
                  return (
                    <button
                      key={ph}
                      type="button"
                      onClick={() => {
                        setStructured((prev) => ({
                          ...prev,
                          phase: ph,
                          ...(preset ? {
                            calories:     preset.calories,
                            proteinGrams: preset.proteinGrams,
                            carbsGrams:   preset.carbsGrams,
                            fatsGrams:    preset.fatsGrams,
                          } : {}),
                        }));
                      }}
                      onMouseEnter={() => setHoveredPhase(ph)}
                      onMouseLeave={() => setHoveredPhase(null)}
                      className="px-3 py-1.5 text-xs font-bold rounded-sm transition-all"
                      style={{
                        backgroundColor: active ? DS.brand    : hovered ? DS.brandBg   : DS.cardBg,
                        color:           active ? "#fff"      : hovered ? DS.brand     : DS.labelText,
                        border:          `1px solid ${active  ? DS.brand : hovered ? DS.brandBorder : DS.border}`,
                      }}
                    >
                      {ph}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Carry-all banner ── */}
            {hasLastPlan && (
              <div
                className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-sm"
                style={{ backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}` }}
              >
                <p className="text-xs" style={{ color: DS.labelText }}>
                  Previous plan on file - load it and adjust, or enter fresh numbers below.
                </p>
                <button
                  type="button"
                  onClick={carryAll}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-sm shrink-0 transition-all"
                  style={{
                    backgroundColor: carryFlash ? DS.safe     : DS.brand,
                    color:           "#fff",
                    border:          `1px solid ${carryFlash ? DS.safe : DS.brand}`,
                  }}
                >
                  {carryFlash
                    ? <><span>✓</span> Loaded</>
                    : <><RotateCcw className="h-3 w-3" /> Carry All</>
                  }
                </button>
              </div>
            )}

            {/* ── Macro comparison table ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-black uppercase tracking-widest" style={{ color: DS.dimText }}>
                  Daily Macros
                </p>
                {hasLastPlan && (
                  <p className="text-xs" style={{ color: DS.dimText }}>
                    last plan → new plan
                  </p>
                )}
              </div>

              <div style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.pageBg, padding: "0 0.75rem" }}>
                <MacroRow
                  label="Calories"  unit="kcal"
                  value={structured?.calories}     onChange={(v) => onChange("calories",     v)}
                  lastValue={lastCal}
                />
                <MacroRow
                  label="Protein"   unit="g"
                  value={structured?.proteinGrams}  onChange={(v) => onChange("proteinGrams", v)}
                  lastValue={lastPro}
                />
                <MacroRow
                  label="Carbs"     unit="g"
                  value={structured?.carbsGrams}    onChange={(v) => onChange("carbsGrams",   v)}
                  lastValue={lastCarb}
                />
                <MacroRow
                  label="Fat"       unit="g"
                  value={structured?.fatsGrams}     onChange={(v) => onChange("fatsGrams",    v)}
                  lastValue={lastFat}
                />
                <MacroRow
                  label="Hydration" unit="oz"
                  value={structured?.hydrationOz}   onChange={(v) => onChange("hydrationOz",  v)}
                  lastValue={lastHyd}
                />
              </div>

              {/* ── Macro math bar ── */}
              {calcCal > 0 && (
                <div
                  className="mt-2 px-3 py-2"
                  style={{ backgroundColor: MC.bg, border: `1px solid ${MC.border}` }}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-bold shrink-0" style={{ color: MC.text }}>
                      {calcCal.toLocaleString()} kcal from macros
                    </span>
                    {macroTotal > 0 && (
                      <span className="text-xs" style={{ color: DS.dimText }}>
                        P {Math.round(pro * 4 / macroTotal * 100)}% ·{" "}
                        C {Math.round(carb * 4 / macroTotal * 100)}% ·{" "}
                        F {Math.round(fat * 9 / macroTotal * 100)}%
                      </span>
                    )}
                    {diff !== null && (
                      <span className="text-xs font-bold ml-auto shrink-0" style={{ color: MC.text }}>
                        {mathState === "good"
                          ? "✓ Matches calorie target"
                          : `${diff > 0 ? "+" : ""}${diff} kcal vs ${stated.toLocaleString()} target`}
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-1" style={{ color: DS.dimText }}>
                    1g protein = 4 kcal · 1g carbs = 4 kcal · 1g fat = 9 kcal
                  </p>
                </div>
              )}
            </div>

            {/* ── Supplements grid ── */}
            <div>
              <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: DS.dimText }}>
                Supplements
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* SmartStack product pickers (with banned substance scan) */}
                {SUPP_CATEGORIES.map((cat) => (
                  <SupplementPicker
                    key={cat.productKey}
                    catDef={cat}
                    products={suppGrouped[cat.productKey] ?? []}
                    structured={structured}
                    onChange={onChange}
                    onScanResult={handleScanResult}
                  />
                ))}
                {/* Electrolytes - no SmartStack category, stays as text */}
                <SuppRow
                  label="Electrolytes"
                  value={structured?.electrolytesRecommendation ?? ""}
                  onChange={(v) => onChange("electrolytesRecommendation", v)}
                  lastValue={String(lastSupp?.electrolytesRecommendation || lastSupp?.electrolytes || "").trim()}
                />
              </div>
            </div>

            {/* ── Notes (collapsible) ── */}
            <div>
              <button
                type="button"
                onClick={() => setShowNotes((v) => !v)}
                className="flex items-center gap-2 w-full text-left"
              >
                <ChevronRight
                  className="h-3.5 w-3.5 shrink-0 transition-transform"
                  style={{ color: DS.dimText, transform: showNotes ? "rotate(90deg)" : "none" }}
                />
                <p className="text-xs font-black uppercase tracking-widest" style={{ color: DS.dimText }}>
                  Additional Notes {!showNotes && <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: "normal" }}>(optional)</span>}
                </p>
              </button>
              {showNotes && (
                <textarea
                  rows={4}
                  value={structured?.freeformNotes ?? ""}
                  onChange={(e) => onChange("freeformNotes", e.target.value)}
                  placeholder="Timing, coaching cues, athlete-specific instructions…"
                  className="w-full mt-2 text-sm px-3 py-2 outline-none resize-y rounded-sm"
                  style={{
                    border: `1px solid ${DS.brandBorder}`,
                    backgroundColor: DS.cardBg,
                    color: DS.bodyText,
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = DS.brand; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; }}
                />
              )}
            </div>

          </div>

          {/* ── Sticky save bar ── */}
          <div className="sticky bottom-0" style={{ zIndex: 10 }}>
            {anySuppFlagged && (
              <div
                className="flex items-center gap-2 px-5 py-2 text-xs font-bold"
                style={{ backgroundColor: "#FFF0F0", borderTop: "1px solid #FFC8C8", color: "#C8102E" }}
              >
                ⛔ A selected supplement contains a banned substance - verify before prescribing
              </div>
            )}
          <div
            className="flex items-center gap-3 px-5 py-3"
            style={{
              backgroundColor: DS.pageBg,
              borderTop: `1px solid ${DS.border}`,
              boxShadow: "0 -4px 12px rgba(0,0,0,0.06)",
            }}
          >
            <span className="text-xs flex-1 hidden sm:block" style={{ color: DS.dimText }}>
              <span className="font-bold" style={{ color: DS.labelText }}>Ctrl+S</span>{" "}Save ·{" "}
              <span className="font-bold" style={{ color: DS.labelText }}>Ctrl+Enter</span>{" "}Save &amp; Next
            </span>

            <button
              type="button"
              onClick={onSave}
              disabled={createLoading}
              className="px-4 py-2 text-xs font-bold rounded-sm transition-all"
              style={{
                border: `1px solid ${flashSaved ? DS.safeBorder : DS.border}`,
                backgroundColor: flashSaved ? DS.safeBg  : DS.cardBg,
                color:           flashSaved ? DS.safe    : DS.labelText,
              }}
              onMouseEnter={(e) => { if (!flashSaved) { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.color = DS.brand; } }}
              onMouseLeave={(e) => { if (!flashSaved) { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.color = DS.labelText; } }}
            >
              {createLoading ? "Saving…" : flashSaved ? "✓ Saved" : "Save"}
            </button>

            <button
              type="button"
              onClick={onSaveNext}
              disabled={createLoading}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-sm transition-all"
              style={{ backgroundColor: DS.brand, color: "#fff", border: `1px solid ${DS.brand}` }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DS.brandLight; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DS.brand; }}
            >
              {createLoading ? "Saving…" : "Save & Next"}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
