// components/org/CreateWorkoutModal.jsx
// Create OR Edit mode.
// Edit mode: pass editWorkout={{ id, title, dateISO, sport, status, items, athleteIds }}
// In edit mode the modal pre-fills all fields and calls /api/org/workouts/update-full on save.
"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  X, Plus, Users, CalendarDays, Dumbbell, AlertTriangle,
  Trash2, ChevronDown, ChevronUp, ClipboardList,
  Link as LinkIcon, Filter, Search, CheckCircle2, Info, Edit2,
} from "lucide-react";
import { DS } from "@/components/org/dashboard/DashboardUI";

// ---------- pure helpers ----------
async function safeJson(res) { try { return await res.json(); } catch { return {}; } }
function normalizeEmail(e)   { return String(e || "").trim().toLowerCase(); }
function normalizeTeam(v)    { return String(v || "").trim().toLowerCase(); }
function titleTeam(v)        { const s = normalizeTeam(v); return s ? s[0].toUpperCase() + s.slice(1) : ""; }
function getAthleteTeam(a)   { return a?.team || a?.Team || a?.sport || a?.Sport || a?.primarySport || a?.PrimarySport || ""; }
function getAthleteToken(a)  { return String(a?.AthleteToken || a?.athleteToken || a?.Token || "").trim(); }
function toNumberOrEmpty(v)  { if (v === "" || v == null) return ""; const n = Number(v); return Number.isFinite(n) ? n : ""; }
function sanitizeUrl(url)    {
  const s = String(url || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[\w-]+\.[\w.-]+/.test(s)) return `https://${s}`;
  return s;
}
function newItem(order) {
  return { Order: order, ExerciseName: "", Sets: "", Reps: "", Weight: "", Rest: "", Instructions: "", VideoURL: "", EvidenceRequired: "none" };
}
function renumberOrders(list) {
  const cleaned = (list||[]).map((it,idx) => ({ ...it, Order: toNumberOrEmpty(it?.Order)==="" ? idx+1 : toNumberOrEmpty(it?.Order) }));
  const seen = new Set(); let needsNorm = false;
  for (const it of cleaned) {
    const o = Number(it.Order);
    if (!Number.isFinite(o) || o<=0 || seen.has(o)) { needsNorm=true; break; }
    seen.add(o);
  }
  return needsNorm ? cleaned.map((it,idx) => ({ ...it, Order: idx+1 })) : cleaned;
}

// Sport options matching Airtable single-select
const SPORT_OPTIONS = ["soccer","basketball","xc","football","track","swim","tennis","hockey","baseball","softball"];

// ---------- DS-token primitives ----------
const inputStyle = {
  width: "100%", padding: "10px 14px", fontSize: "13px",
  border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg,
  color: DS.bodyText, outline: "none",
};
const labelStyle = {
  display: "block", fontSize: "11px", fontWeight: 900,
  textTransform: "uppercase", letterSpacing: "0.06em",
  color: DS.labelText, marginBottom: "6px",
};

function DSInput({ label, value, onChange, placeholder, inputMode, type="text", style={} }) {
  return (
    <div>
      {label && <span style={labelStyle}>{label}</span>}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} inputMode={inputMode}
        style={{ ...inputStyle, ...style }}
        onFocus={e => { e.currentTarget.style.borderColor = DS.brand; }}
        onBlur={e  => { e.currentTarget.style.borderColor = DS.border; }} />
    </div>
  );
}

function DSSelect({ label, value, onChange, children, helper }) {
  return (
    <div>
      {label && <span style={labelStyle}>{label}</span>}
      <select value={value} onChange={onChange}
        style={{ ...inputStyle, cursor: "pointer", appearance: "none" }}
        onFocus={e => { e.currentTarget.style.borderColor = DS.brand; }}
        onBlur={e  => { e.currentTarget.style.borderColor = DS.border; }}>
        {children}
      </select>
      {helper && <p style={{ fontSize: "11px", color: DS.dimText, marginTop: "5px" }}>{helper}</p>}
    </div>
  );
}

