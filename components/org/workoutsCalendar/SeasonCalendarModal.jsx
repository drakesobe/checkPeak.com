// components/org/workoutsCalendar/SeasonCalendarModal.jsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { X, Plus, Trash2, CalendarDays, Save, Info, RefreshCcw } from "lucide-react";
import { DS } from "@/components/org/dashboard/DashboardUI";
import {
  loadPeriods, savePeriods, newPeriod,
  PERIOD_TYPE_OPTIONS, PERIOD_TYPES,
} from "@/lib/org/seasonCalendar";

const TONE = {
  brand:   { bg: DS.brandBg,   border: DS.brandBorder,   text: DS.brand,   dot: DS.brand   },
  safe:    { bg: DS.safeBg,    border: DS.safeBorder,    text: DS.safe,    dot: DS.safe    },
  caution: { bg: DS.cautionBg, border: DS.cautionBorder, text: DS.caution, dot: DS.caution },
  banned:  { bg: DS.bannedBg,  border: DS.bannedBorder,  text: DS.banned,  dot: DS.banned  },
};

const F = {
  cond: "'Barlow Condensed', sans-serif",
  body: "'Barlow', sans-serif",
};

const inputStyle = {
  width: "100%", padding: "9px 12px", fontSize: "13px",
  border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg,
  color: DS.bodyText, outline: "none", fontFamily: F.body,
};

const labelStyle = {
  display: "block", fontFamily: F.cond, fontSize: "10px", fontWeight: 900,
  textTransform: "uppercase", letterSpacing: "0.12em",
  color: DS.labelText, marginBottom: "5px",
};

