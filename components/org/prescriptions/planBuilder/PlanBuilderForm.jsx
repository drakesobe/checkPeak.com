// components/org/prescriptions/planBuilder/PlanBuilderForm.jsx
"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import SearchSelect from "@/components/SearchSelect";
import MealBlockEditor from "./mealBlocks/MealBlockEditor";
import PlanHistory from "../PlanHistory";
import {
  Zap, Save, ArrowRight, RotateCcw, User, ChevronDown,
  Trash2, RefreshCw, BookOpen,
} from "lucide-react";

/* ── DS tokens ────────────────────────────────────────────────────────────── */
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

/* ── D2 football presets ─────────────────────────────────────────────────── */
const PRESETS = [
  { label: "Bulk",     cal: 4200, pro: 225, carbs: 480, fat: 110, phase: "Surplus",  desc: "Linemen / heavy skill" },
  { label: "Maintain", cal: 3200, pro: 185, carbs: 360, fat: 95,  phase: "Maintain", desc: "Standard in-season"    },
  { label: "Cut",      cal: 2700, pro: 210, carbs: 270, fat: 75,  phase: "Cut",      desc: "Weight management"     },
  { label: "Skill",    cal: 3600, pro: 195, carbs: 420, fat: 90,  phase: "Maintain", desc: "Speed / skill spots"   },
];

const TABS = [
  { id: "daily",       label: "Daily"       },
  { id: "meals",       label: "Meals"       },
  { id: "supplements", label: "Supplements" },
  { id: "notes",       label: "Notes"       },
  { id: "history",     label: "History"     },
];

/* ══════════════════════════════════════════════════════
   Shared primitives
══════════════════════════════════════════════════════ */

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

