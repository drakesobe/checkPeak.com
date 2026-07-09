// pages/org/athlete-stats.jsx
// Coach-side game stats logger for a specific athlete.
// Route: /org/athlete-stats?email=athlete@example.com&name=Jane+Smith&sport=football

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import { ChevronLeft, Plus, Pencil, Trash2, X, ChevronDown, Shield, Share2, Check } from "lucide-react";
import { Toaster, toast } from "react-hot-toast";
import {
  SPORT_STATS, SPORT_LABELS, ALL_SPORTS,
  getFootballGroup, getFields, getComputed, aggregateStats,
} from "@/lib/sportStats";

// ── Colour tokens — org portal palette (light) ────────────────────────────────

const DS = {
  bg:       "#F4F7FB",
  surface:  "#FFFFFF",
  card:     "#FFFFFF",
  card2:    "#F4F7FB",
  border:   "#E2E8F0",
  border2:  "#CBD5E1",
  text:     "#1A2535",
  muted:    "#5A6A7D",
  faint:    "#EEF3F9",
  accent:   "#1E3A5F",
  accentBg: "#EEF3F9",
  green:    "#00873E",
  greenBg:  "#F0FBF4",
  greenBdr: "#A8DFB8",
  red:      "#C8102E",
  redBg:    "#FFF0F0",
  redBdr:   "#FFC8C8",
  gold:     "#B86000",
  goldBg:   "#FFFBF0",
  goldBdr:  "#FFD580",
};

const inputStyle = {
  width: "100%", boxSizing: "border-box",
  padding: "9px 12px",
  background: DS.surface, border: `1px solid ${DS.border}`,
  borderRadius: 8, fontSize: 13, fontWeight: 500, color: DS.text,
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

function Label({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: DS.muted, marginBottom: 5 }}>
      {children}
    </div>
  );
}

function ResultBadge({ result }) {
  if (!result) return null;
  const color  = result === "W" ? DS.green : result === "L" ? DS.red : DS.gold;
  const bg     = result === "W" ? DS.greenBg : result === "L" ? DS.redBg : DS.goldBg;
  const border = result === "W" ? DS.greenBdr : result === "L" ? DS.redBdr : DS.goldBdr;
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 900, color, background: bg, border: `1px solid ${border}` }}>
      {result}
    </span>
  );
}

function VerifiedBadge() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 4, fontSize: 9, fontWeight: 900, letterSpacing: "0.1em", color: DS.green, background: DS.greenBg, border: `1px solid ${DS.greenBdr}` }}>
      <Shield size={8} /> COACH LOGGED
    </span>
  );
}

// ── Game Modal (identical logic to athlete page, org palette) ─────────────────

