// pages/athlete/stats.jsx
// Game-by-game stat logger + season summary for athletes.

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import { ChevronLeft, Plus, Pencil, Trash2, X, ChevronDown, Target, TrendingUp, Share2, Check, Shield, BarChart2, Trophy } from "lucide-react";
import { Toaster, toast } from "react-hot-toast";
import {
  SPORT_STATS, SPORT_LABELS, ALL_SPORTS,
  getFootballGroup, getFields, getComputed, aggregateStats, avgStats,
} from "@/lib/sportStats";

const C = {
  bg:      "#0A0A0F",
  surface: "#0E0E16",
  card:    "#131320",
  card2:   "#181828",
  line:    "#1C1C2E",
  line2:   "#242438",
  white:   "#EEEEFF",
  dim:     "rgba(238,238,255,0.65)",
  muted:   "rgba(238,238,255,0.38)",
  faint:   "rgba(238,238,255,0.06)",
  faint2:  "rgba(238,238,255,0.03)",
  accent:  "#4FABFF",
  green:   "#00C851",
  red:     "#EF4444",
  gold:    "#FFD700",
};

const inputStyle = {
  width: "100%", boxSizing: "border-box",
  padding: "10px 13px",
  background: C.card2, border: `1px solid ${C.line2}`,
  borderRadius: 9, fontSize: 14, fontWeight: 500, color: C.white,
  fontFamily: "inherit", outline: "none",
};

const selectStyle = { ...inputStyle, appearance: "none", cursor: "pointer" };

