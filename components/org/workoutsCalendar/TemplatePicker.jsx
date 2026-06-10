// components/org/workoutsCalendar/TemplatePicker.jsx
// Inline template browser for Step 3 of CreateWorkoutDrawer.
// Shows template cards filtered by sport/category.
// Preview expands to show exercises. Apply fills the drawer's exercise builder.
// Save-as-template form saves the current exercise set as a new template.
"use client";

import { useState, useMemo } from "react";
import { Search, Trash2, ChevronDown, ChevronUp, Check, BookOpen, Plus, Save } from "lucide-react";
import { DS } from "@/components/org/dashboard/DashboardUI";

const F = {
  cond: "'Barlow Condensed', sans-serif",
  body: "'Barlow', sans-serif",
};

const CATEGORIES = [
  { value: "strength",     label: "Strength",     hsl: "214,80%,35%" },
  { value: "conditioning", label: "Conditioning", hsl: "20,80%,38%"  },
  { value: "speed",        label: "Speed",        hsl: "270,60%,38%" },
  { value: "mobility",     label: "Mobility",     hsl: "142,65%,32%" },
  { value: "recovery",     label: "Recovery",     hsl: "35,70%,38%"  },
];

const SPORT_OPTIONS = [
  "soccer","basketball","xc","football","track",
  "swim","tennis","hockey","baseball","softball","wrestling",
];

const GROUP_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const PREVIEW_GROUP_COLORS = ["#7C3AED","#0891B2","#D97706","#059669","#DC2626"];

function getPreviewGroupMeta(exercises) {
  const meta = {}; let idx = 0;
  (exercises || []).forEach(ex => {
    const gid = ex?.groupId;
    if (gid && !meta[gid]) { meta[gid] = { label: GROUP_LETTERS[idx % 26], color: PREVIEW_GROUP_COLORS[idx % PREVIEW_GROUP_COLORS.length], count: 0 }; idx++; }
    if (gid) meta[gid].count++;
  });
  Object.values(meta).forEach(m => { m.type = m.count >= 3 ? "Circuit" : "Superset"; });
  return meta;
}

function categoryStyle(value) {
  const cat = CATEGORIES.find(c => c.value === value);
  if (!cat) return { bg: DS.pageBg, border: DS.border, text: DS.dimText };
  return {
    bg:     `hsla(${cat.hsl.replace("%,","%,").split(",").slice(0,2).join(",")},92%)`,
    border: `hsla(${cat.hsl},0.3)`,
    text:   `hsl(${cat.hsl})`,
    dot:    `hsl(${cat.hsl})`,
  };
}

function ExercisePreviewRow({ ex, index }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12,
      padding: "8px 0",
      borderBottom: `1px solid ${DS.border}`,
    }}>
      <span style={{
        fontFamily: F.cond, fontWeight: 900, fontSize: 10,
        letterSpacing: "0.1em", color: DS.dimText,
        minWidth: 20, paddingTop: 2, flexShrink: 0,
      }}>
        {index + 1}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: F.body, fontWeight: 700, fontSize: 13, color: DS.bodyText, margin: "0 0 3px" }}>
          {ex.ExerciseName || "-"}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {[
            ex.Sets   && `${ex.Sets} sets`,
            ex.Reps   && `${ex.Reps} reps`,
            ex.Weight && ex.Weight,
            ex.Rest   && `${ex.Rest} rest`,
          ].filter(Boolean).map((label, i) => (
            <span key={i} style={{
              fontFamily: F.body, fontSize: 11, color: DS.dimText,
              padding: "1px 7px",
              background: DS.pageBg,
              border: `1px solid ${DS.border}`,
            }}>
              {label}
            </span>
          ))}
          {ex.EvidenceRequired && ex.EvidenceRequired !== "none" && (
            <span style={{
              fontFamily: F.cond, fontWeight: 900, fontSize: 9,
              letterSpacing: "0.08em", textTransform: "uppercase",
              padding: "1px 7px",
              background: DS.brandBg, border: `1px solid ${DS.brandBorder}`,
              color: DS.brand,
            }}>
              {ex.EvidenceRequired === "voluntary_activity_vara" ? "VARA" : ex.EvidenceRequired.replace("_", "/")}
            </span>
          )}
        </div>
        {ex.Instructions && (
          <p style={{ fontFamily: F.body, fontSize: 11, color: DS.dimText, margin: "4px 0 0", lineHeight: 1.5 }}>
            {ex.Instructions.slice(0, 120)}{ex.Instructions.length > 120 ? "…" : ""}
          </p>
        )}
      </div>
    </div>
  );
}

