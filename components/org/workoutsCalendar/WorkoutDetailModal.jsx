// components/org/workoutsCalendar/WorkoutDetailModal.jsx
//
// VIEW-ONLY detail modal.
// Clicking "Edit Full" closes this modal and opens CreateWorkoutModal
// in edit mode with all fields pre-populated.
//
// Props:
//   open        boolean
//   onClose     () => void
//   workout     { id, Title, Date, Status, Sport, athleteCount, itemCount }
//   onRefresh   () => void   — called after delete
//   onEditFull  (editWorkout) => void  — parent opens CreateWorkoutModal with this data
"use client";

import { useState, useEffect } from "react";
import {
  X, Trash2, AlertTriangle, Edit2, Loader2, UserCheck, Dumbbell,
  CalendarDays, CheckCircle2, Clock,
} from "lucide-react";
import { DS } from "@/components/org/dashboard/DashboardUI";
import { titleSport } from "@/lib/org/workoutsCalendar/sports";

// ── tiny helpers ───────────────────────────────────────────────────────────────
async function safeJson(r) { try { return await r.json(); } catch { return {}; } }

function formatDate(iso) {
  if (!iso) return "—";
  try {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleString(undefined, {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
  } catch { return iso; }
}

// ── StatusBadge ────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const v = String(status || "").toLowerCase();
  let bg = DS.pageBg, border = DS.border, color = DS.dimText;
  if (v.includes("complete"))                              { bg = DS.safeBg;    border = DS.safeBorder;    color = DS.safe;    }
  else if (v.includes("assign") || v.includes("pending")) { bg = DS.cautionBg; border = DS.cautionBorder; color = DS.caution; }
  else if (v.includes("archive") || v.includes("reject")) { bg = DS.bannedBg;  border = DS.bannedBorder;  color = DS.banned;  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", fontSize: "10px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", backgroundColor: bg, border: `1px solid ${border}`, color }}>
      {status || "—"}
    </span>
  );
}

// ── Stat chip ──────────────────────────────────────────────────────────────────
function Chip({ icon: Icon, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", backgroundColor: DS.pageBg, border: `1px solid ${DS.border}` }}>
      <Icon style={{ width: 16, height: 16, color: DS.brand, flexShrink: 0 }} />
      <div>
        <p style={{ fontSize: "9px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em", color: DS.dimText }}>{label}</p>
        <p style={{ fontSize: "13px", fontWeight: 700, color: DS.bodyText, marginTop: "2px" }}>{value}</p>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function WorkoutDetailModal({ open, onClose, workout, onRefresh, onEditFull }) {
  const [loading,       setLoading]       = useState(false);
  const [detail,        setDetail]        = useState(null);   // full data from /detail
  const [err,           setErr]           = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting,      setDeleting]      = useState(false);

  // ── fetch on open ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !workout?.id) return;
    setErr(""); setConfirmDelete(false); setDetail(null);
    setLoading(true);
    fetch(`/api/org/workouts/detail?id=${encodeURIComponent(workout.id)}`, { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (data?.error) { setErr(data.error); return; }
        if (!data?.workout) { setErr("No workout data returned."); return; }
        setDetail(data); // { workout, siblings }
      })
      .catch(e => setErr(e?.message || "Failed to load workout"))
      .finally(() => setLoading(false));
  }, [open, workout?.id]);

  // ── ESC + scroll lock ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = e => {
      if (e.key === "Escape") {
        if (confirmDelete) { setConfirmDelete(false); return; }
        if (!deleting) onClose?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, onClose, confirmDelete, deleting]);

  if (!open || !workout) return null;

  const w        = detail?.workout;
  const siblings = detail?.siblings || [];
  const title    = w?.Title || workout?.Title || workout?.title || "Workout";
  const sport    = titleSport(w?.Sport || workout?.Sport || workout?.sport || "");
  const dateISO  = w?.Date  || workout?.Date  || workout?.date  || "";
  const status   = w?.Status || workout?.Status || workout?.status || "assigned";
  const items    = Array.isArray(w?.items) ? w.items.filter(it => String(it?.ExerciseName || "").trim()) : [];

  // ── delete all sibling records ───────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true); setErr("");
    const ids = siblings.length ? siblings.map(s => s.id) : [workout.id];
    try {
      await Promise.all(
        ids.map(sid =>
          fetch("/api/org/workouts/delete", {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: sid }),
          })
        )
      );
      onRefresh?.();
      onClose?.();
    } catch (e) {
      setErr(e?.message || "Failed to delete");
      setDeleting(false);
    }
  };

  // ── hand off to CreateWorkoutModal in edit mode ──────────────────────────
  const handleEditFull = () => {
    onEditFull?.({
      id:         workout.id,
      title,
      dateISO,
      sport:      w?.Sport || workout?.Sport || workout?.sport || "",
      status,
      items,
      athleteIds: siblings.map(s => s.athleteToken).filter(Boolean),
    });
    onClose?.();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10002 }}>
      {/* Backdrop */}
      <div
        style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)" }}
        onClick={() => { if (!deleting) onClose?.(); }}
      />

      {/* Panel */}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
        <div
          role="dialog" aria-modal="true"
          onClick={e => e.stopPropagation()}
          style={{
            width: "100%", maxWidth: "560px",
            display: "flex", flexDirection: "column",
            backgroundColor: DS.cardBg,
            border: `1px solid ${DS.border}`,
            borderTop: `3px solid ${String(status).toLowerCase().includes("complete") ? DS.safe : DS.brand}`,
            maxHeight: "calc(100dvh - 32px)",
            overflow: "hidden",
          }}>

          {/* ── Header ── */}
          <div style={{ padding: "16px 20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", borderBottom: `1px solid ${DS.border}`, backgroundColor: DS.pageBg, flexShrink: 0 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <p style={{ fontSize: "15px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.04em", color: DS.bodyText }}>{title}</p>
                <StatusBadge status={status} />
              </div>
              {sport && <p style={{ fontSize: "11px", color: DS.dimText, marginTop: "4px" }}>{sport}</p>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
              {/* Edit Full — opens CreateWorkoutModal pre-populated */}
              <button type="button" onClick={handleEditFull} disabled={loading || deleting}
                style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "7px 14px", fontSize: "11px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em", cursor: (loading || deleting) ? "not-allowed" : "pointer", opacity: (loading || deleting) ? 0.45 : 1, border: `1px solid ${DS.brand}`, backgroundColor: DS.brand, color: "#fff" }}
                onMouseEnter={e => { if (!loading && !deleting) e.currentTarget.style.backgroundColor = DS.brandLight; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = DS.brand; }}>
                <Edit2 style={{ width: 12, height: 12 }} />
                Edit
              </button>
              <button type="button" onClick={onClose} disabled={deleting}
                style={{ padding: "7px", border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg, cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = DS.pageBg; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = DS.cardBg; }}>
                <X style={{ width: 16, height: 16, color: DS.dimText }} />
              </button>
            </div>
          </div>

          {/* ── Body ── */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Error */}
            {err && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "10px 14px", backgroundColor: DS.bannedBg, border: `1px solid ${DS.bannedBorder}`, borderLeft: `3px solid ${DS.banned}` }}>
                <AlertTriangle style={{ width: 16, height: 16, color: DS.banned, flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: "12px", fontWeight: 700, color: DS.banned }}>{err}</p>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", padding: "32px 0" }}>
                <Loader2 style={{ width: 20, height: 20, color: DS.brand }} />
                <p style={{ fontSize: "13px", color: DS.dimText }}>Loading…</p>
              </div>
            )}

            {!loading && (
              <>
                {/* Stat chips */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                  <Chip icon={CalendarDays} label="Date"     value={formatDate(dateISO)} />
                  <Chip icon={UserCheck}    label="Athletes" value={siblings.length || workout?.athleteCount || "—"} />
                  <Chip icon={Dumbbell}     label="Items"    value={items.length > 0 ? items.length : (workout?.itemCount || 0)} />
                </div>

                {/* Athletes */}
                {siblings.length > 0 && (
                  <div>
                    <p style={{ fontSize: "10px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em", color: DS.labelText, marginBottom: "8px" }}>Athletes</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      {siblings.map(s => (
                        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", backgroundColor: s.isSelf ? DS.brandBg : DS.pageBg, border: `1px solid ${s.isSelf ? DS.brandBorder : DS.border}` }}>
                          <UserCheck style={{ width: 13, height: 13, color: s.isSelf ? DS.brand : DS.dimText, flexShrink: 0 }} />
                          <p style={{ fontSize: "12px", fontWeight: 700, color: DS.bodyText }}>
                            {s.athleteName || s.athleteToken || "—"}
                            {s.isSelf && <span style={{ fontSize: "10px", color: DS.brand, marginLeft: "6px" }}>this record</span>}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Workout items */}
                {items.length > 0 && (
                  <div>
                    <p style={{ fontSize: "10px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em", color: DS.labelText, marginBottom: "8px" }}>Exercises</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      {items.map((it, i) => (
                        <div key={i} style={{ display: "grid", gridTemplateColumns: "24px 1fr auto", gap: "10px", alignItems: "center", padding: "9px 12px", backgroundColor: DS.pageBg, border: `1px solid ${DS.border}` }}>
                          <span style={{ fontSize: "10px", fontWeight: 900, color: DS.dimText, textAlign: "center" }}>{it.Order ?? i + 1}</span>
                          <div>
                            <p style={{ fontSize: "13px", fontWeight: 700, color: DS.bodyText }}>{it.ExerciseName}</p>
                            {(it.Instructions) && (
                              <p style={{ fontSize: "11px", color: DS.dimText, marginTop: "2px" }}>{it.Instructions}</p>
                            )}
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            {[it.Sets && `${it.Sets} sets`, it.Reps && `${it.Reps} reps`, it.Weight, it.Rest && `rest ${it.Rest}`].filter(Boolean).map((tag, ti) => (
                              <span key={ti} style={{ display: "inline-block", marginLeft: "4px", marginBottom: "2px", padding: "2px 7px", fontSize: "10px", fontWeight: 700, backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}`, color: DS.brand }}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No items yet */}
                {items.length === 0 && !loading && (
                  <div style={{ padding: "16px", backgroundColor: DS.pageBg, border: `1px solid ${DS.border}`, textAlign: "center" }}>
                    <p style={{ fontSize: "12px", color: DS.dimText }}>No exercises added yet. Click <strong>Edit</strong> to add some.</p>
                  </div>
                )}

                {/* ── Delete ── */}
                {!confirmDelete ? (
                  <button type="button" disabled={deleting} onClick={() => setConfirmDelete(true)}
                    style={{ alignSelf: "flex-start", background: "none", border: "none", cursor: deleting ? "not-allowed" : "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: "5px", opacity: deleting ? 0.45 : 1, marginTop: "4px" }}>
                    <Trash2 style={{ width: 13, height: 13, color: DS.dimText }} />
                    <span style={{ fontSize: "11px", fontWeight: 700, color: DS.dimText, textDecoration: "underline", textDecorationStyle: "dotted" }}>
                      Delete workout{siblings.length > 1 ? ` (${siblings.length} records)` : ""}
                    </span>
                  </button>
                ) : (
                  <div style={{ padding: "14px 16px", backgroundColor: DS.bannedBg, border: `1px solid ${DS.bannedBorder}`, borderLeft: `3px solid ${DS.banned}` }}>
                    <p style={{ fontSize: "13px", fontWeight: 900, color: DS.banned, marginBottom: "6px" }}>
                      Delete "{title}"?
                    </p>
                    <p style={{ fontSize: "12px", color: DS.banned, marginBottom: "14px", opacity: 0.85 }}>
                      Permanently removes <strong>all {siblings.length || 1} record{(siblings.length || 1) !== 1 ? "s" : ""}</strong>. Cannot be undone.
                    </p>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button type="button" disabled={deleting} onClick={handleDelete}
                        style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "7px 14px", fontSize: "11px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em", cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.55 : 1, border: `1px solid ${DS.banned}`, backgroundColor: DS.banned, color: "#fff" }}>
                        <Trash2 style={{ width: 13, height: 13 }} />
                        {deleting ? "Deleting…" : "Yes, delete all"}
                      </button>
                      <button type="button" disabled={deleting} onClick={() => setConfirmDelete(false)}
                        style={{ display: "inline-flex", alignItems: "center", padding: "7px 14px", fontSize: "11px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em", cursor: "pointer", border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg, color: DS.labelText }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Footer ── */}
          <div style={{ padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${DS.border}`, backgroundColor: DS.pageBg, flexShrink: 0 }}>
            <p style={{ fontSize: "10px", color: DS.dimText }}>ID: {workout.id}</p>
            <button type="button" onClick={onClose} disabled={deleting}
              style={{ display: "inline-flex", alignItems: "center", padding: "7px 14px", fontSize: "11px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em", cursor: "pointer", border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg, color: DS.labelText }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = DS.pageBg; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = DS.cardBg; }}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}