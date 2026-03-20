// components/org/athletes/AthleteDrawer.jsx
"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Mail, Clipboard, Star, CheckCircle2,
  ExternalLink, Trash2, AlertTriangle,
} from "lucide-react";
import { formatDateTime, cleanString } from "@/lib/org/athletes/utils";

function cx(...xs) { return xs.filter(Boolean).join(" "); }

function clampPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

const DS = {
  brand:        "#1E3A5F",
  brandBg:      "#EEF3F9",
  brandBorder:  "#C0D0E0",
  safe:         "#00873E",
  safeBg:       "#F0FBF4",
  safeBorder:   "#A8DFB8",
  caution:      "#B86000",
  cautionBg:    "#FFFBF0",
  cautionBorder:"#FFD580",
  banned:       "#C8102E",
  bannedBg:     "#FFF0F0",
  bannedBorder: "#FFC8C8",
  border:       "#E8ECF0",
  pageBg:       "#F4F7FB",
  cardBg:       "#FFFFFF",
  bodyText:     "#1A2535",
  labelText:    "#5A6A7D",
  dimText:      "#9BA8B4",
};

function Section({ title, subtitle, children }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: DS.pageBg, border: `1px solid ${DS.border}` }}>
      {(title || subtitle) && (
        <div className="px-4 py-2.5 border-b" style={{ borderColor: DS.border }}>
          {title && (
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: DS.labelText }}>
              {title}
            </p>
          )}
          {subtitle && (
            <p className="text-[11px] mt-0.5" style={{ color: DS.dimText }}>{subtitle}</p>
          )}
        </div>
      )}
      <div className="px-4 py-3.5">{children}</div>
    </div>
  );
}

function DrawerBtn({ onClick, disabled = false, children, variant = "default" }) {
  const variants = {
    default: {
      bg:      DS.cardBg,
      border:  DS.border,
      color:   DS.labelText,
      hover:   DS.brandBg,
    },
    primary: {
      bg:      DS.brand,
      border:  DS.brand,
      color:   "#fff",
      hover:   "#162d4a",
    },
    danger: {
      bg:      DS.bannedBg,
      border:  DS.bannedBorder,
      color:   DS.banned,
      hover:   "#ffe0e0",
    },
    dangerSolid: {
      bg:      DS.banned,
      border:  DS.banned,
      color:   "#fff",
      hover:   "#a00d23",
    },
    safe: {
      bg:      DS.safeBg,
      border:  DS.safeBorder,
      color:   DS.safe,
      hover:   "#d0f5dc",
    },
    ghost: {
      bg:      DS.pageBg,
      border:  DS.border,
      color:   DS.labelText,
      hover:   DS.brandBg,
    },
  };
  const v = variants[variant] || variants.default;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 flex items-center justify-center gap-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        padding:    "10px 14px",
        background:  v.bg,
        border:      `1px solid ${v.border}`,
        color:       v.color,
        letterSpacing: "0.01em",
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = v.hover; }}
      onMouseLeave={e => { e.currentTarget.style.background = v.bg; }}
    >
      {children}
    </button>
  );
}

/* ── Delete confirmation panel ───────────────────────────────────────────── */

function DeleteConfirm({ athlete, onConfirm, onCancel, deleting, deleteError }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.18 }}
      className="rounded-xl overflow-hidden"
      style={{ background: DS.bannedBg, border: `1px solid ${DS.bannedBorder}` }}
    >
      <div className="px-4 py-3 border-b" style={{ borderColor: DS.bannedBorder }}>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: DS.banned }} />
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: DS.banned }}>
            Delete athlete
          </p>
        </div>
      </div>
      <div className="px-4 py-3.5">
        <p className="text-sm font-semibold mb-1" style={{ color: DS.bodyText }}>
          Remove <span style={{ color: DS.banned }}>{athlete?.name || "this athlete"}</span> from the roster?
        </p>
        <p className="text-xs mb-3.5 leading-relaxed" style={{ color: DS.labelText }}>
          This will permanently delete their Airtable record. Coach notes and local state will also be cleared.
          {athlete?.email && (
            <> Their plan history at <strong>{athlete.email}</strong> is not affected.</>
          )}
        </p>

        {deleteError && (
          <p className="text-xs mb-3 font-semibold" style={{ color: DS.banned }}>{deleteError}</p>
        )}

        <div className="flex gap-2">
          <DrawerBtn onClick={onCancel} variant="ghost" disabled={deleting}>
            Cancel
          </DrawerBtn>
          <DrawerBtn onClick={onConfirm} variant="dangerSolid" disabled={deleting}>
            <Trash2 className="w-3.5 h-3.5" />
            {deleting ? "Deleting…" : "Yes, delete"}
          </DrawerBtn>
        </div>
      </div>
    </motion.div>
  );
}