function Badge({ children, tone = "brand" }) {
  const map = {
    brand:   { bg: DS.brandBg,   color: DS.brand,   border: DS.brandBorder   },
    safe:    { bg: DS.safeBg,    color: DS.safe,    border: DS.safeBorder    },
    caution: { bg: DS.cautionBg, color: DS.caution, border: DS.cautionBorder },
    banned:  { bg: DS.bannedBg,  color: DS.banned,  border: DS.bannedBorder  },
  };
  const s = map[tone] || map.brand;
  return (
    <span
      className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-sm"
      style={{ backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {children}
    </span>
  );
}

/* ══════════════════════════════════════════════════════
   Header zone - athlete identity + templates drawer
══════════════════════════════════════════════════════ */

function AthleteIdentity({ selectedAthlete, selectedAthleteEmail }) {
  const name    = String(selectedAthlete?.name  || "").trim();
  const email   = String(selectedAthleteEmail || selectedAthlete?.email || "").trim();
  const token   = String(selectedAthlete?.AthleteToken || selectedAthlete?.athleteToken || "").trim();
  const present = Boolean(name || email);

  return (
    <div className="flex items-center gap-3 min-w-0">
      <span
        className="h-9 w-9 rounded-sm flex items-center justify-center shrink-0"
        style={{
          backgroundColor: present ? DS.brandBg  : DS.pageBg,
          border:          `1px solid ${present ? DS.brandBorder : DS.border}`,
        }}
      >
        <User className="h-4 w-4" style={{ color: present ? DS.brand : DS.dimText }} />
      </span>

      {present ? (
        <div className="min-w-0">
          <p className="text-sm font-black truncate" style={{ color: DS.bodyText }}>
            {name || email}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {name && email && (
              <span className="text-xs truncate" style={{ color: DS.dimText }}>{email}</span>
            )}
            {token
              ? <Badge tone="brand">Token ✓</Badge>
              : <Badge tone="caution">Token missing</Badge>
            }
          </div>
        </div>
      ) : (
        <p className="text-sm" style={{ color: DS.dimText }}>
          ← Select an athlete to begin
        </p>
      )}
    </div>
  );
}

function TemplatesDrawer({ tpl }) {
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
    <div className="px-5 py-4 space-y-2.5" style={{ borderTop: `1px solid ${DS.border}`, backgroundColor: DS.pageBg }}>

      {templatesError && (
        <p className="text-xs font-bold px-3 py-1.5"
          style={{ backgroundColor: DS.bannedBg, color: DS.banned, border: `1px solid ${DS.bannedBorder}` }}>
          {templatesError}
        </p>
      )}

      {/* Row 1: Apply an existing template */}
      <div className="flex gap-2 items-center">
        <select
          className="flex-1 text-sm px-3 py-2 outline-none rounded-sm min-w-0"
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
          className="px-3 py-2 text-xs font-black uppercase tracking-wide rounded-sm transition-all shrink-0"
          style={{
            backgroundColor: templateId ? DS.brand   : DS.border,
            color:           templateId ? "#fff"     : DS.dimText,
            cursor:          templateId ? "pointer"  : "not-allowed",
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
          className="inline-flex items-center px-2.5 py-2 text-xs font-bold rounded-sm shrink-0 transition-all"
          style={{
            border:          `1px solid ${templateId ? DS.bannedBorder : DS.border}`,
            backgroundColor: DS.cardBg,
            color:           templateId ? DS.banned : DS.dimText,
            cursor:          templateId ? "pointer" : "not-allowed",
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onRefreshTemplates?.()}
          disabled={templatesLoading}
          title="Refresh templates list"
          className="shrink-0 p-2 rounded-sm transition-colors"
          style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg, color: DS.dimText }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.color = DS.brand; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.color = DS.dimText; }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${templatesLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Row 2: Save current plan as a new template */}
      <div className="flex gap-2 items-center">
        <input
          className="flex-1 text-sm px-3 py-2 outline-none rounded-sm min-w-0"
          style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: DS.cardBg, color: DS.bodyText }}
          placeholder="Name this template to save it…"
          value={templateName || ""}
          onChange={(e) => setTemplateName(e.target.value)}
          onFocus={(e) => { e.currentTarget.style.borderColor = DS.brand; }}
          onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; }}
        />
        <button
          type="button"
          onClick={() => saveAsTemplate?.()}
          disabled={templatesLoading || !hasName}
          className="px-3 py-2 text-xs font-black uppercase tracking-wide rounded-sm whitespace-nowrap shrink-0 transition-all"
          style={{
            backgroundColor: hasName ? DS.brand   : DS.border,
            color:           hasName ? "#fff"     : DS.dimText,
            cursor:          hasName ? "pointer"  : "not-allowed",
          }}
          onMouseEnter={(e) => { if (hasName) e.currentTarget.style.backgroundColor = DS.brandLight; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = hasName ? DS.brand : DS.border; }}
        >
          {templatesLoading ? "Saving…" : "Save Template"}
        </button>
      </div>

      <p className="text-xs" style={{ color: DS.dimText }}>
        Pro tip: apply a template once, then <strong>Save &amp; Next</strong> through the full roster without touching the builder.
      </p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Tab bar
══════════════════════════════════════════════════════ */

