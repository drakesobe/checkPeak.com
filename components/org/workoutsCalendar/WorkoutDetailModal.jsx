// components/org/workoutsCalendar/WorkoutDetailModal.jsx
// Opens when a coach clicks any WorkoutCard — shows details, allows status change + delete
"use client";

import { useState, useEffect } from "react";
import {
  X, CheckCircle2, Trash2, CalendarDays, Users, Dumbbell,
  Tag as TagIcon, AlertTriangle, ChevronDown, RotateCcw, Edit2,
} from "lucide-react";
import { DS } from "@/components/org/dashboard/DashboardUI";
import { isoToDate } from "@/lib/org/workoutsCalendar/date";
import { titleSport } from "@/lib/org/workoutsCalendar/sports";

async function safeJson(res) { try { return await res.json(); } catch { return {}; } }

/* ── Tiny primitives ── */
function SmBtn({ children, onClick, variant = "secondary", disabled = false, danger = false }) {
  const baseStyle = {
    display:       "inline-flex",
    alignItems:    "center",
    justifyContent:"center",
    gap:           "5px",
    padding:       "8px 16px",
    fontSize:      "11px",
    fontWeight:    900,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    cursor:        disabled ? "not-allowed" : "pointer",
    opacity:       disabled ? 0.45 : 1,
    transition:    "background-color 0.12s, border-color 0.12s, color 0.12s",
    border:        danger
      ? `1px solid ${DS.bannedBorder}`
      : variant === "primary"
        ? `1px solid ${DS.brand}`
        : `1px solid ${DS.border}`,
    backgroundColor: danger
      ? DS.bannedBg
      : variant === "primary"
        ? DS.brand
        : DS.cardBg,
    color: danger ? DS.banned : variant === "primary" ? "#fff" : DS.labelText,
  };
  const enter = (e) => {
    if (disabled) return;
    if (danger) { e.currentTarget.style.backgroundColor = DS.banned; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = DS.banned; }
    else if (variant === "primary") { e.currentTarget.style.backgroundColor = DS.brandLight; }
    else { e.currentTarget.style.backgroundColor = DS.brandBg; e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.color = DS.brand; }
  };
  const leave = (e) => {
    if (disabled) return;
    e.currentTarget.style.backgroundColor = danger ? DS.bannedBg : variant === "primary" ? DS.brand : DS.cardBg;
    e.currentTarget.style.borderColor     = danger ? DS.bannedBorder : variant === "primary" ? DS.brand : DS.border;
    e.currentTarget.style.color           = danger ? DS.banned : variant === "primary" ? "#fff" : DS.labelText;
  };
  return (
    <button type="button" style={baseStyle} disabled={disabled} onClick={onClick}
      onMouseEnter={enter} onMouseLeave={leave}>
      {children}
    </button>
  );
}

function StatusBadge({ status }) {
  const v = String(status || "").toLowerCase();
  let bg = DS.pageBg, border = DS.border, color = DS.dimText;
  if (v.includes("complete"))       { bg = DS.safeBg;    border = DS.safeBorder;    color = DS.safe;    }
  else if (v.includes("assign") || v.includes("pending")) { bg = DS.cautionBg; border = DS.cautionBorder; color = DS.caution; }
  else if (v.includes("reject") || v.includes("archive")) { bg = DS.bannedBg; border = DS.bannedBorder; color = DS.banned; }
  else if (v === "draft")           { bg = DS.pageBg;    border = DS.border;        color = DS.dimText; }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", fontSize: "10px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", backgroundColor: bg, border: `1px solid ${border}`, color }}>
      {status || "—"}
    </span>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 0", borderBottom: `1px solid ${DS.border}` }}>
      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: DS.brand }} />
      <span style={{ fontSize: "11px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em", color: DS.labelText, minWidth: "80px" }}>{label}</span>
      <span style={{ fontSize: "13px", fontWeight: 700, color: DS.bodyText }}>{value}</span>
    </div>
  );
}

/* ── STATUS OPTIONS ── */
const STATUS_OPTIONS = [
  { value: "assigned",  label: "Assigned",  hint: "Scheduled for athletes" },
  { value: "complete",  label: "Complete",  hint: "Mark as done" },
  { value: "draft",     label: "Draft",     hint: "Not yet published" },
  { value: "archived",  label: "Archived",  hint: "Hidden from athletes" },
];