/* ── AthleteDrawer ───────────────────────────────────────────────────────── */

export default function AthleteDrawer({
  open,
  athlete,
  onClose,
  batchProgress,
  isDone,
  isStarred,
  onOpenPrescriptions,
  onCopyEmail,
  onToggleDoneAuto,
  onToggleStar,
  noteDirty,
  noteValue,
  onNoteChange,
  onDeleteAthlete,  // (athleteId) => Promise — called after confirmed
}) {
  const [deleteMode,  setDeleteMode]  = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [sport,       setSport]       = useState("");
  const [sportSaving, setSportSaving] = useState(false);
  const [sportError,  setSportError]  = useState("");

  // Lock background scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = prev; };
  }, [open]);

  // Reset delete + sport state when athlete changes or drawer closes
  useEffect(() => {
    setDeleteMode(false);
    setDeleting(false);
    setDeleteError("");
    setSport(String(athlete?.sport || "").trim());
    setSportSaving(false);
    setSportError("");
  }, [athlete?.id, open]);

  const athleteId = String(athlete?.id || "");
  const hasEmail  = !!athlete?.email;
  const done      = athleteId ? !!isDone?.(athleteId)    : false;
  const starred   = athleteId ? !!isStarred?.(athleteId) : false;

  const doneN  = Number(batchProgress?.done  || 0);
  const totalN = Number(batchProgress?.total || 0);
  const pct    = clampPct(batchProgress?.pct);

  const pctColor = pct >= 100 ? DS.safe : pct >= 50 ? DS.brand : DS.caution;
  const topPad   = "calc(env(safe-area-inset-top, 0px) + var(--app-header-h, 0px))";

  const handleConfirmDelete = async () => {
    if (!athleteId) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await onDeleteAthlete?.(athleteId);
      // Parent closes drawer + removes from list
    } catch (err) {
      setDeleteError(String(err?.message || "Delete failed. Try again."));
      setDeleting(false);
    }
  };

  const handleSportSave = async (newSport) => {
    if (!athleteId) return;
    setSportSaving(true);
    setSportError("");
    try {
      const res  = await fetch("/api/org/updateAthleteMeta", {
        method:      "PATCH",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ athleteId, sport: newSport }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to save sport.");
      setSport(newSport);
    } catch (err) {
      setSportError(String(err?.message || "Save failed."));
    } finally {
      setSportSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0"
            style={{ background: "rgba(26,37,53,0.35)", backdropFilter: "blur(3px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="absolute right-0 top-0 h-screen w-full sm:w-[480px] flex flex-col overflow-hidden"
            style={{ background: DS.cardBg, borderLeft: `1px solid ${DS.border}`, boxShadow: "-8px 0 32px rgba(26,37,53,0.12)" }}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Top accent */}
            <div className="h-1 shrink-0" style={{ background: `linear-gradient(to right, ${DS.brand}, #4A7FA5, transparent)` }} />

            {/* Sticky header */}
            <div
              className="shrink-0 border-b"
              style={{ background: DS.cardBg, borderColor: DS.border }}
            >
              <div style={{ paddingTop: topPad }}>
                <div className="px-5 py-4 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: DS.dimText }}>
                      Quick View
                    </p>
                    <h3
                      className="text-xl font-extrabold truncate mb-2"
                      style={{ color: DS.bodyText }}
                    >
                      {athlete?.name || "Athlete"}
                    </h3>

                    {/* Status chips */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{
                          background: hasEmail ? DS.safeBg     : DS.cautionBg,
                          border:     hasEmail ? `1px solid ${DS.safeBorder}` : `1px solid ${DS.cautionBorder}`,
                          color:      hasEmail ? DS.safe       : DS.caution,
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: hasEmail ? DS.safe : DS.caution }} />
                        {hasEmail ? "Ready" : "Incomplete"}
                      </span>

                      {done && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                          style={{ background: DS.safeBg, border: `1px solid ${DS.safeBorder}`, color: DS.safe }}
                        >
                          ✓ Done
                        </span>
                      )}
                      {starred && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                          style={{ background: DS.cautionBg, border: `1px solid ${DS.cautionBorder}`, color: DS.caution }}
                        >
                          ★ Priority
                        </span>
                      )}
                      {totalN > 0 && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                          style={{ background: DS.brandBg, border: `1px solid ${DS.brandBorder}`, color: DS.brand }}
                        >
                          {doneN}/{totalN} · {pct}%
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all"
                    style={{ background: DS.pageBg, border: `1px solid ${DS.border}`, color: DS.labelText }}
                    onMouseEnter={e => { e.currentTarget.style.background = DS.brandBg; }}
                    onMouseLeave={e => { e.currentTarget.style.background = DS.pageBg; }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto" style={{ background: DS.pageBg }}>
              <div className="px-4 py-4 space-y-3">

                {/* Contact */}
                <Section title="Contact">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 shrink-0" style={{ color: DS.dimText }} />
                      {athlete?.email ? (
                        <span className="text-sm truncate" style={{ color: DS.labelText }}>{athlete.email}</span>
                      ) : (
                        <span className="text-sm font-semibold" style={{ color: DS.banned }}>Missing email</span>
                      )}
                    </div>
                    {athlete?.createdAt && (
                      <p className="text-xs" style={{ color: DS.dimText }}>
                        Created: <span style={{ color: DS.labelText }}>{formatDateTime(athlete.createdAt)}</span>
                      </p>
                    )}
                  </div>
                </Section>

                {/* Batch progress */}
                {totalN > 0 && (
                  <Section title="Batch progress">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold" style={{ color: DS.bodyText }}>{doneN}/{totalN} done</span>
                      <span className="text-sm font-bold" style={{ color: pctColor }}>{pct}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: DS.border }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pctColor }} />
                    </div>
                  </Section>
                )}

                {/* Primary actions */}
                <div className="grid grid-cols-2 gap-2">
                  <DrawerBtn onClick={() => onOpenPrescriptions?.(athlete?.email)} disabled={!hasEmail} variant="primary">
                    <ExternalLink className="w-3.5 h-3.5" />
                    Prescriptions
                  </DrawerBtn>
                  <DrawerBtn onClick={() => onCopyEmail?.(athlete?.email)} disabled={!hasEmail}>
                    <Clipboard className="w-3.5 h-3.5" />
                    Copy Email
                  </DrawerBtn>
                </div>

                {/* Done / Star toggles */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => athleteId && onToggleDoneAuto?.(athleteId)}
                    className="flex items-center justify-center gap-2 rounded-xl text-xs font-semibold transition-all"
                    style={{
                      padding:    "10px 14px",
                      background:  done ? DS.safeBg  : DS.cardBg,
                      border:      done ? `1px solid ${DS.safeBorder}` : `1px solid ${DS.border}`,
                      color:       done ? DS.safe    : DS.labelText,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = done ? "#dcfae6" : DS.brandBg; }}
                    onMouseLeave={e => { e.currentTarget.style.background = done ? DS.safeBg : DS.cardBg; }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {done ? "✓ Done" : "Mark done"}
                  </button>

                  <button
                    type="button"
                    onClick={() => athleteId && onToggleStar?.(athleteId)}
                    className="flex items-center justify-center gap-2 rounded-xl text-xs font-semibold transition-all"
                    style={{
                      padding:    "10px 14px",
                      background:  starred ? DS.cautionBg : DS.cardBg,
                      border:      starred ? `1px solid ${DS.cautionBorder}` : `1px solid ${DS.border}`,
                      color:       starred ? DS.caution   : DS.labelText,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = starred ? "#fff0d0" : DS.brandBg; }}
                    onMouseLeave={e => { e.currentTarget.style.background = starred ? DS.cautionBg : DS.cardBg; }}
                  >
                    <Star className="w-3.5 h-3.5" fill={starred ? "currentColor" : "none"} />
                    {starred ? "★ Starred" : "Star"}
                  </button>
                </div>

                {/* Coach note */}
                <Section
                  title="Coach note"
                  subtitle={noteDirty ? "Saving…" : "Saved · Local only · Included in exports"}
                >
                  <textarea
                    className="w-full rounded-xl text-sm resize-none outline-none transition-all"
                    style={{
                      background:  DS.cardBg,
                      border:      `1px solid ${DS.border}`,
                      color:       DS.bodyText,
                      padding:     "10px 14px",
                      minHeight:   110,
                      fontFamily:  "inherit",
                    }}
                    value={cleanString(noteValue || "")}
                    onChange={e => onNoteChange?.(e.target.value)}
                    placeholder="Ex: Needs email confirmed · Parent contact · Follow up Monday"
                    onFocus={e => { e.currentTarget.style.border = `1px solid ${DS.brand}`; }}
                    onBlur={e  => { e.currentTarget.style.border = `1px solid ${DS.border}`; }}
                  />
                </Section>

                {/* Sport */}
                <Section title="Sport" subtitle="Updates the athlete's sport in Airtable">
                  <div className="space-y-2">
                    <select
                      value={sport}
                     onChange={e => {
                      const val = e.target.value;
                      console.log("sport change — athleteId:", athleteId, "val:", val);
                      setSport(val);
                      handleSportSave(val);
                    }}
                      disabled={!athleteId || sportSaving}
                      className="w-full text-sm rounded-xl outline-none transition-all disabled:opacity-50"
                      style={{
                        background:  DS.cardBg,
                        border:      `1px solid ${DS.border}`,
                        color:       DS.bodyText,
                        padding:     "9px 12px",
                        fontFamily:  "inherit",
                      }}
                      onFocus={e  => { e.currentTarget.style.border = `1px solid ${DS.brand}`; }}
                      onBlur={e   => { e.currentTarget.style.border = `1px solid ${DS.border}`; }}
                    >
                      <option value="">— No sport selected —</option>
                      {[
                        ["baseball",      "Baseball"],
                        ["basketball",    "Basketball"],
                        ["cross country", "Cross Country"],
                        ["football",      "Football"],
                        ["golf",          "Golf"],
                        ["hockey",        "Hockey"],
                        ["lacrosse",      "Lacrosse"],
                        ["soccer",        "Soccer"],
                        ["softball",      "Softball"],
                        ["swimming",      "Swimming"],
                        ["tennis",        "Tennis"],
                        ["track",         "Track & Field"],
                        ["volleyball",    "Volleyball"],
                        ["wrestling",     "Wrestling"],
                        ["other",         "Other"],
                      ].map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                    {sportSaving && (
                      <p className="text-xs" style={{ color: DS.dimText }}>Saving…</p>
                    )}
                    {sportError && (
                      <p className="text-xs font-semibold" style={{ color: DS.banned }}>{sportError}</p>
                    )}
                  </div>
                </Section>

                {/* ── Delete zone ──────────────────────────────────────────── */}
                <div>
                  <AnimatePresence mode="wait">
                    {!deleteMode ? (
                      <motion.div
                        key="delete-trigger"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.12 }}
                      >
                        <button
                          type="button"
                          onClick={() => setDeleteMode(true)}
                          className="flex items-center gap-2 text-xs font-semibold transition-all rounded-xl px-3 py-2.5 w-full"
                          style={{
                            background: DS.pageBg,
                            border:     `1px solid ${DS.border}`,
                            color:      DS.dimText,
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = DS.bannedBg;
                            e.currentTarget.style.borderColor = DS.bannedBorder;
                            e.currentTarget.style.color = DS.banned;
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = DS.pageBg;
                            e.currentTarget.style.borderColor = DS.border;
                            e.currentTarget.style.color = DS.dimText;
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove athlete from roster…
                        </button>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="delete-confirm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.12 }}
                      >
                        <DeleteConfirm
                          athlete={athlete}
                          onConfirm={handleConfirmDelete}
                          onCancel={() => { setDeleteMode(false); setDeleteError(""); }}
                          deleting={deleting}
                          deleteError={deleteError}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div style={{ height: "calc(16px + env(safe-area-inset-bottom, 0px))" }} />
              </div>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}