function TabBar({ activeTab, onTabChange, badges }) {
  return (
    <div
      className="flex overflow-x-auto"
      style={{ borderBottom: `1px solid ${DS.border}`, backgroundColor: DS.pageBg }}
    >
      {TABS.map((t) => {
        const active = activeTab === t.id;
        const filled = badges[t.id];
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onTabChange(t.id)}
            className="flex-shrink-0 flex items-center gap-1.5 px-5 py-3 text-xs font-black uppercase tracking-wide whitespace-nowrap transition-colors"
            style={{
              color:           active ? DS.brand  : DS.dimText,
              backgroundColor: active ? DS.cardBg : "transparent",
              borderBottom:    active ? `2px solid ${DS.brand}` : "2px solid transparent",
              marginBottom:    "-1px",
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = DS.labelText; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = DS.dimText; }}
          >
            {t.label}
            {filled && (
              <span
                className="inline-flex items-center justify-center h-4 w-4 rounded-full text-[10px] font-black"
                style={{ backgroundColor: DS.safeBg, color: DS.safe, border: `1px solid ${DS.safeBorder}` }}
              >
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Plan summary strip - visible on all tabs except Daily
   so coach always knows what targets are loaded
══════════════════════════════════════════════════════ */

function PlanSummaryStrip({ structured, activeTab }) {
  if (activeTab === "daily") return null;

  const cal   = String(structured?.calories     || "").trim();
  const pro   = String(structured?.proteinGrams || "").trim();
  const carbs = String(structured?.carbsGrams   || "").trim();
  const fat   = String(structured?.fatsGrams    || "").trim();
  const water = String(structured?.hydrationOz  || "").trim();
  const phase = String(structured?.phase        || "").trim();

  if (!cal && !pro && !carbs && !fat && !water) return null;

  const items = [
    phase && { label: phase, strong: true },
    cal   && { label: `${Number(cal).toLocaleString()} cal` },
    pro   && { label: `P ${pro}g` },
    carbs && { label: `C ${carbs}g` },
    fat   && { label: `F ${fat}g` },
    water && { label: `💧 ${water} oz` },
  ].filter(Boolean);

  return (
    <div
      className="flex items-center gap-x-4 gap-y-1 flex-wrap px-5 py-2"
      style={{ backgroundColor: DS.brandBg, borderBottom: `1px solid ${DS.brandBorder}` }}
    >
      {items.map((item, i) => (
        <span
          key={i}
          className={`text-xs tabular-nums ${item.strong ? "font-black uppercase tracking-wide" : "font-semibold"}`}
          style={{ color: item.strong ? DS.brand : DS.labelText }}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Tab: Daily
══════════════════════════════════════════════════════ */

function DailyTab({ structured, onChange, activePreset, setActivePreset, onGoToMeals }) {

  function applyPreset(p) {
    setActivePreset(p.label);
    onChange("calories",     String(p.cal));
    onChange("proteinGrams", String(p.pro));
    onChange("carbsGrams",   String(p.carbs));
    onChange("fatsGrams",    String(p.fat));
    onChange("phase",        p.phase);
  }

  return (
    <div className="p-5 space-y-6">

      {/* Quick presets */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-3.5 w-3.5 shrink-0" style={{ color: DS.brand }} />
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: DS.brand }}>
            Quick Presets
          </p>
          <span className="text-xs" style={{ color: DS.dimText }}>- fills all targets instantly</span>
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
                <p
                  className="font-black tabular-nums mt-0.5"
                  style={{
                    fontSize: "1.05rem",
                    color: active ? "rgba(255,255,255,0.9)" : DS.brand,
                  }}
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
      </section>

      {/* Daily targets */}
      <section>
        <p className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: DS.bodyText }}>
          Daily Targets
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <div>
            <Label>Phase</Label>
            <DSSelect
              value={structured.phase || ""}
              onChange={(e) => onChange("phase", e.target.value)}
            >
              <option value="">Phase…</option>
              {["Surplus", "Maintain", "Cut", "Game Week", "Bye Week"].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </DSSelect>
          </div>

          {[
            { label: "Calories",  key: "calories",     ph: "e.g. 3200" },
            { label: "Protein g", key: "proteinGrams", ph: "e.g. 185"  },
            { label: "Carbs g",   key: "carbsGrams",   ph: "e.g. 360"  },
            { label: "Fat g",     key: "fatsGrams",    ph: "e.g. 95"   },
            { label: "Water oz",  key: "hydrationOz",  ph: "e.g. 96"   },
          ].map(({ label, key, ph }) => (
            <div key={key}>
              <Label>{label}</Label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={structured[key] ?? ""}
                onChange={(e) => { onChange(key, e.target.value); setActivePreset(null); }}
                placeholder={ph}
                className="w-full text-sm px-3 py-2 outline-none rounded-sm tabular-nums"
                style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: DS.cardBg, color: DS.bodyText }}
                onFocus={(e) => { e.currentTarget.style.borderColor = DS.brand; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; }}
              />
            </div>
          ))}
        </div>

        <div className="mt-3">
          <Label>Macro Notes</Label>
          <DSInput
            value={structured.notesMacros ?? ""}
            onChange={(e) => onChange("notesMacros", e.target.value)}
            placeholder="e.g. increase carbs on practice days, prioritize protein within 30min post-practice"
          />
        </div>
      </section>

      {/* CTA to Meals tab */}
      <button
        type="button"
        onClick={onGoToMeals}
        className="w-full flex items-center justify-between px-4 py-3 rounded-sm text-left transition-colors"
        style={{ backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}` }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = DS.brand; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = DS.brandBorder; }}
      >
        <div>
          <p className="text-xs font-black uppercase tracking-wide" style={{ color: DS.brand }}>
            Distribute to Meals
          </p>
          <p className="text-xs mt-0.5" style={{ color: DS.labelText }}>
            Set daily targets above, then Auto-split fills all 4 meal targets from those numbers.
          </p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 ml-3" style={{ color: DS.brand }} />
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Tab: Meals
══════════════════════════════════════════════════════ */

function MealsTab({ structured, onChange }) {
  return (
    <div className="p-5">
      <MealBlockEditor structured={structured} onChange={onChange} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Tab: Supplements
══════════════════════════════════════════════════════ */

/* ── Category → structured field mapping ─────────────────────────────────── */
const SUPP_CATEGORIES = [
  {
    label:      "Pre-Workout",
    strKey:     "preWorkoutRecommendation",
    productKey: "preWorkoutProduct",
    match:      (cat) => /pre.?workout/i.test(cat),
  },
  {
    label:      "Protein Powder",
    strKey:     "proteinRecommendation",
    productKey: "proteinProduct",
    match:      (cat) => /protein.?powder/i.test(cat),
  },
  {
    label:      "Creatine",
    strKey:     "creatineRecommendation",
    productKey: "creatineProduct",
    match:      (cat) => /creatine/i.test(cat),
  },
  {
    label:      "Protein Bars",
    strKey:     "proteinBarRecommendation",
    productKey: "proteinBarProduct",
    match:      (cat) => /protein.?bar/i.test(cat),
  },
  {
    label:      "BCAAs",
    strKey:     "bcaaRecommendation",
    productKey: "bcaaProduct",
    match:      (cat) => /bcaa|eaa/i.test(cat),
  },
];

/* ── Custom product dropdown - shows image in trigger + option rows ──────── */
function CategoryPicker({ catDef, products, structured, onChange }) {
  const [open, setOpen] = useState(false);
  const ref             = useRef(null);

  const selectedProduct = structured[catDef.productKey] ?? null;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = useCallback((product) => {
    if (product === null) {
      onChange(catDef.productKey, null);
      onChange(catDef.strKey, "");
    } else {
      onChange(catDef.productKey, {
        id:            product.id,
        name:          product.name,
        affiliateLink: product.affiliateLink,
        imageUrl:      product.imageUrl,
        category:      product.category,
        pricePerServing: product.pricePerServing,
        Price:         product.Price,
      });
      onChange(catDef.strKey, product.name);
    }
    setOpen(false);
  }, [catDef, onChange]);

  const pps = selectedProduct?.pricePerServing;
  const priceLabel = pps != null
    ? `$${Number(pps).toFixed(2)} / serving`
    : selectedProduct?.Price != null
      ? `$${Number(selectedProduct.Price).toFixed(2)}`
      : null;

  if (products.length === 0) {
    return (
      <div>
        <Label>{catDef.label}</Label>
        <p className="text-xs py-2" style={{ color: DS.dimText }}>
          No {catDef.label} products in SmartStack yet.
        </p>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <Label>{catDef.label}</Label>

      {/* ── Trigger button ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all rounded-sm"
        style={{
          border:          `1px solid ${open ? DS.brand : selectedProduct ? DS.brand : DS.brandBorder}`,
          backgroundColor: selectedProduct ? DS.brandBg : DS.cardBg,
          boxShadow:       open ? `0 0 0 2px ${DS.brand}18` : "none",
        }}
      >
        {/* Thumbnail - shown when something is selected */}
        {selectedProduct ? (
          <div
            className="shrink-0 overflow-hidden rounded-sm"
            style={{ width: 36, height: 36, backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }}
          >
            {selectedProduct.imageUrl ? (
              <img
                src={selectedProduct.imageUrl}
                alt={selectedProduct.name}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => { e.currentTarget.style.opacity = "0.3"; }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm">💊</div>
            )}
          </div>
        ) : (
          <div
            className="shrink-0 rounded-sm flex items-center justify-center text-sm"
            style={{ width: 36, height: 36, backgroundColor: DS.pageBg, border: `1px solid ${DS.border}` }}
          >
            💊
          </div>
        )}

        {/* Label / selected name */}
        <div className="flex-1 min-w-0">
          {selectedProduct ? (
            <>
              <p className="text-sm font-bold truncate" style={{ color: DS.brand }}>
                {selectedProduct.name}
              </p>
              {priceLabel && (
                <p className="text-xs tabular-nums" style={{ color: DS.labelText }}>
                  {priceLabel}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm" style={{ color: DS.dimText }}>
              - No recommendation -
            </p>
          )}
        </div>

        {/* Chevron */}
        <svg
          viewBox="0 0 24 24"
          className="shrink-0 w-4 h-4 transition-transform duration-150"
          style={{
            color:     DS.dimText,
            transform: open ? "rotate(180deg)" : "none",
          }}
          fill="none" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div
          className="absolute left-0 right-0 z-20 mt-1 overflow-y-auto rounded-sm"
          style={{
            backgroundColor: DS.cardBg,
            border:          `1px solid ${DS.brand}`,
            boxShadow:       "0 8px 24px rgba(0,0,0,0.12)",
            maxHeight:       280,
          }}
        >
          {/* Clear option */}
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
            style={{ borderBottom: `1px solid ${DS.border}` }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DS.pageBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <div
              className="shrink-0 rounded-sm flex items-center justify-center"
              style={{ width: 36, height: 36, backgroundColor: DS.pageBg, border: `1px solid ${DS.border}` }}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: DS.dimText }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-sm" style={{ color: DS.dimText }}>- No recommendation -</p>
          </button>

          {/* Product rows */}
          {products.map((p) => {
            const isSelected = selectedProduct?.id === p.id;
            const pLabel = p.pricePerServing != null
              ? `$${Number(p.pricePerServing).toFixed(2)} / serving`
              : p.Price != null ? `$${Number(p.Price).toFixed(2)}` : null;

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelect(p)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                style={{
                  backgroundColor: isSelected ? DS.brandBg : "transparent",
                  borderBottom:    `1px solid ${DS.border}`,
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = DS.pageBg; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                {/* Product image */}
                <div
                  className="shrink-0 overflow-hidden rounded-sm"
                  style={{ width: 36, height: 36, backgroundColor: DS.pageBg, border: `1px solid ${DS.border}` }}
                >
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => { e.currentTarget.style.opacity = "0.3"; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm">💊</div>
                  )}
                </div>

                {/* Name + price */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-semibold truncate"
                    style={{ color: isSelected ? DS.brand : DS.bodyText }}
                  >
                    {p.name}
                  </p>
                  {pLabel && (
                    <p className="text-xs tabular-nums" style={{ color: DS.dimText }}>
                      {pLabel}
                    </p>
                  )}
                </div>

                {/* Check */}
                {isSelected && (
                  <svg viewBox="0 0 24 24" className="shrink-0 w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ color: DS.brand }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}

                {/* Affiliate link - only when hovering feels cluttered, so always show small */}
                {p.affiliateLink && (
                  <a
                    href={p.affiliateLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs font-bold ml-1"
                    style={{ color: DS.brand }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    ↗
                  </a>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Selected product Amazon CTA - shown below trigger when selected ── */}
      {selectedProduct?.affiliateLink && (
        <div className="mt-2 flex items-center justify-between px-3 py-2 rounded-sm"
          style={{ backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}` }}
        >
          <p className="text-xs" style={{ color: DS.labelText }}>
            Athlete will see this product with your link.
          </p>
          <a
            href={selectedProduct.affiliateLink}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-xs font-black uppercase tracking-wide ml-3"
            style={{ color: DS.brand }}
            onClick={(e) => e.stopPropagation()}
          >
            View on Amazon ↗
          </a>
        </div>
      )}
    </div>
  );
}

/* ── SupplementsTab - products passed from page, no fetch here ───────────── */
function SupplementsTab({ structured, onChange, products }) {

  // Split products into category buckets once
  const grouped = useMemo(() => {
    const out = {};
    for (const cat of SUPP_CATEGORIES) {
      out[cat.productKey] = (products ?? []).filter((p) => cat.match(p.category ?? ""));
    }
    return out;
  }, [products]);

  const anySelected = SUPP_CATEGORIES.some(
    (cat) => structured[cat.productKey] != null
  );

  return (
    <div className="p-5 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-wider" style={{ color: DS.bodyText }}>
          Supplement Recommendations
        </p>
        {anySelected && (
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

      {/* One dropdown row per category - 2-col grid on wider screens */}
      <div className="grid sm:grid-cols-2 gap-5">
        {SUPP_CATEGORIES.map((cat) => (
          <CategoryPicker
            key={cat.productKey}
            catDef={cat}
            products={grouped[cat.productKey] ?? []}
            structured={structured}
            onChange={onChange}
          />
        ))}
      </div>

      {/* Dosing notes - plain textarea, not a SearchSelect */}
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

      {/* NSF reminder */}
      <div
        className="px-3 py-2.5 text-xs"
        style={{ backgroundColor: DS.pageBg, border: `1px solid ${DS.border}`, color: DS.dimText }}
      >
        <span className="font-bold" style={{ color: DS.labelText }}>NSF reminder: </span>
        All SmartStack products are pre-screened against the banned substances database.
        Athletes should still confirm with training staff before use.
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Tab: Notes
══════════════════════════════════════════════════════ */

function NotesTab({ structured, onChange, title, setTitle, OPTIONS, onSave, onSaveNext }) {
  return (
    <div className="p-5 space-y-5">

      {/* Coach freeform notes */}
      <section>
        <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: DS.bodyText }}>
          Coach Notes
        </p>
        <textarea
          className="w-full min-h-[130px] resize-y text-sm px-3 py-2 outline-none rounded-sm leading-relaxed"
          style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: DS.cardBg, color: DS.bodyText }}
          value={structured.freeformNotes ?? ""}
          onChange={(e) => onChange("freeformNotes", e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onSave?.(e); return; }
            if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); onSaveNext?.(e); }
          }}
          placeholder="e.g. lactose sensitive - avoid whey. Increase carbs on heavy practice days. Prioritize sleep and avoid fast food in-season…"
          onFocus={(e) => { e.currentTarget.style.borderColor = DS.brand; }}
          onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; }}
        />
        <p className="text-xs mt-1" style={{ color: DS.dimText }}>
          Shift+Enter for new lines · Enter = Save &amp; Next · Ctrl/Cmd+Enter = Save
        </p>
      </section>

      {/* Plan meta - title, status, effective date */}
      <section style={{ borderTop: `1px solid ${DS.border}`, paddingTop: "1.25rem" }}>
        <p className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: DS.bodyText }}>
          Plan Meta
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
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
              label="Status"
              options={OPTIONS?.metaStatus ?? []}
              value={structured.metaStatus}
              onChange={(v) => onChange("metaStatus", v)}
              onCommit={(v) => onChange("metaStatus", v)}
              allowCustom={false}
              placeholder="Status…"
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
            <p className="text-xs mt-1" style={{ color: DS.dimText }}>Blank = today.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Tab: History
