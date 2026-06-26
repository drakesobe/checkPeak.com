// pages/org/film.js  -  Film Intelligence lobby
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import { Toaster, toast } from "react-hot-toast";
import {
  Film, Upload, Users, Users2, Plus, Trash2, RefreshCw, ChevronRight,
  CheckCircle2, AlertCircle, Loader2, X, Video, Zap, Activity,
  Play, TrendingUp, Clock, Volume2, FileText, Search, Tag,
  ArrowRight, Sparkles, ChevronDown, Check, Shield,
} from "lucide-react";

const DS = {
  pageBg:      "#F4F7FB",
  cardBg:      "#FFFFFF",
  brand:       "#1E3A5F",
  brandBg:     "#EEF3F9",
  brandBorder: "#C0D0E0",
  safe:        "#00873E",
  safeBg:      "#F0FBF4",
  safeBorder:  "#A8DFB8",
  caution:     "#B86000",
  cautionBg:   "#FFFBF0",
  warn:        "#C8102E",
  warnBg:      "#FFF0F0",
  bodyText:    "#1A2535",
  labelText:   "#5A6A7D",
  dimText:     "#9BA8B4",
  border:      "#E8ECF0",
};

// Derive a UI state from film.status + film.play_count
function filmUIState(film) {
  const plays = film.play_count ?? 0;
  if (film.status === "uploading") return "uploading";
  if (film.status === "failed")    return "failed";
  if (plays === 0)                 return "needs-tagging";
  return "has-plays";
}

const STATE_CFG = {
  "uploading":     { accent: DS.brand,   label: "Uploading",  spin: true  },
  "failed":        { accent: DS.warn,    label: "Failed",     spin: false },
  "needs-tagging": { accent: DS.caution, label: "Tag Plays",  spin: false },
  "has-plays":     { accent: DS.brand,   label: "Ready",      spin: false },
};

function fmtDate(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
  catch { return String(iso); }
}