function GameModal({ sport, athletePosition, game, seasonYear, onSave, onClose }) {
  const cfg     = SPORT_STATS[sport];
  const isEdit  = !!game;
  const defaultGroup = sport === "football" ? getFootballGroup(game?.group_key || athletePosition) : null;
  const defaultRole  = cfg?.type === "role" ? (game?.role_key || Object.keys(cfg.roles || {})[0] || null) : null;

  const [groupKey, setGroupKey] = useState(defaultGroup);
  const [roleKey,  setRoleKey]  = useState(defaultRole);
  const [meta,     setMeta]     = useState(() => {
    const m = {};
    (cfg?.gameFields || []).forEach(f => { m[f.key] = game?.[f.key] ?? ""; });
    if (!game) m.game_date = new Date().toISOString().slice(0, 10);
    return m;
  });
  const [stats,  setStats]  = useState(() => game?.stats || {});
  const [notes,  setNotes]  = useState(game?.notes || "");
  const [saving, setSaving] = useState(false);
  const [events, setEvents] = useState(() => Array.isArray(game?.stats?.events) ? game.stats.events : []);
  const [newEvent, setNewEvent] = useState("");
  const [newMark,  setNewMark]  = useState("");
  const [newPlace, setNewPlace] = useState("");

  const fields   = getFields(sport, groupKey, roleKey);
  const isEvents = cfg?.type === "events";
  const setStat  = (key, val) => setStats(p => ({ ...p, [key]: val }));

  const addEvent = () => {
    if (!newEvent || !newMark) return;
    setEvents(e => [...e, { event: newEvent, mark: newMark, place: newPlace ? Number(newPlace) : null }]);
    setNewEvent(""); setNewMark(""); setNewPlace("");
  };

  const handleSave = async () => {
    if (!meta.game_date) { toast.error("Date is required"); return; }
    setSaving(true);
    try {
      const email = new URLSearchParams(window.location.search).get("email");
      const payload = {
        email,
        id:          game?.id,
        sport,
        season_year: seasonYear,
        ...meta,
        team_score:  meta.team_score ? Number(meta.team_score) : null,
        opp_score:   meta.opp_score  ? Number(meta.opp_score)  : null,
        group_key:   groupKey,
        role_key:    roleKey,
        stats:       isEvents ? { events } : stats,
        notes,
      };

      const r = await fetch("/api/org/athlete-stats", {
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
      <div style={{ position: "absolute", inset: 0, background: "rgba(26,37,53,0.5)" }} onClick={onClose} />
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 560, maxHeight: "92vh", background: DS.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, border: `1px solid ${DS.border}`, borderBottom: "none", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 20px", borderBottom: `1px solid ${DS.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: DS.text }}>{isEdit ? `Edit ${gameLabel}` : `Log ${gameLabel}`}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}>
            <X size={16} color={DS.muted} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px 8px" }}>
          {/* Group selector */}
          {cfg?.type === "grouped" && (
            <div style={{ marginBottom: 18 }}>
              <Label>Position Group</Label>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {Object.entries(cfg.groups).map(([key, g]) => (
                  <button key={key} onClick={() => setGroupKey(key)} style={{ padding: "6px 12px", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${groupKey === key ? DS.accent : DS.border}`, background: groupKey === key ? DS.accentBg : DS.surface, color: groupKey === key ? DS.accent : DS.muted }}>
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {cfg?.type === "role" && (
            <div style={{ marginBottom: 18 }}>
              <Label>Role</Label>
              <div style={{ display: "flex", gap: 7 }}>
                {Object.entries(cfg.roles).map(([key, r]) => (
                  <button key={key} onClick={() => setRoleKey(key)} style={{ padding: "6px 12px", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${roleKey === key ? DS.accent : DS.border}`, background: roleKey === key ? DS.accentBg : DS.surface, color: roleKey === key ? DS.accent : DS.muted }}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Game metadata */}
          <div style={{ marginBottom: 18 }}>
            <Label>{gameLabel} Info</Label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
              {(cfg?.gameFields || []).map(f => {
                const fullWidth = ["weight_class","meet_name","pin_time","tournament","surface","singles_doubles","score"].includes(f.key);
                if (f.type === "select") return (
                  <div key={f.key} style={fullWidth ? { gridColumn: "1 / -1" } : {}}>
                    <div style={{ fontSize: 9, color: DS.muted, marginBottom: 3, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{f.label}</div>
                    <select value={meta[f.key] || ""} onChange={e => setMeta(p => ({ ...p, [f.key]: e.target.value }))} style={selectStyle}>
                      <option value="">—</option>
                      {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                );
                return (
                  <div key={f.key} style={fullWidth ? { gridColumn: "1 / -1" } : {}}>
                    <div style={{ fontSize: 9, color: DS.muted, marginBottom: 3, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{f.label}</div>
                    <input type={f.type === "date" ? "date" : "text"} value={meta[f.key] || ""} onChange={e => setMeta(p => ({ ...p, [f.key]: e.target.value }))} inputMode={f.type === "int" ? "numeric" : undefined} style={inputStyle} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stat inputs */}
          {!isEvents && fields.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <Label>Stats</Label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 9 }}>
                {fields.map(f => {
                  if (f.type === "checkbox") {
                    const checked = !!stats[f.key];
                    return (
                      <button key={f.key} onClick={() => setStat(f.key, checked ? 0 : 1)} style={{ padding: "9px 8px", borderRadius: 7, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${checked ? DS.greenBdr : DS.border}`, background: checked ? DS.greenBg : DS.surface, color: checked ? DS.green : DS.muted, fontSize: 11, fontWeight: 700 }}>
                        {f.label} {checked ? "✓" : "—"}
                      </button>
                    );
                  }
                  if (f.type === "select") return (
                    <div key={f.key}>
                      <div style={{ fontSize: 9, color: DS.muted, marginBottom: 3, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{f.label}</div>
                      <select value={stats[f.key] || ""} onChange={e => setStat(f.key, e.target.value)} style={selectStyle}>
                        <option value="">—</option>
                        {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  );
                  return (
                    <div key={f.key}>
                      <div style={{ fontSize: 9, color: DS.muted, marginBottom: 3, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{f.label}</div>
                      <input type="text" inputMode={f.type === "int" ? "numeric" : "decimal"} value={stats[f.key] ?? ""} onChange={e => setStat(f.key, e.target.value)} style={inputStyle} placeholder="0" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Events (track/swimming) */}
          {isEvents && (
            <div style={{ marginBottom: 18 }}>
              <Label>Events</Label>
              {events.map((ev, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, padding: "9px 12px", background: DS.card2, borderRadius: 8, border: `1px solid ${DS.border}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: DS.text }}>{ev.event}</div>
                    <div style={{ fontSize: 11, color: DS.muted, marginTop: 1 }}>{ev.mark}{ev.place ? ` · #${ev.place}` : ""}</div>
                  </div>
                  <button onClick={() => setEvents(e => e.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}>
                    <X size={13} color={DS.muted} />
                  </button>
                </div>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8, marginTop: 8 }}>
                <div>
                  <div style={{ fontSize: 9, color: DS.muted, marginBottom: 3, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Event</div>
                  <select value={newEvent} onChange={e => setNewEvent(e.target.value)} style={selectStyle}>
                    <option value="">Select…</option>
                    {cfg.eventOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: DS.muted, marginBottom: 3, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Mark</div>
                  <input value={newMark} onChange={e => setNewMark(e.target.value)} placeholder={cfg.markHints?.[newEvent] || "10.85"} style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: 9, color: DS.muted, marginBottom: 3, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Place</div>
                  <input value={newPlace} onChange={e => setNewPlace(e.target.value)} inputMode="numeric" placeholder="1" style={inputStyle} />
                </div>
              </div>
              <button onClick={addEvent} disabled={!newEvent || !newMark} style={{ marginTop: 9, display: "flex", alignItems: "center", gap: 5, padding: "7px 13px", background: DS.faint, border: `1px solid ${DS.border}`, borderRadius: 7, fontSize: 11, fontWeight: 700, color: DS.accent, cursor: (!newEvent || !newMark) ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: (!newEvent || !newMark) ? 0.5 : 1 }}>
                <Plus size={11} /> Add Event
              </button>
            </div>
          )}

          {/* Notes */}
          <div style={{ marginBottom: 18 }}>
            <Label>Coach Notes (optional)</Label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Film review notes, game conditions, context for this performance…" style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }} />
          </div>
        </div>

        <div style={{ padding: "13px 20px", borderTop: `1px solid ${DS.border}` }}>
          <button onClick={handleSave} disabled={saving} style={{ width: "100%", padding: "12px", background: DS.accent, border: "none", borderRadius: 9, fontSize: 13, fontWeight: 800, color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : `Log ${gameLabel}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Season Summary (org palette) ──────────────────────────────────────────────

function SeasonSummary({ games, sport, groupKey, roleKey }) {
  const cfg = SPORT_STATS[sport];
  if (!cfg || games.length === 0) return null;

  const fields   = getFields(sport, groupKey, roleKey);
  const computed = getComputed(sport, groupKey, roleKey);

  if (cfg.type === "events") {
    const prs = {};
    games.forEach(g => { (g.stats?.events || []).forEach(ev => { if (ev.event && ev.mark && !prs[ev.event]) prs[ev.event] = ev.mark; }); });
    return (
      <div style={{ padding: "16px 18px", background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.16em", color: DS.muted, marginBottom: 12 }}>SEASON BEST MARKS</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {Object.entries(prs).map(([event, mark]) => (
            <div key={event} style={{ padding: "9px 13px", background: DS.card2, border: `1px solid ${DS.border}`, borderRadius: 9 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: DS.muted, marginBottom: 3 }}>{event}</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: DS.text }}>{mark}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!fields.length) return null;

  const totals = aggregateStats(games, fields);
  const computedVals = {};
  computed.forEach(c => { try { computedVals[c.key] = c.fn(totals); } catch { computedVals[c.key] = "—"; } });

  const cfg2 = cfg.type === "grouped" ? cfg.groups[groupKey] : cfg.type === "role" ? cfg.roles[roleKey] : cfg;
  const displayKeys = cfg2?.display || fields.slice(0, 6).map(f => f.key);
  const wins   = games.filter(g => g.result === "W").length;
  const losses = games.filter(g => g.result === "L").length;
  const coachLogs = games.filter(g => g.logged_by === "coach").length;

  return (
    <div style={{ padding: "16px 18px", background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: 12, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.16em", color: DS.muted }}>
          SEASON TOTALS — {games.length} {games.length === 1 ? (cfg?.gameLabel || "game").toLowerCase() : `${(cfg?.gameLabel || "game").toLowerCase()}s`}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {games.some(g => g.result) && <span style={{ fontSize: 11, fontWeight: 700, color: DS.muted }}>{wins}–{losses}</span>}
          {coachLogs > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 4, fontSize: 9, fontWeight: 900, letterSpacing: "0.1em", color: DS.green, background: DS.greenBg, border: `1px solid ${DS.greenBdr}` }}>
              <Shield size={8} /> {coachLogs} coach-logged
            </span>
          )}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(85px, 1fr))", gap: 9 }}>
        {displayKeys.map(key => {
          const isComputed = computed.some(c => c.key === key);
          const val   = isComputed ? computedVals[key] : (totals[key] ?? "—");
          const field = fields.find(f => f.key === key);
          const cDef  = computed.find(c => c.key === key);
          const label = isComputed ? (cDef?.label || key) : (field?.label || key);
          return (
            <div key={key} style={{ textAlign: "center", padding: "11px 8px", background: DS.card2, border: `1px solid ${DS.border}`, borderRadius: 9 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: DS.text, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 4 }}>{val === undefined || val === null ? "—" : val}</div>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: DS.muted }}>{label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Game Log (org palette) ─────────────────────────────────────────────────────

function GameLog({ games, sport, onEdit, onDelete }) {
  const cfg = SPORT_STATS[sport];
  if (games.length === 0) return null;

  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.16em", color: DS.muted, marginBottom: 10 }}>
        {(cfg?.gameLabel || "GAME").toUpperCase()} LOG
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {games.map(game => {
          const groupKey    = game.group_key;
          const roleKey     = game.role_key;
          const fields      = getFields(sport, groupKey, roleKey);
          const computed    = getComputed(sport, groupKey, roleKey);
          const cfg2        = cfg?.type === "grouped" ? cfg?.groups?.[groupKey] : cfg?.type === "role" ? cfg?.roles?.[roleKey] : cfg;
          const displayKeys = cfg2?.display || fields.slice(0, 4).map(f => f.key);
          const totals      = aggregateStats([game], fields);
          const computedVals = {};
          computed.forEach(c => { try { computedVals[c.key] = c.fn(totals, [game]); } catch { computedVals[c.key] = "—"; } });
          const eventList = Array.isArray(game.stats?.events) ? game.stats.events : null;
          const isCoach   = game.logged_by === "coach";

          return (
            <div key={game.id} style={{ background: DS.surface, border: `1px solid ${isCoach ? DS.greenBdr : DS.border}`, borderRadius: 11, padding: "12px 15px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: eventList || fields.length > 0 ? 9 : 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: DS.muted }}>{fmtDate(game.game_date)}</span>
                  {game.opponent && <span style={{ fontSize: 12, fontWeight: 700, color: DS.text }}>vs {game.opponent}</span>}
                  {game.location && <span style={{ fontSize: 11, color: DS.muted }}>{game.location}</span>}
                  <ResultBadge result={game.result} />
                  {(game.team_score != null && game.opp_score != null) && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: DS.muted }}>{game.team_score}–{game.opp_score}</span>
                  )}
                  {isCoach && <VerifiedBadge />}
                  {!isCoach && <span style={{ display: "inline-block", padding: "2px 7px", borderRadius: 4, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: DS.muted, background: DS.faint, border: `1px solid ${DS.border}` }}>ATHLETE REPORTED</span>}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => onEdit(game)} style={{ background: DS.faint, border: `1px solid ${DS.border}`, borderRadius: 6, padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center" }}>
                    <Pencil size={11} color={DS.muted} />
                  </button>
                  <button onClick={() => onDelete(game)} style={{ background: DS.redBg, border: `1px solid ${DS.redBdr}`, borderRadius: 6, padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center" }}>
                    <Trash2 size={11} color={DS.red} />
                  </button>
                </div>
              </div>

              {!eventList && fields.length > 0 && (
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  {displayKeys.map(key => {
                    const isComp  = computed.some(c => c.key === key);
                    const val     = isComp ? computedVals[key] : (game.stats?.[key] ?? null);
                    const field   = fields.find(f => f.key === key);
                    const compDef = computed.find(c => c.key === key);
                    const label   = isComp ? (compDef?.label || key) : (field?.label || key);
                    if (!isComp && (val === 0 || val === "" || val == null)) return null;
                    return (
                      <div key={key}>
                        <div style={{ fontSize: 14, fontWeight: 900, color: DS.text, letterSpacing: "-0.02em", lineHeight: 1 }}>{val ?? "—"}</div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: DS.muted, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              {eventList && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {eventList.map((ev, i) => (
                    <div key={i} style={{ padding: "4px 10px", background: DS.card2, border: `1px solid ${DS.border}`, borderRadius: 7, fontSize: 11 }}>
                      <span style={{ fontWeight: 700, color: DS.text }}>{ev.mark}</span>
                      <span style={{ color: DS.muted, marginLeft: 4 }}>{ev.event}</span>
                      {ev.place && <span style={{ color: DS.accent, marginLeft: 4 }}>#{ev.place}</span>}
                    </div>
                  ))}
                </div>
              )}
              {game.notes && (
                <div style={{ marginTop: 7, fontSize: 11, color: DS.muted, fontStyle: "italic" }}>{game.notes}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CoachAthleteStatsPage() {
  const router = useRouter();
  const { user, authReady } = useAuthContext();

  const role      = String(user?.role || user?.Role || "").toLowerCase();
  const isOrgSide = role.includes("org") || role.includes("admin") || role.includes("train");

  const { email, name: qName } = router.query;

  const [athleteName,     setAthleteName]     = useState(qName || "Athlete");
  const [sport,           setSport]           = useState("");
  const [season,          setSeason]          = useState(CURRENT_YEAR);
  const [games,           setGames]           = useState([]);
  const [loading,         setLoading]         = useState(false);
  const [modalOpen,       setModalOpen]       = useState(false);
  const [editGame,        setEditGame]        = useState(null);
  const [confirmDelete,   setConfirmDelete]   = useState(null);
  const [showSportPicker, setShowSportPicker] = useState(false);
  const [activeGroup,     setActiveGroup]     = useState(null);
  const [activeRole,      setActiveRole]      = useState(null);

  // Load games whenever sport or season changes
  const loadGames = useCallback(async () => {
    if (!sport || !email) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/org/athlete-stats?email=${encodeURIComponent(email)}&sport=${sport}&season=${season}`, { credentials: "include" });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      if (d.athleteName && athleteName === "Athlete") setAthleteName(d.athleteName);
      setGames(d.games || []);

      const first = d.games?.[0];
      if (first?.group_key) setActiveGroup(first.group_key);
      else if (SPORT_STATS[sport]?.type === "grouped") setActiveGroup(getFootballGroup(""));
      else setActiveGroup(null);

      if (first?.role_key) setActiveRole(first.role_key);
      else if (SPORT_STATS[sport]?.type === "role") setActiveRole(Object.keys(SPORT_STATS[sport]?.roles || {})[0] || null);
      else setActiveRole(null);
    } catch (e) {
      toast.error(e.message || "Could not load stats");
    } finally {
      setLoading(false);
    }
  }, [sport, season, email]);

  useEffect(() => { if (sport && email) loadGames(); }, [loadGames]);

  // Default sport from query string if provided
  useEffect(() => {
    const s = String(router.query.sport || "").toLowerCase();
    if (s && SPORT_STATS[s]) setSport(s);
    if (router.query.name) setAthleteName(router.query.name);
  }, [router.query]);

  const handleSaveGame = (game, isEdit) => {
    setGames(prev => isEdit ? prev.map(g => g.id === game.id ? game : g) : [game, ...prev]);
    setModalOpen(false); setEditGame(null);
  };

  const handleDelete = async (game) => {
    try {
      const r = await fetch(`/api/org/athlete-stats?id=${game.id}&email=${encodeURIComponent(email)}`, { method: "DELETE", credentials: "include" });
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

  if (!authReady) return null;
  if (!isOrgSide) return <div style={{ padding: 32, fontSize: 14, color: DS.muted }}>Coach access required.</div>;
  if (!email)     return <div style={{ padding: 32, fontSize: 14, color: DS.muted }}>No athlete selected.</div>;

  const cfg = SPORT_STATS[sport];
  const gameLabel = cfg?.gameLabel || "Game";
  const sortedGames = [...games].sort((a, b) => b.game_date.localeCompare(a.game_date));
  const summaryGames = cfg?.type === "grouped"
    ? sortedGames.filter(g => !activeGroup || g.group_key === activeGroup)
    : cfg?.type === "role"
    ? sortedGames.filter(g => !activeRole  || g.role_key  === activeRole)
    : sortedGames;

  return (
    <div style={{ minHeight: "100dvh", background: DS.bg, paddingBottom: 80 }}>
      <Toaster position="bottom-center" />

      {/* Header */}
      <div style={{ background: DS.surface, borderBottom: `1px solid ${DS.border}`, position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px" }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
            <ChevronLeft size={20} color={DS.muted} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: DS.text }}>{athleteName}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 1 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 6px", borderRadius: 4, fontSize: 9, fontWeight: 900, letterSpacing: "0.1em", color: DS.green, background: DS.greenBg, border: `1px solid ${DS.greenBdr}` }}>
                <Shield size={8} /> COACH PORTAL
              </span>
              <span style={{ fontSize: 11, color: DS.muted }}>{SPORT_LABELS[sport] || "Select sport"} · {season}</span>
            </div>
          </div>
          {sport && (
            <button onClick={() => { setEditGame(null); setModalOpen(true); }} style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", background: DS.accent, border: "none", borderRadius: 9, fontSize: 12, fontWeight: 800, color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
              <Plus size={13} /> Log {gameLabel}
            </button>
          )}
        </div>

        {/* Sport selector — own row, not inside overflow container */}
        <div style={{ padding: "0 18px 6px", position: "relative" }}>
          <button onClick={() => setShowSportPicker(p => !p)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 12px", background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: 8, fontSize: 12, fontWeight: 700, color: DS.muted, cursor: "pointer", fontFamily: "inherit" }}>
            {SPORT_LABELS[sport] || "Select sport"} <ChevronDown size={11} />
          </button>
          {showSportPicker && (
            <div style={{ position: "absolute", top: "calc(100% + 2px)", left: 18, background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: 10, zIndex: 200, minWidth: 170, boxShadow: "0 12px 32px rgba(26,37,53,0.15)", overflow: "hidden" }}>
              {ALL_SPORTS.map(s => (
                <button key={s} onClick={() => { setSport(s); setShowSportPicker(false); }} style={{ display: "block", width: "100%", padding: "9px 14px", background: sport === s ? DS.accentBg : "none", border: "none", textAlign: "left", fontSize: 12, fontWeight: sport === s ? 700 : 500, color: sport === s ? DS.accent : DS.muted, cursor: "pointer", fontFamily: "inherit" }}>
                  {SPORT_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Season pills — scrollable */}
        <div style={{ display: "flex", gap: 9, padding: "0 18px 12px", overflowX: "auto" }}>
          {SEASON_OPTIONS.map(y => (
            <button key={y} onClick={() => setSeason(y)} style={{ flexShrink: 0, padding: "7px 13px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${season === y ? DS.accent : DS.border}`, background: season === y ? DS.accentBg : DS.surface, color: season === y ? DS.accent : DS.muted }}>
              {y}
            </button>
          ))}
        </div>

        {cfg?.type === "grouped" && (
          <div style={{ display: "flex", gap: 7, padding: "0 18px 12px", overflowX: "auto" }}>
            {Object.entries(cfg.groups).map(([key, g]) => (
              <button key={key} onClick={() => setActiveGroup(key)} style={{ flexShrink: 0, padding: "5px 11px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${activeGroup === key ? DS.accent : DS.border}`, background: activeGroup === key ? DS.accentBg : DS.surface, color: activeGroup === key ? DS.accent : DS.muted }}>
                {g.label}
              </button>
            ))}
          </div>
        )}
        {cfg?.type === "role" && (
          <div style={{ display: "flex", gap: 7, padding: "0 18px 12px" }}>
            {Object.entries(cfg.roles).map(([key, r]) => (
              <button key={key} onClick={() => setActiveRole(key)} style={{ flexShrink: 0, padding: "5px 11px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${activeRole === key ? DS.accent : DS.border}`, background: activeRole === key ? DS.accentBg : DS.surface, color: activeRole === key ? DS.accent : DS.muted }}>
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* No sport selected */}
      {!sport && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: DS.faint, border: `1px solid ${DS.border}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <BarChart2 size={22} color={DS.muted} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: DS.text, marginBottom: 6 }}>Select a sport to begin</div>
          <div style={{ fontSize: 12, color: DS.muted }}>Choose {athleteName}&apos;s sport above to log game stats.</div>
        </div>
      )}

      {sport && (
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "22px 18px" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
              <div style={{ width: 22, height: 22, border: `2px solid ${DS.border}`, borderTopColor: DS.accent, borderRadius: "50%", animation: "spin 0.9s linear infinite" }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : (
            <>
              {games.length === 0 && (
                <div style={{ textAlign: "center", padding: "50px 20px", background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: DS.faint, border: `1px solid ${DS.border}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <Shield size={20} color={DS.muted} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: DS.text, marginBottom: 6 }}>No games logged yet</div>
                  <div style={{ fontSize: 12, color: DS.muted, marginBottom: 20, lineHeight: 1.6 }}>
                    Log {athleteName}&apos;s first {gameLabel.toLowerCase()} — your log is marked coach-verified on their recruit profile.
                  </div>
                  <button onClick={() => { setEditGame(null); setModalOpen(true); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 22px", background: DS.accent, border: "none", borderRadius: 9, fontSize: 13, fontWeight: 800, color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
                    <Plus size={13} /> Log First {gameLabel}
                  </button>
                </div>
              )}

              {games.length > 0 && (
                <>
                  <SeasonSummary games={summaryGames} sport={sport} groupKey={activeGroup} roleKey={activeRole} />
                  <GameLog games={sortedGames} sport={sport} onEdit={g => { setEditGame(g); setModalOpen(true); }} onDelete={setConfirmDelete} />
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Game modal */}
      {(modalOpen || editGame) && (
        <GameModal
          sport={sport}
          athletePosition=""
          game={editGame}
          seasonYear={season}
          onSave={handleSaveGame}
          onClose={() => { setModalOpen(false); setEditGame(null); }}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(26,37,53,0.5)" }} onClick={() => setConfirmDelete(null)} />
          <div style={{ position: "relative", background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: 14, padding: 24, maxWidth: 340, width: "90%" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: DS.text, marginBottom: 7 }}>Delete this game?</div>
            <div style={{ fontSize: 12, color: DS.muted, marginBottom: 18 }}>
              {fmtDate(confirmDelete.game_date)}{confirmDelete.opponent ? ` vs ${confirmDelete.opponent}` : ""} — this can&apos;t be undone.
            </div>
            <div style={{ display: "flex", gap: 9 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: "9px", background: DS.faint, border: `1px solid ${DS.border}`, borderRadius: 8, fontSize: 12, fontWeight: 700, color: DS.muted, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} style={{ flex: 1, padding: "9px", background: DS.redBg, border: `1px solid ${DS.redBdr}`, borderRadius: 8, fontSize: 12, fontWeight: 700, color: DS.red, cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
