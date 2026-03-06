// components/org/prescriptions/GroupBlastPanel.jsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  Zap, CheckSquare, Square, Search, X,
  CheckCircle, AlertTriangle, ExternalLink, RotateCcw,
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

const PRESETS = [
  { label: "Bulk",     cal: 4200, pro: 225, carbs: 480, fat: 110, phase: "Surplus",  desc: "Linemen / heavy skill" },
  { label: "Maintain", cal: 3200, pro: 185, carbs: 360, fat: 95,  phase: "Maintain", desc: "Standard in-season"    },
  { label: "Cut",      cal: 2700, pro: 210, carbs: 270, fat: 75,  phase: "Cut",      desc: "Weight management"     },
  { label: "Skill",    cal: 3600, pro: 195, carbs: 420, fat: 90,  phase: "Maintain", desc: "Speed / skill spots"   },
];

// ─── view states ──────────────────────────────────────────────────────────────
// "configure" → pick preset + athletes
// "confirm"   → review before blasting
// "blasting"  → in progress
// "summary"   → results

function GhostBtn({ onClick, icon: Icon, children, disabled: dis }) {
  return (
    <button
      type="button"
      onClick={dis ? undefined : onClick}
      disabled={dis}
      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-sm transition-all"
      style={{
        border:          `1px solid ${DS.border}`,
        backgroundColor: "transparent",
        color:           dis ? DS.dimText : DS.labelText,
        cursor:          dis ? "not-allowed" : "pointer",
        opacity:         dis ? 0.5 : 1,
      }}
      onMouseEnter={(e) => { if (!dis) { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.color = DS.brand; e.currentTarget.style.backgroundColor = DS.brandBg; } }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.color = dis ? DS.dimText : DS.labelText; e.currentTarget.style.backgroundColor = "transparent"; }}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
      {children}
    </button>
  );
}

function PrimaryBtn({ onClick, children, icon: Icon, disabled: dis, color }) {
  const bg  = dis ? DS.pageBg : (color || DS.brand);
  const bgH = dis ? DS.pageBg : (color || DS.brandLight);
  return (
    <button
      type="button"
      onClick={dis ? undefined : onClick}
      disabled={dis}
      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wide rounded-sm transition-all"
      style={{ backgroundColor: bg, color: dis ? DS.dimText : "#fff", cursor: dis ? "not-allowed" : "pointer" }}
      onMouseEnter={(e) => { if (!dis) e.currentTarget.style.backgroundColor = bgH; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = bg; }}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
      {children}
    </button>
  );
}

// ─── Configure step ───────────────────────────────────────────────────────────