export default function WorkoutDetailModal({
  open, onClose,
  workout,           // the workout object from WorkoutsByDate
  onRefresh,         // () => void — called after any mutation
}) {
  const [busy,          setBusy]          = useState(false);
  const [err,           setErr]           = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  const [localStatus,   setLocalStatus]   = useState("");

  // Sync local status when workout changes
  useEffect(() => {
    if (workout) setLocalStatus(String(workout?.Status || workout?.status || "assigned"));
    setErr(""); setConfirmDelete(false); setStatusPickerOpen(false);
  }, [workout, open]);

  // ESC + scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") { if (confirmDelete) setConfirmDelete(false); else onClose?.(); } };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, onClose, confirmDelete]);

  if (!open || !workout) return null;

  /* ── Derived fields ── */
  const id      = String(workout?.id || workout?.Id || "").trim();
  const title   = workout?.Title || workout?.title || "Workout";
  const status  = localStatus || workout?.Status || workout?.status || "assigned";
  const sport   = titleSport(workout?.Sport || workout?.sport || "");
  const dateISO = String(workout?.Date || workout?.date || "").slice(0, 10);
  const athletes = Number(workout?.athleteCount || 0);
  const items    = Number(workout?.itemCount    || 0);

  const dateLabel = (() => {
    if (!dateISO) return "—";
    try {
      const [y, m, d] = dateISO.split("-").map(Number);
      return new Date(y, m - 1, d).toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    } catch { return dateISO; }
  })();

  /* ── API helpers ── */
  const updateStatus = async (newStatus) => {
    if (!id) { setErr("No workout ID — cannot update."); return; }
    setErr(""); setBusy(true);
    try {
      const res  = await fetch("/api/org/workouts/update-status", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to update status");
      setLocalStatus(newStatus);
      setStatusPickerOpen(false);
      onRefresh?.();
    } catch (e) { setErr(e?.message || "Failed to update status"); }
    finally     { setBusy(false); }
  };

  const deleteWorkout = async () => {
    if (!id) { setErr("No workout ID — cannot delete."); return; }
    setErr(""); setBusy(true);
    try {
      const res  = await fetch("/api/org/workouts/delete", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to delete workout");
      onRefresh?.();
      onClose?.();
    } catch (e) { setErr(e?.message || "Failed to delete workout"); setBusy(false); }
  };

  const isComplete = String(status).toLowerCase().includes("complete");

  return (
    <div className="fixed inset-0" style={{ zIndex: 10002 }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => { if (!busy) onClose?.(); }}
      />

      {/* Panel */}
      <div className="absolute inset-0 flex items-center justify-center px-3 py-4 sm:px-6 sm:py-8">
        <div
          className="w-full flex flex-col"
          style={{
            maxWidth:        "600px",
            backgroundColor: DS.cardBg,
            border:          `1px solid ${DS.border}`,
            borderTop:       `3px solid ${isComplete ? DS.safe : DS.brand}`,
            maxHeight:       "calc(100dvh - 32px)",
            overflow:        "hidden",
          }}
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="px-5 py-4 flex items-start justify-between gap-4 shrink-0"
            style={{ borderBottom: `1px solid ${DS.border}`, backgroundColor: DS.pageBg }}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-black uppercase tracking-wide truncate" style={{ color: DS.bodyText }}>
                  {title}
                </p>
                <StatusBadge status={status} />
              </div>
              {sport && (
                <p className="text-xs font-bold mt-1" style={{ color: DS.dimText }}>{sport}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: "7px", border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg, cursor: "pointer", flexShrink: 0 }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DS.pageBg; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DS.cardBg; }}
            >
              <X className="w-4 h-4" style={{ color: DS.dimText }} />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-4">

            {/* Error banner */}
            {err && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "10px 14px", backgroundColor: DS.bannedBg, border: `1px solid ${DS.bannedBorder}`, borderLeft: `3px solid ${DS.banned}` }}>
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: DS.banned }} />
                <p style={{ fontSize: "12px", fontWeight: 700, color: DS.banned }}>{err}</p>
              </div>
            )}

            {/* Details card */}
            <div style={{ border: `1px solid ${DS.border}`, padding: "0 16px", backgroundColor: DS.cardBg }}>
              <InfoRow icon={CalendarDays} label="Date"     value={dateLabel} />
              <InfoRow icon={TagIcon}      label="Sport"    value={sport || "—"} />
              <InfoRow icon={Users}        label="Athletes" value={athletes > 0 ? `${athletes} assigned` : "—"} />
              <InfoRow icon={Dumbbell}     label="Items"    value={items > 0 ? `${items} exercises` : "None"} />
            </div>

            {/* Status picker */}
            <div style={{ border: `1px solid ${DS.border}` }}>
              <button
                type="button"
                className="w-full flex items-center justify-between gap-3"
                style={{ padding: "12px 16px", backgroundColor: DS.pageBg, cursor: "pointer" }}
                onClick={() => setStatusPickerOpen((v) => !v)}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DS.brandBg; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DS.pageBg; }}
              >
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: "11px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em", color: DS.bodyText }}>
                    Change Status
                  </span>
                  <StatusBadge status={status} />
                </div>
                <ChevronDown className="w-4 h-4" style={{ color: DS.dimText, transform: statusPickerOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
              </button>

              {statusPickerOpen && (
                <div style={{ borderTop: `1px solid ${DS.border}`, padding: "12px", backgroundColor: DS.cardBg, display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {STATUS_OPTIONS.map(({ value, label, hint }) => {
                    const isCurrent = String(status).toLowerCase() === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={isCurrent || busy}
                        onClick={() => updateStatus(value)}
                        title={hint}
                        style={{
                          display: "flex", flexDirection: "column", alignItems: "flex-start",
                          padding: "8px 14px", cursor: isCurrent || busy ? "default" : "pointer",
                          border: isCurrent ? `1px solid ${DS.brand}` : `1px solid ${DS.border}`,
                          backgroundColor: isCurrent ? DS.brandBg : DS.cardBg,
                          opacity: busy ? 0.5 : 1,
                          minWidth: "110px",
                          transition: "background-color 0.12s, border-color 0.12s",
                        }}
                        onMouseEnter={(e) => { if (!isCurrent && !busy) { e.currentTarget.style.backgroundColor = DS.brandBg; e.currentTarget.style.borderColor = DS.brandBorder; } }}
                        onMouseLeave={(e) => { if (!isCurrent && !busy) { e.currentTarget.style.backgroundColor = DS.cardBg; e.currentTarget.style.borderColor = DS.border; } }}
                      >
                        <span style={{ fontSize: "11px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em", color: isCurrent ? DS.brand : DS.bodyText }}>
                          {label}
                        </span>
                        <span style={{ fontSize: "10px", color: DS.dimText, marginTop: "2px" }}>{hint}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick-action shortcuts */}
            {!isComplete && (
              <div style={{ display: "flex", gap: "8px" }}>
                <SmBtn
                  variant="primary"
                  disabled={busy}
                  onClick={() => updateStatus("complete")}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {busy ? "Saving…" : "Mark complete"}
                </SmBtn>
              </div>
            )}
            {isComplete && (
              <div style={{ display: "flex", gap: "8px" }}>
                <SmBtn
                  disabled={busy}
                  onClick={() => updateStatus("assigned")}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {busy ? "Saving…" : "Reopen"}
                </SmBtn>
              </div>
            )}

            {/* Delete section */}
            {!confirmDelete ? (
              <div style={{ paddingTop: "8px" }}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmDelete(true)}
                  style={{ background: "none", border: "none", cursor: busy ? "not-allowed" : "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: "5px" }}
                >
                  <Trash2 className="w-3.5 h-3.5" style={{ color: DS.dimText }} />
                  <span style={{ fontSize: "11px", fontWeight: 700, color: DS.dimText, textDecoration: "underline", textDecorationStyle: "dotted" }}>
                    Delete workout
                  </span>
                </button>
              </div>
            ) : (
              <div style={{ padding: "14px 16px", backgroundColor: DS.bannedBg, border: `1px solid ${DS.bannedBorder}`, borderLeft: `3px solid ${DS.banned}` }}>
                <p style={{ fontSize: "13px", fontWeight: 900, color: DS.banned, marginBottom: "10px" }}>
                  Delete "{title}"?
                </p>
                <p style={{ fontSize: "12px", color: DS.banned, marginBottom: "14px", opacity: 0.85 }}>
                  This removes the workout and all athlete assignments. This cannot be undone.
                </p>
                <div style={{ display: "flex", gap: "8px" }}>
                  <SmBtn danger disabled={busy} onClick={deleteWorkout}>
                    <Trash2 className="w-3.5 h-3.5" />
                    {busy ? "Deleting…" : "Yes, delete"}
                  </SmBtn>
                  <SmBtn disabled={busy} onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </SmBtn>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="px-5 py-3 flex justify-end"
            style={{ borderTop: `1px solid ${DS.border}`, backgroundColor: DS.pageBg }}
          >
            <SmBtn onClick={onClose} disabled={busy}>Close</SmBtn>
          </div>
        </div>
      </div>
    </div>
  );
}