function DSTextarea({ label, value, onChange, placeholder }) {
  return (
    <div>
      {label && <span style={labelStyle}>{label}</span>}
      <textarea value={value} onChange={onChange} placeholder={placeholder}
        style={{ ...inputStyle, minHeight: "88px", resize: "vertical" }}
        onFocus={e => { e.currentTarget.style.borderColor = DS.brand; }}
        onBlur={e  => { e.currentTarget.style.borderColor = DS.border; }} />
    </div>
  );
}

function Btn({ children, onClick, variant="secondary", disabled, fullWidth, title, type="button" }) {
  const isPrimary = variant === "primary";
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        gap: "5px", padding: "8px 16px", fontSize: "12px", fontWeight: 900,
        textTransform: "uppercase", letterSpacing: "0.06em",
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1,
        transition: "background-color 0.12s",
        border: `1px solid ${isPrimary ? DS.brand : DS.border}`,
        backgroundColor: isPrimary ? DS.brand : DS.cardBg,
        color: isPrimary ? "#fff" : DS.labelText,
        width: fullWidth ? "100%" : "auto",
      }}
      onMouseEnter={e => {
        if (disabled) return;
        if (isPrimary) { e.currentTarget.style.backgroundColor = DS.brandLight; }
        else { e.currentTarget.style.backgroundColor = DS.brandBg; e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.color = DS.brand; }
      }}
      onMouseLeave={e => {
        if (disabled) return;
        e.currentTarget.style.backgroundColor = isPrimary ? DS.brand : DS.cardBg;
        e.currentTarget.style.borderColor = isPrimary ? DS.brand : DS.border;
        e.currentTarget.style.color = isPrimary ? "#fff" : DS.labelText;
      }}>
      {children}
    </button>
  );
}

function Tag({ children, tone="neutral" }) {
  const colors = {
    neutral: { bg: DS.pageBg,    border: DS.border,        text: DS.labelText },
    good:    { bg: DS.safeBg,    border: DS.safeBorder,    text: DS.safe      },
    warn:    { bg: DS.cautionBg, border: DS.cautionBorder, text: DS.caution   },
    bad:     { bg: DS.bannedBg,  border: DS.bannedBorder,  text: DS.banned    },
    brand:   { bg: DS.brandBg,   border: DS.brandBorder,   text: DS.brand     },
  };
  const c = colors[tone] || colors.neutral;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 8px", fontSize: "11px", fontWeight: 700, backgroundColor: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
      {children}
    </span>
  );
}