function ConfigureStep({ athletes, onProceed }) {
  const [selectedPreset, setSelectedPreset]   = useState(null);
  const [customPlan,     setCustomPlan]        = useState({ cal: "", pro: "", carbs: "", fat: "", phase: "Maintain", notes: "" });
  const [useCustom,      setUseCustom]         = useState(false);

  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return athletes;
    return athletes.filter((a) =>
      (a.name || "").toLowerCase().includes(q) ||
      (a.email || "").toLowerCase().includes(q) ||
      (a._token || "").toLowerCase().includes(q)
    );
  }, [athletes, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((a) => a._token && selected.has(a._token));

  function toggleAll() {
    const next = new Set(selected);
    if (allFilteredSelected) {
      filtered.forEach((a) => { if (a._token) next.delete(a._token); });
    } else {
      filtered.forEach((a) => { if (a._token) next.add(a._token); });
    }
    setSelected(next);
  }

  function toggleOne(token) {
    const next = new Set(selected);
    next.has(token) ? next.delete(token) : next.add(token);
    setSelected(next);
  }

  const activePlan = useCustom
    ? { cal: Number(customPlan.cal) || 0, pro: Number(customPlan.pro) || 0, carbs: Number(customPlan.carbs) || 0, fat: Number(customPlan.fat) || 0, phase: customPlan.phase, notes: customPlan.notes }
    : selectedPreset
      ? { cal: selectedPreset.cal, pro: selectedPreset.pro, carbs: selectedPreset.carbs, fat: selectedPreset.fat, phase: selectedPreset.phase, notes: "" }
      : null;

  const readyToBlast = activePlan && (activePlan.cal > 0 || activePlan.pro > 0) && selected.size > 0;
  const selectedAthletes = athletes.filter((a) => a._token && selected.has(a._token));

  return (
    <div className="space-y-0" style={{ border: `1px solid ${DS.border}`, borderTop: `3px solid ${DS.brand}`, backgroundColor: DS.cardBg }}>

      {/* ── Preset picker ── */}
      <div className="px-4 pt-4 pb-4" style={{ borderBottom: `1px solid ${DS.border}` }}>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-3.5 w-3.5" style={{ color: DS.brand }} />
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: DS.brand }}>
            Choose a Plan Preset
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PRESETS.map((p) => {
            const active = !useCustom && selectedPreset?.label === p.label;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => { setSelectedPreset(p); setUseCustom(false); }}
                className="text-left p-3 rounded-sm transition-all"
                style={{
                  border:          `1px solid ${active ? DS.brand : DS.brandBorder}`,
                  backgroundColor: active ? DS.brand : DS.brandBg,
                  color:           active ? "#fff"   : DS.bodyText,
                }}
                onMouseEnter={(e) => { if (!active) { e.currentTarget.style.borderColor = DS.brand; } }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = DS.brandBorder; }}
              >
                <p className="font-black text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {p.label}
                </p>
                <p
                  className="font-black tabular-nums"
                  style={{ fontSize: "1.1rem", color: active ? "rgba(255,255,255,0.85)" : DS.brand, fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  {p.cal.toLocaleString()} cal
                </p>
                <p className="text-xs mt-0.5" style={{ color: active ? "rgba(255,255,255,0.55)" : DS.dimText }}>
                  {p.desc}
                </p>
              </button>
            );
          })}
        </div>

        {/* Custom toggle */}
        <button
          type="button"
          onClick={() => { setUseCustom((v) => !v); setSelectedPreset(null); }}
          className="mt-3 text-xs font-bold transition-all"
          style={{ color: useCustom ? DS.brand : DS.dimText }}
        >
          {useCustom ? "▼ Custom targets (editing)" : "▶ Enter custom targets instead"}
        </button>

        {useCustom && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-6 gap-2">
            {[
              { label: "Calories", key: "cal",   placeholder: "e.g. 3500" },
              { label: "Protein g", key: "pro",  placeholder: "e.g. 190"  },
              { label: "Carbs g",   key: "carbs", placeholder: "e.g. 380" },
              { label: "Fat g",     key: "fat",  placeholder: "e.g. 90"   },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <p className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: DS.dimText }}>{label}</p>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={customPlan[key]}
                  onChange={(e) => setCustomPlan((p) => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full text-sm px-2 py-1.5 outline-none rounded-sm tabular-nums"
                  style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: DS.cardBg, color: DS.bodyText }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = DS.brand; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; }}
                />
              </div>
            ))}
            <div>
              <p className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: DS.dimText }}>Phase</p>
              <select
                value={customPlan.phase}
                onChange={(e) => setCustomPlan((p) => ({ ...p, phase: e.target.value }))}
                className="w-full text-sm px-2 py-1.5 outline-none rounded-sm"
                style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: DS.brandBg, color: DS.bodyText }}
              >
                <option value="Surplus">Surplus</option>
                <option value="Maintain">Maintain</option>
                <option value="Cut">Cut</option>
                <option value="Game Week">Game Week</option>
                <option value="Bye Week">Bye Week</option>
              </select>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: DS.dimText }}>Notes</p>
              <input
                type="text"
                value={customPlan.notes}
                onChange={(e) => setCustomPlan((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Optional"
                className="w-full text-sm px-2 py-1.5 outline-none rounded-sm"
                style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: DS.cardBg, color: DS.bodyText }}
                onFocus={(e) => { e.currentTarget.style.borderColor = DS.brand; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Athlete checklist ── */}
      <div style={{ borderBottom: `1px solid ${DS.border}` }}>

        {/* Step header — navy bar, clearly a new section */}
        <div
          className="flex items-center gap-2 px-4 py-2.5"
          style={{ backgroundColor: DS.brand }}
        >
          <CheckSquare className="h-3.5 w-3.5 shrink-0" style={{ color: "rgba(255,255,255,0.65)" }} />
          <p className="text-xs font-black uppercase tracking-wider flex-1" style={{ color: "#fff" }}>
            Step 2 — Select Athletes
          </p>
          {selected.size > 0 && (
            <span
              className="text-xs font-black px-2 py-0.5"
              style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#fff" }}
            >
              {selected.size} selected
            </span>
          )}
        </div>

        {/* Toolbar — select all + filter */}
        <div
          className="flex items-center justify-between gap-3 px-4 py-2"
          style={{ backgroundColor: DS.brandBg, borderBottom: `1px solid ${DS.brandBorder}` }}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleAll}
              className="inline-flex items-center gap-1.5 text-xs font-bold transition-all"
              style={{ color: allFilteredSelected ? DS.brand : DS.labelText }}
              onMouseEnter={(e) => { e.currentTarget.style.color = DS.brand; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = allFilteredSelected ? DS.brand : DS.labelText; }}
            >
              {allFilteredSelected
                ? <CheckSquare className="h-4 w-4" style={{ color: DS.brand }} />
                : <Square      className="h-4 w-4" style={{ color: DS.dimText }} />
              }
              {allFilteredSelected ? "Deselect all" : "Select all"}
            </button>
            <span className="text-xs" style={{ color: DS.dimText }}>
              {filtered.length} athlete{filtered.length !== 1 ? "s" : ""}{search ? " matching" : " total"}
            </span>
          </div>

          {/* Filter */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3" style={{ color: DS.dimText }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter athletes…"
              className="pl-6 pr-6 py-1.5 text-xs outline-none rounded-sm"
              style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: DS.cardBg, color: DS.bodyText, width: 180 }}
              onFocus={(e) => { e.currentTarget.style.borderColor = DS.brand; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; }}
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="h-3 w-3" style={{ color: DS.dimText }} />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-auto" style={{ maxHeight: 280 }}>
          {filtered.map((a) => {
            const checked = Boolean(a._token && selected.has(a._token));
            const noToken = !a._token;
            return (
              <button
                key={a._token || a.email || a.id}
                type="button"
                disabled={noToken}
                onClick={() => a._token && toggleOne(a._token)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                style={{
                  borderBottom: `1px solid ${DS.border}`,
                  backgroundColor: checked ? DS.brandBg : "transparent",
                  opacity: noToken ? 0.4 : 1,
                  cursor: noToken ? "not-allowed" : "pointer",
                }}
                onMouseEnter={(e) => { if (!noToken && !checked) e.currentTarget.style.backgroundColor = DS.pageBg; }}
                onMouseLeave={(e) => { if (!checked) e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                {checked
                  ? <CheckSquare className="h-4 w-4 shrink-0" style={{ color: DS.brand }} />
                  : <Square      className="h-4 w-4 shrink-0" style={{ color: DS.dimText }} />
                }
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-bold" style={{ color: DS.bodyText }}>{a.name || "Athlete"}</span>
                  {a.email && <span className="text-xs ml-2" style={{ color: DS.dimText }}>{a.email}</span>}
                </div>
                {noToken && <span className="text-xs shrink-0" style={{ color: DS.caution }}>No token</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Proceed bar ── */}
      <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ backgroundColor: DS.pageBg }}>
        <div className="text-xs" style={{ color: DS.dimText }}>
          {!activePlan
            ? "Pick a preset above to continue."
            : selected.size === 0
            ? "Select at least one athlete."
            : <span style={{ color: DS.bodyText }}>
                Ready to assign{" "}
                <span className="font-bold">{activePlan.cal.toLocaleString()} cal / {activePlan.pro}g protein</span>
                {" "}({activePlan.phase}) to{" "}
                <span className="font-bold">{selected.size} athlete{selected.size !== 1 ? "s" : ""}</span>.
              </span>
          }
        </div>
        <PrimaryBtn
          onClick={() => onProceed({ plan: activePlan, athletes: selectedAthletes })}
          disabled={!readyToBlast}
          icon={Zap}
        >
          Review & Blast
        </PrimaryBtn>
      </div>
    </div>
  );
}

// ─── Confirm step ─────────────────────────────────────────────────────────────

function ConfirmStep({ plan, athletes, onConfirm, onBack, blasting }) {
  return (
    <div style={{ border: `1px solid ${DS.border}`, borderTop: `3px solid ${DS.caution}`, backgroundColor: DS.cardBg }}>
      <div className="px-4 py-3" style={{ backgroundColor: DS.cautionBg, borderBottom: `1px solid ${DS.cautionBorder}` }}>
        <p className="text-sm font-black uppercase tracking-wide" style={{ color: DS.caution }}>
          Confirm Group Blast
        </p>
        <p className="text-xs mt-0.5" style={{ color: DS.caution }}>
          This will archive each athlete's current active plan and replace it.
        </p>
      </div>

      {/* Plan summary */}
      <div className="px-4 py-3" style={{ borderBottom: `1px solid ${DS.border}` }}>
        <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: DS.labelText }}>Plan being assigned</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { label: "Phase",    value: plan.phase                },
            { label: "Calories", value: `${plan.cal.toLocaleString()} kcal` },
            { label: "Protein",  value: `${plan.pro}g`            },
            { label: "Carbs",    value: `${plan.carbs}g`          },
            { label: "Fat",      value: `${plan.fat}g`            },
          ].map(({ label, value }) => (
            <div key={label} className="p-2.5" style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.pageBg }}>
              <p className="text-xs" style={{ color: DS.dimText }}>{label}</p>
              <p className="text-sm font-black tabular-nums mt-0.5" style={{ color: DS.bodyText }}>{value}</p>
            </div>
          ))}
        </div>
        {plan.notes && (
          <p className="mt-2 text-xs" style={{ color: DS.labelText }}>
            Notes: <span style={{ color: DS.bodyText }}>{plan.notes}</span>
          </p>
        )}
      </div>

      {/* Athlete list */}
      <div className="px-4 py-3" style={{ borderBottom: `1px solid ${DS.border}` }}>
        <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: DS.labelText }}>
          {athletes.length} athlete{athletes.length !== 1 ? "s" : ""} will be updated
        </p>
        <div className="flex flex-wrap gap-1.5">
          {athletes.map((a) => (
            <span
              key={a._token}
              className="text-xs font-bold px-2 py-0.5 rounded-sm"
              style={{ backgroundColor: DS.brandBg, color: DS.brand, border: `1px solid ${DS.brandBorder}` }}
            >
              {a.name || a._token}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 py-3">
        <GhostBtn onClick={onBack} disabled={blasting} icon={RotateCcw}>
          Back
        </GhostBtn>
        <PrimaryBtn onClick={onConfirm} disabled={blasting} icon={Zap} color={DS.caution}>
          {blasting ? "Assigning…" : `Assign to ${athletes.length} athlete${athletes.length !== 1 ? "s" : ""}`}
        </PrimaryBtn>
      </div>
    </div>
  );
}

// ─── Summary step ─────────────────────────────────────────────────────────────

function SummaryStep({ results, athleteMap, plan, onReset }) {
  const router   = useRouter();
  const succeeded = results.filter((r) => r.ok);
  const failed    = results.filter((r) => !r.ok);

  return (
    <div style={{ border: `1px solid ${DS.border}`, borderTop: `3px solid ${DS.safe}`, backgroundColor: DS.cardBg }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ backgroundColor: DS.safeBg, borderBottom: `1px solid ${DS.safeBorder}` }}
      >
        <div>
          <p className="text-sm font-black uppercase tracking-wide" style={{ color: DS.safe }}>
            Blast complete
          </p>
          <p className="text-xs mt-0.5" style={{ color: DS.safe }}>
            {succeeded.length} assigned · {failed.length} failed
          </p>
        </div>
        <GhostBtn onClick={onReset} icon={RotateCcw}>
          New blast
        </GhostBtn>
      </div>

      {/* Assigned plan reminder */}
      <div
        className="px-4 py-2.5 flex flex-wrap gap-3 text-xs"
        style={{ backgroundColor: DS.pageBg, borderBottom: `1px solid ${DS.border}`, color: DS.labelText }}
      >
        <span>Plan assigned:</span>
        <span className="font-bold" style={{ color: DS.bodyText }}>
          {plan.phase} · {plan.cal.toLocaleString()} cal · {plan.pro}g protein · {plan.carbs}g carbs · {plan.fat}g fat
        </span>
      </div>

      {/* Failed */}
      {failed.length > 0 && (
        <div className="px-4 py-3" style={{ borderBottom: `1px solid ${DS.border}` }}>
          <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: DS.banned }}>
            <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />
            Failed ({failed.length})
          </p>
          <div className="space-y-1">
            {failed.map((r) => (
              <div
                key={r.athleteToken}
                className="flex items-center justify-between px-3 py-2"
                style={{ backgroundColor: DS.bannedBg, border: `1px solid ${DS.bannedBorder}` }}
              >
                <span className="text-xs font-bold" style={{ color: DS.bodyText }}>
                  {athleteMap[r.athleteToken]?.name || r.athleteToken}
                </span>
                <span className="text-xs" style={{ color: DS.banned }}>{r.error}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Succeeded — with override links */}
      <div className="px-4 py-3">
        <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: DS.labelText }}>
          Assigned ({succeeded.length}) — click any name to open profile and override
        </p>
        <div className="space-y-1">
          {succeeded.map((r) => {
            const a = athleteMap[r.athleteToken];
            return (
              <div
                key={r.athleteToken}
                className="flex items-center justify-between px-3 py-2 transition-colors"
                style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DS.brandBg; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DS.cardBg; }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle className="h-3.5 w-3.5 shrink-0" style={{ color: DS.safe }} />
                  <span className="text-sm font-bold truncate" style={{ color: DS.bodyText }}>
                    {a?.name || r.athleteToken}
                  </span>
                  {a?.email && (
                    <span className="text-xs hidden sm:inline truncate" style={{ color: DS.dimText }}>
                      {a.email}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => router.push(`/org/nutrition/athlete/${encodeURIComponent(r.athleteToken)}`)}
                  className="inline-flex items-center gap-1 text-xs font-bold shrink-0 ml-2 transition-all"
                  style={{ color: DS.dimText }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = DS.brand; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = DS.dimText; }}
                  title="Open athlete profile to override"
                >
                  Override <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function GroupBlastPanel({ athletes }) {
  const [step,        setStep]        = useState("configure"); // configure | confirm | blasting | summary
  const [blastConfig, setBlastConfig] = useState(null);  // { plan, athletes }
  const [results,     setResults]     = useState([]);

  // Normalize athletes — only those with tokens can be blasted
  const normalizedAthletes = useMemo(() =>
    (Array.isArray(athletes) ? athletes : []).map((a) => ({
      ...a,
      _token: String(a?.athleteToken || a?.AthleteToken || "").trim(),
      name:   String(a?.name || a?.Name || "Athlete").trim(),
      email:  String(a?.email || a?.Email || "").toLowerCase().trim(),
    })),
    [athletes]
  );

  const athleteMap = useMemo(() => {
    const m = {};
    normalizedAthletes.forEach((a) => { if (a._token) m[a._token] = a; });
    return m;
  }, [normalizedAthletes]);

  async function handleBlast() {
    if (!blastConfig) return;
    setStep("blasting");

    const { plan, athletes: selected } = blastConfig;
    const tokens = selected.map((a) => a._token).filter(Boolean);

    try {
      const res  = await fetch("/api/org/nutrition/bulk-assign-plan", {
        method:      "POST",
        headers:     { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          athleteTokens: tokens,
          plan: {
            calories: plan.cal,
            protein:  plan.pro,
            carbs:    plan.carbs,
            fat:      plan.fat,
            phase:    plan.phase,
            notes:    plan.notes || "",
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Blast failed");
      setResults(json.results || []);
      setStep("summary");
    } catch (e) {
      // Fallback: show all as failed
      setResults(tokens.map((t) => ({ athleteToken: t, ok: false, error: e?.message || "Unknown error" })));
      setStep("summary");
    }
  }

  function handleReset() {
    setStep("configure");
    setBlastConfig(null);
    setResults([]);
  }

  return (
    <div>
      {step === "configure" && (
        <ConfigureStep
          athletes={normalizedAthletes}
          onProceed={(config) => {
            setBlastConfig(config);
            setStep("confirm");
          }}
        />
      )}

      {(step === "confirm" || step === "blasting") && blastConfig && (
        <ConfirmStep
          plan={blastConfig.plan}
          athletes={blastConfig.athletes}
          blasting={step === "blasting"}
          onBack={() => setStep("configure")}
          onConfirm={handleBlast}
        />
      )}

      {step === "summary" && (
        <SummaryStep
          results={results}
          athleteMap={athleteMap}
          plan={blastConfig?.plan}
          onReset={handleReset}
        />
      )}
    </div>
  );
}