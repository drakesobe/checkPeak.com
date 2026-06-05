// components/commercial/WorkoutBuilder.jsx
// Workout creation/edit drawer for the commercial dashboard.
// Uses the shared TemplatePicker from the org side — same template system,
// same /api/org/templates/list endpoint, same groupId preservation.
// Optional one-time price: when set, the workout can be bought No Subscription (no subscription).
"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Plus, Trash2, Link2, Unlink, ChevronDown } from "lucide-react";
import { DS } from "@/components/org/dashboard/DashboardUI";
import TemplatePicker from "@/components/org/workoutsCalendar/TemplatePicker";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(v) {
  if (v === "" || v == null) return "";
  const n = Number(v);
  return Number.isFinite(n) ? n : "";
}

function newExercise(order) {
  return {
    Order: order, ExerciseName: "", Sets: "", Reps: "",
    Weight: "", Rest: "", Instructions: "", VideoURL: "",
    groupId: null,
  };
}

function renumber(list) {
  return list.map((it, i) => ({ ...it, Order: i + 1 }));
}

function genGroupId() {
  return `grp_${Math.random().toString(36).slice(2, 9)}`;
}

const GROUP_COLORS = [
  { accent: "#7C3AED", bg: "rgba(124,58,237,0.05)", border: "rgba(124,58,237,0.2)" },
  { accent: "#0891B2", bg: "rgba(8,145,178,0.05)",  border: "rgba(8,145,178,0.2)"  },
  { accent: "#D97706", bg: "rgba(217,119,6,0.05)",  border: "rgba(217,119,6,0.2)"  },
  { accent: "#059669", bg: "rgba(5,150,105,0.05)",  border: "rgba(5,150,105,0.2)"  },
  { accent: "#DC2626", bg: "rgba(220,38,38,0.05)",  border: "rgba(220,38,38,0.2)"  },
];

function getGroupMeta(items) {
  const meta = {};
  let idx = 0;
  (items || []).forEach(it => {
    if (it?.groupId && !meta[it.groupId]) {
      meta[it.groupId] = {
        label: String.fromCharCode(65 + (idx % 26)),
        color: GROUP_COLORS[idx % GROUP_COLORS.length],
        count: 0,
      };
      idx++;
    }
    if (it?.groupId) meta[it.groupId].count++;
  });
  Object.values(meta).forEach(m => { m.type = m.count >= 3 ? "Circuit" : "Superset"; });
  return meta;
}

function computeSegments(items, groupMeta) {
  const segs = [];
  let i = 0;
  while (i < (items || []).length) {
    const item = items[i];
    if (item?.groupId && groupMeta[item.groupId]) {
      const members = [{ item, index: i }];
      let j = i + 1;
      while (j < items.length && items[j]?.groupId === item.groupId) {
        members.push({ item: items[j], index: j });
        j++;
      }
      segs.push({ type: "group", groupId: item.groupId, members });
      i = j;
    } else {
      segs.push({ type: "single", item, index: i });
      i++;
    }
  }
  return segs;
}

// ─── Shared input styles ──────────────────────────────────────────────────────

const inp = {
  width: "100%", padding: "9px 12px", fontSize: 13,
  border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg,
  color: DS.bodyText, outline: "none", fontFamily: "inherit",
  borderRadius: 0,
};

const lbl = {
  display: "block", fontSize: 10, fontWeight: 900,
  textTransform: "uppercase", letterSpacing: "0.12em",
  color: DS.labelText, marginBottom: 5, fontFamily: "inherit",
};

const focusStyle = e => { e.target.style.borderColor = DS.brand; };
const blurStyle  = e => { e.target.style.borderColor = DS.border; };

// ─── Exercise row ─────────────────────────────────────────────────────────────