function ModalShell({ open, title, subtitle, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[10000]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center px-3 py-3 sm:px-4 sm:py-5">
        <div
          style={{
            width: "100%", maxWidth: "860px", backgroundColor: DS.cardBg,
            border: `1px solid ${DS.border}`, borderTop: `3px solid ${DS.brand}`,
            maxHeight: "calc(100dvh - 24px)", overflow: "hidden",
            display: "flex", flexDirection: "column",
          }}
          role="dialog" aria-modal="true" aria-label={title}
          onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${DS.border}`, backgroundColor: DS.pageBg, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexShrink: 0 }}>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em", color: DS.bodyText }}>{title}</p>
              {subtitle && <p style={{ fontSize: "11px", color: DS.dimText, marginTop: "3px" }}>{subtitle}</p>}
            </div>
            <button type="button" onClick={onClose}
              style={{ padding: "6px", border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg, cursor: "pointer", flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = DS.pageBg; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = DS.cardBg; }}>
              <X className="w-4 h-4" style={{ color: DS.dimText }} />
            </button>
          </div>
          <div style={{ overflowY: "auto", flex: 1, padding: "20px" }}>
            {children}
            <div style={{ height: "12px" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, label, open, onToggle, children }) {
  return (
    <div style={{ border: `1px solid ${DS.border}` }}>
      <button type="button" onClick={onToggle}
        className="w-full flex items-center justify-between gap-3"
        style={{ padding: "12px 16px", backgroundColor: DS.pageBg, cursor: "pointer", borderBottom: open ? `1px solid ${DS.border}` : "none" }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = DS.brandBg; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = DS.pageBg; }}>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: "12px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em", color: DS.bodyText }}>{title}</span>
          {label && <Tag>{label}</Tag>}
        </div>
        {open ? <ChevronUp className="w-4 h-4" style={{ color: DS.dimText }} /> : <ChevronDown className="w-4 h-4" style={{ color: DS.dimText }} />}
      </button>
      {open && <div style={{ padding: "16px", backgroundColor: DS.cardBg }}>{children}</div>}
    </div>
  );
}

// ============================================================
export default function CreateWorkoutModal({
  open, onClose,
  dateISO,      // default date for create mode
  sport,        // default sport for create mode
  onCreated,    // called after create
  onUpdated,    // called after update
  editWorkout,  // { id, title, dateISO, sport, status, items, athleteIds } — triggers edit mode
}) {
  const isEditMode = Boolean(editWorkout?.id);

  const [loadingAthletes, setLoadingAthletes] = useState(false);
  const [athletes,        setAthletes]        = useState([]);
  const [title,           setTitle]           = useState("");
  const [editDate,        setEditDate]        = useState("");
  const [editSport,       setEditSport]       = useState("");
  const [status,          setStatus]          = useState("assigned");
  const [selected,        setSelected]        = useState({});
  const [search,          setSearch]          = useState("");
  const [teamFilter,      setTeamFilter]      = useState("all");
  const [showSelectedOnly,setShowSelectedOnly]= useState(false);
  const [itemsOpen,       setItemsOpen]       = useState(false);
  const [items,           setItems]           = useState([newItem(1)]);
  const [saving,          setSaving]          = useState(false);
  const [err,             setErr]             = useState("");
  const [okMsg,           setOkMsg]           = useState("");
  const titleRef = useRef(null);

  // Active date/sport (edit mode overrides props)
  const activeDate  = isEditMode ? editDate  : dateISO;
  const activeSport = isEditMode ? editSport : sport;

  useEffect(() => {
    if (!open) return;
    setErr(""); setOkMsg("");
    if (isEditMode) {
      // Pre-fill from editWorkout
      setTitle(editWorkout.title || "");
      setEditDate(String(editWorkout.dateISO || "").slice(0,10));
      setEditSport(editWorkout.sport || "");
      setStatus(editWorkout.status || "assigned");
      // Pre-fill items
      const rawItems = Array.isArray(editWorkout.items) && editWorkout.items.length
        ? editWorkout.items
        : [newItem(1)];
      setItems(rawItems.map((it,idx) => ({
        Order:            Number(it?.Order ?? it?.order ?? idx+1),
        ExerciseName:     String(it?.ExerciseName || it?.exerciseName || it?.name || ""),
        Sets:             toNumberOrEmpty(it?.Sets ?? it?.sets),
        Reps:             String(it?.Reps   || it?.reps   || ""),
        Weight:           String(it?.Weight || it?.weight || ""),
        Rest:             String(it?.Rest   || it?.rest   || ""),
        Instructions:     String(it?.Instructions || it?.instructions || ""),
        VideoURL:         String(it?.VideoURL || it?.videoUrl || ""),
        EvidenceRequired: String(it?.EvidenceRequired || it?.evidenceRequired || "none"),
      })));
      setItemsOpen(true); // show items in edit mode by default
      // Pre-select athletes that were passed in
      const incoming = Array.isArray(editWorkout.athleteIds) ? editWorkout.athleteIds : [];
      if (incoming.length) {
        const sel = {};
        incoming.forEach(t => { if (t) sel[String(t)] = true; });
        setSelected(sel);
        setShowSelectedOnly(true);
      } else {
        setSelected({});
        setShowSelectedOnly(false);
      }
    } else {
      // Create mode defaults
      setTitle((prev) => prev || `${sport || "Workout"} — ${dateISO || ""}`);
      setStatus("assigned"); setSelected({});
      setSearch(""); setTeamFilter("all"); setShowSelectedOnly(false);
      setItemsOpen(typeof window !== "undefined" ? window.innerWidth >= 1024 : false);
      setItems([newItem(1)]);
      setEditDate(""); setEditSport("");
    }
    setTimeout(() => { try { titleRef.current?.focus?.(); } catch {} }, 60);
  }, [open, isEditMode]);  // intentionally not re-running on editWorkout fields change

  const fetchAthletes = useCallback(async () => {
    setLoadingAthletes(true); setErr("");
    try {
      const res  = await fetch("/api/org/getAthletes", { credentials: "include" });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to load athletes");
      setAthletes(Array.isArray(data?.athletes) ? data.athletes : []);
    } catch (e) { setAthletes([]); setErr(e?.message || "Failed to load athletes"); }
    finally     { setLoadingAthletes(false); }
  }, []);

  useEffect(() => { if (open) fetchAthletes(); }, [open, fetchAthletes]);

  const teamsAll = useMemo(() => {
    const set = new Set();
    (Array.isArray(athletes) ? athletes : []).forEach(a => { const t = normalizeTeam(getAthleteTeam(a)); if (t) set.add(t); });
    return Array.from(set).sort();
  }, [athletes]);

  const selectedTokens = useMemo(() =>
    Object.entries(selected).filter(([,v]) => !!v).map(([k]) => k),
  [selected]);
  const selectedCount = selectedTokens.length;

  const filteredAthletes = useMemo(() => {
    const q   = String(search || "").trim().toLowerCase();
    const sel = new Set(selectedTokens);
    let out   = (Array.isArray(athletes) ? athletes : []).filter(a => {
      const token = getAthleteToken(a);
      if (!token) return false;
      const name  = String(a?.name || a?.Name || "").toLowerCase();
      const email = normalizeEmail(a?.email || a?.Email);
      const team  = normalizeTeam(getAthleteTeam(a));
      return (teamFilter === "all" || team === teamFilter) && (!q || name.includes(q) || email.includes(q));
    });
    if (showSelectedOnly) out = out.filter(a => sel.has(getAthleteToken(a)));
    return out;
  }, [athletes, search, teamFilter, showSelectedOnly, selectedTokens]);

  const toggleAllShown = (on) => {
    const next = {};
    (filteredAthletes || []).forEach(a => { const t = getAthleteToken(a); if (t) next[t] = !!on; });
    setSelected(prev => ({ ...prev, ...next }));
  };

  // ---------- items ----------
  const addItem    = () => setItems(p => { const n=[...(Array.isArray(p)?p:[])]; n.push(newItem(n.length+1)); return renumberOrders(n); });
  const removeItem = (i) => setItems(p => { const n=(Array.isArray(p)?[...p]:[]).filter((_,j)=>j!==i); return renumberOrders(n.length?n:[newItem(1)]); });
  const updateItem = (i, patch) => setItems(p => { const n=Array.isArray(p)?[...p]:[]; n[i]={...(n[i]||newItem(i+1)),...patch}; return n; });

  const sortedItemsForSubmit = useMemo(() => {
    const list = renumberOrders(items||[]);
    return [...list].sort((a,b) => Number(a.Order)-Number(b.Order));
  }, [items]);

  const hasAnyMeaningfulItem = useMemo(() =>
    (Array.isArray(items)?items:[]).some(it => String(it?.ExerciseName||"").trim()),
  [items]);

  const validateItems = () => {
    if (!hasAnyMeaningfulItem) return { ok: true, items: [] };
    const list = sortedItemsForSubmit;
    for (let i=0; i<list.length; i++) {
      const it   = list[i] || {};
      const name = String(it.ExerciseName||"").trim();
      const sets = toNumberOrEmpty(it.Sets);
      if (sets !== "" && Number(sets) < 0) return { ok: false, error: `Item #${i+1}: Sets must be ≥ 0.` };
      const ord  = toNumberOrEmpty(it.Order);
      if (ord  !== "" && Number(ord) <= 0) return { ok: false, error: `Item #${i+1}: Order must be ≥ 1.` };
      const ev   = String(it.EvidenceRequired||"none");
      if (!["none","photo","video","photo_or_video"].includes(ev)) return { ok: false, error: `Item #${i+1}: Invalid EvidenceRequired.` };
    }
    const cleaned = list
      .filter(it => String(it?.ExerciseName||"").trim())
      .map((it,idx) => ({
        Order:            Number(toNumberOrEmpty(it.Order)||idx+1),
        ExerciseName:     String(it.ExerciseName||"").trim(),
        Sets:             toNumberOrEmpty(it.Sets)==="" ? null : Number(it.Sets),
        Reps:             String(it.Reps||"").trim() || null,
        Weight:           String(it.Weight||"").trim() || null,
        Rest:             String(it.Rest||"").trim() || null,
        Instructions:     String(it.Instructions||"").trim() || null,
        VideoURL:         sanitizeUrl(it.VideoURL) || null,
        EvidenceRequired: String(it.EvidenceRequired||"none"),
      }));
    return { ok: true, items: cleaned };
  };

  const canSubmit = useMemo(() => {
    if (isEditMode) return Boolean(String(title||"").trim() && !saving);
    return Boolean(activeDate && String(title||"").trim() && selectedCount && !saving);
  }, [isEditMode, activeDate, title, selectedCount, saving]);

  /* ── Submit ── */
  const submit = async () => {
    setErr(""); setOkMsg("");
    if (!String(title||"").trim()) return setErr("Title is required.");
    const itemsCheck = validateItems();
    if (!itemsCheck.ok) return setErr(itemsCheck.error || "Invalid items.");

    if (isEditMode) {
      // ── EDIT PATH ──
      setSaving(true);
      try {
        const body = {
          id:     editWorkout.id,
          title:  String(title).trim(),
          status,
          ...(editDate  ? { date:  String(editDate).slice(0,10)  } : {}),
          ...(editSport ? { sport: String(editSport).toLowerCase() } : {}),
          items: itemsCheck.items,
        };
        const res  = await fetch("/api/org/workouts/update-full", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data?.error || "Failed to update workout");
        setOkMsg("Workout updated!");
        onUpdated?.(data);
        setTimeout(() => onClose?.(), 350);
      } catch (e) { setErr(e?.message || "Failed to update workout"); }
      finally     { setSaving(false); }
    } else {
      // ── CREATE PATH ──
      if (!activeDate)        return setErr("Missing date.");
      if (!selectedTokens.length) return setErr("Select at least one athlete.");
      setSaving(true);
      try {
        const res  = await fetch("/api/org/workouts/create", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: String(activeDate).slice(0,10), title: String(title).trim(), status,
            athleteIds: selectedTokens, items: itemsCheck.items,
            ...(activeSport ? { sport: String(activeSport) } : {}),
          }),
        });
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data?.error || "Failed to create workout");
        setOkMsg("Workout created!");
        onCreated?.(data?.dailyWorkout || data?.workout || null);
        setTimeout(() => onClose?.(), 350);
      } catch (e) { setErr(e?.message || "Failed to create workout"); }
      finally     { setSaving(false); }
    }
  };

  // ---------- render ----------
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={isEditMode ? "Edit Workout" : "Create Workout"}
      subtitle={isEditMode
        ? `Editing: ${editWorkout?.title || "workout"} · changes overwrite all fields and items`
        : "Select athletes, set a title, and optionally add exercise rows."}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* Context bar */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px", padding: "12px 16px", backgroundColor: DS.pageBg, border: `1px solid ${DS.border}`, borderLeft: `3px solid ${isEditMode ? DS.caution : DS.brand}` }}>
          {isEditMode && (
            <span className="flex items-center gap-1.5 text-sm" style={{ color: DS.caution }}>
              <Edit2 className="w-4 h-4" style={{ color: DS.caution }} />
              <strong>Edit mode</strong>
            </span>
          )}
          <span className="flex items-center gap-1.5 text-sm" style={{ color: DS.bodyText }}>
            <CalendarDays className="w-4 h-4" style={{ color: DS.brand }} />
            <strong>{activeDate || "—"}</strong>
          </span>
          {activeSport && <Tag tone="brand">{activeSport}</Tag>}
          <Tag tone={selectedCount ? "good" : "warn"}>
            <Users className="w-3 h-3" /> {selectedCount} selected
          </Tag>
          <Tag tone={hasAnyMeaningfulItem ? "brand" : "neutral"}>
            <Dumbbell className="w-3 h-3" /> {hasAnyMeaningfulItem ? `${items.length} items` : "Items optional"}
          </Tag>
        </div>

        {/* Errors / success */}
        {err && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "12px 16px", backgroundColor: DS.bannedBg, border: `1px solid ${DS.bannedBorder}`, borderLeft: `3px solid ${DS.banned}` }}>
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: DS.banned }} />
            <p style={{ fontSize: "13px", fontWeight: 700, color: DS.banned }}>{err}</p>
          </div>
        )}
        {okMsg && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 16px", backgroundColor: DS.safeBg, border: `1px solid ${DS.safeBorder}`, borderLeft: `3px solid ${DS.safe}` }}>
            <CheckCircle2 className="w-4 h-4" style={{ color: DS.safe }} />
            <p style={{ fontSize: "13px", fontWeight: 700, color: DS.safe }}>{okMsg}</p>
          </div>
        )}

        {/* Title + Status (+ Date/Sport in edit mode) */}
        <div style={{ display: "grid", gridTemplateColumns: isEditMode ? "1fr 160px" : "1fr 200px", gap: "12px" }}>
          <div>
            <span style={labelStyle}>Workout title</span>
            <input ref={titleRef} value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Lower Body Strength — Team Wide"
              style={{ ...inputStyle }}
              onFocus={e => { e.currentTarget.style.borderColor = DS.brand; }}
              onBlur={e  => { e.currentTarget.style.borderColor = DS.border; }} />
            {!isEditMode && (
              <p style={{ fontSize: "11px", color: DS.dimText, marginTop: "5px", display: "flex", alignItems: "center", gap: "4px" }}>
                <Info className="w-3 h-3" /> Tip: include the session goal — speed, strength, mobility.
              </p>
            )}
          </div>
          <DSSelect label="Status" value={status} onChange={e => setStatus(e.target.value)}
            helper={isEditMode ? undefined : "Use 'assigned' for normal scheduling."}>
            <option value="assigned">assigned</option>
            <option value="complete">complete</option>
            <option value="draft">draft</option>
            <option value="archived">archived</option>
          </DSSelect>
        </div>

        {/* Date + Sport (edit mode only — in create mode these come from the calendar) */}
        {isEditMode && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <DSInput label="Date" type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
            <DSSelect label="Sport" value={editSport} onChange={e => setEditSport(e.target.value)}>
              <option value="">— no sport —</option>
              {SPORT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </DSSelect>
          </div>
        )}

        {/* Items builder */}
        <Section
          title="Workout items"
          label={hasAnyMeaningfulItem ? `${items.length} rows` : "optional"}
          open={itemsOpen}
          onToggle={() => setItemsOpen(v => !v)}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <p style={{ fontSize: "11px", color: DS.dimText }}>
              Rows with a blank <strong>ExerciseName</strong> are skipped on submit.
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <Btn onClick={addItem}><Plus className="w-3.5 h-3.5" /> Add item</Btn>
              <Btn onClick={() => setItems([newItem(1)])}>Clear</Btn>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {(items||[]).map((it, idx) => (
              <div key={idx} style={{ border: `1px solid ${DS.border}`, padding: "14px", backgroundColor: DS.pageBg }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 900, color: DS.bodyText }}>Item {idx+1}</span>
                  <button type="button" onClick={() => removeItem(idx)}
                    style={{ padding: "5px", border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg, cursor: "pointer" }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = DS.bannedBg; e.currentTarget.style.borderColor = DS.bannedBorder; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = DS.cardBg;  e.currentTarget.style.borderColor = DS.border; }}>
                    <Trash2 className="w-3.5 h-3.5" style={{ color: DS.dimText }} />
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "10px", marginBottom: "10px" }}>
                  <DSInput label="Order" value={toNumberOrEmpty(it?.Order)} onChange={e => updateItem(idx,{Order:toNumberOrEmpty(e.target.value)})} placeholder="1" inputMode="numeric" />
                  <DSInput label="Exercise name" value={it?.ExerciseName||""} onChange={e => updateItem(idx,{ExerciseName:e.target.value})} placeholder="e.g. Trap Bar Deadlift" />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px", marginBottom: "10px" }}>
                  <DSInput label="Sets"   value={toNumberOrEmpty(it?.Sets)}  onChange={e => updateItem(idx,{Sets:toNumberOrEmpty(e.target.value)})} placeholder="3" inputMode="numeric" />
                  <DSInput label="Reps"   value={it?.Reps||""}               onChange={e => updateItem(idx,{Reps:e.target.value})} placeholder="8–10" />
                  <DSInput label="Weight" value={it?.Weight||""}             onChange={e => updateItem(idx,{Weight:e.target.value})} placeholder="225 lb" />
                  <DSInput label="Rest"   value={it?.Rest||""}               onChange={e => updateItem(idx,{Rest:e.target.value})} placeholder="90s" />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                  <DSSelect label="Evidence required" value={it?.EvidenceRequired||"none"} onChange={e => updateItem(idx,{EvidenceRequired:e.target.value})} helper="Must match Airtable single select.">
                    <option value="none">none</option>
                    <option value="photo">photo</option>
                    <option value="video">video</option>
                    <option value="photo_or_video">photo_or_video</option>
                  </DSSelect>
                  <div>
                    <span style={labelStyle}>Video URL</span>
                    <div style={{ position: "relative" }}>
                      <LinkIcon className="w-3.5 h-3.5 absolute" style={{ left:"10px",top:"50%",transform:"translateY(-50%)",color:DS.dimText,pointerEvents:"none" }} />
                      <input value={it?.VideoURL||""} onChange={e => updateItem(idx,{VideoURL:e.target.value})}
                        placeholder="https://…"
                        style={{ ...inputStyle, paddingLeft: "30px" }}
                        onFocus={e => { e.currentTarget.style.borderColor = DS.brand; }}
                        onBlur={e  => { e.currentTarget.style.borderColor = DS.border; }} />
                    </div>
                    <p style={{ fontSize: "11px", color: DS.dimText, marginTop: "5px" }}>YouTube, Hudl, Drive link, etc.</p>
                  </div>
                </div>

                <DSTextarea label="Instructions" value={it?.Instructions||""} onChange={e => updateItem(idx,{Instructions:e.target.value})} placeholder="Coaching cues, tempo, technique notes…" />
              </div>
            ))}
          </div>
        </Section>

        {/* Athlete picker */}
        <Section
          title={isEditMode ? "Athlete assignment (view only in edit mode)" : "Assign athletes"}
          label={selectedCount ? `${selectedCount} selected` : "required"}
          open={true}
          onToggle={() => {}}
        >
          {isEditMode && (
            <div style={{ padding: "10px 14px", marginBottom: "12px", backgroundColor: DS.cautionBg, border: `1px solid ${DS.cautionBorder}`, borderLeft: `3px solid ${DS.caution}` }}>
              <p style={{ fontSize: "12px", fontWeight: 700, color: DS.caution }}>
                Athlete re-assignment is not supported in edit mode. To reassign, delete this workout and create a new one.
                Existing athlete assignments are preserved automatically.
              </p>
            </div>
          )}

          {/* Toolbar */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Tag tone={selectedCount ? "good" : "warn"}><Users className="w-3 h-3" /> {selectedCount} selected</Tag>
              <Tag tone="neutral">{loadingAthletes ? "Loading…" : `${filteredAthletes.length} shown`}</Tag>
            </div>
            {!isEditMode && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                <Btn onClick={() => toggleAllShown(true)}  disabled={loadingAthletes || !filteredAthletes.length}>Select shown</Btn>
                <Btn onClick={() => toggleAllShown(false)} disabled={loadingAthletes || !filteredAthletes.length}>Clear shown</Btn>
                <Btn onClick={() => setSelected({})}       disabled={!selectedCount}>Clear all</Btn>
                <Btn onClick={fetchAthletes}               disabled={loadingAthletes}>Refresh</Btn>
              </div>
            )}
          </div>

          {/* Filters */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: "10px", marginBottom: "12px" }}>
            <DSSelect label="Team" value={teamFilter} onChange={e => setTeamFilter(e.target.value)}>
              <option value="all">All teams</option>
              {teamsAll.map(t => <option key={t} value={t}>{titleTeam(t)}</option>)}
            </DSSelect>
            <div>
              <span style={labelStyle}>Search</span>
              <div style={{ position: "relative" }}>
                <Search className="w-3.5 h-3.5 absolute" style={{ left:"10px",top:"50%",transform:"translateY(-50%)",color:DS.dimText,pointerEvents:"none" }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or email…"
                  style={{ ...inputStyle, paddingLeft: "30px" }}
                  onFocus={e => { e.currentTarget.style.borderColor = DS.brand; }}
                  onBlur={e  => { e.currentTarget.style.borderColor = DS.border; }} />
              </div>
            </div>
            <div>
              <span style={labelStyle}>View</span>
              <button type="button" onClick={() => setShowSelectedOnly(v => !v)} disabled={!selectedCount && !isEditMode}
                style={{
                  ...inputStyle, fontWeight: 900, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em",
                  cursor: (!selectedCount && !isEditMode) ? "not-allowed" : "pointer",
                  opacity: (!selectedCount && !isEditMode) ? 0.45 : 1,
                  backgroundColor: showSelectedOnly ? DS.brand : DS.cardBg,
                  borderColor:     showSelectedOnly ? DS.brand : DS.border,
                  color:           showSelectedOnly ? "#fff"   : DS.labelText,
                  width: "auto", padding: "10px 14px", whiteSpace: "nowrap",
                }}>
                {showSelectedOnly ? "Selected only" : "All"}
              </button>
            </div>
          </div>

          {/* Athlete list */}
          <div style={{ maxHeight: "320px", overflowY: "auto", border: `1px solid ${DS.border}` }}>
            {loadingAthletes ? (
              <div style={{ padding: "16px", textAlign: "center" }}><p style={{ fontSize: "12px", color: DS.dimText }}>Loading athletes…</p></div>
            ) : filteredAthletes.length === 0 ? (
              <div style={{ padding: "16px", textAlign: "center" }}><p style={{ fontSize: "12px", color: DS.dimText }}>No athletes found.</p></div>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {filteredAthletes.map(a => {
                  const token   = getAthleteToken(a);
                  if (!token) return null;
                  const checked = !!selected[token];
                  const team    = titleTeam(getAthleteTeam(a));
                  return (
                    <li key={token} style={{ borderBottom: `1px solid ${DS.border}`, backgroundColor: checked ? DS.brandBg : DS.cardBg }}>
                      <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 14px", cursor: isEditMode ? "default" : "pointer" }}
                        onMouseEnter={e => { if (!checked && !isEditMode) e.currentTarget.parentElement.style.backgroundColor = DS.pageBg; }}
                        onMouseLeave={e => { if (!checked && !isEditMode) e.currentTarget.parentElement.style.backgroundColor = DS.cardBg; }}>
                        <input type="checkbox" checked={checked}
                          disabled={isEditMode}
                          onChange={() => {
                            if (isEditMode) return;
                            const key = String(token||"").trim();
                            if (key) setSelected(prev => ({ ...prev, [key]: !prev[key] }));
                          }}
                          style={{ marginTop: "3px", accentColor: DS.brand, flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: "13px", fontWeight: 700, color: DS.bodyText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {a?.name || a?.Name || "Athlete"}
                          </p>
                          <p style={{ fontSize: "11px", color: DS.dimText, wordBreak: "break-all" }}>
                            {normalizeEmail(a?.email || a?.Email) || "—"}
                          </p>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "5px" }}>
                            {team && <Tag>{team}</Tag>}
                            {a?.needsPlan && <Tag tone="bad">Needs plan</Tag>}
                            {a?.stale     && <Tag tone="warn">Stale</Tag>}
                          </div>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Selection summary */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", marginTop: "10px", padding: "10px 14px", backgroundColor: DS.pageBg, border: `1px solid ${DS.border}` }}>
            <Tag tone={selectedCount ? "good" : "warn"}>{selectedCount} selected</Tag>
            <Tag tone="neutral">{filteredAthletes.length} shown</Tag>
            {teamFilter !== "all" && <Tag tone="brand">Team: {titleTeam(teamFilter)}</Tag>}
            {search && <Tag tone="brand">Search: "{search}"</Tag>}
            {!isEditMode && (
              <p style={{ fontSize: "11px", color: DS.dimText, marginLeft: "auto" }}>
                At least one athlete required to save.
              </p>
            )}
          </div>
        </Section>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", paddingTop: "4px" }}>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={!canSubmit}
            title={!isEditMode && !selectedCount ? "Select at least one athlete" : undefined}>
            {isEditMode ? <Edit2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {saving ? (isEditMode ? "Updating…" : "Creating…") : (isEditMode ? "Save changes" : "Create workout")}
          </Btn>
        </div>
      </div>
    </ModalShell>
  );
}