function fmtDuration(secs) {
  if (!secs) return null;
  const m = Math.floor(secs / 60), s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const FILM_TYPES = [
  { key: "game",       label: "Game",       color: "#1E3A5F", bg: "#EEF3F9" },
  { key: "practice",   label: "Practice",   color: "#7C3AED", bg: "#F5F3FF" },
  { key: "7v7",        label: "7v7",        color: "#D97706", bg: "#FFFBEB" },
  { key: "scrimmage",  label: "Scrimmage",  color: "#0891B2", bg: "#ECFEFF" },
  { key: "tournament", label: "Tournament", color: "#C8102E", bg: "#FFF0F0" },
];
const FILM_TYPE_MAP = Object.fromEntries(FILM_TYPES.map(t => [t.key, t]));

const inputStyle = { width: "100%", boxSizing: "border-box", border: `1px solid ${DS.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: DS.bodyText, outline: "none", background: DS.pageBg };
const labelStyle = { display: "block", fontSize: 11, fontWeight: 700, color: DS.labelText, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 };

// ── Roster panel ──────────────────────────────────────────────────────────────
function RosterPanel({ onClose, defaultSport = "football" }) {
  const [tab,     setTab]     = useState("roster"); // "roster" | "sync" | "csv"
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Roster tab
  const [form,   setForm]   = useState({ playerName: "", jerseyNumber: "", position: "" });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");

  // Sync tab
  const [sport,      setSport]      = useState(defaultSport || "football");
  const [athletes,   setAthletes]   = useState([]);
  const [athLoading, setAthLoading] = useState(false);
  const [jerseyMap,  setJerseyMap]  = useState({});
  const [selected,   setSelected]   = useState(new Set());
  const [syncing,    setSyncing]    = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);

  // CSV tab
  const [csvText,      setCsvText]      = useState("");
  const [csvRows,      setCsvRows]      = useState([]);
  const [csvParsed,    setCsvParsed]    = useState(false);
  const [importing,    setImporting]    = useState(false);
  const [importResult, setImportResult] = useState(null);
  const csvFileRef = useRef(null);

  const POSITIONS = ["QB","RB","WR","TE","OL","DE","DT","LB","CB","S","K","P","ST"];
  const SPORTS    = ["football","basketball","baseball","soccer","lacrosse","softball","volleyball","track","wrestling","other"];

  // ── Roster helpers ──
  async function fetchRoster() {
    setLoading(true);
    try {
      const r = await fetch("/api/film/roster", { credentials: "include" });
      const d = await r.json();
      setPlayers(d.players ?? []);
    } catch {}
    setLoading(false);
  }
  useEffect(() => { fetchRoster(); }, []);

  async function addPlayer(e) {
    e.preventDefault(); setErr("");
    if (!form.playerName.trim() || form.jerseyNumber === "") { setErr("Name and jersey number are required."); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/film/roster", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName: form.playerName.trim(), jerseyNumber: Number(form.jerseyNumber), position: form.position.trim() || null }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Failed to add player."); }
      else { setForm({ playerName: "", jerseyNumber: "", position: "" }); fetchRoster(); }
    } catch { setErr("Network error."); }
    setSaving(false);
  }

  async function removePlayer(id) {
    if (!confirm("Remove this player?")) return;
    await fetch(`/api/film/roster?playerId=${id}`, { method: "DELETE", credentials: "include" });
    fetchRoster();
  }

  // ── Sync helpers ──
  const syncedMap = {};
  for (const a of athletes) {
    const m = players.find(p => p.player_name.toLowerCase().trim() === (a.name || "").toLowerCase().trim());
    if (m) syncedMap[a.id] = m.jersey_number;
  }
  const syncedCount = Object.keys(syncedMap).length;

  async function fetchAthletes(s) {
    setAthLoading(true);
    setAthletes([]);
    setJerseyMap({});
    setSelected(new Set());
    setSyncStatus(null);
    try {
      const r = await fetch("/api/org/getAthletes", { credentials: "include" });
      const d = await r.json();
      const all = d.athletes ?? d.data ?? [];
      const filtered = (!s || s === "all") ? all : all.filter(a => (a.sport || "").toLowerCase() === s.toLowerCase());
      setAthletes(filtered);
      // Pre-fill jersey numbers for athletes already matched in roster by name
      const initMap = {};
      for (const a of filtered) {
        const match = players.find(p => p.player_name.toLowerCase().trim() === (a.name || "").toLowerCase().trim());
        if (match) initMap[a.id] = String(match.jersey_number);
      }
      setJerseyMap(initMap);
    } catch {}
    setAthLoading(false);
  }

  useEffect(() => { if (tab === "sync") fetchAthletes(sport); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleSelect(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function syncSelected() {
    const toAdd = athletes.filter(a => selected.has(a.id));
    const playersData = toAdd.map(a => ({ playerName: a.name, jerseyNumber: Number(jerseyMap[a.id] ?? -1), position: null }));
    const missing = playersData.filter(p => isNaN(p.jerseyNumber) || p.jerseyNumber < 0 || p.jerseyNumber > 99);
    if (missing.length) { setSyncStatus({ ok: false, errors: [{ reason: `Assign jersey #s (0–99) for all selected athletes before syncing.` }] }); return; }
    setSyncing(true);
    try {
      const r = await fetch("/api/film/roster-bulk", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ players: playersData }),
      });
      const d = await r.json();
      setSyncStatus(d);
      if (d.ok) {
        fetchRoster();
        setJerseyMap({});
        setSelected(new Set());
        toast.success(`Synced - ${d.inserted} added, ${d.updated} updated`);
      } else {
        toast.error(d.errors?.[0]?.reason ?? "Sync failed");
      }
    } catch { setSyncStatus({ ok: false, errors: [{ reason: "Network error" }] }); toast.error("Network error"); }
    setSyncing(false);
  }

  // ── CSV helpers ──
  function parseCSV(text) {
    return text.split("\n").map(l => l.trim()).filter(Boolean).reduce((acc, line) => {
      if (/^(name|player)[,\t]/i.test(line)) return acc;
      const parts = line.includes("\t") ? line.split("\t") : line.split(",");
      const name      = (parts[0] || "").trim().replace(/^["']|["']$/g, "");
      const jerseyRaw = (parts[1] || "").trim().replace(/^["']|["']$/g, "").replace("#","");
      const pos       = (parts[2] || "").trim().replace(/^["']|["']$/g, "");
      const jersey    = parseInt(jerseyRaw, 10);
      let err = null;
      if (!name) err = "Name missing";
      else if (isNaN(jersey) || jersey < 0 || jersey > 99) err = "Jersey must be 0–99";
      acc.push({ name, jerseyRaw, jersey, position: pos || null, err });
      return acc;
    }, []);
  }

  function handleCSVText(text) {
    setCsvText(text);
    setImportResult(null);
    if (text.trim()) { setCsvRows(parseCSV(text)); setCsvParsed(true); }
    else             { setCsvRows([]); setCsvParsed(false); }
  }

  function handleCSVFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => handleCSVText(ev.target.result || "");
    reader.readAsText(file);
  }

  async function importCSV() {
    const validRows = csvRows.filter(r => !r.err);
    if (!validRows.length) return;
    setImporting(true);
    try {
      const r = await fetch("/api/film/roster-bulk", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ players: validRows.map(r => ({ playerName: r.name, jerseyNumber: r.jersey, position: r.position })) }),
      });
      const d = await r.json();
      setImportResult(d);
      if (d.ok) {
        fetchRoster();
        setCsvText(""); setCsvRows([]); setCsvParsed(false);
        toast.success(`Imported - ${d.inserted} added, ${d.updated} updated`);
      } else {
        toast.error(d.errors?.[0]?.reason ?? "Import failed");
      }
    } catch { setImportResult({ ok: false, errors: [{ reason: "Network error" }] }); toast.error("Network error"); }
    setImporting(false);
  }

  const validCSVRows   = csvRows.filter(r => !r.err);
  const invalidCSVRows = csvRows.filter(r =>  r.err);

  const TABS = [
    { id: "roster", label: "Roster",        Icon: Users    },
    { id: "sync",   label: "Sync Athletes", Icon: RefreshCw },
    { id: "csv",    label: "Import CSV",    Icon: FileText  },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: DS.cardBg, borderRadius: 16, padding: 28, width: "100%", maxWidth: 540, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: DS.bodyText }}>Manage Roster</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: DS.dimText }}><X size={20} /></button>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 4, marginBottom: 22, background: DS.pageBg, borderRadius: 10, padding: 4 }}>
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                background: active ? DS.cardBg : "transparent", border: "none", borderRadius: 7,
                padding: "7px 4px", cursor: "pointer",
                fontWeight: active ? 700 : 500, fontSize: 12,
                color: active ? DS.brand : DS.labelText,
                boxShadow: active ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                transition: "all 0.15s",
              }}>
                <t.Icon size={13} /> {t.label}
              </button>
            );
          })}
        </div>

        {/* ── TAB: Roster ── */}
        {tab === "roster" && (
          <>
            <form onSubmit={addPlayer} style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 90px", gap: 8 }}>
                <input value={form.playerName} onChange={e => setForm(f => ({ ...f, playerName: e.target.value }))} placeholder="Player name" style={inputStyle} required />
                <input type="number" value={form.jerseyNumber} onChange={e => setForm(f => ({ ...f, jerseyNumber: e.target.value }))} placeholder="#" min={0} max={99} style={inputStyle} required />
                <select value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} style={inputStyle}>
                  <option value="">Pos.</option>
                  {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              {err && <p style={{ margin: 0, fontSize: 12, color: DS.warn }}>{err}</p>}
              <button type="submit" disabled={saving} style={{ background: DS.brand, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}>
                <Plus size={14} /> {saving ? "Adding…" : "Add Player"}
              </button>
            </form>
            {loading ? (
              <div style={{ textAlign: "center", color: DS.dimText, padding: 20 }}><Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /></div>
            ) : players.length === 0 ? (
              <p style={{ color: DS.dimText, textAlign: "center", fontSize: 13 }}>No players yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {players.map(p => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: DS.pageBg, borderRadius: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 15, color: DS.brand, minWidth: 32, textAlign: "center" }}>#{p.jersey_number}</span>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: DS.bodyText }}>{p.player_name}</span>
                    {p.position && <span style={{ fontSize: 11, fontWeight: 700, color: DS.labelText, background: DS.brandBg, borderRadius: 4, padding: "2px 6px" }}>{p.position}</span>}
                    <button onClick={() => removePlayer(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: DS.dimText, padding: 4 }}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── TAB: Sync Athletes ── */}
        {tab === "sync" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Sport selector */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ ...labelStyle, margin: 0, whiteSpace: "nowrap" }}>Sport</label>
              <select value={sport} onChange={e => { setSport(e.target.value); fetchAthletes(e.target.value); }} style={{ ...inputStyle, flex: 1 }}>
                {SPORTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                <option value="all">All Sports</option>
              </select>
              <button onClick={() => fetchAthletes(sport)} style={{ flexShrink: 0, background: DS.pageBg, border: `1px solid ${DS.border}`, borderRadius: 7, padding: "8px 10px", cursor: "pointer", color: DS.labelText }}>
                <RefreshCw size={13} />
              </button>
            </div>

            {/* Sync result */}
            {syncStatus && (
              <div style={{ padding: "10px 14px", borderRadius: 8, background: syncStatus.ok ? DS.safeBg : DS.warnBg, border: `1px solid ${syncStatus.ok ? DS.safeBorder : "#C8102E30"}` }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: syncStatus.ok ? DS.safe : DS.warn }}>
                  {syncStatus.ok
                    ? `Done - ${syncStatus.inserted} added, ${syncStatus.updated} updated${syncStatus.skipped ? `, ${syncStatus.skipped} skipped` : ""}`
                    : `Error - ${syncStatus.errors?.[0]?.reason ?? "Unknown"}`}
                </p>
              </div>
            )}

            {athLoading ? (
              <div style={{ textAlign: "center", padding: 28, color: DS.dimText }}><Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /></div>
            ) : athletes.length === 0 ? (
              <p style={{ color: DS.dimText, textAlign: "center", fontSize: 13, padding: 16 }}>
                No athletes found for {sport}. Make sure athletes have their sport field set.
              </p>
            ) : (
              <>
                {/* Summary bar */}
                <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 12px", background: DS.pageBg, borderRadius: 8, border: `1px solid ${DS.border}` }}>
                  {syncedCount > 0
                    ? <span style={{ fontSize: 12, fontWeight: 600, color: DS.safe }}>✓ {syncedCount} synced</span>
                    : null}
                  {athletes.length - syncedCount > 0
                    ? <span style={{ fontSize: 12, fontWeight: 600, color: DS.caution }}>{syncedCount > 0 ? "· " : ""}{athletes.length - syncedCount} need jersey</span>
                    : null}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 12, color: DS.labelText }}>{selected.size} selected</span>
                  <button onClick={() => setSelected(new Set(athletes.map(a => a.id)))} style={{ fontSize: 11, color: DS.brand, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>All</button>
                  <button onClick={() => setSelected(new Set())} style={{ fontSize: 11, color: DS.dimText, background: "none", border: "none", cursor: "pointer" }}>None</button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" }}>
                  {athletes.map(a => {
                    const isSelected = selected.has(a.id);
                    const isSynced   = a.id in syncedMap;
                    const jerseyVal  = jerseyMap[a.id] ?? "";
                    return (
                      <div key={a.id} onClick={() => toggleSelect(a.id)} style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                        background: isSelected ? DS.brandBg : isSynced ? DS.safeBg : DS.pageBg,
                        borderRadius: 8, cursor: "pointer",
                        border: `1px solid ${isSelected ? DS.brandBorder : isSynced ? DS.safeBorder : DS.border}`,
                        transition: "all 0.12s",
                      }}>
                        <input type="checkbox" checked={isSelected} onChange={() => {}} style={{ accentColor: DS.brand, cursor: "pointer", flexShrink: 0 }} />
                        <span style={{ flex: 1, fontWeight: 600, fontSize: 13, color: DS.bodyText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                        {isSynced && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: DS.safe, background: "#fff", border: `1px solid ${DS.safeBorder}`, borderRadius: 20, padding: "2px 8px", flexShrink: 0 }}>
                            ✓ #{syncedMap[a.id]}
                          </span>
                        )}
                        <input
                          type="number" placeholder="#" min={0} max={99} value={jerseyVal}
                          onClick={e => e.stopPropagation()}
                          onChange={e => setJerseyMap(prev => ({ ...prev, [a.id]: e.target.value }))}
                          title={isSynced ? `In roster as #${syncedMap[a.id]} - edit to reassign` : "Assign jersey number"}
                          style={{ ...inputStyle, width: 58, textAlign: "center", padding: "5px 6px", fontSize: 12, flexShrink: 0, borderColor: DS.border }}
                        />
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={syncSelected}
                  disabled={syncing || selected.size === 0}
                  style={{ background: DS.brand, color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 700, fontSize: 13, cursor: (syncing || selected.size === 0) ? "not-allowed" : "pointer", opacity: (syncing || selected.size === 0) ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  {syncing
                    ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Syncing…</>
                    : <><RefreshCw size={14} /> Sync {selected.size > 0 ? `${selected.size} ` : ""}to Roster</>}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── TAB: Import CSV ── */}
        {tab === "csv" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: DS.pageBg, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: DS.labelText, lineHeight: 1.6 }}>
              Format: <strong>Name, Jersey #, Position</strong> (one player per line - header row optional)<br />
              <code style={{ color: DS.brand, fontFamily: "monospace", fontSize: 12 }}>Marcus Johnson,12,WR</code><br />
              <code style={{ color: DS.brand, fontFamily: "monospace", fontSize: 12 }}>Tyler Brooks,24,RB</code>
            </div>

            <div>
              <input ref={csvFileRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={handleCSVFile} />
              <button onClick={() => csvFileRef.current?.click()} style={{ background: DS.pageBg, border: `1px solid ${DS.border}`, borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13, color: DS.bodyText, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <FileText size={13} /> Choose CSV File
              </button>
            </div>

            <div>
              <label style={labelStyle}>Or paste CSV text</label>
              <textarea
                value={csvText}
                onChange={e => handleCSVText(e.target.value)}
                placeholder={"Marcus Johnson,12,WR\nTyler Brooks,24,RB\nDavin Harris,7,QB"}
                rows={5}
                style={{ ...inputStyle, fontFamily: "monospace", fontSize: 12, resize: "vertical" }}
              />
            </div>

            {importResult && (
              <div style={{ padding: "10px 14px", borderRadius: 8, background: importResult.ok ? DS.safeBg : DS.warnBg, border: `1px solid ${importResult.ok ? DS.safeBorder : "#C8102E30"}` }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: importResult.ok ? DS.safe : DS.warn }}>
                  {importResult.ok
                    ? `Imported - ${importResult.inserted} added, ${importResult.updated} updated`
                    : `Failed - ${importResult.errors?.[0]?.reason ?? "Unknown"}`}
                </p>
              </div>
            )}

            {csvParsed && csvRows.length > 0 && !importResult && (
              <>
                <div style={{ border: `1px solid ${DS.border}`, borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 64px 70px 90px", background: DS.pageBg, padding: "8px 12px", borderBottom: `1px solid ${DS.border}` }}>
                    {["Name","Jersey","Position","Status"].map(h => (
                      <span key={h} style={{ fontSize: 10, fontWeight: 700, color: DS.labelText, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
                    ))}
                  </div>
                  <div style={{ maxHeight: 200, overflowY: "auto" }}>
                    {csvRows.map((r, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 64px 70px 90px", padding: "8px 12px", borderBottom: i < csvRows.length - 1 ? `1px solid ${DS.border}` : "none", background: r.err ? DS.warnBg : "transparent" }}>
                        <span style={{ fontSize: 13, color: DS.bodyText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name || "-"}</span>
                        <span style={{ fontSize: 13, color: DS.labelText }}>{r.jerseyRaw || "-"}</span>
                        <span style={{ fontSize: 13, color: DS.labelText }}>{r.position || "-"}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: r.err ? DS.warn : DS.safe }}>{r.err || "OK"}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, color: DS.labelText, flex: 1 }}>
                    {validCSVRows.length} valid · {invalidCSVRows.length} with errors
                  </span>
                  <button
                    onClick={importCSV}
                    disabled={importing || validCSVRows.length === 0}
                    style={{ background: DS.brand, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: (importing || validCSVRows.length === 0) ? "not-allowed" : "pointer", opacity: (importing || validCSVRows.length === 0) ? 0.6 : 1, display: "flex", alignItems: "center", gap: 6 }}
                  >
                    {importing
                      ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Importing…</>
                      : <><Plus size={14} /> Import {validCSVRows.length} Players</>}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Groups modal (position group management) ───────────────────────────────────
function GroupsModal({ onClose }) {
  const [groups,        setGroups]        = useState([]);
  const [athletes,      setAthletes]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [creating,      setCreating]      = useState(false);
  const [newName,       setNewName]       = useState("");
  const [activeGroup,   setActiveGroup]   = useState(null); // group being edited
  const [saving,        setSaving]        = useState(false);
  const [deleting,      setDeleting]      = useState(null);

  async function fetchGroups() {
    const r = await fetch("/api/org/groups", { credentials: "include" });
    const d = await r.json();
    setGroups(d.groups ?? []);
  }

  async function fetchAthletes() {
    const r = await fetch("/api/org/getAthletes", { credentials: "include" });
    const d = await r.json();
    setAthletes((d.athletes ?? d.data ?? []).map(a => ({
      id: a.id,
      name: a.name || a.Name || "Unknown",
      email: (a.email || a.Email || "").toLowerCase(),
    })));
  }

  useEffect(() => {
    Promise.all([fetchGroups(), fetchAthletes()]).finally(() => setLoading(false));
  }, []);

  async function createGroup() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const r = await fetch("/api/org/groups", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), athleteEmails: [] }),
      });
      const d = await r.json();
      if (d.ok) { setNewName(""); setCreating(false); setGroups(prev => [...prev, d.group]); toast.success("Group created"); }
    } catch {}
    setSaving(false);
  }

  async function deleteGroup(id) {
    setDeleting(id);
    try {
      await fetch(`/api/org/groups?id=${id}`, { method: "DELETE", credentials: "include" });
      setGroups(prev => prev.filter(g => g.id !== id));
      if (activeGroup?.id === id) setActiveGroup(null);
      toast.success("Group deleted");
    } catch { toast.error("Delete failed"); }
    setDeleting(null);
  }

  async function toggleAthleteInGroup(email) {
    if (!activeGroup) return;
    const current = activeGroup.athlete_emails ?? [];
    const next = current.includes(email)
      ? current.filter(e => e !== email)
      : [...current, email];

    setSaving(true);
    try {
      const r = await fetch("/api/org/groups", {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeGroup.id, athleteEmails: next }),
      });
      const d = await r.json();
      if (d.ok) {
        setActiveGroup(d.group);
        setGroups(prev => prev.map(g => g.id === d.group.id ? d.group : g));
      }
    } catch {}
    setSaving(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: DS.cardBg, borderRadius: 16, padding: 0, width: "100%", maxWidth: 560, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 16px", borderBottom: `1px solid ${DS.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#F3E8FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Shield size={15} color="#7C3AED" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: DS.bodyText }}>Position Groups</h2>
              <p style={{ margin: 0, fontSize: 11, color: DS.dimText }}>Target specific groups when publishing film</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: DS.dimText }}><X size={18} /></button>
        </div>

        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Groups list */}
          <div style={{ width: 200, borderRight: `1px solid ${DS.border}`, padding: 12, overflowY: "auto" }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 24, color: DS.dimText }}><Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /></div>
            ) : (
              <>
                {groups.map(g => (
                  <div
                    key={g.id}
                    onClick={() => setActiveGroup(g)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                      background: activeGroup?.id === g.id ? "#F3E8FF" : "transparent",
                      border: `1px solid ${activeGroup?.id === g.id ? "#C4B5FD" : "transparent"}`,
                      marginBottom: 4, transition: "all 0.12s",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: DS.bodyText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</p>
                      <p style={{ margin: 0, fontSize: 10, color: DS.dimText }}>{(g.athlete_emails ?? []).length} athletes</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); deleteGroup(g.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: DS.dimText, padding: 2, opacity: deleting === g.id ? 0.4 : 1 }}>
                      {deleting === g.id ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={11} />}
                    </button>
                  </div>
                ))}
                {groups.length === 0 && !creating && (
                  <p style={{ fontSize: 12, color: DS.dimText, textAlign: "center", padding: "12px 4px" }}>No groups yet.</p>
                )}
                {creating ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                    <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Group name…" autoFocus style={inputStyle} onKeyDown={e => { if (e.key === "Enter") createGroup(); if (e.key === "Escape") { setCreating(false); setNewName(""); }}} />
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={createGroup} disabled={!newName.trim() || saving} style={{ flex: 1, background: "#7C3AED", color: "#fff", border: "none", borderRadius: 6, padding: "6px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Create</button>
                      <button onClick={() => { setCreating(false); setNewName(""); }} style={{ background: DS.pageBg, border: `1px solid ${DS.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 11, cursor: "pointer", color: DS.labelText }}>×</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setCreating(true)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", borderRadius: 8, border: `1px dashed ${DS.border}`, background: "transparent", cursor: "pointer", color: DS.labelText, fontSize: 12, fontWeight: 600, marginTop: 8 }}>
                    <Plus size={12} /> New Group
                  </button>
                )}
              </>
            )}
          </div>

          {/* Athletes panel */}
          <div style={{ flex: 1, padding: 16, overflowY: "auto" }}>
            {!activeGroup ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8 }}>
                <Shield size={28} color={DS.dimText} style={{ opacity: 0.3 }} />
                <p style={{ fontSize: 13, color: DS.dimText, textAlign: "center" }}>Select a group to manage its athletes</p>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: DS.bodyText }}>{activeGroup.name}</h3>
                  <span style={{ fontSize: 11, color: DS.dimText }}>{(activeGroup.athlete_emails ?? []).length} / {athletes.length} athletes</span>
                </div>
                {athletes.length === 0 ? (
                  <p style={{ fontSize: 12, color: DS.dimText, textAlign: "center" }}>No athletes in org roster yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {athletes.map(a => {
                      const inGroup = (activeGroup.athlete_emails ?? []).includes(a.email);
                      return (
                        <div
                          key={a.id || a.email}
                          onClick={() => toggleAthleteInGroup(a.email)}
                          style={{
                            display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                            background: inGroup ? "#F3E8FF" : DS.pageBg,
                            border: `1px solid ${inGroup ? "#C4B5FD" : DS.border}`,
                            transition: "all 0.1s",
                          }}
                        >
                          <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${inGroup ? "#7C3AED" : DS.border}`, background: inGroup ? "#7C3AED" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {inGroup && <Check size={10} color="#fff" />}
                          </div>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: DS.bodyText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                          <span style={{ fontSize: 10, color: DS.dimText }}>{a.email}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Upload modal ──────────────────────────────────────────────────────────────
function UploadModal({ onClose, onUploadStarted }) {
  const [form, setForm] = useState({ title: "", gameDate: "", opponent: "", sport: "football", filmType: "game" });
  const [file, setFile] = useState(null);
  const [phase, setPhase] = useState("idle"); // idle | presigning | uploading | done | error
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState("");
  const fileRef = useRef(null);
  // Store presign result so retries reuse the same film record instead of creating duplicates
  const presignRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault(); setErr(""); setProgress(0);
    if (!file) { setErr("Select a video file."); return; }
    if (!form.title.trim()) { setErr("Game title is required."); return; }
    try {
      // Only presign once per modal open — reuse on retry to prevent duplicate DB records
      if (!presignRef.current) {
        setPhase("presigning");
        const r = await fetch("/api/film/presign", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: form.title.trim(), sport: form.sport, gameDate: form.gameDate || null, opponent: form.opponent.trim() || null, filmType: form.filmType }),
        });
        const d = await r.json();
        if (!r.ok) { setErr(d.error || "Failed to get upload URL."); setPhase("error"); return; }
        presignRef.current = d;
      }

      const { filmId, uploadUrl } = presignRef.current;

      setPhase("uploading");
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", "video/mp4");
        xhr.upload.onprogress = ev => { if (ev.lengthComputable) setProgress(Math.round(ev.loaded / ev.total * 100)); };
        xhr.onload  = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`S3 upload rejected (${xhr.status}) — check bucket CORS policy allows PUT from this domain`));
        xhr.onerror = () => reject(new Error("Upload blocked by browser — S3 bucket needs CORS configured for this domain"));
        xhr.send(file);
      });

      await fetch("/api/film/process", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filmId }),
      });

      setPhase("done");
      onUploadStarted(filmId);
      setTimeout(onClose, 1400);
    } catch (e2) { setErr(e2.message || "Upload failed."); setPhase("error"); }
  }

  const busy = phase === "presigning" || phase === "uploading";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: DS.cardBg, borderRadius: 16, padding: 28, width: "100%", maxWidth: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: DS.bodyText }}>Upload Film</h2>
          {!busy && <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: DS.dimText }}><X size={20} /></button>}
        </div>

        {phase === "done" ? (
          <div style={{ textAlign: "center", padding: 24 }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: DS.safeBg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <CheckCircle2 size={32} color={DS.safe} />
            </div>
            <p style={{ fontWeight: 800, fontSize: 18, color: DS.bodyText, margin: "0 0 8px" }}>Film uploaded!</p>
            <p style={{ fontSize: 13, color: DS.labelText, margin: "0 0 4px" }}>Open it in the Film Room to tag plays.</p>
            <p style={{ fontSize: 12, color: DS.dimText, margin: 0 }}>Open it to tag plays and build your playbook analytics.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelStyle}>Game Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="vs Lincoln HS - Week 3" style={inputStyle} disabled={busy} required />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelStyle}>Opponent</label>
                <input value={form.opponent} onChange={e => setForm(f => ({ ...f, opponent: e.target.value }))} placeholder="Lincoln HS" style={inputStyle} disabled={busy} />
              </div>
              <div>
                <label style={labelStyle}>Game Date</label>
                <input type="date" value={form.gameDate} onChange={e => setForm(f => ({ ...f, gameDate: e.target.value }))} style={inputStyle} disabled={busy} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Film Type</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {FILM_TYPES.map(t => {
                  const active = form.filmType === t.key;
                  return (
                    <button key={t.key} type="button" disabled={busy} onClick={() => setForm(f => ({ ...f, filmType: t.key }))} style={{
                      flex: "1 1 auto", padding: "7px 10px", borderRadius: 8, border: `1.5px solid ${active ? t.color : DS.border}`,
                      background: active ? t.bg : DS.pageBg, cursor: busy ? "not-allowed" : "pointer",
                      fontSize: 12, fontWeight: active ? 800 : 500, color: active ? t.color : DS.labelText,
                      transition: "all 0.12s",
                    }}>
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Video File *</label>
              <div onClick={() => !busy && fileRef.current?.click()} style={{
                border: `2px dashed ${file ? DS.brand : DS.border}`, borderRadius: 10, padding: "18px 16px",
                textAlign: "center", cursor: busy ? "not-allowed" : "pointer",
                background: file ? DS.brandBg : DS.pageBg, transition: "all 0.15s",
              }}>
                <input ref={fileRef} type="file" accept="video/*" style={{ display: "none" }} onChange={e => setFile(e.target.files?.[0] || null)} />
                {file ? (
                  <div>
                    <Video size={20} color={DS.brand} style={{ marginBottom: 4 }} />
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: DS.brand }}>{file.name}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: DS.labelText }}>{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                ) : (
                  <div>
                    <Upload size={20} color={DS.dimText} style={{ marginBottom: 4 }} />
                    <p style={{ margin: 0, fontSize: 13, color: DS.labelText }}>Click to select video</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: DS.dimText }}>MP4, MOV - up to 4 GB</p>
                  </div>
                )}
              </div>
            </div>

            {busy && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: DS.labelText }}>{phase === "presigning" ? "Preparing…" : `Uploading… ${progress}%`}</span>
                </div>
                <div style={{ height: 6, background: DS.border, borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: DS.brand, borderRadius: 99, width: `${phase === "presigning" ? 5 : progress}%`, transition: "width 0.3s ease" }} />
                </div>
              </div>
            )}

            {err && <p style={{ margin: 0, fontSize: 12, color: DS.warn }}>{err}</p>}

            <button type="submit" disabled={busy} style={{ background: DS.brand, color: "#fff", border: "none", borderRadius: 8, padding: "11px 16px", fontWeight: 700, fontSize: 14, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {busy ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Uploading…</> : <><Upload size={15} /> Upload Film</>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Film card ─────────────────────────────────────────────────────────────────
function FilmCard({ film, onClick, onDelete, onPublish, watchCount, seasonStatus }) {
  const uiState      = filmUIState(film);
  const isProcessing = uiState === "uploading";
  const isFailed     = uiState === "failed";
  const isTagged     = uiState === "has-plays";
  const needsTag     = uiState === "needs-tagging";
  const canView      = isTagged || needsTag;
  const playCount    = film.play_count ?? 0;
  const thumb        = film.mux_playback_id && canView
    ? `https://image.mux.com/${film.mux_playback_id}/thumbnail.jpg?time=5&width=320&fit_mode=preserve`
    : null;

  const [hovered,      setHovered]      = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [confirmDel,   setConfirmDel]   = useState(false);
  const [publishing,   setPublishing]   = useState(false);
  const [btnHover,     setBtnHover]     = useState(null); // "share" | "view" | null
  const [showPicker,   setShowPicker]   = useState(false);

  async function handlePublish(e, type) {
    e?.stopPropagation();
    if (publishing) return;
    setShowPicker(false);
    setPublishing(true);
    await onPublish?.(film, type);
    setPublishing(false);
  }

  async function handleSetType(e, type) {
    e?.stopPropagation();
    await onPublish?.(film, type, "setType");
  }

  async function handleDelete(e) {
    e.stopPropagation();
    if (!confirmDel) { setConfirmDel(true); return; }
    setDeleting(true);
    try {
      const r = await fetch(`/api/film/delete?filmId=${film.id}`, { method: "DELETE", credentials: "include" });
      if (r.ok) { toast.success("Film deleted"); onDelete?.(film.id); }
      else { const d = await r.json(); toast.error(d.error ?? "Delete failed"); }
    } catch { toast.error("Network error"); }
    setDeleting(false); setConfirmDel(false);
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setConfirmDel(false); }}
      style={{
        display: "flex",
        background: DS.cardBg,
        border: `1px solid ${hovered ? DS.border : DS.border}`,
        borderRadius: 14,
        transition: "box-shadow 0.15s",
        boxShadow: hovered ? "0 2px 12px rgba(0,0,0,0.06)" : "none",
        position: "relative", // needed so card stacks above backdrop
      }}
    >
      {/* ── Thumbnail ─────────────────────────────────────────────────────────── */}
      <div style={{
        width: 156, flexShrink: 0, minHeight: 96,
        background: "#0c1628",
        position: "relative", overflow: "hidden",
        borderTopLeftRadius: 14, borderBottomLeftRadius: 14,
      }}>
        {thumb ? (
          <img
            src={thumb} alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", minHeight: 96, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {isProcessing
              ? <Loader2 size={22} color="rgba(255,255,255,0.2)" style={{ animation: "spin 1s linear infinite" }} />
              : isFailed
                ? <AlertCircle size={22} color="rgba(200,16,46,0.4)" />
                : <Film size={22} color="rgba(255,255,255,0.12)" />
            }
          </div>
        )}

        {/* Shared badge overlay — shows type */}
        {film.is_published && (
          <div style={{
            position: "absolute", top: 8, left: 8,
            background: film.viewing_type === "cara" ? "rgba(200,16,46,0.88)" : "rgba(0,135,62,0.88)",
            backdropFilter: "blur(4px)",
            borderRadius: 5, padding: "3px 8px",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff", flexShrink: 0 }} />
            <span style={{ fontSize: 9, fontWeight: 800, color: "#fff", letterSpacing: "0.07em" }}>
              {film.viewing_type === "cara" ? "REQUIRED" : "VOLUNTARY"}
            </span>
          </div>
        )}

        {/* Play count badge */}
        {playCount > 0 && (
          <div style={{
            position: "absolute", bottom: 7, right: 7,
            background: "rgba(0,0,0,0.62)", backdropFilter: "blur(4px)",
            borderRadius: 5, padding: "2px 8px",
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>{playCount} plays</span>
          </div>
        )}

        {/* Upload progress bar pinned to bottom */}
        {isProcessing && (
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "rgba(255,255,255,0.08)" }}>
            <div style={{
              height: "100%", background: DS.brand,
              width: `${Math.max(film.progress_pct ?? 0, 6)}%`,
              transition: "width 0.5s ease",
              animation: (film.progress_pct ?? 0) === 0 ? "pulse 1.5s ease-in-out infinite" : "none",
            }} />
          </div>
        )}
      </div>

      {/* ── Content ───────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, padding: "14px 18px", display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>

        {/* Info block */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: DS.bodyText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {film.title}
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 5, flexWrap: "wrap" }}>
            {film.sport && (
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "capitalize", color: DS.brand, background: DS.brandBg, borderRadius: 4, padding: "1px 6px" }}>
                {film.sport}
              </span>
            )}
            {(() => {
              const ft = FILM_TYPE_MAP[film.film_type];
              if (!ft) return null;
              return (
                <span style={{ fontSize: 10, fontWeight: 700, color: ft.color, background: ft.bg, borderRadius: 4, padding: "1px 6px", border: `1px solid ${ft.color}22` }}>
                  {ft.label}
                </span>
              );
            })()}
            {film.opponent && <span style={{ fontSize: 12, color: DS.labelText }}>vs {film.opponent}</span>}
            {film.game_date && <span style={{ fontSize: 12, color: DS.dimText }}>{fmtDate(film.game_date)}</span>}
            {fmtDuration(film.duration_secs) && <span style={{ fontSize: 11, color: DS.dimText }}>{fmtDuration(film.duration_secs)}</span>}
          </div>

          {/* State hints */}
          {isProcessing && (
            <p style={{ margin: "6px 0 0", fontSize: 11, color: DS.brand, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
              <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} />
              {(film.progress_pct ?? 0) > 0 ? `Uploading… ${film.progress_pct}%` : "Processing…"}
            </p>
          )}
          {needsTag && (
            <p style={{ margin: "6px 0 0", fontSize: 11, color: DS.caution, fontWeight: 600 }}>
              No plays tagged yet — open to start tagging
            </p>
          )}
          {isFailed && (
            <p style={{ margin: "6px 0 0", fontSize: 11, color: DS.warn, fontWeight: 600 }}>
              Upload failed — delete and try again
            </p>
          )}

          {/* Watch receipt + due date — only for published films */}
          {film.is_published && (watchCount !== null || film.watch_due_date) && (() => {
            const dueFmt = film.watch_due_date ? (() => {
              const due   = new Date(film.watch_due_date + "T00:00:00");
              const today = new Date(); today.setHours(0,0,0,0);
              const diff  = Math.round((due - today) / 86400000);
              if (diff < 0)   return { label: "Overdue",      color: "#C8102E" };
              if (diff === 0)  return { label: "Due today",    color: DS.warn   };
              if (diff === 1)  return { label: "Due tomorrow", color: DS.warn   };
              if (diff <= 6)   return { label: `Due ${due.toLocaleDateString("en-US", { weekday: "short" })}`, color: DS.warn };
              return { label: `Due ${due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, color: DS.dimText };
            })() : null;

            return (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                {watchCount !== null && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, background: watchCount > 0 ? DS.safeBg : DS.pageBg, border: `1px solid ${watchCount > 0 ? DS.safeBorder : DS.border}`, borderRadius: 20, padding: "2px 10px" }}>
                    <Users size={10} color={watchCount > 0 ? DS.safe : DS.dimText} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: watchCount > 0 ? DS.safe : DS.dimText }}>
                      {watchCount > 0 ? `${watchCount} watched` : "No views yet"}
                    </span>
                  </div>
                )}
                {dueFmt && film.viewing_type === "cara" && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: dueFmt.color }}>
                    · {dueFmt.label}
                  </span>
                )}
              </div>
            );
          })()}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>

          {/* Delete — always rendered to avoid layout shift; invisible until hover */}
          {!isProcessing && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              title={confirmDel ? "Click again to confirm" : "Delete film"}
              style={{
                background: confirmDel ? DS.warnBg : "none",
                border: confirmDel ? `1px solid #C8102E44` : "none",
                borderRadius: 7, padding: confirmDel ? "5px 9px" : "4px",
                cursor: deleting ? "not-allowed" : "pointer",
                color: DS.warn, display: "flex", alignItems: "center", gap: 4,
                fontSize: 11, fontWeight: 700,
                opacity: (hovered || confirmDel) ? 1 : 0,
                transition: "opacity 0.15s",
                pointerEvents: (hovered || confirmDel) ? "auto" : "none",
              }}
            >
              {deleting ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={12} />}
              {confirmDel && !deleting && "Confirm?"}
            </button>
          )}

          {/* Share with Team — unified pill + dropdown (same pattern as film detail header) */}
          {isTagged && (
            <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
              {film.is_published ? (
                <button
                  onClick={() => setShowPicker(p => !p)}
                  disabled={publishing}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: film.viewing_type === "cara" ? "rgba(255,59,48,0.08)" : DS.safeBg,
                    border: `1.5px solid ${film.viewing_type === "cara" ? "rgba(255,59,48,0.3)" : DS.safeBorder}`,
                    borderRadius: 20, padding: "5px 12px 5px 9px", cursor: "pointer",
                    opacity: publishing ? 0.6 : 1,
                  }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: film.viewing_type === "cara" ? "#FF3B30" : DS.safe, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: film.viewing_type === "cara" ? "#FF3B30" : DS.safe }}>
                    {film.viewing_type === "cara" ? "Required" : "Voluntary"}
                  </span>
                  <ChevronDown size={10} color={DS.dimText} />
                </button>
              ) : (
                <button
                  onClick={() => setShowPicker(p => !p)}
                  disabled={publishing}
                  onMouseEnter={() => setBtnHover("share")}
                  onMouseLeave={() => setBtnHover(null)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: DS.pageBg, border: `1px solid ${DS.border}`,
                    borderRadius: 9, padding: "7px 13px", cursor: "pointer",
                    opacity: publishing ? 0.6 : 1,
                    transition: "transform 0.12s, box-shadow 0.12s",
                    transform: btnHover === "share" ? "translateY(-1px)" : "none",
                    boxShadow: btnHover === "share" ? "0 4px 14px rgba(0,0,0,0.1)" : "none",
                  }}
                >
                  {publishing ? <Loader2 size={12} color={DS.labelText} style={{ animation: "spin 1s linear infinite" }} /> : <Users size={12} color={DS.labelText} />}
                  <span style={{ fontSize: 12, fontWeight: 700, color: DS.labelText }}>{publishing ? "Sharing…" : "Share with Team"}</span>
                </button>
              )}

              {showPicker && (
                <>
                  <div onClick={() => setShowPicker(false)} style={{ position: "fixed", inset: 0, zIndex: 199 }} />
                  <div style={{
                    position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 200,
                    background: DS.cardBg, border: `1px solid ${DS.border}`,
                    borderRadius: 12, padding: "8px 6px",
                    boxShadow: "0 8px 28px rgba(0,0,0,0.12)", minWidth: 210,
                  }}>
                    {!film.is_published && (
                      <p style={{ margin: "2px 10px 8px", fontSize: 11, fontWeight: 600, color: DS.dimText }}>
                        How should athletes view this?
                      </p>
                    )}
                    {film.is_published && (
                      <p style={{ margin: "2px 10px 8px", fontSize: 10, fontWeight: 700, color: DS.dimText, textTransform: "uppercase", letterSpacing: "0.06em" }}>Viewing type</p>
                    )}
                    {/* Season compliance warning */}
                    {seasonStatus && !seasonStatus.isCara && seasonStatus.phase !== "unconfigured" && (() => {
                      const isDeadPeriod = seasonStatus.phase === "dead-period";
                      return (
                        <div style={{
                          margin: "0 4px 8px", padding: "8px 10px", borderRadius: 8,
                          background: isDeadPeriod ? "rgba(200,16,46,0.07)" : "rgba(234,179,8,0.09)",
                          border: `1px solid ${isDeadPeriod ? "rgba(200,16,46,0.25)" : "rgba(234,179,8,0.3)"}`,
                        }}>
                          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: isDeadPeriod ? "#C8102E" : DS.warn }}>
                            {isDeadPeriod ? "Dead Period" : seasonStatus.label || "Off-Season"}
                          </p>
                          <p style={{ margin: "2px 0 0", fontSize: 10, color: DS.dimText, lineHeight: 1.5 }}>
                            {isDeadPeriod
                              ? "Required Viewing is not permitted during a dead period."
                              : "You're outside the playing season — Required Viewing may not be NCAA-compliant."}
                          </p>
                        </div>
                      );
                    })()}

                    {[
                      { key: "cara", label: "Required Viewing", sub: "Counts toward 20hr/week limit", dot: "#FF3B30" },
                      { key: "vara", label: "Voluntary Study",  sub: "Athlete-initiated, not countable", dot: DS.safe },
                    ].map(({ key, label, sub, dot }) => {
                      const isActive = film.is_published && film.viewing_type === key;
                      return (
                        <button key={key}
                          onClick={e => { e.stopPropagation(); film.is_published ? handleSetType(e, key) : handlePublish(e, key); setShowPicker(false); }}
                          style={{
                            width: "100%", display: "flex", alignItems: "center", gap: 9,
                            padding: "8px 10px", borderRadius: 8, border: "none",
                            background: isActive ? DS.pageBg : "transparent",
                            cursor: "pointer", textAlign: "left",
                          }}
                        >
                          <div style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: DS.bodyText }}>{label}</p>
                            <p style={{ margin: "1px 0 0", fontSize: 10, color: DS.dimText }}>{sub}</p>
                          </div>
                          {isActive && <Check size={12} color={DS.brand} />}
                        </button>
                      );
                    })}
                    {film.is_published && (
                      <>
                        <div style={{ height: 1, background: DS.border, margin: "6px 4px" }} />
                        <button
                          onClick={e => { e.stopPropagation(); handlePublish(e, null); setShowPicker(false); }}
                          style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", fontSize: 12, fontWeight: 600, color: DS.warn }}
                        >Remove from team feed</button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* View Film / Tag Plays CTA */}
          {canView && (
            <button
              onClick={onClick}
              onMouseEnter={() => setBtnHover("view")}
              onMouseLeave={() => setBtnHover(null)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: needsTag ? "#FFF7ED" : DS.brandBg,
                border: `1px solid ${needsTag ? "#FED7AA" : DS.brandBorder}`,
                borderRadius: 9, padding: "8px 14px", cursor: "pointer",
                transition: "transform 0.12s, box-shadow 0.12s",
                transform: btnHover === "view" ? "translateY(-1px)" : "none",
                boxShadow: btnHover === "view"
                  ? `0 4px 14px ${needsTag ? "rgba(245,158,11,0.18)" : "rgba(30,58,95,0.15)"}`
                  : "none",
              }}
            >
              {needsTag ? <Tag size={13} color={DS.caution} /> : <Film size={13} color={DS.brand} />}
              <span style={{ fontSize: 12, fontWeight: 700, color: needsTag ? DS.caution : DS.brand }}>
                {needsTag ? "Tag Plays" : "View Film"}
              </span>
              <ArrowRight size={13} color={needsTag ? DS.caution : DS.brand} />
            </button>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Stats header ──────────────────────────────────────────────────────────────
function StatsHeader({ films }) {
  if (!films.length) return null;
  const totalPlays   = films.reduce((s, f) => s + (f.play_count ?? 0), 0);
  const sharedCount  = films.filter(f => filmUIState(f) === "has-plays" && f.is_published).length;
  const readyCount   = films.filter(f => filmUIState(f) === "has-plays" && !f.is_published).length;
  const needsTagging = films.filter(f => filmUIState(f) === "needs-tagging").length;

  const stats = [
    { label: "Total Films",      value: films.length, Icon: Film,  color: DS.brand,   bg: DS.brandBg   },
    { label: "Plays Tagged",     value: totalPlays,   Icon: Play,  color: DS.brand,   bg: DS.brandBg   },
    { label: "Shared with Team", value: sharedCount,  Icon: Users, color: DS.safe,    bg: DS.safeBg    },
    { label: "Ready to Share",   value: readyCount,   Icon: Zap,   color: DS.caution, bg: DS.cautionBg },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 24 }}>
      {stats.map(s => (
        <div key={s.label} style={{
          background: DS.cardBg, border: `1px solid ${DS.border}`,
          borderRadius: 12, padding: "14px 16px",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: s.bg,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <s.Icon size={16} color={s.color} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: s.value > 0 ? DS.bodyText : DS.dimText, lineHeight: 1 }}>{s.value}</p>
            <p style={{ margin: "3px 0 0", fontSize: 10, color: DS.dimText, fontWeight: 500 }}>{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FilmPage() {
  const router   = useRouter();
  const { user } = useAuthContext();

  const [films,          setFilms]          = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [showUpload,     setShowUpload]     = useState(false);
  const [showRoster,     setShowRoster]     = useState(false);
  const [showGroups,     setShowGroups]     = useState(false);
  const [searchQuery,    setSearchQuery]    = useState("");
  const [sportFilter,    setSportFilter]    = useState("all");
  const [filmTypeFilter, setFilmTypeFilter] = useState("all");
  const [watchStats,    setWatchStats]    = useState({}); // { [filmId]: watched_count }
  const [seasonStatus,  setSeasonStatus]  = useState(null);
  const pollingRef = useRef({});
  const pollSetRef = useRef(new Set());

  const ACTIVE_STATUSES = ["uploading"];

  const fetchFilms = useCallback(async () => {
    try {
      const r = await fetch("/api/film/list", { credentials: "include" });
      const d = await r.json();
      if (d.films) {
        setFilms(d.films);
        d.films.filter(f => ACTIVE_STATUSES.includes(f.status)).forEach(f => startPolling(f.id));
        // Fetch watch counts for all published films
        const published = d.films.filter(f => f.is_published);
        if (published.length) {
          const results = await Promise.allSettled(
            published.map(f => fetch(`/api/film/watch-stats?filmId=${f.id}`, { credentials: "include" }).then(r => r.json()))
          );
          const stats = {};
          results.forEach((res, i) => {
            if (res.status === "fulfilled" && res.value.ok) {
              stats[published[i].id] = res.value.watched_count ?? 0;
            }
          });
          setWatchStats(stats);
        }
      }
    } catch {}
    setLoading(false);
  }, []);

  function startPolling(filmId) {
    if (pollSetRef.current.has(filmId)) return;
    pollSetRef.current.add(filmId);
    pollingRef.current[filmId] = setInterval(async () => {
      try {
        const r = await fetch(`/api/film/status?filmId=${filmId}`, { credentials: "include" });
        const d = await r.json();
        if (d.status) {
          setFilms(prev => prev.map(f => f.id === filmId ? { ...f, status: d.status, progress_pct: d.progressPct, play_count: d.play_count } : f));
          if (!ACTIVE_STATUSES.includes(d.status)) {
            clearInterval(pollingRef.current[filmId]);
            delete pollingRef.current[filmId];
            pollSetRef.current.delete(filmId);
          }
        }
      } catch {}
    }, 5000);
  }

  useEffect(() => {
    fetchFilms();
    fetch("/api/org/season-status", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.ok) setSeasonStatus(d); })
      .catch(() => {});
    return () => { Object.values(pollingRef.current).forEach(clearInterval); };
  }, [fetchFilms]);

  function handleUploadStarted(filmId) {
    fetchFilms();
    toast.success("Film uploaded — open it to start tagging plays.");
    setTimeout(() => startPolling(filmId), 1000);
  }

  function handleFilmDeleted(filmId) {
    setFilms(prev => prev.filter(f => f.id !== filmId));
    if (pollingRef.current[filmId]) { clearInterval(pollingRef.current[filmId]); delete pollingRef.current[filmId]; }
    pollSetRef.current.delete(filmId);
  }

  async function handlePublish(film, viewingType, action) {
    let resolvedAction = action;
    let willPublish    = film.is_published;

    if (!resolvedAction) {
      resolvedAction = film.is_published ? "unpublish" : "publish";
    }
    if (resolvedAction === "publish")   willPublish = true;
    if (resolvedAction === "unpublish") willPublish = false;

    // Optimistic update
    setFilms(prev => prev.map(f => f.id === film.id
      ? { ...f, is_published: willPublish, ...(viewingType ? { viewing_type: viewingType } : {}) }
      : f
    ));
    try {
      const r = await fetch("/api/film/publish", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filmId: film.id, action: resolvedAction, viewingType }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Publish failed");
      setFilms(prev => prev.map(f => f.id === film.id
        ? { ...f, is_published: d.published, viewing_type: d.viewing_type ?? f.viewing_type }
        : f
      ));
      if (resolvedAction === "setType") toast.success(`Changed to ${d.viewing_type?.toUpperCase() ?? ""}`);
      else toast.success(d.published ? "Film shared with team ✓" : "Film removed from team feed");
    } catch (e) {
      // Revert
      setFilms(prev => prev.map(f => f.id === film.id ? { ...f, is_published: film.is_published, viewing_type: film.viewing_type } : f));
      toast.error(e.message || "Could not update publish status");
    }
  }

  const role        = String(user?.role || user?.Role || "").toLowerCase();
  const isOrgSide   = role.includes("org") || role.includes("coach") || role.includes("trainer") || role === "admin" || role === "organization";
  const primarySport = films.find(f => f.sport)?.sport ?? "football";

  const allSports = [...new Set(films.map(f => f.sport).filter(Boolean))].sort();

  const filmTypesInUse = [...new Set(films.map(f => f.film_type).filter(Boolean))];
  const filteredFilms = films.filter(f => {
    if (sportFilter !== "all" && f.sport !== sportFilter) return false;
    if (filmTypeFilter !== "all" && f.film_type !== filmTypeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!f.title?.toLowerCase().includes(q) && !f.opponent?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (!isOrgSide) return (
    <div style={{ minHeight: "100vh", background: DS.pageBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: DS.labelText }}>Coach access required.</p>
    </div>
  );

  const inProgress   = filteredFilms.filter(f => f.status === "uploading");
  const needsTagging = filteredFilms.filter(f => filmUIState(f) === "needs-tagging");
  const sharedFilms  = filteredFilms.filter(f => filmUIState(f) === "has-plays" && f.is_published);
  const readyFilms   = filteredFilms.filter(f => filmUIState(f) === "has-plays" && !f.is_published);
  const failed       = filteredFilms.filter(f => f.status === "failed");

  return (
    <>
      <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
      <style>{`
        @keyframes spin  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      `}</style>

      <div style={{ minHeight: "100vh", background: DS.pageBg, padding: "32px 16px", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: DS.brandBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Film size={18} color={DS.brand} />
                </div>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: DS.bodyText }}>Film Intelligence</h1>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: DS.labelText }}>
                Upload game film, tag plays, and share with your team — all in one place.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button onClick={() => setShowGroups(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 8, padding: "9px 14px", fontWeight: 600, fontSize: 13, color: DS.bodyText, cursor: "pointer" }}>
                <Shield size={14} /> Groups
              </button>
              <button onClick={() => setShowRoster(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 8, padding: "9px 14px", fontWeight: 600, fontSize: 13, color: DS.bodyText, cursor: "pointer" }}>
                <Users size={14} /> Roster
              </button>
              <button onClick={() => setShowUpload(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: DS.brand, border: "none", borderRadius: 8, padding: "9px 16px", fontWeight: 700, fontSize: 13, color: "#fff", cursor: "pointer" }}>
                <Upload size={14} /> Upload Film
              </button>
            </div>
          </div>

          {/* Stats header */}
          {!loading && <StatsHeader films={films} />}

          {/* Search + filter row */}
          {!loading && films.length > 0 && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
                <div style={{ flex: 1, position: "relative" }}>
                  <Search size={13} color={DS.dimText} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search films or opponents…"
                    style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${DS.border}`, borderRadius: 8, padding: "9px 12px 9px 32px", fontSize: 13, color: DS.bodyText, background: DS.cardBg, outline: "none" }}
                  />
                </div>
                {allSports.length > 1 && (
                  <select
                    value={sportFilter}
                    onChange={e => setSportFilter(e.target.value)}
                    style={{ border: `1px solid ${DS.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: DS.bodyText, background: DS.cardBg, outline: "none", cursor: "pointer" }}
                  >
                    <option value="all">All Sports</option>
                    {allSports.map(s => <option key={s} value={s} style={{ textTransform: "capitalize" }}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                )}
              </div>

              {/* Film type filter pills — only show when >1 type exists */}
              {filmTypesInUse.length > 1 && (
                <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
                  {[{ key: "all", label: "All Types", color: DS.labelText, bg: DS.cardBg }, ...FILM_TYPES.filter(t => filmTypesInUse.includes(t.key))].map(t => {
                    const active = filmTypeFilter === t.key;
                    return (
                      <button key={t.key} onClick={() => setFilmTypeFilter(t.key)} style={{
                        padding: "5px 12px", borderRadius: 20,
                        border: `1.5px solid ${active ? (t.color === DS.labelText ? DS.border : t.color) : DS.border}`,
                        background: active ? (t.bg || DS.cardBg) : DS.cardBg,
                        fontSize: 12, fontWeight: active ? 700 : 500,
                        color: active ? (t.color === DS.labelText ? DS.bodyText : t.color) : DS.labelText,
                        cursor: "pointer", transition: "all 0.12s",
                      }}>
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: DS.dimText }}>
              <Loader2 size={28} style={{ animation: "spin 1s linear infinite", marginBottom: 12 }} />
              <p style={{ margin: 0, fontSize: 14 }}>Loading films…</p>
            </div>
          ) : films.length === 0 ? (
            <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 16, padding: 52, textAlign: "center" }}>
              <Video size={44} color={DS.dimText} style={{ marginBottom: 18, opacity: 0.3 }} />
              <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: DS.bodyText }}>No films yet</h3>
              <p style={{ margin: "0 0 22px", fontSize: 13, color: DS.labelText }}>Upload your first game film to start tagging plays and sharing film with your team.</p>
              <button onClick={() => setShowUpload(true)} style={{ background: DS.brand, color: "#fff", border: "none", borderRadius: 8, padding: "11px 22px", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Upload size={15} /> Upload Film
              </button>
            </div>
          ) : filteredFilms.length === 0 ? (
            <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 14, padding: 36, textAlign: "center" }}>
              <Search size={28} color={DS.dimText} style={{ marginBottom: 10, opacity: 0.4 }} />
              <p style={{ margin: 0, fontSize: 14, color: DS.labelText }}>No films match your search.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

              {/* Shared with Team — athletes can see these */}
              {sharedFilms.length > 0 && (
                <section>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: DS.safe, flexShrink: 0 }} />
                    <h2 style={{ margin: 0, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: DS.safe }}>
                      Shared with Team — {sharedFilms.length} film{sharedFilms.length !== 1 ? "s" : ""}
                    </h2>
                    <span style={{ fontSize: 11, color: DS.dimText, fontWeight: 500 }}>· visible in athlete feed</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {sharedFilms.map(f => (
                      <FilmCard key={f.id} film={f} onClick={() => router.push(`/org/film/${f.id}`)} onDelete={handleFilmDeleted} onPublish={handlePublish} watchCount={watchStats[f.id] ?? null} seasonStatus={seasonStatus} />
                    ))}
                  </div>
                </section>
              )}

              {/* Ready to Share — tagged but not yet shared */}
              {readyFilms.length > 0 && (
                <section>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <Zap size={13} color={DS.brand} />
                    <h2 style={{ margin: 0, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: DS.brand }}>
                      Ready to Share — {readyFilms.length} film{readyFilms.length !== 1 ? "s" : ""}
                    </h2>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {readyFilms.map(f => (
                      <FilmCard key={f.id} film={f} onClick={() => router.push(`/org/film/${f.id}`)} onDelete={handleFilmDeleted} onPublish={handlePublish} />
                    ))}
                  </div>
                </section>
              )}

              {/* Needs Tagging */}
              {needsTagging.length > 0 && (
                <section>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <Tag size={13} color={DS.caution} />
                    <h2 style={{ margin: 0, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: DS.caution }}>
                      Needs Tagging — {needsTagging.length} film{needsTagging.length !== 1 ? "s" : ""}
                    </h2>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {needsTagging.map(f => (
                      <FilmCard key={f.id} film={f} onClick={() => router.push(`/org/film/${f.id}`)} onDelete={handleFilmDeleted} onPublish={handlePublish} />
                    ))}
                  </div>
                </section>
              )}

              {/* In Progress */}
              {inProgress.length > 0 && (
                <section>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <Loader2 size={13} color={DS.brand} style={{ animation: "spin 1s linear infinite" }} />
                    <h2 style={{ margin: 0, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: DS.brand }}>
                      In Progress
                    </h2>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {inProgress.map(f => (
                      <FilmCard key={f.id} film={f} onClick={() => router.push(`/org/film/${f.id}`)} onDelete={handleFilmDeleted} onPublish={handlePublish} />
                    ))}
                  </div>
                </section>
              )}

              {/* Failed */}
              {failed.length > 0 && (
                <section>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <AlertCircle size={13} color={DS.warn} />
                    <h2 style={{ margin: 0, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: DS.warn }}>Failed</h2>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {failed.map(f => (
                      <FilmCard key={f.id} film={f} onClick={() => router.push(`/org/film/${f.id}`)} onDelete={handleFilmDeleted} onPublish={handlePublish} />
                    ))}
                  </div>
                </section>
              )}

            </div>
          )}

          {!loading && films.length > 0 && (
            <div style={{ textAlign: "center", marginTop: 20 }}>
              <button onClick={fetchFilms} style={{ background: "none", border: "none", cursor: "pointer", color: DS.dimText, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}>
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
          )}
        </div>
      </div>

      {showGroups && <GroupsModal onClose={() => setShowGroups(false)} />}
      {showRoster && <RosterPanel onClose={() => setShowRoster(false)} defaultSport={primarySport} />}
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onUploadStarted={handleUploadStarted} />}
    </>
  );
}