══════════════════════════════════════════════════════ */

function HistoryTab({ hist, selectedAthleteToken, selectedAthleteEmail, selectedAthleteName, onCopyToBuilder }) {
  return (
    <div className="p-3">
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
        onCopyNotesToBuilder={onCopyToBuilder}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Root component
══════════════════════════════════════════════════════ */

export default function PlanBuilderForm({
  // Plan data
  title,
  setTitle,
  structured,
  onChange,
  OPTIONS,
  // Save state
  createLoading,
  selectedAthleteEmail,
  onReset,
  onSave,
  onSaveNext,
  // Athlete object (for name + token display in header)
  selectedAthlete,
  // Templates bundle - see prescriptions.js for shape
  tpl,
  // History bundle - the hist object from usePlanHistory
  hist,
  // SmartStack products - fetched once at page level
  products = [],
}) {
  const [activeTab,     setActiveTab]     = useState("daily");
  const [activePreset,  setActivePreset]  = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);

  const canSave = Boolean(selectedAthleteEmail) && !createLoading;

  /* ── Tab content badges - shows ✓ when a section has data ── */
  const badges = useMemo(() => ({
    daily: Boolean(
      String(structured?.calories     || "").trim() ||
      String(structured?.proteinGrams || "").trim()
    ),
    meals: ["breakfast", "lunch", "afternoon", "dinner"].some((k) => {
      const t = structured?.mealBlocks?.[k]?.targets || {};
      return String(t.calories || "").trim() || String(t.protein || "").trim();
    }),
    supplements: Boolean(
      structured?.proteinRecommendation  ||
      structured?.creatineRecommendation ||
      structured?.bcaaRecommendation     ||
      structured?.proteinProduct         ||
      structured?.creatineProduct        ||
      structured?.bcaaProduct            ||
      structured?.preWorkoutProduct      ||
      structured?.proteinBarProduct
    ),
    notes:   Boolean(String(structured?.freeformNotes || "").trim()),
    history: false,
  }), [structured]);

  function handleTabChange(tab) {
    setActiveTab(tab);
    if (tab === "history" && hist && !hist.historyRequested) {
      hist.searchHistory?.({ reset: true });
    }
  }

  function handleReset() {
    setActivePreset(null);
    onReset?.();
  }

  // When coach hits "Copy to Builder" in history, land them on Notes tab
  function handleCopyFromHistory(p) {
    setTitle(p.title || "Nutrition + Supplements Plan");
    onChange("freeformNotes", p.prescription || "");
    setActiveTab("notes");
  }

  const selectedAthleteToken = String(
    selectedAthlete?.AthleteToken || selectedAthlete?.athleteToken || ""
  ).trim();
  const selectedAthleteName = String(selectedAthlete?.name || "").trim();
  const templateCount       = tpl?.activeTemplates?.length ?? 0;

  return (
    <div
      className="flex flex-col"
      style={{
        border:          `1px solid ${DS.border}`,
        borderTop:       `3px solid ${DS.brand}`,
        backgroundColor: DS.cardBg,
      }}
    >

      {/* ── Header: athlete identity + templates toggle ── */}
      <div style={{ backgroundColor: DS.pageBg }}>
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <AthleteIdentity
            selectedAthlete={selectedAthlete}
            selectedAthleteEmail={selectedAthleteEmail}
          />

          <button
            type="button"
            onClick={() => setShowTemplates((v) => !v)}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-sm transition-all"
            style={{
              border:          `1px solid ${showTemplates ? DS.brand : DS.border}`,
              backgroundColor: showTemplates ? DS.brandBg : DS.cardBg,
              color:           showTemplates ? DS.brand   : DS.labelText,
            }}
            onMouseEnter={(e) => { if (!showTemplates) { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.color = DS.brand; } }}
            onMouseLeave={(e) => { if (!showTemplates) { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.color = DS.labelText; } }}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Templates
            {templateCount > 0 && (
              <span className="tabular-nums" style={{ color: DS.dimText }}>({templateCount})</span>
            )}
            <ChevronDown
              className="h-3 w-3 transition-transform duration-150"
              style={{ transform: showTemplates ? "rotate(180deg)" : "none" }}
            />
          </button>
        </div>

        {showTemplates && <TemplatesDrawer tpl={tpl} />}
      </div>

      {/* ── Tab bar ── */}
      <TabBar activeTab={activeTab} onTabChange={handleTabChange} badges={badges} />

      {/* ── Persistent plan summary - keeps daily targets visible from any tab ── */}
      <PlanSummaryStrip structured={structured} activeTab={activeTab} />

      {/* ── Tab content ── */}
      <div className="flex-1">

        {activeTab === "daily" && (
          <DailyTab
            structured={structured}
            onChange={onChange}
            activePreset={activePreset}
            setActivePreset={setActivePreset}
            onGoToMeals={() => handleTabChange("meals")}
          />
        )}

        {activeTab === "meals" && (
          <MealsTab structured={structured} onChange={onChange} />
        )}

        {activeTab === "supplements" && (
          <SupplementsTab structured={structured} onChange={onChange} products={products} />
        )}

        {activeTab === "notes" && (
          <NotesTab
            structured={structured}
            onChange={onChange}
            title={title}
            setTitle={setTitle}
            OPTIONS={OPTIONS}
            onSave={onSave}
            onSaveNext={onSaveNext}
          />
        )}

        {activeTab === "history" && (
          <HistoryTab
            hist={hist}
            selectedAthleteToken={selectedAthleteToken}
            selectedAthleteEmail={selectedAthleteEmail}
            selectedAthleteName={selectedAthleteName}
            onCopyToBuilder={handleCopyFromHistory}
          />
        )}
      </div>

      {/* ── Sticky action bar - always reachable ── */}
      <div
        className="flex items-center gap-3 px-5 py-3"
        style={{
          backgroundColor: DS.pageBg,
          borderTop:       `1px solid ${DS.border}`,
          boxShadow:       "0 -2px 8px rgba(0,0,0,0.05)",
        }}
      >
        {/* Reset */}
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

        {/* Warning - no athlete selected */}
        {!selectedAthleteEmail && (
          <p className="flex-1 text-center text-xs font-semibold" style={{ color: DS.caution }}>
            Select an athlete to save
          </p>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {/* Save (stay on athlete) */}
          <button
            type="button"
            onClick={(e) => onSave?.(e)}
            disabled={!canSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wide rounded-sm transition-all"
            style={{
              border:          `1px solid ${DS.border}`,
              backgroundColor: canSave ? DS.cardBg  : DS.pageBg,
              color:           canSave ? DS.bodyText : DS.dimText,
              cursor:          canSave ? "pointer"   : "not-allowed",
            }}
            onMouseEnter={(e) => { if (canSave) { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.backgroundColor = DS.brandBg; } }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.backgroundColor = canSave ? DS.cardBg : DS.pageBg; }}
          >
            <Save className="h-3.5 w-3.5" />
            {createLoading ? "Saving…" : "Save"}
          </button>

          {/* Save & Next (advance to next pending athlete) */}
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