const CURRENT_YEAR = new Date().getFullYear();
const SEASON_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${Number(m)}/${Number(day)}/${y.slice(2)}`;
}

function resultBadge(r) {
  if (!r) return null;
  const color = r === "W" ? C.green : r === "L" ? C.red : C.gold;
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 5,
      fontSize: 11, fontWeight: 900, color,
      background: `${color}18`, border: `1px solid ${color}30`,
    }}>{r}</span>
  );
}

function Label({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 6 }}>
      {children}
    </div>
  );
}

// ── Game Modal ────────────────────────────────────────────────────────────────

function GameModal({ sport, athletePosition, game, seasonYear, onSave, onClose }) {
  const cfg = SPORT_STATS[sport];
  const isEdit = !!game;

  // Determine initial group/role
  const defaultGroup = sport === "football"
    ? getFootballGroup(game?.group_key || athletePosition)
    : null;
  const defaultRole = cfg?.type === "role"
    ? (game?.role_key || Object.keys(cfg.roles || {})[0] || null)
    : null;

  const [groupKey, setGroupKey] = useState(defaultGroup);
  const [roleKey,  setRoleKey]  = useState(defaultRole);
  const [meta,     setMeta]     = useState(() => {
    const m = {};
    (cfg?.gameFields || []).forEach(f => { m[f.key] = game?.[f.key] ?? ""; });
    // defaults
    if (!game) {
      m.game_date = new Date().toISOString().slice(0, 10);
    }
    return m;
  });
  const [stats, setStats] = useState(() => game?.stats || {});
  const [notes, setNotes] = useState(game?.notes || "");
  const [saving, setSaving] = useState(false);

  // Events for track/swimming
  const [events, setEvents] = useState(() =>
    Array.isArray(game?.stats?.events) ? game.stats.events : []
  );
  const [newEvent, setNewEvent] = useState("");
  const [newMark,  setNewMark]  = useState("");
  const [newPlace, setNewPlace] = useState("");
  const [newWind,  setNewWind]  = useState("");

  const activeKey   = groupKey || roleKey;
  const fields      = getFields(sport, groupKey, roleKey);
  const isEvents    = cfg?.type === "events";

  const setStat = (key, val) => setStats(p => ({ ...p, [key]: val }));

  const addEvent = () => {
    if (!newEvent || !newMark) return;
    setEvents(e => [...e, { event: newEvent, mark: newMark, place: newPlace ? Number(newPlace) : null, wind: newWind || null }]);
    setNewEvent(""); setNewMark(""); setNewPlace(""); setNewWind("");
  };

  const removeEvent = (i) => setEvents(e => e.filter((_, j) => j !== i));

  const handleSave = async () => {
    if (!meta.game_date) { toast.error("Date is required"); return; }
    setSaving(true);
    try {
      const finalStats = isEvents ? { events } : stats;
      const payload = {
        id:          game?.id,
        sport,
        season_year: seasonYear,
        ...meta,
        team_score:  meta.team_score ? Number(meta.team_score) : null,
        opp_score:   meta.opp_score  ? Number(meta.opp_score)  : null,
        group_key:   groupKey,
        role_key:    roleKey,
        stats:       finalStats,
        notes,
      };

      const r = await fetch("/api/athlete/stats/games", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Failed to save");
      toast.success(isEdit ? "Game updated" : "Game added");
      onSave(d.game, isEdit);
    } catch (e) {
      toast.error(e.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const gameLabel = cfg?.gameLabel || "Game";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)" }}
        onClick={onClose}
      />
      <div style={{
        position: "relative", zIndex: 1,
        width: "100%", maxWidth: 560, maxHeight: "92vh",
        background: C.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18,
        border: `1px solid ${C.line2}`, borderBottom: "none",
        display: "flex", flexDirection: "column",
      }}>
        {/* Modal header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${C.line}` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.white }}>
            {isEdit ? `Edit ${gameLabel}` : `Add ${gameLabel}`}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}>
            <X size={18} color={C.muted} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 8px" }}>

          {/* Position/role selector */}
          {cfg?.type === "grouped" && (
            <div style={{ marginBottom: 20 }}>
              <Label>Position Group</Label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {Object.entries(cfg.groups).map(([key, g]) => (
                  <button
                    key={key}
                    onClick={() => setGroupKey(key)}
                    style={{
                      padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                      cursor: "pointer", fontFamily: "inherit", border: "none",
                      background: groupKey === key ? C.accent : C.card2,
                      color: groupKey === key ? "#fff" : C.dim,
                    }}>
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {cfg?.type === "role" && (
            <div style={{ marginBottom: 20 }}>
              <Label>Role</Label>
              <div style={{ display: "flex", gap: 8 }}>
                {Object.entries(cfg.roles).map(([key, r]) => (
                  <button
                    key={key}
                    onClick={() => setRoleKey(key)}
                    style={{
                      padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                      cursor: "pointer", fontFamily: "inherit", border: "none",
                      background: roleKey === key ? C.accent : C.card2,
                      color: roleKey === key ? "#fff" : C.dim,
                    }}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Game metadata */}
          <div style={{ marginBottom: 20 }}>
            <Label>{gameLabel} Info</Label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {(cfg?.gameFields || []).map(f => {
                if (f.key === "weight_class" || f.key === "meet_name" || f.key === "pin_time" || f.key === "tournament" || f.key === "surface" || f.key === "singles_doubles" || f.key === "score") {
                  return (
                    <div key={f.key} style={{ gridColumn: "1 / -1" }}>
                      <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{f.label}</div>
                      <input value={meta[f.key] || ""} onChange={e => setMeta(p => ({ ...p, [f.key]: e.target.value }))} style={inputStyle} />
                    </div>
                  );
                }
                if (f.type === "select") {
                  return (
                    <div key={f.key}>
                      <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{f.label}</div>
                      <select value={meta[f.key] || ""} onChange={e => setMeta(p => ({ ...p, [f.key]: e.target.value }))} style={selectStyle}>
                        <option value="">—</option>
                        {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  );
                }
                return (
                  <div key={f.key}>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{f.label}</div>
                    <input
                      type={f.type === "date" ? "date" : "text"}
                      value={meta[f.key] || ""}
                      onChange={e => setMeta(p => ({ ...p, [f.key]: e.target.value }))}
                      inputMode={f.type === "int" ? "numeric" : undefined}
                      style={inputStyle}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stat inputs — flat or grouped */}
          {!isEvents && fields.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <Label>Stats</Label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {fields.map(f => {
                  if (f.type === "checkbox") {
                    const checked = !!stats[f.key];
                    return (
                      <button
                        key={f.key}
                        onClick={() => setStat(f.key, checked ? 0 : 1)}
                        style={{
                          padding: "10px 8px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", border: "none",
                          background: checked ? `${C.green}20` : C.card2,
                          color: checked ? C.green : C.muted,
                          fontSize: 11, fontWeight: 700,
                        }}>
                        {f.label} {checked ? "✓" : "—"}
                      </button>
                    );
                  }
                  if (f.type === "select") {
                    return (
                      <div key={f.key}>
                        <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{f.label}</div>
                        <select value={stats[f.key] || ""} onChange={e => setStat(f.key, e.target.value)} style={selectStyle}>
                          <option value="">—</option>
                          {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    );
                  }
                  return (
                    <div key={f.key}>
                      <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{f.label}</div>
                      <input
                        type="text"
                        inputMode={f.type === "int" ? "numeric" : "decimal"}
                        value={stats[f.key] ?? ""}
                        onChange={e => setStat(f.key, e.target.value)}
                        style={inputStyle}
                        placeholder="0"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Event-based (track / swimming) */}
          {isEvents && (
            <div style={{ marginBottom: 20 }}>
              <Label>Events</Label>

              {events.map((ev, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "10px 12px", background: C.card2, borderRadius: 9, border: `1px solid ${C.line2}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.white }}>{ev.event}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                      {ev.mark}
                      {ev.place ? ` · ${ev.place}${["st","nd","rd"][ev.place-1]||"th"} place` : ""}
                      {ev.wind  ? ` · wind ${ev.wind}` : ""}
                    </div>
                  </div>
                  <button onClick={() => removeEvent(i)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}>
                    <X size={14} color={C.muted} />
                  </button>
                </div>
              ))}

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8, marginTop: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Event</div>
                  <select value={newEvent} onChange={e => setNewEvent(e.target.value)} style={selectStyle}>
                    <option value="">Select…</option>
                    {cfg.eventOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Mark</div>
                  <input
                    value={newMark} onChange={e => setNewMark(e.target.value)}
                    placeholder={cfg.markHints?.[newEvent] || "10.85"}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Place</div>
                  <input value={newPlace} onChange={e => setNewPlace(e.target.value)} inputMode="numeric" placeholder="1" style={inputStyle} />
                </div>
              </div>
              {sport === "track" && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Wind (m/s) — sprints only</div>
                  <input value={newWind} onChange={e => setNewWind(e.target.value)} placeholder="+1.2" style={{ ...inputStyle, maxWidth: 120 }} />
                </div>
              )}
              <button
                onClick={addEvent}
                disabled={!newEvent || !newMark}
                style={{
                  marginTop: 10, display: "flex", alignItems: "center", gap: 5,
                  padding: "8px 14px", background: C.faint, border: `1px solid ${C.line2}`,
                  borderRadius: 8, fontSize: 12, fontWeight: 700, color: C.accent,
                  cursor: (!newEvent || !newMark) ? "not-allowed" : "pointer",
                  fontFamily: "inherit", opacity: (!newEvent || !newMark) ? 0.5 : 1,
                }}>
                <Plus size={12} /> Add Event
              </button>
            </div>
          )}

          {/* Notes */}
          <div style={{ marginBottom: 20 }}>
            <Label>Notes (optional)</Label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="How'd it go? Injuries, game conditions, anything notable…"
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
            />
          </div>
        </div>

        {/* Save footer */}
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${C.line}` }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              width: "100%", padding: "13px", background: C.accent,
              border: "none", borderRadius: 10, fontSize: 14, fontWeight: 800,
              color: "#fff", cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "inherit", opacity: saving ? 0.7 : 1,
            }}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : `Add ${gameLabel}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Season Summary ────────────────────────────────────────────────────────────

function SeasonSummary({ games, sport, groupKey, roleKey }) {
  const cfg  = SPORT_STATS[sport];
  if (!cfg || games.length === 0) return null;

  const fields   = getFields(sport, groupKey, roleKey);
  const computed = getComputed(sport, groupKey, roleKey);

  if (cfg.type === "events") {
    // Flatten all events, find PRs per event
    const prs = {};
    games.forEach(g => {
      (g.stats?.events || []).forEach(ev => {
        if (!ev.event || !ev.mark) return;
        if (!prs[ev.event]) prs[ev.event] = ev.mark;
        // TODO: smarter comparison for times/distances
      });
    });
    return (
      <div style={{ padding: "18px 20px", background: C.card, border: `1px solid ${C.line2}`, borderRadius: 14, marginBottom: 20 }}>
        <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.16em", color: C.muted, marginBottom: 14 }}>SEASON BEST MARKS</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {Object.entries(prs).map(([event, mark]) => (
            <div key={event} style={{ padding: "10px 14px", background: C.card2, border: `1px solid ${C.line2}`, borderRadius: 10, minWidth: 100 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 4 }}>{event}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: C.white, letterSpacing: "-0.03em" }}>{mark}</div>
            </div>
          ))}
          {Object.keys(prs).length === 0 && (
            <div style={{ fontSize: 12, color: C.muted }}>No marks logged yet.</div>
          )}
        </div>
      </div>
    );
  }

  if (fields.length === 0) return null;

  const totals = aggregateStats(games, fields);
  const gp     = games.length;
  const avgs   = avgStats(totals, fields, gp);

  // Wrestling: compute record from individual game results
  const isWrestling = sport === "wrestling";
  const wins   = isWrestling ? games.filter(g => g.result === "W").length : null;
  const losses = isWrestling ? games.filter(g => g.result === "L").length : null;
  const pins   = isWrestling ? games.filter(g => g.result === "W" && g.method === "Pin").length : null;
  const techs  = isWrestling ? games.filter(g => g.result === "W" && g.method === "Technical Fall").length : null;

  // Computed stats from totals
  const computedVals = {};
  computed.forEach(c => { try { computedVals[c.key] = c.fn(totals, games); } catch { computedVals[c.key] = "—"; } });

  const cfg2 = cfg.type === "grouped" ? cfg.groups[groupKey] : cfg.type === "role" ? cfg.roles[roleKey] : cfg;
  const displayKeys = cfg2?.display || fields.slice(0, 6).map(f => f.key);

  const winsTotal  = games.filter(g => g.result === "W").length;
  const lossesTotal = games.filter(g => g.result === "L").length;
  const hasResults = games.some(g => g.result);

  return (
    <div style={{ padding: "18px 20px", background: C.card, border: `1px solid ${C.line2}`, borderRadius: 14, marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.16em", color: C.muted }}>SEASON TOTALS — {gp} {gp === 1 ? (cfg?.gameLabel || "game").toLowerCase() : `${(cfg?.gameLabel || "game").toLowerCase()}s`}</div>
        {hasResults && (
          <div style={{ fontSize: 11, fontWeight: 700, color: C.dim }}>
            {winsTotal}–{lossesTotal}
            {sport === "wrestling" && pins !== null && ` · ${pins} pin${pins !== 1 ? "s" : ""}`}
            {sport === "wrestling" && techs !== null && techs > 0 && ` · ${techs} TF`}
          </div>
        )}
      </div>

      {/* Key stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 10, marginBottom: computed.length > 0 ? 14 : 0 }}>
        {displayKeys.map(key => {
          const isComputed = computed.some(c => c.key === key);
          const val = isComputed ? computedVals[key] : totals[key] ?? "—";
          const field = fields.find(f => f.key === key);
          const computedDef = computed.find(c => c.key === key);
          const label = isComputed ? (computedDef?.label || key) : (field?.label || key);
          return (
            <div key={key} style={{ textAlign: "center", padding: "12px 8px", background: C.card2, border: `1px solid ${C.line2}`, borderRadius: 10 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: C.white, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 5 }}>
                {val === undefined || val === null ? "—" : val}
              </div>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted }}>{label}</div>
            </div>
          );
        })}
      </div>

      {/* Per-game averages */}
      {gp >= 2 && cfg.avgFields && (
        <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 12, marginTop: 4 }}>
          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.14em", color: C.muted, marginBottom: 10 }}>PER {(cfg?.gameLabel || "GAME").toUpperCase()}</div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {cfg.avgFields.map(key => {
              const field = fields.find(f => f.key === key);
              if (!field || totals[key] == null) return null;
              return (
                <div key={key}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: C.accent, letterSpacing: "-0.03em", lineHeight: 1 }}>
                    {(totals[key] / gp).toFixed(1)}
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, marginTop: 3 }}>{field.label}/G</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Game Log ──────────────────────────────────────────────────────────────────

function ShareButton({ gameId }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = `${window.location.origin}/share/game/${gameId}`;
    if (navigator.share) {
      try { await navigator.share({ url, title: "CheckPeak Game Card" }); } catch { /* dismissed */ }
    } else {
      try { await navigator.clipboard.writeText(url); } catch { /* fallback */ }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  return (
    <button
      onClick={share}
      title="Share this game"
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "5px 10px", borderRadius: 7, cursor: "pointer",
        border: "none", fontFamily: "inherit", fontSize: 11, fontWeight: 700,
        background: copied ? `${C.green}18` : C.faint,
        color: copied ? C.green : C.muted,
        transition: "background 0.15s, color 0.15s",
      }}>
      {copied ? <Check size={11} /> : <Share2 size={11} />}
      {copied ? "Copied" : "Share"}
    </button>
  );
}

function GameLog({ games, sport, onEdit, onDelete }) {
  const cfg = SPORT_STATS[sport];
  const gameLabel = cfg?.gameLabel || "Game";

  if (games.length === 0) return null;

  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.16em", color: C.muted, marginBottom: 12 }}>
        {gameLabel.toUpperCase()} LOG
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {games.map(game => {
          const groupKey = game.group_key;
          const roleKey  = game.role_key;
          const fields   = getFields(sport, groupKey, roleKey);
          const computed = getComputed(sport, groupKey, roleKey);
          const cfg2     = cfg?.type === "grouped" ? cfg?.groups?.[groupKey] : cfg?.type === "role" ? cfg?.roles?.[roleKey] : cfg;
          const displayKeys = cfg2?.display || fields.slice(0, 4).map(f => f.key);
          const totals = aggregateStats([game], fields);
          const computedVals = {};
          computed.forEach(c => { try { computedVals[c.key] = c.fn(totals, [game]); } catch { computedVals[c.key] = "—"; } });

          // For events-based sports, show event list
          const eventList = Array.isArray(game.stats?.events) ? game.stats.events : null;

          return (
            <div key={game.id} style={{ background: C.card, border: `1px solid ${C.line2}`, borderRadius: 12, padding: "13px 16px" }}>
              {/* Row header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: eventList || fields.length > 0 ? 10 : 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.dim }}>{fmtDate(game.game_date)}</span>
                  {game.opponent && <span style={{ fontSize: 13, fontWeight: 700, color: C.white }}>vs {game.opponent}</span>}
                  {game.location && <span style={{ fontSize: 11, color: C.muted }}>{game.location}</span>}
                  {resultBadge(game.result)}
                  {(game.team_score != null && game.opp_score != null) && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>{game.team_score}–{game.opp_score}</span>
                  )}
                  {game.logged_by === "coach" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 7px", background: "rgba(0,135,62,0.1)", border: "1px solid rgba(0,135,62,0.25)", borderRadius: 4 }}>
                      <Shield size={9} color={C.green} strokeWidth={2.5} />
                      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: C.green }}>COACH VERIFIED</span>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <ShareButton gameId={game.id} />
                  <button onClick={() => onEdit(game)} style={{ background: C.faint, border: `1px solid ${C.line2}`, borderRadius: 7, padding: "5px 9px", cursor: "pointer", display: "flex", alignItems: "center" }}>
                    <Pencil size={11} color={C.dim} />
                  </button>
                  <button onClick={() => onDelete(game)} style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.18)", borderRadius: 7, padding: "5px 9px", cursor: "pointer", display: "flex", alignItems: "center" }}>
                    <Trash2 size={11} color={C.red} />
                  </button>
                </div>
              </div>

              {/* Stats row */}
              {!eventList && fields.length > 0 && (
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  {displayKeys.map(key => {
                    const isComp  = computed.some(c => c.key === key);
                    const val     = isComp ? computedVals[key] : (game.stats?.[key] ?? null);
                    const field   = fields.find(f => f.key === key);
                    const compDef = computed.find(c => c.key === key);
                    const label   = isComp ? (compDef?.label || key) : (field?.label || key);
                    if (val == null || val === "" || val === 0 && field?.agg === "sum") {
                      // hide 0-value stats unless they're computed
                      if (!isComp && (val === 0 || val === "")) return null;
                    }
                    return (
                      <div key={key}>
                        <div style={{ fontSize: 15, fontWeight: 900, color: C.white, letterSpacing: "-0.02em", lineHeight: 1 }}>{val ?? "—"}</div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, marginTop: 3, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Event list (track/swimming) */}
              {eventList && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {eventList.map((ev, i) => (
                    <div key={i} style={{ padding: "5px 11px", background: C.card2, border: `1px solid ${C.line2}`, borderRadius: 8, fontSize: 12 }}>
                      <span style={{ fontWeight: 700, color: C.white }}>{ev.mark}</span>
                      <span style={{ color: C.muted, marginLeft: 5 }}>{ev.event}</span>
                      {ev.place && <span style={{ color: C.accent, marginLeft: 5 }}>#{ev.place}</span>}
                    </div>
                  ))}
                </div>
              )}

              {game.notes && (
                <div style={{ marginTop: 8, fontSize: 11, color: C.muted, fontStyle: "italic" }}>{game.notes}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Career Arc ────────────────────────────────────────────────────────────────

function CareerArc({ sport, groupKey, roleKey, currentSeason }) {
  const [seasons, setSeasons] = useState([]);

  useEffect(() => {
    if (!sport) return;
    const CURRENT = new Date().getFullYear();
    const years = [CURRENT, CURRENT - 1, CURRENT - 2, CURRENT - 3];
    Promise.all(
      years.map(y =>
        fetch(`/api/athlete/stats/games?sport=${sport}&season=${y}`, { credentials: "include" })
          .then(r => r.json())
          .then(d => ({ year: y, games: d.games || [] }))
          .catch(() => ({ year: y, games: [] }))
      )
    ).then(results => {
      const withGames = results.filter(r => r.games.length > 0);
      if (withGames.length < 2) { setSeasons([]); return; }
      const cfg = SPORT_STATS[sport];
      const fields = getFields(sport, groupKey, roleKey);
      const computed = getComputed(sport, groupKey, roleKey);
      const cfg2 = cfg?.type === "grouped" ? cfg?.groups?.[groupKey] : cfg?.type === "role" ? cfg?.roles?.[roleKey] : cfg;
      const displayKeys = (cfg2?.display || fields.slice(0, 3).map(f => f.key)).slice(0, 3);
      const labelMap = {};
      [...fields, ...computed].forEach(f => { labelMap[f.key] = f.label; });

      setSeasons(withGames.map(({ year, games }) => {
        const totals = aggregateStats(games, fields);
        const computedVals = {};
        computed.forEach(c => { try { computedVals[c.key] = c.fn(totals, games); } catch { computedVals[c.key] = "—"; } });
        const wins   = games.filter(g => g.result === "W").length;
        const losses = games.filter(g => g.result === "L").length;
        const verified = games.filter(g => g.logged_by === "coach").length;
        return { year, gp: games.length, wins, losses, verified, totals, computedVals, displayKeys, labelMap };
      }));
    });
  }, [sport, groupKey, roleKey]);

  if (seasons.length < 2) return null;

  return (
    <div style={{ background: C.card, border: `1px solid ${C.line2}`, borderRadius: 14, padding: "16px 18px", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <BarChart2 size={14} color={C.accent} />
        <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.14em", color: C.muted }}>CAREER ARC</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {seasons.map((s, i) => {
          const isCurrent = s.year === currentSeason;
          return (
            <div key={s.year} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, background: isCurrent ? `${C.accent}0D` : "transparent", border: isCurrent ? `1px solid ${C.accent}22` : "1px solid transparent" }}>
              <span style={{ fontSize: 12, fontWeight: isCurrent ? 800 : 600, color: isCurrent ? C.accent : C.muted, flexShrink: 0, width: 36 }}>{s.year}</span>
              <span style={{ fontSize: 10, color: C.muted, flexShrink: 0, width: 32 }}>{s.gp}G</span>
              {s.wins > 0 || s.losses > 0 ? <span style={{ fontSize: 10, color: C.dim, flexShrink: 0, width: 40 }}>{s.wins}-{s.losses}</span> : <span style={{ width: 40 }} />}
              <div style={{ flex: 1, display: "flex", gap: 14, flexWrap: "wrap" }}>
                {s.displayKeys.map(key => {
                  const isComp = s.computedVals[key] !== undefined;
                  const val    = isComp ? s.computedVals[key] : s.totals[key];
                  if (val == null || val === "—" || val === 0) return null;
                  return (
                    <div key={key}>
                      <div style={{ fontSize: 14, fontWeight: 900, color: isCurrent ? C.white : C.dim, letterSpacing: "-0.02em", lineHeight: 1 }}>{val}</div>
                      <div style={{ fontSize: 8, fontWeight: 700, color: C.muted, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.labelMap[key] || key}</div>
                    </div>
                  );
                })}
              </div>
              {s.verified > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                  <Shield size={9} color={C.green} strokeWidth={2.5} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: C.green }}>{s.verified}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Goals Section ─────────────────────────────────────────────────────────────

function GoalsSection({ sport, season, games, groupKey, roleKey }) {
  const cfg = SPORT_STATS[sport];
  const [goals,       setGoals]       = useState([]);
  const [adding,      setAdding]      = useState(false);
  const [newField,    setNewField]    = useState("");
  const [newTarget,   setNewTarget]   = useState("");
  const [saving,      setSaving]      = useState(false);

  useEffect(() => {
    if (!sport || !season) return;
    fetch(`/api/athlete/stats/goals?sport=${sport}&season=${season}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.ok) setGoals(d.goals || []); })
      .catch(() => {});
  }, [sport, season]);

  if (!cfg || cfg.type === "events") return null;

  // Gather all numeric fields for this sport/group/role
  const fields   = getFields(sport, groupKey, roleKey);
  const computed = getComputed(sport, groupKey, roleKey);
  const allFields = [...fields.filter(f => f.type === "int" || f.type === "decimal"), ...computed];

  // Current season totals for progress
  const relevantGames = cfg.type === "grouped"
    ? games.filter(g => !groupKey || g.group_key === groupKey)
    : cfg.type === "role"
    ? games.filter(g => !roleKey || g.role_key === roleKey)
    : games;

  const totals = aggregateStats(relevantGames, fields);
  const computedVals = {};
  computed.forEach(c => { try { computedVals[c.key] = c.fn(totals); } catch { computedVals[c.key] = "—"; } });

  const saveGoal = async () => {
    if (!newField || !newTarget || isNaN(Number(newTarget))) return;
    setSaving(true);
    try {
      const r = await fetch("/api/athlete/stats/goals", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sport, season_year: season, field_key: newField, target: Number(newTarget) }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      setGoals(prev => {
        const existing = prev.findIndex(g => g.field_key === newField);
        return existing >= 0
          ? prev.map((g, i) => i === existing ? d.goal : g)
          : [...prev, d.goal];
      });
      setAdding(false);
      setNewField(""); setNewTarget("");
    } catch (e) {
      toast.error(e.message || "Could not save goal");
    } finally {
      setSaving(false);
    }
  };

  const deleteGoal = async (fieldKey) => {
    try {
      await fetch(`/api/athlete/stats/goals?sport=${sport}&season=${season}&field_key=${fieldKey}`, {
        method: "DELETE", credentials: "include",
      });
      setGoals(prev => prev.filter(g => g.field_key !== fieldKey));
    } catch { /* swallow */ }
  };

  const getFieldLabel = (key) => allFields.find(f => f.key === key)?.label || key;

  const getCurrent = (key) => {
    if (computedVals[key] != null && computedVals[key] !== "—") {
      return parseFloat(computedVals[key]) || 0;
    }
    return Number(totals[key] || 0);
  };

  if (goals.length === 0 && !adding) {
    return (
      <div style={{ padding: "18px 20px", background: C.card, border: `1px solid ${C.line2}`, borderRadius: 14, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.dim, marginBottom: 2 }}>Season Goals</div>
          <div style={{ fontSize: 11, color: C.muted }}>Track progress toward your {season} targets</div>
        </div>
        <button
          onClick={() => setAdding(true)}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", background: C.faint, border: `1px solid ${C.line2}`, borderRadius: 8, fontSize: 12, fontWeight: 700, color: C.accent, cursor: "pointer", fontFamily: "inherit" }}>
          <Target size={12} /> Set Goals
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "18px 20px", background: C.card, border: `1px solid ${C.line2}`, borderRadius: 14, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: goals.length > 0 ? 16 : 0 }}>
        <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.16em", color: C.muted }}>SEASON GOALS — {season}</div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: C.accent, padding: 0, fontFamily: "inherit" }}>
            <Plus size={11} /> Add
          </button>
        )}
      </div>

      {/* Goal bars */}
      {goals.map(goal => {
        const current = getCurrent(goal.field_key);
        const target  = Number(goal.target);
        const pct     = target > 0 ? Math.min(current / target * 100, 100) : 0;
        const done    = pct >= 100;
        const label   = getFieldLabel(goal.field_key);
        const barColor = done ? C.green : pct >= 70 ? C.accent : pct >= 40 ? C.accent : C.accent;

        return (
          <div key={goal.field_key} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: done ? C.green : C.dim }}>{label}</span>
                {done && <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.1em", color: C.green, padding: "2px 7px", background: "rgba(0,200,81,0.1)", borderRadius: 20 }}>DONE</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>
                  <span style={{ color: done ? C.green : C.white }}>{current % 1 === 0 ? current : current.toFixed(1)}</span>
                  <span style={{ color: "rgba(240,243,250,0.3)" }}> / {target}</span>
                </span>
                <button
                  onClick={() => deleteGoal(goal.field_key)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", opacity: 0.5 }}>
                  <X size={11} color={C.muted} />
                </button>
              </div>
            </div>
            <div style={{ height: 6, background: C.card2, borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 3,
                background: done ? C.green : `linear-gradient(90deg, ${barColor}cc, ${barColor})`,
                width: `${pct}%`,
                transition: "width 0.4s ease",
              }} />
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 4, fontWeight: 600 }}>
              {done
                ? `Goal reached!`
                : target > 0
                ? `${Math.round(pct)}% · ${Math.max(0, Math.ceil(target - current))} to go`
                : null
              }
            </div>
          </div>
        );
      })}

      {/* Add goal form */}
      {adding && (
        <div style={{ marginTop: goals.length > 0 ? 16 : 0, padding: "14px", background: C.card2, border: `1px solid ${C.line2}`, borderRadius: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, marginBottom: 10 }}>New Goal</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
            <select
              value={newField}
              onChange={e => setNewField(e.target.value)}
              style={{ ...selectStyle, fontSize: 12 }}>
              <option value="">Choose stat…</option>
              {allFields.filter(f => !goals.some(g => g.field_key === f.key)).map(f => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Target"
              value={newTarget}
              onChange={e => setNewTarget(e.target.value)}
              style={{ ...inputStyle, width: 90, fontSize: 12 }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              onClick={saveGoal}
              disabled={!newField || !newTarget || saving}
              style={{
                flex: 1, padding: "9px", background: newField && newTarget ? C.accent : C.faint,
                border: "none", borderRadius: 8, fontSize: 12, fontWeight: 800,
                color: newField && newTarget ? "#fff" : C.muted,
                cursor: newField && newTarget && !saving ? "pointer" : "not-allowed",
                fontFamily: "inherit", opacity: saving ? 0.7 : 1,
              }}>
              {saving ? "Saving…" : "Save Goal"}
            </button>
            <button
              onClick={() => { setAdding(false); setNewField(""); setNewTarget(""); }}
              style={{ padding: "9px 14px", background: C.faint, border: `1px solid ${C.line2}`, borderRadius: 8, fontSize: 12, fontWeight: 700, color: C.muted, cursor: "pointer", fontFamily: "inherit" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const router  = useRouter();
  const { user, authReady } = useAuthContext();

  const role      = String(user?.role || user?.Role || "").toLowerCase();
  const isAthlete = role.includes("ath");

  const [profileSport,    setProfileSport]    = useState("");
  const [profilePosition, setProfilePosition] = useState("");
  const [sport,           setSport]           = useState("");
  const [season,          setSeason]          = useState(CURRENT_YEAR);
  const [games,           setGames]           = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [modalOpen,       setModalOpen]       = useState(false);
  const [editGame,        setEditGame]        = useState(null);
  const [confirmDelete,   setConfirmDelete]   = useState(null);
  const [showSportPicker, setShowSportPicker] = useState(false);
  const [activeGroup,     setActiveGroup]     = useState(null);
  const [activeRole,      setActiveRole]      = useState(null);

  // Load athlete profile to get sport/position defaults
  useEffect(() => {
    if (!authReady || !isAthlete) return;
    fetch("/api/athlete/profile", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (!d.ok) return;
        const s = (d.profile.sport || "").toLowerCase();
        setProfileSport(s);
        setProfilePosition(d.profile.position || "");
        // Only apply profile default if no URL param is overriding sport
        if (!sport && !router.query.sport) setSport(s || "football");
      })
      .catch(() => {});
  }, [authReady, isAthlete]);

  // Apply URL params once when router is ready — URL params win over profile default
  useEffect(() => {
    if (!router.isReady) return;
    const { sport: qs, season: qy } = router.query;
    if (qs && typeof qs === "string") setSport(qs.toLowerCase());
    if (qy) {
      const y = Number(qy);
      if (y >= 2020 && y <= CURRENT_YEAR + 1) setSeason(y);
    }
  }, [router.isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load games whenever sport or season changes
  const loadGames = useCallback(async () => {
    if (!sport) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/athlete/stats/games?sport=${sport}&season=${season}`, { credentials: "include" });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      setGames(d.games || []);

      // Set default group/role from first game or position
      const first = d.games?.[0];
      if (first?.group_key) setActiveGroup(first.group_key);
      else if (SPORT_STATS[sport]?.type === "grouped") setActiveGroup(getFootballGroup(profilePosition));
      else setActiveGroup(null);

      if (first?.role_key) setActiveRole(first.role_key);
      else if (SPORT_STATS[sport]?.type === "role") {
        setActiveRole(Object.keys(SPORT_STATS[sport]?.roles || {})[0] || null);
      } else setActiveRole(null);

    } catch { toast.error("Could not load stats"); }
    finally { setLoading(false); }
  }, [sport, season, profilePosition]);

  useEffect(() => { if (sport) loadGames(); }, [loadGames]);

  const handleSaveGame = (game, isEdit) => {
    setGames(prev => isEdit
      ? prev.map(g => g.id === game.id ? game : g)
      : [game, ...prev]
    );
    setModalOpen(false);
    setEditGame(null);
  };

  const handleDelete = async (game) => {
    try {
      const r = await fetch(`/api/athlete/stats/games?id=${game.id}`, { method: "DELETE", credentials: "include" });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      setGames(prev => prev.filter(g => g.id !== game.id));
      toast.success("Game removed");
    } catch (e) {
      toast.error(e.message || "Could not delete");
    } finally {
      setConfirmDelete(null);
    }
  };

  const openAdd = () => { setEditGame(null); setModalOpen(true); };
  const openEdit = (game) => { setEditGame(game); setModalOpen(true); };

  if (!authReady) return null;
  if (!isAthlete) return <div style={{ padding: 32, fontSize: 14, color: "rgba(238,238,255,0.38)" }}>Not authorized.</div>;

  const cfg = SPORT_STATS[sport];
  const gameLabel = cfg?.gameLabel || "Game";

  const sortedGames = [...games].sort((a, b) => b.game_date.localeCompare(a.game_date));

  // For grouped/role sports, filter game log to the active group/role for summary
  const summaryGames = cfg?.type === "grouped"
    ? sortedGames.filter(g => !activeGroup || g.group_key === activeGroup)
    : cfg?.type === "role"
    ? sortedGames.filter(g => !activeRole || g.role_key === activeRole)
    : sortedGames;

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, paddingBottom: 80 }}>
      <Toaster position="bottom-center" toastOptions={{
        style: { background: "#1A1A2E", color: "#EEEEFF", fontSize: 13, fontWeight: 600, border: "1px solid #2A2A4A" },
        error: { iconTheme: { primary: "#EF4444", secondary: "#1A1A2E" } },
      }} />

      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.line}`, position: "sticky", top: 0, zIndex: 20, paddingTop: "env(safe-area-inset-top,0)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px" }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
            <ChevronLeft size={20} color={C.muted} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.white, letterSpacing: "-0.3px" }}>Season Stats</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
              {SPORT_LABELS[sport] || sport} · {season}
            </div>
          </div>
          <button
            onClick={() => router.push("/athlete/leaderboard")}
            title="Team Leaderboard"
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 10px", background: "transparent", border: `1px solid ${C.line2}`, borderRadius: 9, cursor: "pointer", color: C.muted, fontFamily: "inherit" }}>
            <Trophy size={15} color={C.gold} />
          </button>
          <button
            onClick={openAdd}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", background: C.accent, border: "none", borderRadius: 9, fontSize: 12, fontWeight: 800, color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
            <Plus size={13} />
            Add {gameLabel}
          </button>
        </div>

        {/* Sport selector — own row so its dropdown isn't clipped by overflowX */}
        <div style={{ padding: "0 18px 6px", position: "relative" }}>
          <button
            onClick={() => setShowSportPicker(p => !p)}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 12px", background: C.card, border: `1px solid ${C.line2}`, borderRadius: 8, fontSize: 12, fontWeight: 700, color: C.dim, cursor: "pointer", fontFamily: "inherit" }}>
            {SPORT_LABELS[sport] || "Select sport"}
            <ChevronDown size={12} />
          </button>
          {showSportPicker && (
            <div style={{ position: "absolute", top: "calc(100% + 2px)", left: 18, background: C.card, border: `1px solid ${C.line2}`, borderRadius: 10, zIndex: 200, minWidth: 170, boxShadow: "0 12px 32px rgba(0,0,0,0.5)", overflow: "hidden" }}>
              {ALL_SPORTS.map(s => (
                <button
                  key={s}
                  onClick={() => { setSport(s); setShowSportPicker(false); }}
                  style={{ display: "block", width: "100%", padding: "10px 14px", background: sport === s ? `${C.accent}18` : "none", border: "none", textAlign: "left", fontSize: 13, fontWeight: sport === s ? 700 : 500, color: sport === s ? C.accent : C.dim, cursor: "pointer", fontFamily: "inherit" }}>
                  {SPORT_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Season pills — scrollable */}
        <div style={{ display: "flex", gap: 8, padding: "0 18px 12px", overflowX: "auto" }}>
          {SEASON_OPTIONS.map(y => (
            <button
              key={y}
              onClick={() => setSeason(y)}
              style={{
                flexShrink: 0, padding: "7px 13px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                border: `1px solid ${season === y ? C.accent : C.line2}`,
                background: season === y ? `${C.accent}18` : C.card,
                color: season === y ? C.accent : C.dim,
              }}>
              {y}
            </button>
          ))}
        </div>

        {/* Group/role filter tabs */}
        {cfg?.type === "grouped" && (
          <div style={{ display: "flex", gap: 8, padding: "0 18px 12px", overflowX: "auto" }}>
            {Object.entries(cfg.groups).map(([key, g]) => (
              <button
                key={key}
                onClick={() => setActiveGroup(key)}
                style={{
                  flexShrink: 0, padding: "6px 12px", borderRadius: 7, fontSize: 11, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit", border: "none",
                  background: activeGroup === key ? `${C.accent}20` : C.faint,
                  color: activeGroup === key ? C.accent : C.muted,
                }}>
                {g.label}
              </button>
            ))}
          </div>
        )}

        {cfg?.type === "role" && (
          <div style={{ display: "flex", gap: 8, padding: "0 18px 12px" }}>
            {Object.entries(cfg.roles).map(([key, r]) => (
              <button
                key={key}
                onClick={() => setActiveRole(key)}
                style={{
                  flexShrink: 0, padding: "6px 12px", borderRadius: 7, fontSize: 11, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit", border: "none",
                  background: activeRole === key ? `${C.accent}20` : C.faint,
                  color: activeRole === key ? C.accent : C.muted,
                }}>
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 18px" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <div style={{ width: 24, height: 24, border: `2px solid ${C.line2}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.9s linear infinite" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : (
          <>
            {/* Empty state */}
            {games.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 20px", background: C.card, border: `1px solid ${C.line2}`, borderRadius: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: C.faint, border: `1px solid ${C.line2}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <TrendingUp size={22} color={C.muted} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.dim, marginBottom: 8 }}>No games logged yet</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 24, lineHeight: 1.7 }}>
                  Add your first {gameLabel.toLowerCase()} to start tracking your {season} season.
                </div>
                <button
                  onClick={openAdd}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "11px 22px", background: C.accent, border: "none", borderRadius: 10, fontSize: 13, fontWeight: 800, color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
                  <Plus size={14} />
                  Add First {gameLabel}
                </button>
              </div>
            )}

            {games.length > 0 && (
              <>
                <CareerArc sport={sport} groupKey={activeGroup} roleKey={activeRole} currentSeason={season} />
                <SeasonSummary
                  games={summaryGames}
                  sport={sport}
                  groupKey={activeGroup}
                  roleKey={activeRole}
                />
                <GoalsSection
                  sport={sport}
                  season={season}
                  games={summaryGames}
                  groupKey={activeGroup}
                  roleKey={activeRole}
                />
                <GameLog
                  games={sortedGames}
                  sport={sport}
                  onEdit={openEdit}
                  onDelete={setConfirmDelete}
                />
              </>
            )}
          </>
        )}
      </div>

      {/* Game modal */}
      {(modalOpen || editGame) && (
        <GameModal
          sport={sport}
          athletePosition={profilePosition}
          game={editGame}
          seasonYear={season}
          onSave={handleSaveGame}
          onClose={() => { setModalOpen(false); setEditGame(null); }}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)" }} onClick={() => setConfirmDelete(null)} />
          <div style={{ position: "relative", background: C.surface, border: `1px solid ${C.line2}`, borderRadius: 16, padding: 24, maxWidth: 340, width: "90%" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.white, marginBottom: 8 }}>Delete this game?</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>
              {fmtDate(confirmDelete.game_date)}{confirmDelete.opponent ? ` vs ${confirmDelete.opponent}` : ""} — this can't be undone.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: "10px", background: C.faint, border: `1px solid ${C.line2}`, borderRadius: 9, fontSize: 13, fontWeight: 700, color: C.dim, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} style={{ flex: 1, padding: "10px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 9, fontSize: 13, fontWeight: 700, color: C.red, cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
