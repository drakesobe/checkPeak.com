// components/org/nutrition/page/OrgNutritionQueuePage.jsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import { useNutritionQueue } from "@/hooks/org/useNutritionQueue";
import {
  Search, X, ChevronDown, ChevronUp,
  ExternalLink, Bell, ClipboardList, RefreshCw,
  AlertTriangle, CheckCircle, Zap,
} from "lucide-react";

import NutritionHeader from "@/components/org/nutrition/NutritionHeader";
import { normalizeRole, isOrgSideRole, isLikelyOrgToken } from "@/lib/org/nutrition/pageUtils";

// ─── Design tokens ────────────────────────────────────────────────────────────
const DS = {
  brand:         "#1E3A5F",
  brandLight:    "#2A4F7C",
  brandBg:       "#EEF3F9",
  brandBorder:   "#C0D0E0",
  banned:        "#C8102E",
  bannedBg:      "#FFF0F0",
  bannedBorder:  "#FFC8C8",
  caution:       "#B86000",
  cautionBg:     "#FFFBF0",
  cautionBorder: "#FFD580",
  safe:          "#00873E",
  safeBg:        "#F0FBF4",
  safeBorder:    "#A8DFB8",
  border:        "#E8ECF0",
  pageBg:        "#F4F7FB",
  cardBg:        "#FFFFFF",
  bodyText:      "#1A2535",
  labelText:     "#5A6A7D",
  dimText:       "#9BA8B4",
};

// ─── D2 football plan presets ─────────────────────────────────────────────────
// Realistic targets for college football. Protein stays high even in cut.
const PLAN_PRESETS = [
  { label: "Bulk",     calories: 4200, protein: 225, carbs: 480, fat: 110, phase: "Surplus",  desc: "Linemen, heavy skill"   },
  { label: "Maintain", calories: 3200, protein: 185, carbs: 360, fat: 95,  phase: "Maintain", desc: "Standard in-season"     },
  { label: "Cut",      calories: 2700, protein: 210, carbs: 270, fat: 75,  phase: "Cut",      desc: "Weight management"      },
  { label: "Skill",    calories: 3600, protein: 195, carbs: 420, fat: 90,  phase: "Maintain", desc: "Speed/skill positions"  },
];

// ─── Grouping logic ───────────────────────────────────────────────────────────
function getSubGroup(row) {
  if (!row?.hasPlan)         return "noPlan";
  if (row?.missingCheckin)   return "noCheckin";
  if (row?.lowAdherence)     return "lowAdherence";
  return "onTrack";
}

function assignGroup(row) {
  const sg = getSubGroup(row);
  if (sg === "noPlan" || sg === "noCheckin") return "act";
  if (sg === "lowAdherence")                  return "followup";
  return "good";
}

function applyFilters(rows, { search, sport, team }) {
  let out = Array.isArray(rows) ? rows : [];
  const q = String(search || "").trim().toLowerCase();
  if (q) {
    out = out.filter((r) => {
      // Cover both field name conventions: athleteName (queue.js) and name (table.js)
      const name     = String(r?.athleteName || r?.name || "").toLowerCase();
      const email    = String(r?.athleteEmail || r?.email || "").toLowerCase();
      const token    = String(r?.athleteToken || "").toLowerCase();
      const team     = String(r?.team || "").toLowerCase();
      const sport    = String(r?.sport || "").toLowerCase();
      const position = String(r?.position || r?.pos || "").toLowerCase();
      return name.includes(q) || email.includes(q) || token.includes(q)
          || team.includes(q) || sport.includes(q) || position.includes(q);
    });
  }
  if (sport && sport !== "all") out = out.filter((r) => String(r.sport || "") === sport);
  if (team  && team  !== "all") out = out.filter((r) => String(r.team  || "") === team);
  return out;
}

function groupRows(rows) {
  const out = { act: [], followup: [], good: [] };
  for (const r of rows) out[assignGroup(r)].push(r);
  return out;
}

function avgAdherence(rows) {
  const valid = rows.map((r) => Number(r.adherenceAvg)).filter((n) => Number.isFinite(n) && n > 0);
  if (!valid.length) return null;
  return Math.round(valid.reduce((s, n) => s + n, 0) / valid.length);
}

// ─── Shared input primitives ──────────────────────────────────────────────────
function DSInput({ type = "text", value, onChange, placeholder, min, step }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      min={min}
      step={step}
      className="w-full text-sm px-3 py-2 outline-none rounded-sm"
      style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: DS.cardBg, color: DS.bodyText }}
      onFocus={(e) => { e.currentTarget.style.borderColor = DS.brand; e.currentTarget.style.boxShadow = `0 0 0 2px ${DS.brand}18`; }}
      onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.boxShadow = "none"; }}
    />
  );
}

function DSSelect({ value, onChange, disabled, children }) {
  return (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      className="text-sm px-3 py-2 outline-none transition-all rounded-sm w-full"
      style={{
        border: `1px solid ${DS.brandBorder}`,
        backgroundColor: disabled ? DS.pageBg : DS.brandBg,
        color: disabled ? DS.dimText : DS.bodyText,
      }}
      onFocus={(e) => { if (!disabled) e.currentTarget.style.borderColor = DS.brand; }}
      onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; }}
    >
      {children}
    </select>
  );
}