// ─── API helpers ──────────────────────────────────────────────────────────────
async function fetchPeriodsFromAPI() {
  const res  = await fetch("/api/org/season-calendar/get", { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Failed to load calendar");
  return Array.isArray(data?.periods) ? data.periods : [];
}

async function savePeriodsToAPI(periods) {
  const res  = await fetch("/api/org/season-calendar/save", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ periods }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Failed to save calendar");
  return Array.isArray(data?.periods) ? data.periods : periods;
}

// ─── Period row ───────────────────────────────────────────────────────────────
function PeriodRow({ period, index, onChange, onRemove }) {
  const cfg  = PERIOD_TYPES[period.type] || {};
  const tone = TONE[cfg.tone] || TONE.brand;

  return (
    <div style={{
      border: `1px solid ${DS.border}`, borderLeft: `3px solid ${tone.dot}`,
      background: DS.cardBg, padding: "14px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontFamily: F.cond, fontWeight: 900, fontSize: 10,
            letterSpacing: "0.1em", textTransform: "uppercase",
            color: tone.text, background: tone.bg,
            border: `1px solid ${tone.border}`, padding: "2px 8px",
          }}>
            {cfg.label || "Period"}
          </span>
          {cfg.varaRequired === true  && <span style={{ fontFamily: F.body, fontSize: 10, fontWeight: 700, color: DS.banned }}>VARA required</span>}
          {cfg.varaRequired === "warn" && <span style={{ fontFamily: F.body, fontSize: 10, fontWeight: 700, color: DS.caution }}>VARA preferred</span>}
        </div>
        <button type="button" onClick={() => onRemove(index)}
          style={{ padding: 5, border: `1px solid ${DS.border}`, background: DS.cardBg, cursor: "pointer" }}
          onMouseEnter={e => { e.currentTarget.style.background = DS.bannedBg; e.currentTarget.style.borderColor = DS.bannedBorder; }}
          onMouseLeave={e => { e.currentTarget.style.background = DS.cardBg;   e.currentTarget.style.borderColor = DS.border; }}>
          <Trash2 style={{ width: 13, height: 13, color: DS.dimText }} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 10, marginBottom: 10 }}>
        <div>
          <span style={labelStyle}>Period name</span>
          <input type="text" value={period.name}
            onChange={e => onChange(index, { name: e.target.value })}
            placeholder="e.g. Winter Break 2025–26"
            style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderColor = DS.brand; }}
            onBlur={e  => { e.currentTarget.style.borderColor = DS.border; }} />
        </div>
        <div>
          <span style={labelStyle}>Type</span>
          <select value={period.type} onChange={e => onChange(index, { type: e.target.value })}
            style={{ ...inputStyle, cursor: "pointer", appearance: "none" }}
            onFocus={e => { e.currentTarget.style.borderColor = DS.brand; }}
            onBlur={e  => { e.currentTarget.style.borderColor = DS.border; }}>
            {PERIOD_TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <span style={labelStyle}>Start date</span>
          <input type="date" value={period.start}
            onChange={e => onChange(index, { start: e.target.value })}
            style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderColor = DS.brand; }}
            onBlur={e  => { e.currentTarget.style.borderColor = DS.border; }} />
        </div>
        <div>
          <span style={labelStyle}>End date</span>
          <input type="date" value={period.end}
            onChange={e => onChange(index, { end: e.target.value })}
            style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderColor = DS.brand; }}
            onBlur={e  => { e.currentTarget.style.borderColor = DS.border; }} />
        </div>
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export default function SeasonCalendarModal({ open, onClose, onSaved }) {
  const [periods,  setPeriods]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [fetchErr, setFetchErr] = useState("");
  const [saveErr,  setSaveErr]  = useState("");

  useEffect(() => {
    if (!open) return;
    setSaved(false); setSaveErr(""); setFetchErr("");

    // Show cached localStorage data immediately while API loads
    setPeriods(loadPeriods());

    setLoading(true);
    fetchPeriodsFromAPI()
      .then((apiPeriods) => {
        setPeriods(apiPeriods);
        savePeriods(apiPeriods); // keep local cache in sync
      })
      .catch((e) => {
        setFetchErr("Could not sync from server — showing locally cached data.");
        console.warn("[SeasonCalendarModal] fetch:", e?.message);
      })
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev  = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  const addPeriod    = useCallback(() => setPeriods(prev => [...prev, newPeriod()]), []);
  const updatePeriod = useCallback((index, patch) => {
    setPeriods(prev => { const next = [...prev]; next[index] = { ...next[index], ...patch }; return next; });
  }, []);
  const removePeriod = useCallback((index) => setPeriods(prev => prev.filter((_, i) => i !== index)), []);

  const handleSave = useCallback(async () => {
    setSaveErr("");
    const sorted = [...periods].sort((a, b) => {
      if (!a.start) return 1; if (!b.start) return -1;
      return a.start.localeCompare(b.start);
    });

    // Write locally first so calendar is instant
    savePeriods(sorted);
    setPeriods(sorted);
    setSaving(true);

    try {
      const confirmed = await savePeriodsToAPI(sorted);
      savePeriods(confirmed);
      setPeriods(confirmed);
      onSaved?.(confirmed); // ← tell the calendar page immediately
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setSaveErr(`Saved locally but server sync failed: ${e?.message || "Unknown error"}. Changes are active on this device.`);
    } finally {
      setSaving(false);
    }
  }, [periods]);

  if (!open) return null;

  const breakCount       = periods.filter(p => PERIOD_TYPES[p.type]?.varaRequired === true).length;
  const outOfSeasonCount = periods.filter(p => PERIOD_TYPES[p.type]?.varaRequired === "warn").length;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10002 }}>
      <div
        style={{ position: "absolute", inset: 0, background: "rgba(13,27,42,0.5)", backdropFilter: "blur(3px)" }}
        onClick={onClose}
      />
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "clamp(12px, 3vw, 24px)",
      }}>
        <div
          style={{
            width: "100%", maxWidth: 640, maxHeight: "calc(100dvh - 48px)",
            background: DS.cardBg, border: `1px solid ${DS.border}`,
            borderTop: `3px solid ${DS.brand}`,
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}
          onClick={e => e.stopPropagation()}
          role="dialog" aria-modal="true" aria-label="Season Calendar Setup"
        >
          {/* Header */}
          <div style={{
            padding: "14px 20px", borderBottom: `1px solid ${DS.border}`,
            background: DS.pageBg, display: "flex", alignItems: "flex-start",
            justifyContent: "space-between", gap: 12, flexShrink: 0,
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <CalendarDays style={{ width: 14, height: 14, color: DS.brand }} />
                <p style={{ fontFamily: F.cond, fontWeight: 900, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: DS.bodyText, margin: 0 }}>
                  Season Calendar Setup
                </p>
                {loading && <RefreshCcw style={{ width: 11, height: 11, color: DS.dimText, animation: "spin 1s linear infinite" }} />}
              </div>
              <p style={{ fontFamily: F.body, fontSize: 11, color: DS.dimText, margin: 0 }}>
                Shared across all coaches in your org — synced to Airtable.
              </p>
            </div>
            <button type="button" onClick={onClose}
              style={{ padding: 6, border: `1px solid ${DS.border}`, background: DS.cardBg, cursor: "pointer", flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.background = DS.pageBg; }}
              onMouseLeave={e => { e.currentTarget.style.background = DS.cardBg; }}>
              <X style={{ width: 15, height: 15, color: DS.dimText }} />
            </button>
          </div>

          {/* Info banner */}
          <div style={{
            padding: "10px 20px", background: DS.brandBg,
            borderBottom: `1px solid ${DS.brandBorder}`,
            display: "flex", gap: 8, alignItems: "flex-start", flexShrink: 0,
          }}>
            <Info style={{ width: 13, height: 13, color: DS.brand, flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontFamily: F.body, fontSize: 11, lineHeight: 1.55, color: DS.brand, margin: 0 }}>
              When creating a workout on a <strong>break or vacation date</strong>, CheckPeak flags it with a red warning and prompts you to switch to <strong>Voluntary Activity (VARA)</strong>. <strong>Out of season</strong> dates show amber.
            </p>
          </div>

          {/* Fetch error */}
          {fetchErr && (
            <div style={{
              padding: "8px 20px", background: DS.cautionBg,
              borderBottom: `1px solid ${DS.cautionBorder}`,
              fontFamily: F.body, fontSize: 11, color: DS.caution, flexShrink: 0,
            }}>
              ⚠ {fetchErr}
            </div>
          )}

          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
            {periods.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                <span style={{ fontFamily: F.body, fontSize: 11, fontWeight: 700, padding: "3px 10px", background: DS.pageBg, border: `1px solid ${DS.border}`, color: DS.labelText }}>
                  {periods.length} period{periods.length !== 1 ? "s" : ""}
                </span>
                {breakCount > 0 && (
                  <span style={{ fontFamily: F.body, fontSize: 11, fontWeight: 700, padding: "3px 10px", background: DS.bannedBg, border: `1px solid ${DS.bannedBorder}`, color: DS.banned }}>
                    {breakCount} VARA-required
                  </span>
                )}
                {outOfSeasonCount > 0 && (
                  <span style={{ fontFamily: F.body, fontSize: 11, fontWeight: 700, padding: "3px 10px", background: DS.cautionBg, border: `1px solid ${DS.cautionBorder}`, color: DS.caution }}>
                    {outOfSeasonCount} out-of-season
                  </span>
                )}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {periods.length === 0 && !loading ? (
                <div style={{ padding: "40px 20px", textAlign: "center", border: `2px dashed ${DS.border}`, background: DS.pageBg }}>
                  <CalendarDays style={{ width: 24, height: 24, color: DS.dimText, margin: "0 auto 12px" }} />
                  <p style={{ fontFamily: F.cond, fontWeight: 900, fontSize: 13, letterSpacing: "0.04em", textTransform: "uppercase", color: DS.bodyText, margin: "0 0 4px" }}>
                    No periods defined
                  </p>
                  <p style={{ fontFamily: F.body, fontSize: 12, color: DS.dimText, margin: "0 0 16px" }}>
                    Add your preseason, regular season, breaks, and vacation windows.
                  </p>
                  <button type="button" onClick={addPeriod} style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "8px 18px", background: DS.brand, color: "#fff",
                    fontFamily: F.cond, fontSize: 12, fontWeight: 900,
                    letterSpacing: "0.1em", textTransform: "uppercase",
                    border: "none", cursor: "pointer",
                  }}>
                    <Plus style={{ width: 13, height: 13 }} /> Add First Period
                  </button>
                </div>
              ) : (
                <>
                  {periods.map((p, i) => (
                    <PeriodRow key={p.id} period={p} index={i} onChange={updatePeriod} onRemove={removePeriod} />
                  ))}
                  <button type="button" onClick={addPeriod} style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "10px", border: `2px dashed ${DS.border}`, background: "transparent",
                    fontFamily: F.cond, fontSize: 11, fontWeight: 900,
                    letterSpacing: "0.1em", textTransform: "uppercase",
                    color: DS.labelText, cursor: "pointer", transition: "all 0.12s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = DS.brand; e.currentTarget.style.color = DS.brand; e.currentTarget.style.background = DS.brandBg; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.color = DS.labelText; e.currentTarget.style.background = "transparent"; }}>
                    <Plus style={{ width: 13, height: 13 }} /> Add Period
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: "12px 20px", borderTop: `1px solid ${DS.border}`,
            background: DS.pageBg, display: "flex", flexDirection: "column",
            gap: 8, flexShrink: 0,
          }}>
            {saveErr && (
              <p style={{ fontFamily: F.body, fontSize: 11, color: DS.caution, margin: 0 }}>⚠ {saveErr}</p>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <p style={{ fontFamily: F.body, fontSize: 11, color: DS.dimText, margin: 0 }}>
                {saved ? "✓ Saved to Airtable — all coaches will see these dates." : "Shared across all coaches in your org."}
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={onClose} style={{
                  padding: "8px 16px", border: `1px solid ${DS.border}`, background: DS.cardBg,
                  fontFamily: F.cond, fontSize: 11, fontWeight: 900,
                  letterSpacing: "0.08em", textTransform: "uppercase",
                  color: DS.labelText, cursor: "pointer",
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = DS.pageBg; }}
                  onMouseLeave={e => { e.currentTarget.style.background = DS.cardBg; }}>
                  Cancel
                </button>
                <button type="button" onClick={handleSave} disabled={saving} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 18px",
                  border: `1px solid ${saved ? DS.safe : DS.brand}`,
                  background: saved ? DS.safeBg : saving ? DS.raised : DS.brand,
                  fontFamily: F.cond, fontSize: 11, fontWeight: 900,
                  letterSpacing: "0.08em", textTransform: "uppercase",
                  color: saved ? DS.safe : saving ? DS.muted : "#fff",
                  cursor: saving ? "not-allowed" : "pointer", transition: "all 0.2s",
                }}>
                  {saving
                    ? <RefreshCcw style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} />
                    : <Save style={{ width: 12, height: 12 }} />
                  }
                  {saving ? "Saving…" : saved ? "Saved ✓" : "Save Calendar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}