function ExerciseRow({ item, index, onChange, onRemove, isGrouped, canChainDown, onGroup, onUngroup, groupColor }) {
  return (
    <div style={{
      border:       isGrouped ? "none" : `1px solid ${DS.border}`,
      borderBottom: isGrouped ? `1px solid ${groupColor?.border || DS.border}` : `1px solid ${DS.border}`,
      background:   DS.pageBg,
      overflow:     "hidden",
    }}>
      {/* Row header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", background: DS.cardBg, borderBottom: `1px solid ${DS.border}` }}>
        <span style={{ ...lbl, margin: 0, color: isGrouped ? (groupColor?.accent || DS.labelText) : DS.labelText }}>
          Exercise {index + 1}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {isGrouped && onUngroup && (
            <button type="button" onClick={onUngroup}
              style={{ padding: "3px 8px", border: "1px solid transparent", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: DS.dimText, fontFamily: "inherit" }}
              onMouseEnter={e => { e.currentTarget.style.background = DS.cautionBg; e.currentTarget.style.borderColor = DS.cautionBorder; e.currentTarget.style.color = DS.caution; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = DS.dimText; }}>
              <Unlink className="w-2.5 h-2.5" /> Unlink
            </button>
          )}
          {!isGrouped && canChainDown && onGroup && (
            <button type="button" onClick={onGroup}
              style={{ padding: "3px 8px", border: `1px solid ${DS.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: DS.brand, fontFamily: "inherit" }}
              onMouseEnter={e => { e.currentTarget.style.background = DS.brandBg; e.currentTarget.style.borderColor = DS.brandBorder; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = DS.border; }}>
              <Link2 className="w-2.5 h-2.5" /> Group with next
            </button>
          )}
          <button type="button" onClick={onRemove}
            style={{ padding: "3px 6px", border: "1px solid transparent", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: DS.dimText, fontFamily: "inherit" }}
            onMouseEnter={e => { e.currentTarget.style.background = DS.bannedBg; e.currentTarget.style.borderColor = DS.bannedBorder; e.currentTarget.style.color = DS.banned; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = DS.dimText; }}>
            <Trash2 className="w-2.5 h-2.5" /> Remove
          </button>
        </div>
      </div>

      {/* Fields */}
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <span style={lbl}>Exercise name</span>
          <input
            value={item.ExerciseName}
            onChange={e => onChange({ ExerciseName: e.target.value })}
            placeholder="e.g. Trap Bar Deadlift"
            style={inp}
            onFocus={focusStyle} onBlur={blurStyle}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {[
            { label: "Sets",   key: "Sets",   ph: "3",    num: true  },
            { label: "Reps",   key: "Reps",   ph: "8–10", num: false },
            { label: "Weight", key: "Weight", ph: "225lb",num: false },
            { label: "Rest",   key: "Rest",   ph: "90s",  num: false },
          ].map(({ label, key, ph, num }) => (
            <div key={key}>
              <span style={lbl}>{label}</span>
              <input
                value={num ? toNum(item[key]) : (item[key] || "")}
                onChange={e => onChange({ [key]: num ? toNum(e.target.value) : e.target.value })}
                placeholder={ph}
                style={{ ...inp, padding: "8px 10px" }}
                onFocus={focusStyle} onBlur={blurStyle}
              />
            </div>
          ))}
        </div>
        <div>
          <span style={lbl}>Video URL <span style={{ textTransform: "none", fontWeight: 400, letterSpacing: 0 }}>(optional)</span></span>
          <input
            value={item.VideoURL || ""}
            onChange={e => onChange({ VideoURL: e.target.value })}
            placeholder="https://youtube.com/..."
            style={inp}
            onFocus={focusStyle} onBlur={blurStyle}
          />
        </div>
        <div>
          <span style={lbl}>Instructions <span style={{ textTransform: "none", fontWeight: 400, letterSpacing: 0 }}>(optional)</span></span>
          <textarea
            value={item.Instructions || ""}
            onChange={e => onChange({ Instructions: e.target.value })}
            placeholder="Coaching cues, tempo, technique notes..."
            style={{ ...inp, minHeight: 60, resize: "vertical" }}
            onFocus={focusStyle} onBlur={blurStyle}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Group block ──────────────────────────────────────────────────────────────

function GroupBlock({ groupId, members, groupMeta, onChange, onRemove, onUngroup, onUngroupAll }) {
  const meta = groupMeta[groupId];
  if (!meta) return null;
  const { label, color, type } = meta;

  return (
    <div style={{ border: `1px solid ${color.border}`, borderLeft: `3px solid ${color.accent}`, background: color.bg, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", background: DS.cardBg, borderBottom: `1px solid ${color.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", padding: "2px 8px", background: `${color.accent}18`, border: `1px solid ${color.accent}30`, color: color.accent, fontFamily: "inherit" }}>
            {type} {label}
          </span>
          <span style={{ fontSize: 11, color: DS.dimText }}>
            {meta.count} exercises · rest after all
          </span>
        </div>
        <button type="button" onClick={() => onUngroupAll(groupId)}
          style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: DS.dimText, background: "transparent", border: "1px solid transparent", padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}
          onMouseEnter={e => { e.currentTarget.style.color = DS.banned; e.currentTarget.style.borderColor = DS.bannedBorder; e.currentTarget.style.background = DS.bannedBg; }}
          onMouseLeave={e => { e.currentTarget.style.color = DS.dimText; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.background = "transparent"; }}>
          Ungroup all
        </button>
      </div>
      {members.map(({ item, index }) => (
        <ExerciseRow
          key={index}
          item={item} index={index}
          onChange={patch => onChange(index, patch)}
          onRemove={() => onRemove(index)}
          onUngroup={() => onUngroup(index)}
          isGrouped groupColor={color}
        />
      ))}
    </div>
  );
}

// ─── Main WorkoutBuilder ──────────────────────────────────────────────────────

export default function WorkoutBuilder({ open, onClose, editWorkout, onSaved }) {
  const isEdit = Boolean(editWorkout?.id);

  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [tier,        setTier]        = useState("Basic");
  const [price,       setPrice]       = useState("");   // optional one-time price (No Subscription)
  const [exercises,   setExercises]   = useState([newExercise(1)]);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");

  // ── Template state — mirrors CreateWorkoutDrawer exactly ─────────────────
  const [templates,         setTemplates]         = useState([]);
  const [loadingTemplates,  setLoadingTemplates]  = useState(false);
  const [appliedTemplateId, setAppliedTemplateId] = useState(null);

  const hasPrice = price.trim() !== "" && Number(price) > 0;

  // ── Fetch templates ───────────────────────────────────────────────────────
  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const res  = await fetch("/api/org/templates/list", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      setTemplates(Array.isArray(data?.templates) ? data.templates : []);
    } catch {
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  // ── Hydrate on open ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setError("");
    setAppliedTemplateId(null);
    fetchTemplates();

    if (isEdit) {
      setTitle(editWorkout.fields?.title ?? "");
      setDescription(editWorkout.fields?.description ?? "");
      setTier(editWorkout.fields?.tier ?? "Basic");
      setPrice(editWorkout.fields?.price != null ? String(editWorkout.fields.price) : "");
      try {
        const raw = JSON.parse(editWorkout.fields?.exercises || "[]");
        setExercises(Array.isArray(raw) && raw.length
          ? raw.map((ex, i) => ({
              Order:        Number(ex.Order ?? i + 1),
              ExerciseName: String(ex.ExerciseName || ""),
              Sets:         toNum(ex.Sets),
              Reps:         String(ex.Reps    || ""),
              Weight:       String(ex.Weight  || ""),
              Rest:         String(ex.Rest    || ""),
              Instructions: String(ex.Instructions || ""),
              VideoURL:     String(ex.VideoURL || ""),
              groupId:      ex.groupId || null,
            }))
          : [newExercise(1)]);
      } catch { setExercises([newExercise(1)]); }
    } else {
      setTitle(""); setDescription(""); setTier("Basic"); setPrice("");
      setExercises([newExercise(1)]);
    }
  }, [open, isEdit]);

  // ── Lock body scroll ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = e => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  // ── Template handlers — same pattern as CreateWorkoutDrawer ───────────────

  const applyTemplate = useCallback((template) => {
    // Convert template exercises → commercial exercise format.
    // Preserves groupId so superset/circuit structure carries over.
    const converted = Array.isArray(template.exercises)
      ? template.exercises.map((ex, i) => ({
          Order:        Number(ex?.Order ?? i + 1),
          ExerciseName: String(ex?.ExerciseName || ""),
          Sets:         toNum(ex?.Sets),
          Reps:         String(ex?.Reps    || ""),
          Weight:       String(ex?.Weight  || ""),
          Rest:         String(ex?.Rest    || ""),
          Instructions: String(ex?.Instructions || ""),
          VideoURL:     String(ex?.VideoURL || ""),
          groupId:      ex?.groupId || null,  // ← preserves template grouping
        }))
      : [newExercise(1)];

    setExercises(converted.length ? converted : [newExercise(1)]);
    setAppliedTemplateId(template.id);
    if (!title && template.name) setTitle(template.name);
  }, [title]);

  const handleTemplateDeleted = useCallback((id) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    if (appliedTemplateId === id) setAppliedTemplateId(null);
  }, [appliedTemplateId]);

  const handleTemplateSaved = useCallback((tmpl) => {
    setTemplates(prev => {
      const idx = prev.findIndex(t => t.id === tmpl.id);
      return idx >= 0 ? prev.map((t, i) => i === idx ? tmpl : t) : [...prev, tmpl];
    });
  }, []);

  // ── Grouping handlers ─────────────────────────────────────────────────────

  const groupMeta = getGroupMeta(exercises);
  const segments  = computeSegments(exercises, groupMeta);

  const handleGroup = useCallback((index) => {
    setExercises(prev => {
      const next = [...prev];
      const a = next[index], b = next[index + 1];
      if (!a || !b) return prev;
      let gid = a.groupId || b.groupId || genGroupId();
      if (a.groupId && b.groupId && a.groupId !== b.groupId) {
        const old = b.groupId;
        return next.map(it => it.groupId === old ? { ...it, groupId: gid } : it);
      }
      next[index]     = { ...a, groupId: gid };
      next[index + 1] = { ...b, groupId: gid };
      return next;
    });
  }, []);

  const handleUngroup = useCallback((index) => {
    setExercises(prev => {
      const item = prev[index];
      if (!item?.groupId) return prev;
      const gid  = item.groupId;
      const next = prev.map((it, i) => i === index ? { ...it, groupId: null } : it);
      const remaining = next.filter(it => it.groupId === gid);
      if (remaining.length === 1) return next.map(it => it.groupId === gid ? { ...it, groupId: null } : it);
      return next;
    });
  }, []);

  const handleUngroupAll = useCallback((groupId) => {
    setExercises(prev => prev.map(it => it.groupId === groupId ? { ...it, groupId: null } : it));
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────────

  async function save() {
    setError("");
    if (!title.trim()) return setError("Title is required.");

    const meaningful = exercises.filter(ex => String(ex.ExerciseName || "").trim());

    setSaving(true);
    try {
      const method = isEdit ? "PUT" : "POST";
      const url    = isEdit
        ? `/api/commercial/workout-programs?id=${editWorkout.id}`
        : "/api/commercial/workout-programs";

      const res = await fetch(url, {
        method, credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:       title.trim(),
          description: description.trim(),
          tier,
          // null = subscription-only; number = also purchasable No Subscription
          price: price.trim() === "" ? null : Math.max(0, Number(price) || 0),
          exercises: meaningful.map((ex, i) => ({
            Order:        i + 1,
            ExerciseName: String(ex.ExerciseName).trim(),
            Sets:         toNum(ex.Sets) === "" ? null : Number(ex.Sets),
            Reps:         String(ex.Reps    || "").trim() || null,
            Weight:       String(ex.Weight  || "").trim() || null,
            Rest:         String(ex.Rest    || "").trim() || null,
            Instructions: String(ex.Instructions || "").trim() || null,
            VideoURL:     String(ex.VideoURL || "").trim() || null,
            groupId:      ex.groupId || null,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      onSaved?.(data.workout);
      onClose?.();
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const TIER_STYLE = {
    Basic:   { color: DS.safe,    bg: DS.safeBg,    border: DS.safeBorder    },
    Premium: { color: DS.caution, bg: DS.cautionBg, border: DS.cautionBorder },
    Ultra:   { color: DS.brand,   bg: DS.brandBg,   border: DS.brandBorder   },
  };

  const meaningfulCount = exercises.filter(ex => String(ex.ExerciseName || "").trim()).length;

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 9990, background: "rgba(13,27,42,0.35)", backdropFilter: "blur(3px)" }}
      />

      {/* Drawer */}
      <div style={{
        position:   "fixed", top: 0, right: 0, bottom: 0,
        width:      "clamp(480px, 44vw, 580px)",
        zIndex:     9991,
        background: DS.cardBg,
        borderLeft: `1px solid ${DS.border}`,
        borderTop:  `3px solid ${DS.brand}`,
        display:    "flex", flexDirection: "column",
        boxShadow:  "-12px 0 60px rgba(0,0,0,0.15)",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}>

        {/* Header */}
        <div style={{ padding: "14px 20px 12px", background: DS.pageBg, borderBottom: `1px solid ${DS.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <p style={{ fontSize: 15, fontWeight: 900, color: DS.bodyText, margin: 0, letterSpacing: "-0.01em" }}>
              {isEdit ? "Edit Workout" : "Create Workout"}
            </p>
            <button type="button" onClick={onClose}
              style={{ padding: 6, border: `1px solid ${DS.border}`, background: DS.cardBg, cursor: "pointer", display: "flex" }}
              onMouseEnter={e => { e.currentTarget.style.background = DS.pageBg; }}
              onMouseLeave={e => { e.currentTarget.style.background = DS.cardBg; }}>
              <X className="w-4 h-4" style={{ color: DS.dimText }} />
            </button>
          </div>
          <p style={{ fontSize: 11, color: DS.dimText, margin: 0 }}>
            Structured workout with exercises, sets, and reps. Clients can check off exercises.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: "8px 20px", background: DS.bannedBg, borderBottom: `1px solid ${DS.bannedBorder}` }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: DS.banned, margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Title */}
            <div>
              <span style={lbl}>Workout title *</span>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Upper Body Strength — Block 1"
                autoFocus
                style={inp}
                onFocus={focusStyle} onBlur={blurStyle}
              />
            </div>

            {/* Description */}
            <div>
              <span style={lbl}>Description <span style={{ textTransform: "none", fontWeight: 400, letterSpacing: 0 }}>(optional)</span></span>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What to expect, how this fits into the program, who it's for..."
                style={{ ...inp, minHeight: 60, resize: "vertical" }}
                onFocus={focusStyle} onBlur={blurStyle}
              />
            </div>

            {/* Tier */}
            <div>
              <span style={lbl}>Access tier</span>
              <div style={{ display: "flex", gap: 8 }}>
                {["Basic", "Premium", "Ultra"].map(t => {
                  const isActive = tier === t;
                  const ts = TIER_STYLE[t];
                  return (
                    <button key={t} type="button" onClick={() => setTier(t)}
                      style={{ flex: 1, padding: "9px 12px", border: `1px solid ${isActive ? ts.color + "55" : DS.border}`, background: isActive ? ts.bg : DS.cardBg, color: isActive ? ts.color : DS.labelText, fontSize: 12, fontWeight: isActive ? 800 : 500, cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s" }}>
                      {t}
                    </button>
                  );
                })}
              </div>
              <p style={{ fontSize: 11, color: DS.dimText, marginTop: 5 }}>
                Clients on this tier and above can access this workout.
              </p>
            </div>

            {/* One-time price */}
            <div>
              <span style={lbl}>One-time price <span style={{ textTransform: "none", fontWeight: 400, letterSpacing: 0 }}>(optional)</span></span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: DS.labelText }}>$</span>
                <input
                  type="number" min="0"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  placeholder="0"
                  style={{ ...inp, width: 120 }}
                  onFocus={focusStyle} onBlur={blurStyle}
                />
                <span style={{ fontSize: 11, color: DS.dimText }}>one-time</span>
              </div>
              <p style={{ fontSize: 11, color: hasPrice ? DS.brand : DS.dimText, marginTop: 5, lineHeight: 1.5 }}>
                {hasPrice
                  ? "Clients can buy this workout outright — no subscription needed. Subscribers on the tier (and above) still get it included."
                  : "Leave empty to keep this workout subscription-only. Add a price to also sell it as a one-time purchase."}
              </p>
            </div>

            <div style={{ height: 1, background: DS.border }} />

            {/* ── Template picker — shared org component ── */}
            <TemplatePicker
              templates={templates}
              loading={loadingTemplates}
              appliedId={appliedTemplateId}
              derivedSport=""
              currentExercises={exercises}
              onApply={applyTemplate}
              onDelete={handleTemplateDeleted}
              onTemplateSaved={handleTemplateSaved}
            />

            <div style={{ height: 1, background: DS.border }} />

            {/* Exercise section header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 800, color: DS.bodyText, margin: "0 0 2px" }}>
                  Exercises
                  {meaningfulCount > 0 && (
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: DS.dimText }}>
                      {meaningfulCount} added
                    </span>
                  )}
                </p>
                {Object.keys(groupMeta).length > 0 && (
                  <p style={{ fontSize: 11, color: DS.dimText, margin: 0 }}>
                    {Object.values(groupMeta).map(m => `${m.type} ${m.label}`).join(" · ")}
                  </p>
                )}
              </div>
            </div>

            {/* Grouping hint */}
            {exercises.length >= 2 && Object.keys(groupMeta).length === 0 && (
              <div style={{ display: "flex", gap: 8, padding: "8px 12px", background: DS.brandBg, border: `1px solid ${DS.brandBorder}`, borderLeft: `3px solid ${DS.brand}` }}>
                <Link2 className="w-3 h-3" style={{ color: DS.brand, flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontSize: 11, color: DS.brand, margin: 0, lineHeight: 1.5 }}>
                  <strong>Tip:</strong> Use <strong>Group with next</strong> to create Supersets and Circuits.
                </p>
              </div>
            )}

            {/* Exercise list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {segments.map(seg => {
                if (seg.type === "group") {
                  return (
                    <GroupBlock
                      key={seg.groupId}
                      groupId={seg.groupId}
                      members={seg.members}
                      groupMeta={groupMeta}
                      onChange={(index, patch) => setExercises(prev => { const n = [...prev]; n[index] = { ...n[index], ...patch }; return n; })}
                      onRemove={(index) => setExercises(prev => { const n = renumber(prev.filter((_, j) => j !== index)); return n.length ? n : [newExercise(1)]; })}
                      onUngroup={handleUngroup}
                      onUngroupAll={handleUngroupAll}
                    />
                  );
                }
                const { item, index } = seg;
                return (
                  <ExerciseRow
                    key={index}
                    item={item} index={index}
                    onChange={patch => setExercises(prev => { const n = [...prev]; n[index] = { ...n[index], ...patch }; return n; })}
                    onRemove={() => setExercises(prev => { const n = renumber(prev.filter((_, j) => j !== index)); return n.length ? n : [newExercise(1)]; })}
                    isGrouped={false}
                    canChainDown={index < exercises.length - 1}
                    onGroup={() => handleGroup(index)}
                  />
                );
              })}
            </div>

            {/* Add exercise */}
            <button type="button"
              onClick={() => setExercises(prev => renumber([...prev, newExercise(prev.length + 1)]))}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, border: `2px dashed ${DS.border}`, background: "transparent", fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: DS.brand, cursor: "pointer", fontFamily: "inherit" }}
              onMouseEnter={e => { e.currentTarget.style.background = DS.brandBg; e.currentTarget.style.borderColor = DS.brandBorder; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = DS.border; }}>
              <Plus className="w-3.5 h-3.5" /> Add exercise
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px", background: DS.pageBg, borderTop: `1px solid ${DS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <button type="button" onClick={onClose}
            style={{ padding: "9px 16px", border: `1px solid ${DS.border}`, background: DS.cardBg, fontSize: 11, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: DS.labelText, cursor: "pointer", fontFamily: "inherit" }}
            onMouseEnter={e => { e.currentTarget.style.background = DS.pageBg; }}
            onMouseLeave={e => { e.currentTarget.style.background = DS.cardBg; }}>
            Cancel
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: DS.dimText }}>
              {meaningfulCount} exercise{meaningfulCount !== 1 ? "s" : ""} · {tier}{hasPrice ? ` · $${Math.max(0, Number(price) || 0)}` : ""}
            </span>
            <button type="button" onClick={save} disabled={saving || !title.trim()}
              style={{ padding: "9px 20px", background: title.trim() && !saving ? DS.brand : DS.border, border: "none", fontSize: 11, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff", cursor: title.trim() && !saving ? "pointer" : "not-allowed", opacity: title.trim() && !saving ? 1 : 0.5, fontFamily: "inherit" }}>
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create workout"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}