// ─── Inline plan assignment panel ─────────────────────────────────────────────
function AssignPlanPanel({ row, onClose, onSaved }) {
  const [calories, setCalories] = useState("");
  const [protein,  setProtein]  = useState("");
  const [carbs,    setCarbs]    = useState("");
  const [fat,      setFat]      = useState("");
  const [phase,    setPhase]    = useState("Maintain");
  const [notes,    setNotes]    = useState("");
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState("");
  const [preset,   setPreset]   = useState(null);

  function applyPreset(p) {
    setPreset(p.label);
    setCalories(String(p.calories));
    setProtein(String(p.protein));
    setCarbs(String(p.carbs));
    setFat(String(p.fat));
    setPhase(p.phase);
  }

  async function handleSave() {
    if (!calories || !protein) { setErr("Calories and protein are required."); return; }
    setSaving(true);
    setErr("");
    try {
      const res = await fetch("/api/org/nutrition/assign-plan", {
        method:      "POST",
        headers:     { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          athleteToken: row.athleteToken,
          plan: {
            calories: Number(calories),
            protein:  Number(protein),
            carbs:    Number(carbs)  || 0,
            fat:      Number(fat)    || 0,
            phase,
            notes,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to save plan.");
      onSaved?.();
    } catch (e) {
      setErr(e?.message || "Failed to save plan.");
      setSaving(false);
    }
  }

  return (
    <div style={{ backgroundColor: DS.brandBg, borderTop: `2px solid ${DS.brand}` }}>

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: `1px solid ${DS.brandBorder}` }}
      >
        <div>
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: DS.brand }}>
            Assign Nutrition Plan
          </p>
          <p className="text-xs" style={{ color: DS.labelText }}>
            {row.athleteName || row.name || "Athlete"}{row.position || row.pos ? ` · ${row.position || row.pos}` : ""}
          </p>
        </div>
        <button type="button" onClick={onClose} style={{ color: DS.dimText }}>
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Quick presets */}
      <div className="px-4 pt-3 pb-2">
        <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: DS.labelText }}>
          Quick Fill
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PLAN_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p)}
              className="text-xs font-bold px-3 py-1.5 rounded-sm transition-all"
              style={{
                backgroundColor: preset === p.label ? DS.brand    : DS.cardBg,
                color:           preset === p.label ? "#fff"      : DS.bodyText,
                border:          `1px solid ${preset === p.label ? DS.brand : DS.brandBorder}`,
              }}
              title={p.desc}
            >
              {p.label}
              <span
                className="ml-1.5 font-normal"
                style={{ color: preset === p.label ? "rgba(255,255,255,0.65)" : DS.dimText }}
              >
                {p.calories} cal
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Fields */}
      <div className="px-4 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Calories / day *", value: calories, set: setCalories, placeholder: "e.g. 3200" },
          { label: "Protein (g) *",    value: protein,  set: setProtein,  placeholder: "e.g. 185"  },
          { label: "Carbs (g)",        value: carbs,    set: setCarbs,    placeholder: "e.g. 360"  },
          { label: "Fat (g)",          value: fat,      set: setFat,      placeholder: "e.g. 95"   },
        ].map(({ label, value, set, placeholder }) => (
          <div key={label}>
            <label className="block text-xs font-black uppercase tracking-wider mb-1" style={{ color: DS.labelText }}>
              {label}
            </label>
            <DSInput
              type="number"
              value={value}
              onChange={(e) => { set(e.target.value); setPreset(null); }}
              placeholder={placeholder}
              min="0"
              step="1"
            />
          </div>
        ))}

        <div>
          <label className="block text-xs font-black uppercase tracking-wider mb-1" style={{ color: DS.labelText }}>
            Phase
          </label>
          <DSSelect value={phase} onChange={(e) => setPhase(e.target.value)}>
            <option value="Surplus">Surplus</option>
            <option value="Maintain">Maintain</option>
            <option value="Cut">Cut</option>
            <option value="Game Week">Game Week</option>
            <option value="Bye Week">Bye Week</option>
          </DSSelect>
        </div>

        <div className="sm:col-span-3">
          <label className="block text-xs font-black uppercase tracking-wider mb-1" style={{ color: DS.labelText }}>
            Notes
          </label>
          <DSInput
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional — e.g. pre-game adjustments"
          />
        </div>
      </div>

      {err && (
        <div
          className="mx-4 mb-3 px-3 py-2 text-xs rounded-sm"
          style={{ backgroundColor: DS.bannedBg, borderLeft: `3px solid ${DS.banned}`, color: "#7A1A1A" }}
        >
          {err}
        </div>
      )}

      <div className="px-4 pb-4 flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wide rounded-sm"
          style={{ backgroundColor: saving ? DS.labelText : DS.brand, color: "#fff", cursor: saving ? "not-allowed" : "pointer" }}
        >
          <ClipboardList className="h-3.5 w-3.5" />
          {saving ? "Saving…" : "Save Plan"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-bold uppercase tracking-wide rounded-sm"
          style={{ backgroundColor: DS.cardBg, color: DS.labelText, border: `1px solid ${DS.border}` }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Secondary ghost button — labeled, always subordinate to primary CTA ─────
function SecBtn({ icon: Icon, label, onClick, disabled: dis }) {
  return (
    <button
      type="button"
      onClick={dis ? undefined : onClick}
      disabled={dis}
      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-sm whitespace-nowrap transition-all"
      style={{
        color:           dis ? DS.dimText : DS.labelText,
        border:          `1px solid ${DS.border}`,
        backgroundColor: "transparent",
        cursor:          dis ? "not-allowed" : "pointer",
        opacity:         dis ? 0.45 : 1,
      }}
      onMouseEnter={(e) => {
        if (!dis) {
          e.currentTarget.style.borderColor = DS.brandBorder;
          e.currentTarget.style.color = DS.brand;
          e.currentTarget.style.backgroundColor = DS.brandBg;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = DS.border;
        e.currentTarget.style.color = DS.labelText;
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span>{label}</span>
    </button>
  );
}

// ─── Single athlete row ───────────────────────────────────────────────────────
function AthleteRow({ row, onOpenAthlete, onPlanSaved }) {
  const [assignOpen,   setAssignOpen]   = useState(false);
  const [reminding,    setReminding]    = useState(false);
  const [doneState,    setDoneState]    = useState(null); // null | "plan" | "remind"

  const athleteName  = row?.athleteName || row?.name  || "Athlete";
  const athleteTeam  = row?.team        || "";
  const athletePos   = row?.position    || row?.pos   || "";
  const subGroup = getSubGroup(row);
  const hasToken = Boolean(String(row?.athleteToken || "").trim());

  const adherence = row.adherenceAvg != null
    ? Math.max(0, Math.min(100, Math.round(Number(row.adherenceAvg))))
    : null;

  const adherenceColor =
    adherence == null ? DS.dimText
    : adherence >= 80 ? DS.safe
    : adherence >= 65 ? DS.caution
    : DS.banned;

  const situationLabel =
    subGroup === "noPlan"         ? "No plan assigned"
    : subGroup === "noCheckin"    ? "No check-in this week"
    : subGroup === "lowAdherence" ? "Low adherence"
    : "On track";

  const situationColor =
    subGroup === "noPlan"         ? DS.banned
    : subGroup === "noCheckin"    ? DS.caution
    : subGroup === "lowAdherence" ? DS.caution
    : DS.safe;

  async function sendReminder() {
    if (reminding || !hasToken) return;
    setReminding(true);
    try {
      const res  = await fetch("/api/org/nutrition/send-reminder", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ athleteToken: row.athleteToken }),
      });
      const json = await res.json().catch(() => ({}));
      if (json?.mailto) window.open(json.mailto, "_blank");
      setDoneState("remind");
    } catch { /* non-fatal */ }
    finally { setReminding(false); }
  }

  function handlePlanSaved() {
    setAssignOpen(false);
    setDoneState("plan");
    setTimeout(() => onPlanSaved?.(), 1800);
  }

  // Confirmed success state — shows briefly then list refreshes
  if (doneState) {
    return (
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ backgroundColor: DS.safeBg, borderBottom: `1px solid ${DS.border}`, opacity: 0.8 }}
      >
        <CheckCircle className="h-4 w-4 shrink-0" style={{ color: DS.safe }} />
        <span className="text-sm font-bold" style={{ color: DS.bodyText }}>
          {athleteName}
        </span>
        <span className="text-xs" style={{ color: DS.safe }}>
          {doneState === "plan" ? "Plan assigned ✓" : "Reminder sent ✓"}
        </span>
      </div>
    );
  }

  return (
    <div style={{ borderBottom: `1px solid ${DS.border}`, backgroundColor: DS.cardBg }}>
      <div className="flex items-center gap-3 px-4 py-3.5">

        {/* Situation color bar */}
        <div
          className="shrink-0 self-stretch rounded-full"
          style={{ width: 3, backgroundColor: situationColor, minHeight: 40 }}
        />

        {/* Identity */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-bold text-sm" style={{ color: DS.bodyText }}>
              {athleteName}
            </span>
            {athletePos && (
              <span className="text-xs hidden sm:inline" style={{ color: DS.dimText }}>
                {athletePos}
              </span>
            )}
            {athleteTeam && (
              <span
                className="text-xs font-bold px-1.5 py-0.5 rounded-sm hidden sm:inline"
                style={{ backgroundColor: DS.brandBg, color: DS.brand, border: `1px solid ${DS.brandBorder}` }}
              >
                {athleteTeam}
              </span>
            )}
          </div>

          <div className="flex items-center flex-wrap gap-x-2 mt-0.5">
            <span className="text-xs font-bold" style={{ color: situationColor }}>
              {situationLabel}
            </span>
            {adherence != null && (
              <span className="text-xs" style={{ color: DS.dimText }}>
                ·{" "}
                <span className="font-bold tabular-nums" style={{ color: adherenceColor }}>
                  {adherence}%
                </span>{" "}
                adherence
              </span>
            )}
          </div>
        </div>

        {/* ── Actions ──────────────────────────────────────────────────────────
            Layout: [Primary CTA]  |  [Secondary]  [Secondary]
            Primary = one bold labeled button matching the situation.
            Secondary = small labeled ghost buttons for the other available actions.
            Divider makes the hierarchy obvious at a glance.
        ──────────────────────────────────────────────────────────────────── */}
        <div
          className="shrink-0 flex items-center gap-3"
          onClick={(e) => e.stopPropagation()}
        >

          {/* ── Primary CTA ── */}
          {subGroup === "noPlan" && (
            <button
              type="button"
              onClick={() => hasToken && setAssignOpen((v) => !v)}
              disabled={!hasToken}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-black uppercase tracking-wide rounded-sm whitespace-nowrap transition-all"
              style={{
                backgroundColor: assignOpen ? DS.brandLight : DS.brand,
                color: "#fff",
                opacity: hasToken ? 1 : 0.4,
                minWidth: 110,
                justifyContent: "center",
              }}
              onMouseEnter={(e) => { if (hasToken) e.currentTarget.style.backgroundColor = DS.brandLight; }}
              onMouseLeave={(e) => { if (!assignOpen) e.currentTarget.style.backgroundColor = DS.brand; }}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              {assignOpen ? "Close Form" : "Assign Plan"}
            </button>
          )}

          {subGroup === "noCheckin" && (
            <button
              type="button"
              onClick={sendReminder}
              disabled={!hasToken || reminding}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-black uppercase tracking-wide rounded-sm whitespace-nowrap transition-all"
              style={{
                backgroundColor: DS.caution,
                color: "#fff",
                opacity: hasToken && !reminding ? 1 : 0.4,
                minWidth: 130,
                justifyContent: "center",
              }}
              onMouseEnter={(e) => { if (hasToken) e.currentTarget.style.filter = "brightness(1.08)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
            >
              <Bell className="h-3.5 w-3.5" />
              {reminding ? "Sending…" : "Send Reminder"}
            </button>
          )}

          {(subGroup === "lowAdherence" || subGroup === "onTrack") && (
            <button
              type="button"
              onClick={() => typeof onOpenAthlete === "function" && onOpenAthlete(row)}
              disabled={!hasToken}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-black uppercase tracking-wide rounded-sm whitespace-nowrap transition-all"
              style={{
                backgroundColor: subGroup === "lowAdherence" ? DS.cautionBg : DS.safeBg,
                color:           subGroup === "lowAdherence" ? DS.caution   : DS.safe,
                border:          `1px solid ${subGroup === "lowAdherence" ? DS.cautionBorder : DS.safeBorder}`,
                opacity: hasToken ? 1 : 0.4,
                minWidth: 110,
                justifyContent: "center",
              }}
              onMouseEnter={(e) => { if (hasToken) e.currentTarget.style.filter = "brightness(0.94)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View Profile
            </button>
          )}

          {/* ── Divider ── */}
          <div className="shrink-0" style={{ width: 1, height: 28, backgroundColor: DS.border }} />

          {/* ── Secondary actions — labeled ghost buttons ──
              These are always visible so the coach knows they exist.
              Labels are short but unambiguous: Edit Plan / Remind / Profile.
          ── */}
          <div className="flex items-center gap-1.5">
            {subGroup !== "noPlan" && (
              <SecBtn
                icon={ClipboardList}
                label="Edit Plan"
                disabled={!hasToken}
                onClick={() => setAssignOpen((v) => !v)}
              />
            )}
            {subGroup !== "noCheckin" && (
              <SecBtn
                icon={Bell}
                label="Remind"
                disabled={!hasToken || reminding}
                onClick={sendReminder}
              />
            )}
            {(subGroup === "noPlan" || subGroup === "noCheckin") && (
              <SecBtn
                icon={ExternalLink}
                label="Profile"
                disabled={!hasToken}
                onClick={() => typeof onOpenAthlete === "function" && onOpenAthlete(row)}
              />
            )}
          </div>
        </div>
      </div>

      {assignOpen && hasToken && (
        <AssignPlanPanel
          row={row}
          onClose={() => setAssignOpen(false)}
          onSaved={handlePlanSaved}
        />
      )}
    </div>
  );
}

// ─── Act Now section ──────────────────────────────────────────────────────────
// The most important structural decision: split "No Plan" from "Not Checked In".
// These require different immediate actions — mixing them makes the coach read every row.
function ActNowSection({ rows, onOpenAthlete, onPlanSaved, sectionRef }) {
  const [open, setOpen] = useState(true);

  const noPlan    = useMemo(() =>
    rows.filter((r) => !r.hasPlan)
        .sort((a, b) => (a.athleteName || a.name || "").localeCompare(b.athleteName || b.name || "")),
    [rows]);

  const noCheckin = useMemo(() =>
    rows.filter((r) => r.hasPlan && r.missingCheckin)
        .sort((a, b) => (a.athleteName || a.name || "").localeCompare(b.athleteName || b.name || "")),
    [rows]);

  if (!rows.length) return null;

  return (
    <div ref={sectionRef} style={{ border: `1px solid ${DS.bannedBorder}`, borderTop: `3px solid ${DS.banned}` }}>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors"
        style={{ backgroundColor: open ? DS.bannedBg : DS.cardBg }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DS.bannedBg; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = open ? DS.bannedBg : DS.cardBg; }}
      >
        <div className="flex items-center gap-3">
          <span
            className="font-black tabular-nums leading-none"
            style={{ fontSize: "2rem", color: DS.banned, fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            {rows.length}
          </span>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black uppercase tracking-wide" style={{ color: DS.banned }}>
                Act Now
              </span>
              <span
                className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-sm"
                style={{ backgroundColor: DS.banned, color: "#fff" }}
              >
                <Zap className="h-3 w-3" />
                Priority
              </span>
            </div>
            <div className="text-xs mt-0.5" style={{ color: DS.dimText }}>
              {noPlan.length > 0    && `${noPlan.length} need a plan`}
              {noPlan.length > 0 && noCheckin.length > 0 && " · "}
              {noCheckin.length > 0 && `${noCheckin.length} haven't checked in`}
            </div>
          </div>
        </div>
        {open
          ? <ChevronUp   className="h-4 w-4 shrink-0" style={{ color: DS.dimText }} />
          : <ChevronDown className="h-4 w-4 shrink-0" style={{ color: DS.dimText }} />
        }
      </button>

      {open && (
        <div style={{ borderTop: `1px solid ${DS.bannedBorder}` }}>

          {/* Sub-group: No Plan */}
          {noPlan.length > 0 && (
            <>
              <div
                className="flex items-center gap-2.5 px-4 py-2"
                style={{ backgroundColor: "#FFF5F5", borderBottom: `1px solid ${DS.bannedBorder}` }}
              >
                <span
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-black shrink-0"
                  style={{ backgroundColor: DS.banned, color: "#fff" }}
                >
                  {noPlan.length}
                </span>
                <div>
                  <span className="text-xs font-black uppercase tracking-wide" style={{ color: DS.banned }}>
                    No Plan Assigned
                  </span>
                  <span className="text-xs ml-2" style={{ color: DS.dimText }}>
                    Athletes can't check in without a plan — assign first
                  </span>
                </div>
              </div>
              {noPlan.map((row, i) => (
                <AthleteRow
                  key={row.athleteToken || row.id || `np-${i}`}
                  row={row}
                  onOpenAthlete={onOpenAthlete}
                  onPlanSaved={onPlanSaved}
                />
              ))}
            </>
          )}

          {/* Sub-group: Not Checked In */}
          {noCheckin.length > 0 && (
            <>
              <div
                className="flex items-center gap-2.5 px-4 py-2"
                style={{
                  backgroundColor: "#FFFBF0",
                  borderTop:    noPlan.length > 0 ? `2px solid ${DS.border}` : "none",
                  borderBottom: `1px solid ${DS.cautionBorder}`,
                }}
              >
                <span
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-black shrink-0"
                  style={{ backgroundColor: DS.caution, color: "#fff" }}
                >
                  {noCheckin.length}
                </span>
                <div>
                  <span className="text-xs font-black uppercase tracking-wide" style={{ color: DS.caution }}>
                    Not Checked In
                  </span>
                  <span className="text-xs ml-2" style={{ color: DS.dimText }}>
                    Has a plan — just needs a reminder to log this week
                  </span>
                </div>
              </div>
              {noCheckin.map((row, i) => (
                <AthleteRow
                  key={row.athleteToken || row.id || `nc-${i}`}
                  row={row}
                  onOpenAthlete={onOpenAthlete}
                  onPlanSaved={onPlanSaved}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Follow Up section ────────────────────────────────────────────────────────
// Sorted by lowest adherence first — worst cases at the top.
function FollowUpSection({ rows, onOpenAthlete, onPlanSaved, defaultOpen, sectionRef }) {
  const [open, setOpen] = useState(defaultOpen);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => Number(a.adherenceAvg || 0) - Number(b.adherenceAvg || 0)),
    [rows]
  );

  const avg = avgAdherence(rows);

  if (!rows.length) return null;

  return (
    <div ref={sectionRef} style={{ border: `1px solid ${DS.cautionBorder}`, borderTop: `3px solid ${DS.caution}` }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors"
        style={{ backgroundColor: open ? DS.cautionBg : DS.cardBg }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DS.cautionBg; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = open ? DS.cautionBg : DS.cardBg; }}
      >
        <div className="flex items-center gap-3">
          <span
            className="font-black tabular-nums leading-none"
            style={{ fontSize: "2rem", color: DS.caution, fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            {rows.length}
          </span>
          <div className="text-left">
            <span className="text-sm font-black uppercase tracking-wide" style={{ color: DS.caution }}>
              Follow Up
            </span>
            <div className="text-xs mt-0.5" style={{ color: DS.dimText }}>
              Has a plan but adherence is low
              {avg != null && ` · avg ${avg}% this week`}
            </div>
          </div>
        </div>
        {open
          ? <ChevronUp   className="h-4 w-4 shrink-0" style={{ color: DS.dimText }} />
          : <ChevronDown className="h-4 w-4 shrink-0" style={{ color: DS.dimText }} />
        }
      </button>

      {open && (
        <div style={{ borderTop: `1px solid ${DS.cautionBorder}` }}>
          <div
            className="px-4 py-2 text-xs"
            style={{ backgroundColor: "#FFFBF0", borderBottom: `1px solid ${DS.cautionBorder}`, color: DS.labelText }}
          >
            Sorted by lowest adherence first. Open an athlete's detail page to adjust targets, leave a note, or reassign their plan.
          </div>
          {sorted.map((row, i) => (
            <AthleteRow
              key={row.athleteToken || row.id || i}
              row={row}
              onOpenAthlete={onOpenAthlete}
              onPlanSaved={onPlanSaved}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── On Track section ─────────────────────────────────────────────────────────
// Always starts collapsed. Shows avg adherence in the header — no need to expand
// unless you want to find a specific name.
function OnTrackSection({ rows, onOpenAthlete, sectionRef }) {
  const [open, setOpen] = useState(false);

  const avg    = avgAdherence(rows);
  const sorted = useMemo(
    () => [...rows].sort((a, b) => (a.athleteName || a.name || "").localeCompare(b.athleteName || b.name || "")),
    [rows]
  );

  if (!rows.length) return null;

  return (
    <div ref={sectionRef} style={{ border: `1px solid ${DS.safeBorder}`, borderTop: `3px solid ${DS.safe}` }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors"
        style={{ backgroundColor: open ? DS.safeBg : DS.cardBg }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DS.safeBg; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = open ? DS.safeBg : DS.cardBg; }}
      >
        <div className="flex items-center gap-3">
          <span
            className="font-black tabular-nums leading-none"
            style={{ fontSize: "2rem", color: DS.safe, fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            {rows.length}
          </span>
          <div className="text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-black uppercase tracking-wide" style={{ color: DS.safe }}>
                On Track
              </span>
              {avg != null && (
                <span
                  className="text-xs font-black px-2 py-0.5 rounded-sm"
                  style={{ backgroundColor: DS.safeBg, color: DS.safe, border: `1px solid ${DS.safeBorder}` }}
                >
                  avg {avg}% adherence
                </span>
              )}
            </div>
            <div className="text-xs mt-0.5" style={{ color: DS.dimText }}>
              Plan + check-in complete · {open ? "collapse" : "expand to view names"}
            </div>
          </div>
        </div>
        {open
          ? <ChevronUp   className="h-4 w-4 shrink-0" style={{ color: DS.dimText }} />
          : <ChevronDown className="h-4 w-4 shrink-0" style={{ color: DS.dimText }} />
        }
      </button>

      {open && (
        <div style={{ borderTop: `1px solid ${DS.safeBorder}` }}>
          {sorted.map((row, i) => (
            <AthleteRow
              key={row.athleteToken || row.id || i}
              row={row}
              onOpenAthlete={onOpenAthlete}
              onPlanSaved={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Weekly progress bar ──────────────────────────────────────────────────────
// Proportional bar + tap-to-scroll. Replaces old snapshot chips.
function WeekProgressBar({ groups, total, onJump }) {
  if (!total) return null;

  const actCount      = groups.act.length;
  const followupCount = groups.followup.length;
  const goodCount     = groups.good.length;

  const actPct      = Math.round((actCount      / total) * 100);
  const followupPct = Math.round((followupCount / total) * 100);
  const goodPct     = 100 - actPct - followupPct;
  const onTrackPct  = Math.round((goodCount / total) * 100);

  const segments = [
    { key: "act",      pct: actPct,      color: DS.banned,  label: `${actCount} Act Now`        },
    { key: "followup", pct: followupPct, color: DS.caution, label: `${followupCount} Follow Up` },
    { key: "good",     pct: goodPct,     color: DS.safe,    label: `${goodCount} On Track`      },
  ].filter((s) => s.pct > 0);

  return (
    <div
      className="px-4 py-3"
      style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }}
    >
      <div className="flex items-baseline justify-between mb-2">
        <div>
          {actCount > 0 ? (
            <span className="text-sm font-black" style={{ color: DS.banned }}>
              {actCount} athlete{actCount !== 1 ? "s" : ""} need action
            </span>
          ) : (
            <span className="text-sm font-black" style={{ color: DS.safe }}>
              All athletes accounted for this week
            </span>
          )}
          {followupCount > 0 && (
            <span className="text-sm ml-2" style={{ color: DS.labelText }}>
              · {followupCount} to follow up
            </span>
          )}
        </div>
        <span
          className="text-xs font-black tabular-nums"
          style={{ color: onTrackPct >= 80 ? DS.safe : onTrackPct >= 50 ? DS.caution : DS.banned }}
        >
          {onTrackPct}% on track
        </span>
      </div>

      {/* Proportional bar — tap to jump */}
      <div className="flex h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: DS.border, gap: 2 }}>
        {segments.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => onJump(s.key)}
            title={`Jump to ${s.label}`}
            className="h-full transition-all"
            style={{
              width: `${s.pct}%`,
              backgroundColor: s.color,
              minWidth: s.pct > 0 ? 6 : 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.15)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-2">
        {segments.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => onJump(s.key)}
            className="inline-flex items-center gap-1.5 text-xs transition-all"
            style={{ color: DS.labelText }}
            onMouseEnter={(e) => { e.currentTarget.style.color = s.color; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = DS.labelText; }}
          >
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: s.color }} />
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Nav bar ──────────────────────────────────────────────────────────────────
function NavBar({ weekLabel, loading, onRefresh, onGoDashboard, onGoPlans }) {
  const dayCtx = useMemo(() => {
    const day      = new Date().getDay();
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const daysLeft = day === 0 ? 0 : 7 - day;
    return daysLeft <= 1
      ? { text: `${dayNames[day]} · last chance this week`, color: "#FFB3B3" }
      : daysLeft <= 3
      ? { text: `${dayNames[day]} · ${daysLeft} days left in week`, color: "#FFD580" }
      : { text: dayNames[day], color: "rgba(255,255,255,0.4)" };
  }, []);

  return (
    <div
      className="flex items-center justify-between px-4 py-2.5 gap-4"
      style={{ backgroundColor: DS.brand }}
    >
      <div className="flex items-center gap-3 min-w-0 overflow-hidden">
        <span className="font-black uppercase tracking-wider text-xs shrink-0" style={{ color: "rgba(255,255,255,0.55)" }}>
          Nutrition Queue
        </span>
        {weekLabel && (
          <span className="text-xs truncate" style={{ color: "rgba(255,255,255,0.3)" }}>
            {weekLabel}
          </span>
        )}
        <span className="text-xs font-bold shrink-0" style={{ color: dayCtx.color }}>
          {dayCtx.text}
        </span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {[
          { label: "Dashboard", onClick: onGoDashboard },
          { label: "Plans",     onClick: onGoPlans     },
        ].map(({ label, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className="text-xs font-bold px-2.5 py-1.5 rounded-sm transition-all"
            style={{ color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.35)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-sm transition-all"
          style={{
            backgroundColor: loading ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.12)",
            color: loading ? "rgba(255,255,255,0.3)" : "#fff",
          }}
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">{loading ? "Loading…" : "Refresh"}</span>
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function OrgNutritionQueuePage() {
  const router = useRouter();
  const { user, authReady } = useAuthContext();

  const role      = useMemo(() => normalizeRole(user), [user]);
  const isOrgSide = useMemo(() => isOrgSideRole(role), [role]);

  useEffect(() => {
    if (!authReady) return;
    if (!user) return;
    if (!isOrgSide) router.push("/dashboard");
  }, [authReady, user, isOrgSide, router]);

  const { loading, error, rows, counts, meta, lastUpdatedLabel, refresh } = useNutritionQueue({
    // Wait for auth to fully resolve before enabling — prevents the race where
    // user populates before the session is confirmed, causing a 401 on first fetch.
    enabled: Boolean(authReady && user && isOrgSide),
  });

  const [search, setSearch] = useState("");
  const [sport,  setSport]  = useState("all");
  const [team,   setTeam]   = useState("all");

  const sports = Array.isArray(meta?.sports) ? meta.sports : [];
  const teams  = Array.isArray(meta?.teams)  ? meta.teams  : [];

  const filtered = useMemo(
    () => applyFilters(rows, { search, sport, team }),
    [rows, search, sport, team]
  );

  const groups = useMemo(() => groupRows(filtered), [filtered]);

  // Refs for scroll-to from progress bar
  const actRef      = useRef(null);
  const followupRef = useRef(null);
  const goodRef     = useRef(null);

  function jumpToSection(key) {
    const map = { act: actRef, followup: followupRef, good: goodRef };
    map[key]?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const onOpenAthlete = useCallback((row) => {
    const token = String(row?.athleteToken || "").trim();
    if (!token || isLikelyOrgToken(token)) return;
    router.push(`/org/nutrition/athlete/${encodeURIComponent(token)}`);
  }, [router]);

  const hasAnyRows = Array.isArray(rows) && rows.length > 0;
  const hasResults = filtered.length > 0;
  const canReset   = Boolean(search || sport !== "all" || team !== "all");

  const weekLabel = useMemo(() => {
    if (!meta?.weekStartISO) return "";
    try {
      const d = new Date(String(meta.weekStartISO).slice(0, 10) + "T12:00:00Z");
      if (Number.isNaN(d.getTime())) return "";
      const e = new Date(d); e.setDate(e.getDate() + 6);
      const fmt = (x) => x.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      return `${fmt(d)} – ${fmt(e)}`;
    } catch { return ""; }
  }, [meta?.weekStartISO]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: DS.pageBg }}>

      <NavBar
        weekLabel={weekLabel}
        loading={loading}
        onRefresh={() => refresh()}
        onGoDashboard={() => router.push("/org/dashboard")}
        onGoPlans={() => router.push("/org/prescriptions")}
      />

      <main className="max-w-4xl mx-auto px-4 py-4 space-y-3">

        {/* Error */}
        {error && (
          <div
            className="flex items-start gap-3 px-4 py-3 text-sm"
            style={{ backgroundColor: DS.bannedBg, borderLeft: `4px solid ${DS.banned}`, color: "#7A1A1A" }}
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: DS.banned }} />
            <div className="flex-1">{error}</div>
            <button type="button" className="text-xs font-bold underline shrink-0" onClick={() => refresh()}>
              Retry
            </button>
          </div>
        )}

        {/* Progress bar */}
        {!loading && hasResults && (
          <WeekProgressBar groups={groups} total={filtered.length} onJump={jumpToSection} />
        )}

        {/* Filter strip */}
        <div
          className="flex flex-col sm:flex-row gap-2 px-3 py-2.5"
          style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: DS.dimText }} />
            <input
              className="w-full pl-8 pr-7 text-sm py-2 outline-none rounded-sm"
              style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: DS.brandBg, color: DS.bodyText }}
              placeholder="Search by name, team, position…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={(e) => { e.currentTarget.style.borderColor = DS.brand; e.currentTarget.style.boxShadow = `0 0 0 3px ${DS.brand}15`; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.boxShadow = "none"; }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2"
                style={{ color: DS.dimText }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {sports.length > 0 && (
              <DSSelect value={sport} onChange={(e) => { setSport(e.target.value); setTeam("all"); }}>
                <option value="all">All sports</option>
                {sports.map((s) => <option key={s} value={s}>{s}</option>)}
              </DSSelect>
            )}
            <DSSelect value={team} onChange={(e) => setTeam(e.target.value)} disabled={!teams.length}>
              <option value="all">All teams</option>
              {teams.map((t) => <option key={t} value={t}>{t}</option>)}
            </DSSelect>
            {canReset && (
              <button
                type="button"
                onClick={() => { setSearch(""); setSport("all"); setTeam("all"); }}
                className="shrink-0 px-3 py-2 rounded-sm transition-all"
                style={{ backgroundColor: DS.brandBg, color: DS.brand, border: `1px solid ${DS.brandBorder}` }}
                title="Clear filters"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Loading skeletons */}
        {loading && !hasAnyRows && (
          <div className="space-y-2">
            <div className="animate-pulse h-14 rounded-sm" style={{ backgroundColor: DS.bannedBg, border: `1px solid ${DS.bannedBorder}` }} />
            {[0,1,2].map((i) => (
              <div key={i} className="animate-pulse h-16 rounded-sm" style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}`, marginLeft: 8 }} />
            ))}
            <div className="animate-pulse h-14 rounded-sm mt-3" style={{ backgroundColor: DS.cautionBg, border: `1px solid ${DS.cautionBorder}` }} />
            {[0,1].map((i) => (
              <div key={i} className="animate-pulse h-16 rounded-sm" style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}`, marginLeft: 8 }} />
            ))}
          </div>
        )}

        {/* Empty org */}
        {!loading && !hasAnyRows && (
          <div
            className="p-6"
            style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}`, borderLeft: `4px solid ${DS.brand}` }}
          >
            <p
              className="font-black uppercase mb-1"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1.15rem", color: DS.bodyText, letterSpacing: "0.04em" }}
            >
              No athletes yet
            </p>
            <p className="text-sm mb-4" style={{ color: DS.labelText }}>
              Once athletes join your org they'll appear here, sorted by who needs attention first.
            </p>
            <button
              type="button"
              onClick={() => router.push("/org/athletes")}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wide rounded-sm"
              style={{ backgroundColor: DS.brand, color: "#fff" }}
            >
              Go to Athletes →
            </button>
          </div>
        )}

        {/* No filter match */}
        {!loading && hasAnyRows && !hasResults && (
          <div
            className="px-4 py-3"
            style={{ backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}`, borderLeft: `4px solid ${DS.brand}` }}
          >
            <p className="text-sm font-bold mb-1" style={{ color: DS.bodyText }}>No athletes match your filters.</p>
            <button
              type="button"
              onClick={() => { setSearch(""); setSport("all"); setTeam("all"); }}
              className="text-xs font-bold underline"
              style={{ color: DS.brand }}
            >
              Clear filters
            </button>
          </div>
        )}

        {/* The work */}
        {!loading && hasResults && (
          <div className="space-y-3">
            <ActNowSection
              rows={groups.act}
              onOpenAthlete={onOpenAthlete}
              onPlanSaved={() => refresh()}
              sectionRef={actRef}
            />
            <FollowUpSection
              rows={groups.followup}
              onOpenAthlete={onOpenAthlete}
              onPlanSaved={() => refresh()}
              defaultOpen={groups.act.length === 0}
              sectionRef={followupRef}
            />
            <OnTrackSection
              rows={groups.good}
              onOpenAthlete={onOpenAthlete}
              sectionRef={goodRef}
            />
          </div>
        )}

        {lastUpdatedLabel && !loading && (
          <p className="text-xs text-center pb-2" style={{ color: DS.dimText }}>
            Updated {lastUpdatedLabel}
          </p>
        )}

      </main>
    </div>
  );
}