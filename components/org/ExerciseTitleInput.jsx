// components/org/ExerciseTitleInput.jsx
// Autocomplete input backed by the org's Exercise Library.
// - Fetches exercises on first focus (lazy, no mount cost)
// - Filters as you type — matches anywhere in the name
// - × button deletes from the library (scoped to org, safe)
// - "Add to library" footer when typed name isn't in the library yet
// - Keyboard: ↑↓ navigate, Enter select, Escape close
//
// Usage:
//   <ExerciseTitleInput
//     value={exerciseName}
//     onChange={setExerciseName}
//     placeholder="Exercise name"
//     inputStyle={{ ...yourExistingInputStyles }}
//   />

"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export default function ExerciseTitleInput({
  value       = "",
  onChange,
  placeholder = "Exercise name",
  className   = "",
  style       = {},
  inputStyle  = {},
  disabled    = false,
}) {
  const [allExercises, setAllExercises] = useState([]); // { id, name, category }[]
  const [filtered,     setFiltered]     = useState([]);
  const [open,         setOpen]         = useState(false);
  const [activeIdx,    setActiveIdx]    = useState(-1);
  const [fetched,      setFetched]      = useState(false);
  const [adding,       setAdding]       = useState(false);
  const [deleting,     setDeleting]     = useState(new Set()); // set of ids being deleted

  const wrapRef  = useRef(null);
  const inputRef = useRef(null);
  const listRef  = useRef(null);

  // ── Fetch from library once on first focus ──────────────────────────────
  const fetchExercises = useCallback(async () => {
    if (fetched) return;
    setFetched(true);
    try {
      const res  = await fetch("/api/org/exercises", { credentials: "include" });
      const data = await res.json();
      if (data.ok) setAllExercises(data.exercises || []);
    } catch {
      // Silently fail — still works as plain text input
    }
  }, [fetched]);

  // ── Filter on value change ───────────────────────────────────────────────
  useEffect(() => {
    const q = String(value || "").trim().toLowerCase();
    if (!q) { setFiltered([]); setOpen(false); return; }
    const matches = allExercises.filter(e => e.name.toLowerCase().includes(q));
    setFiltered(matches.slice(0, 8));
    setOpen(true);
    setActiveIdx(-1);
  }, [value, allExercises]);

  // ── Close on outside click ───────────────────────────────────────────────
  useEffect(() => {
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setActiveIdx(-1);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // ── Scroll active item into view ─────────────────────────────────────────
  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return;
    listRef.current.children[activeIdx]?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  // ── Select an exercise ───────────────────────────────────────────────────
  const select = useCallback((name) => {
    onChange?.(name);
    setOpen(false);
    setActiveIdx(-1);
    inputRef.current?.focus();
  }, [onChange]);

  // ── Add current value to library ─────────────────────────────────────────
  const handleAdd = useCallback(async () => {
    const name = String(value || "").trim();
    if (!name || adding) return;
    setAdding(true);
    try {
      const res  = await fetch("/api/org/exercises", {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ name }),
      });
      const data = await res.json();
      if (data.ok && data.exercise) {
        setAllExercises(prev => {
          const exists = prev.some(e => e.id === data.exercise.id);
          return exists ? prev : [...prev, data.exercise].sort((a,b) => a.name.localeCompare(b.name));
        });
        select(data.exercise.name);
      }
    } catch {
      // Silently fail
    } finally {
      setAdding(false);
    }
  }, [value, adding, select]);

  // ── Delete exercise from library ─────────────────────────────────────────
  const handleDelete = useCallback(async (exercise, e) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleting(prev => new Set(prev).add(exercise.id));
    // Optimistic removal
    setAllExercises(prev => prev.filter(ex => ex.id !== exercise.id));
    try {
      await fetch(`/api/org/exercises?id=${encodeURIComponent(exercise.id)}`, {
        method:      "DELETE",
        credentials: "include",
      });
    } catch {
      // Already removed from local state — silent fail is acceptable
    } finally {
      setDeleting(prev => { const n = new Set(prev); n.delete(exercise.id); return n; });
    }
  }, []);

  // ── Keyboard navigation ──────────────────────────────────────────────────
  const onKeyDown = useCallback((e) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      select(filtered[activeIdx].name);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIdx(-1);
    }
  }, [open, filtered, activeIdx, select]);

  // ── Highlight matching text ──────────────────────────────────────────────
  function highlight(name, query) {
    if (!query) return name;
    const idx = name.toLowerCase().indexOf(query.toLowerCase());
    if (idx < 0) return name;
    return (
      <>
        {name.slice(0, idx)}
        <mark style={{ background: "rgba(0,112,204,0.15)", color: "inherit", borderRadius: 2, padding: 0 }}>
          {name.slice(idx, idx + query.length)}
        </mark>
        {name.slice(idx + query.length)}
      </>
    );
  }

  const query          = String(value || "").trim();
  const exactMatch     = allExercises.some(e => e.name.toLowerCase() === query.toLowerCase());
  const showAddFooter  = query.length > 1 && !exactMatch && fetched;

  return (
    <div ref={wrapRef} style={{ position: "relative", ...style }} className={className}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        onChange={e => onChange?.(e.target.value)}
        onFocus={fetchExercises}
        onKeyDown={onKeyDown}
        style={{ width: "100%", ...inputStyle }}
      />

      {open && (filtered.length > 0 || showAddFooter) && (
        <ul
          ref={listRef}
          role="listbox"
          style={{
            position:     "absolute",
            top:          "calc(100% + 4px)",
            left:         0,
            right:        0,
            zIndex:       1000,
            background:   "#fff",
            border:       "1px solid #E5E7EB",
            borderRadius: 8,
            boxShadow:    "0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
            padding:      "4px",
            margin:       0,
            listStyle:    "none",
            maxHeight:    300,
            overflowY:    "auto",
          }}
        >
          {/* Exercise items */}
          {filtered.map((exercise, i) => {
            const isActive = i === activeIdx;
            return (
              <li
                key={exercise.id}
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setActiveIdx(i)}
                onMouseDown={e => { e.preventDefault(); select(exercise.name); }}
                style={{
                  padding:     "9px 10px",
                  borderRadius: 6,
                  cursor:      "pointer",
                  background:  isActive ? "#EFF6FF" : "transparent",
                  display:     "flex",
                  alignItems:  "center",
                  gap:         10,
                  transition:  "background 0.1s",
                }}
              >
                {/* Icon */}
                <div style={{
                  width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                  background:     isActive ? "#DBEAFE" : "#F3F4F6",
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  fontSize:       13,
                }}>
                  🏋️
                </div>

                {/* Name + category */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {highlight(exercise.name, query)}
                  </div>
                  {exercise.category && (
                    <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 1, textTransform: "capitalize" }}>
                      {exercise.category}
                    </div>
                  )}
                </div>

                {/* Enter hint */}
                {isActive && (
                  <kbd style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 4, padding: "1px 5px", flexShrink: 0 }}>
                    ↵
                  </kbd>
                )}

                {/* Delete button */}
                <button
                  onMouseDown={e => handleDelete(exercise, e)}
                  title={`Remove "${exercise.name}" from library`}
                  style={{
                    flexShrink:     0,
                    width:          22,
                    height:         22,
                    borderRadius:   4,
                    border:         `1px solid ${isActive ? "#FECACA" : "#E5E7EB"}`,
                    background:     isActive ? "#FEF2F2" : "#F9FAFB",
                    color:          isActive ? "#DC2626" : "#9CA3AF",
                    fontSize:       14,
                    lineHeight:     1,
                    cursor:         "pointer",
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "center",
                    padding:        0,
                    transition:     "all 0.12s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#FEF2F2"; e.currentTarget.style.borderColor = "#FECACA"; e.currentTarget.style.color = "#DC2626"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isActive ? "#FEF2F2" : "#F9FAFB"; e.currentTarget.style.borderColor = isActive ? "#FECACA" : "#E5E7EB"; e.currentTarget.style.color = isActive ? "#DC2626" : "#9CA3AF"; }}
                >
                  ×
                </button>
              </li>
            );
          })}

          {/* Add to library footer */}
          {showAddFooter && (
            <li style={{ borderTop: filtered.length ? "1px solid #F3F4F6" : "none", marginTop: filtered.length ? 4 : 0 }}>
              <button
                onMouseDown={e => { e.preventDefault(); handleAdd(); }}
                disabled={adding}
                style={{
                  width:        "100%",
                  display:      "flex",
                  alignItems:   "center",
                  gap:          10,
                  padding:      "9px 10px",
                  background:   "transparent",
                  border:       "none",
                  borderRadius: 6,
                  cursor:       adding ? "not-allowed" : "pointer",
                  textAlign:    "left",
                  opacity:      adding ? 0.6 : 1,
                  transition:   "background 0.1s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#F0FDF4"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ width: 28, height: 28, borderRadius: 6, background: "#DCFCE7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>
                  ＋
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#16A34A" }}>
                    {adding ? "Adding..." : `Add "${query}" to library`}
                  </div>
                  <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 1 }}>
                    Saves it for all coaches in your org
                  </div>
                </div>
              </button>
            </li>
          )}

          {/* Keyboard hint */}
          {filtered.length > 1 && (
            <li style={{ padding: "5px 10px", fontSize: 10, color: "#9CA3AF", borderTop: "1px solid #F3F4F6", marginTop: 4 }}>
              ↑↓ navigate · Enter select · Esc close
            </li>
          )}
        </ul>
      )}
    </div>
  );
}