function TemplateCard({ template, onApply, onDelete, isApplied }) {
  const [previewing, setPreviewing] = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const cs = categoryStyle(template.category);

  const handleDelete = async () => {
    if (!confirm(`Delete "${template.name}"? This can't be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/org/templates/delete", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: template.id }),
      });
      if (res.ok) onDelete?.(template.id);
    } catch {}
    setDeleting(false);
  };

  return (
    <div style={{
      border: `1px solid ${isApplied ? DS.brandBorder : DS.border}`,
      borderTop: `2px solid ${isApplied ? DS.brand : cs.dot || DS.border}`,
      background: isApplied ? DS.brandBg : DS.cardBg,
      overflow: "hidden",
      transition: "border-color 0.15s, background 0.15s",
    }}>
      {/* Card header */}
      <div style={{ padding: "12px 14px" }}>
        {/* Top row: category badge + actions */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{
              fontFamily: F.cond, fontWeight: 900, fontSize: 9,
              letterSpacing: "0.12em", textTransform: "uppercase",
              padding: "2px 8px",
              background: cs.bg, border: `1px solid ${cs.border}`,
              color: cs.text,
            }}>
              {template.category}
            </span>
            {template.sport && (
              <span style={{
                fontFamily: F.cond, fontWeight: 900, fontSize: 9,
                letterSpacing: "0.1em", textTransform: "uppercase",
                padding: "2px 7px",
                background: DS.pageBg, border: `1px solid ${DS.border}`,
                color: DS.dimText,
              }}>
                {template.sport}
              </span>
            )}
          </div>
          <button type="button" onClick={handleDelete} disabled={deleting}
            style={{ padding: "3px 5px", border: `1px solid transparent`, background: "transparent", cursor: "pointer", opacity: deleting ? 0.4 : 1, flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = DS.bannedBorder; e.currentTarget.style.background = DS.bannedBg; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.background = "transparent"; }}>
            <Trash2 style={{ width: 12, height: 12, color: DS.dimText }} />
          </button>
        </div>

        {/* Name */}
        <p style={{ fontFamily: F.cond, fontWeight: 900, fontSize: 14, letterSpacing: "0.02em", textTransform: "uppercase", color: DS.bodyText, margin: "0 0 4px" }}>
          {template.name}
        </p>

        {/* Description + exercise count */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: F.body, fontSize: 11, color: DS.dimText }}>
            {template.exercises.length} exercise{template.exercises.length !== 1 ? "s" : ""}
          </span>
          {template.description && (
            <>
              <span style={{ color: DS.border }}>·</span>
              <span style={{ fontFamily: F.body, fontSize: 11, color: DS.dimText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {template.description}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div style={{
        display: "flex", borderTop: `1px solid ${DS.border}`,
      }}>
        <button type="button" onClick={() => setPreviewing(v => !v)}
          style={{
            flex: 1, padding: "8px 12px",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            background: "transparent", border: "none", borderRight: `1px solid ${DS.border}`,
            fontFamily: F.cond, fontWeight: 900, fontSize: 10,
            letterSpacing: "0.1em", textTransform: "uppercase",
            color: DS.dimText, cursor: "pointer", transition: "background 0.12s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = DS.pageBg; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
          {previewing
            ? <><ChevronUp style={{ width: 12, height: 12 }} /> Hide</>
            : <><ChevronDown style={{ width: 12, height: 12 }} /> Preview</>
          }
        </button>
        <button type="button" onClick={() => onApply(template)}
          style={{
            flex: 1, padding: "8px 12px",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            background: isApplied ? DS.brand : "transparent",
            border: "none",
            fontFamily: F.cond, fontWeight: 900, fontSize: 10,
            letterSpacing: "0.1em", textTransform: "uppercase",
            color: isApplied ? "#fff" : DS.brand, cursor: "pointer", transition: "all 0.12s",
          }}
          onMouseEnter={e => { if (!isApplied) { e.currentTarget.style.background = DS.brandBg; } }}
          onMouseLeave={e => { if (!isApplied) { e.currentTarget.style.background = "transparent"; } }}>
          {isApplied
            ? <><Check style={{ width: 12, height: 12 }} /> Applied</>
            : <>Apply template <ChevronDown style={{ width: 12, height: 12, transform: "rotate(-90deg)" }} /></>
          }
        </button>
      </div>

      {/* Preview panel */}
      {previewing && template.exercises.length > 0 && (() => {
        const gMeta = getPreviewGroupMeta(template.exercises);
        const seenGroups = new Set();
        return (
          <div style={{ borderTop: `1px solid ${DS.border}`, background: DS.pageBg, padding: "12px 14px" }}>
            {template.exercises.map((ex, i) => {
              const gid = ex?.groupId;
              const gm  = gid ? gMeta[gid] : null;
              const isFirstInGroup = gm && !seenGroups.has(gid);
              if (isFirstInGroup) seenGroups.add(gid);
              return (
                <div key={i}>
                  {isFirstInGroup && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 7,
                      padding: "5px 0 3px",
                      borderTop: i > 0 ? `1px solid ${DS.border}` : "none",
                      marginTop: i > 0 ? 4 : 0,
                    }}>
                      <span style={{
                        fontFamily: F.cond, fontWeight: 900, fontSize: 9,
                        letterSpacing: "0.1em", textTransform: "uppercase",
                        padding: "2px 7px",
                        background: gm.color + "18",
                        border: `1px solid ${gm.color}40`,
                        color: gm.color,
                      }}>
                        {gm.type} {gm.label}
                      </span>
                      <span style={{ fontFamily: F.body, fontSize: 10, color: DS.dimText }}>
                        {gm.count} exercises · back to back
                      </span>
                    </div>
                  )}
                  <div style={{ paddingLeft: gm ? 10 : 0, borderLeft: gm ? `2px solid ${gm.color}40` : "none" }}>
                    <ExercisePreviewRow ex={ex} index={i} />
                  </div>
                </div>
              );
            })}
            <button type="button" onClick={() => { onApply(template); setPreviewing(false); }}
              style={{
                marginTop: 12, width: "100%",
                padding: "9px", background: DS.brand, border: "none",
                fontFamily: F.cond, fontWeight: 900, fontSize: 11,
                letterSpacing: "0.1em", textTransform: "uppercase",
                color: "#fff", cursor: "pointer",
              }}
              onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}>
              Apply this template
            </button>
          </div>
        );
      })()}
    </div>
  );
}

// Save-as-template form
function SaveTemplateForm({ currentExercises, derivedSport, onSaved, onCancel }) {
  const [name,        setName]        = useState("");
  const [category,    setCategory]    = useState("strength");
  const [sport,       setSport]       = useState(derivedSport || "");
  const [description, setDescription] = useState("");
  const [saving,      setSaving]      = useState(false);
  const [err,         setErr]         = useState("");

  const handleSave = async () => {
    if (!name.trim()) return setErr("Name is required.");
    setSaving(true); setErr("");
    try {
      const res  = await fetch("/api/org/templates/save", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: {
            name: name.trim(), category, sport, description: description.trim(),
            exercises: currentExercises.filter(ex => String(ex?.ExerciseName || "").trim()),
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Save failed");
      onSaved?.(data.template);
    } catch (e) {
      setErr(e?.message || "Save failed.");
    }
    setSaving(false);
  };

  const inp = {
    width: "100%", padding: "9px 12px", fontSize: "13px",
    border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg,
    color: DS.bodyText, outline: "none", fontFamily: F.body,
  };
  const lbl = {
    display: "block", fontFamily: F.cond, fontSize: "10px", fontWeight: 900,
    textTransform: "uppercase", letterSpacing: "0.12em",
    color: DS.labelText, marginBottom: "4px",
  };

  return (
    <div style={{
      border: `1px solid ${DS.brandBorder}`,
      borderTop: `3px solid ${DS.brand}`,
      background: DS.brandBg,
      padding: "16px",
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      <p style={{ fontFamily: F.cond, fontWeight: 900, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: DS.brand, margin: 0 }}>
        Save as Template
      </p>

      {err && (
        <p style={{ fontFamily: F.body, fontSize: 11, color: DS.banned, fontWeight: 700, margin: 0 }}>
          ⚠ {err}
        </p>
      )}

      {/* Name */}
      <div>
        <span style={lbl}>Template name *</span>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="e.g. Upper Body Strength A"
          autoFocus style={inp}
          onFocus={e => { e.currentTarget.style.borderColor = DS.brand; }}
          onBlur={e  => { e.currentTarget.style.borderColor = DS.border; }} />
      </div>

      {/* Category + Sport */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <span style={lbl}>Category</span>
          <select value={category} onChange={e => setCategory(e.target.value)}
            style={{ ...inp, cursor: "pointer", appearance: "none" }}
            onFocus={e => { e.currentTarget.style.borderColor = DS.brand; }}
            onBlur={e  => { e.currentTarget.style.borderColor = DS.border; }}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <span style={lbl}>Sport (optional)</span>
          <select value={sport} onChange={e => setSport(e.target.value)}
            style={{ ...inp, cursor: "pointer", appearance: "none" }}
            onFocus={e => { e.currentTarget.style.borderColor = DS.brand; }}
            onBlur={e  => { e.currentTarget.style.borderColor = DS.border; }}>
            <option value="">All sports</option>
            {SPORT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Description */}
      <div>
        <span style={lbl}>Description (optional)</span>
        <input value={description} onChange={e => setDescription(e.target.value)}
          placeholder="e.g. Compound press focus - 5x5 week"
          style={inp}
          onFocus={e => { e.currentTarget.style.borderColor = DS.brand; }}
          onBlur={e  => { e.currentTarget.style.borderColor = DS.border; }} />
      </div>

      {/* Exercise count */}
      <p style={{ fontFamily: F.body, fontSize: 11, color: DS.brand, opacity: 0.8, margin: 0 }}>
        {currentExercises.filter(ex => String(ex?.ExerciseName || "").trim()).length} exercises will be saved.
      </p>

      {/* Buttons */}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={handleSave} disabled={saving}
          style={{
            flex: 1, padding: "9px", background: DS.brand, border: "none",
            fontFamily: F.cond, fontWeight: 900, fontSize: 11,
            letterSpacing: "0.1em", textTransform: "uppercase",
            color: "#fff", cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
          <Save style={{ width: 12, height: 12 }} />
          {saving ? "Saving..." : "Save template"}
        </button>
        <button type="button" onClick={onCancel}
          style={{
            padding: "9px 16px", border: `1px solid ${DS.brandBorder}`,
            background: "transparent",
            fontFamily: F.cond, fontWeight: 900, fontSize: 11,
            letterSpacing: "0.1em", textTransform: "uppercase",
            color: DS.brand, cursor: "pointer",
          }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main TemplatePicker export ───────────────────────────────────────────────
export default function TemplatePicker({
  templates,
  loading,
  appliedId,
  derivedSport,
  currentExercises,
  onApply,
  onDelete,
  onTemplateSaved,
}) {
  const [search,      setSearch]      = useState("");
  const [catFilter,   setCatFilter]   = useState("all");
  const [sportFilter, setSportFilter] = useState(derivedSport || "all");
  const [saveMode,    setSaveMode]    = useState(false);
  const [open,        setOpen]        = useState(false);

  const filtered = useMemo(() => {
    if (!Array.isArray(templates)) return [];
    const q = search.trim().toLowerCase();
    return templates.filter(t => {
      if (catFilter !== "all"   && t.category !== catFilter)                  return false;
      if (sportFilter !== "all" && t.sport && t.sport !== sportFilter)        return false;
      if (sportFilter !== "all" && !t.sport && sportFilter !== "all")         {} // "" sport = all sports, show always
      if (q && !t.name.toLowerCase().includes(q) && !t.description?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [templates, catFilter, sportFilter, search]);

  const sportsWithTemplates = useMemo(() => {
    const set = new Set();
    (templates || []).forEach(t => { if (t.sport) set.add(t.sport); });
    return Array.from(set).sort();
  }, [templates]);

  const handleSaved = (tmpl) => {
    onTemplateSaved?.(tmpl);
    setSaveMode(false);
  };

  return (
    <div style={{ border: `1px solid ${DS.border}`, overflow: "hidden" }}>

      {/* Header toggle */}
      <button type="button" onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", background: open ? DS.pageBg : DS.cardBg, border: "none",
          borderBottom: open ? `1px solid ${DS.border}` : "none",
          cursor: "pointer", transition: "background 0.12s",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = DS.brandBg; }}
        onMouseLeave={e => { e.currentTarget.style.background = open ? DS.pageBg : DS.cardBg; }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BookOpen style={{ width: 14, height: 14, color: DS.brand }} />
          <span style={{ fontFamily: F.cond, fontWeight: 900, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: DS.bodyText }}>
            Start from a template
          </span>
          {loading ? (
            <span style={{ fontFamily: F.body, fontSize: 11, color: DS.dimText }}>Loading...</span>
          ) : (
            <span style={{
              fontFamily: F.cond, fontWeight: 900, fontSize: 10,
              padding: "2px 7px", background: DS.pageBg,
              border: `1px solid ${DS.border}`, color: DS.dimText,
            }}>
              {templates?.length || 0}
            </span>
          )}
          {appliedId && (
            <span style={{
              fontFamily: F.cond, fontWeight: 900, fontSize: 9,
              padding: "2px 7px", background: DS.safeBg,
              border: `1px solid ${DS.safeBorder}`, color: DS.safe,
              letterSpacing: "0.08em", textTransform: "uppercase",
            }}>
              ✓ Applied
            </span>
          )}
        </div>
        {open
          ? <ChevronUp   style={{ width: 14, height: 14, color: DS.dimText }} />
          : <ChevronDown style={{ width: 14, height: 14, color: DS.dimText }} />
        }
      </button>

      {open && (
        <div>
          {/* Filters */}
          <div style={{ padding: "10px 16px", borderBottom: `1px solid ${DS.border}`, display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Search */}
            <div style={{ position: "relative" }}>
              <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 12, height: 12, color: DS.dimText, pointerEvents: "none" }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search templates..."
                style={{
                  width: "100%", padding: "7px 12px 7px 30px", fontSize: "12px",
                  border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg,
                  color: DS.bodyText, outline: "none", fontFamily: F.body,
                }}
                onFocus={e => { e.currentTarget.style.borderColor = DS.brand; }}
                onBlur={e  => { e.currentTarget.style.borderColor = DS.border; }} />
            </div>

            {/* Category pills */}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setCatFilter("all")}
                style={{ padding: "3px 10px", fontFamily: F.cond, fontWeight: 900, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", border: `1px solid ${catFilter === "all" ? DS.brand : DS.border}`, background: catFilter === "all" ? DS.brand : "transparent", color: catFilter === "all" ? "#fff" : DS.dimText, cursor: "pointer" }}>
                All
              </button>
              {CATEGORIES.map(c => {
                const cs     = categoryStyle(c.value);
                const active = catFilter === c.value;
                return (
                  <button key={c.value} type="button" onClick={() => setCatFilter(c.value)}
                    style={{ padding: "3px 10px", fontFamily: F.cond, fontWeight: 900, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", border: `1px solid ${active ? cs.dot : DS.border}`, background: active ? cs.bg : "transparent", color: active ? cs.text : DS.dimText, cursor: "pointer" }}>
                    {c.label}
                  </button>
                );
              })}
            </div>

            {/* Sport pills - only show if templates have sport tags */}
            {sportsWithTemplates.length > 0 && (
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                <button type="button" onClick={() => setSportFilter("all")}
                  style={{ padding: "3px 10px", fontFamily: F.cond, fontWeight: 900, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", border: `1px solid ${sportFilter === "all" ? DS.brand : DS.border}`, background: sportFilter === "all" ? DS.brand : "transparent", color: sportFilter === "all" ? "#fff" : DS.dimText, cursor: "pointer" }}>
                  All sports
                </button>
                {sportsWithTemplates.map(s => {
                  const active = sportFilter === s;
                  return (
                    <button key={s} type="button" onClick={() => setSportFilter(s)}
                      style={{ padding: "3px 10px", fontFamily: F.cond, fontWeight: 900, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", border: `1px solid ${active ? DS.brand : DS.border}`, background: active ? DS.brand : "transparent", color: active ? "#fff" : DS.dimText, cursor: "pointer" }}>
                      {s}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Template grid */}
          <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            {loading && (
              <p style={{ fontFamily: F.body, fontSize: 12, color: DS.dimText, textAlign: "center", padding: "24px 0" }}>
                Loading templates...
              </p>
            )}
            {!loading && filtered.length === 0 && (
              <div style={{ padding: "32px 16px", textAlign: "center" }}>
                <BookOpen style={{ width: 24, height: 24, color: DS.dimText, margin: "0 auto 10px" }} />
                <p style={{ fontFamily: F.cond, fontWeight: 900, fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", color: DS.bodyText, margin: "0 0 4px" }}>
                  {(templates?.length || 0) === 0 ? "No templates yet" : "No matches"}
                </p>
                <p style={{ fontFamily: F.body, fontSize: 12, color: DS.dimText, margin: 0 }}>
                  {(templates?.length || 0) === 0
                    ? "Build your first workout below, then save it as a template."
                    : "Try a different filter."}
                </p>
              </div>
            )}
            {!loading && filtered.map(t => (
              <TemplateCard
                key={t.id}
                template={t}
                isApplied={appliedId === t.id}
                onApply={onApply}
                onDelete={onDelete}
              />
            ))}
          </div>

          {/* Save-as-template section */}
          <div style={{ padding: "0 16px 16px" }}>
            {!saveMode ? (
              <button type="button" onClick={() => setSaveMode(true)}
                style={{
                  width: "100%", padding: "9px", border: `2px dashed ${DS.border}`,
                  background: "transparent", fontFamily: F.cond, fontWeight: 900,
                  fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase",
                  color: DS.brand, cursor: "pointer", display: "flex",
                  alignItems: "center", justifyContent: "center", gap: 6,
                  transition: "all 0.12s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = DS.brandBg; e.currentTarget.style.borderColor = DS.brandBorder; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = DS.border; }}>
                <Plus style={{ width: 13, height: 13 }} />
                Save current exercises as template
              </button>
            ) : (
              <SaveTemplateForm
                currentExercises={currentExercises}
                derivedSport={derivedSport}
                onSaved={handleSaved}
                onCancel={() => setSaveMode(false)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}