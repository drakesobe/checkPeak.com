// components/org/workoutsCalendar/SportsMoreModal.jsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Search, X } from "lucide-react";
import { DS } from "@/components/org/dashboard/DashboardUI";
import { normalizeSport, titleSport } from "@/lib/org/workoutsCalendar/sports";

function uniqNorm(list) {
  const out = []; const seen = new Set();
  (Array.isArray(list) ? list : []).forEach((v) => {
    const k = normalizeSport(v);
    if (!k || seen.has(k)) return;
    seen.add(k); out.push(k);
  });
  return out;
}

function scoreMatch(label, query) {
  const s = String(label || "").toLowerCase();
  if (!query) return 2;
  if (s.startsWith(query)) return 0;
  if (s.includes(query)) return 1;
  return 2;
}

function SmBtn({ children, onClick, disabled, variant = "secondary", fullWidth }) {
  const isPrimary = variant === "primary";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wide transition-colors"
      style={{
        padding:         "7px 14px",
        border:          `1px solid ${isPrimary ? DS.brand : DS.border}`,
        backgroundColor: isPrimary ? DS.brand : DS.cardBg,
        color:           isPrimary ? "#fff" : DS.labelText,
        opacity:         disabled ? 0.4 : 1,
        cursor:          disabled ? "not-allowed" : "pointer",
        width:           fullWidth ? "100%" : "auto",
        justifyContent:  fullWidth ? "center" : undefined,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        if (isPrimary) { e.currentTarget.style.backgroundColor = DS.brandLight; }
        else { e.currentTarget.style.backgroundColor = DS.brandBg; e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.color = DS.brand; }
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.backgroundColor = isPrimary ? DS.brand : DS.cardBg;
        e.currentTarget.style.borderColor      = isPrimary ? DS.brand : DS.border;
        e.currentTarget.style.color            = isPrimary ? "#fff"   : DS.labelText;
      }}
    >
      {children}
    </button>
  );
}

export default function SportsMoreModal({
  open, onClose, sportsAll, selectedSports, setSelectedSports, maxSelected = 6,
}) {
  const [q, setQ] = useState("");

  const all = useMemo(() => {
    const src = Array.isArray(sportsAll) ? sportsAll : [];
    const map = new Map();
    src.forEach((s) => { const k = normalizeSport(s); if (k && !map.has(k)) map.set(k, { k, label: titleSport(s) }); });
    const out = Array.from(map.values());
    out.sort((a, b) => String(a.label).localeCompare(String(b.label)));
    return out;
  }, [sportsAll]);

  const selected = useMemo(() => uniqNorm(selectedSports), [selectedSports]);
  const [draft, setDraft] = useState([]);

  useEffect(() => {
    if (open) { setQ(""); setDraft(selected); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ESC + scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") cancel(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isDirty = useMemo(() => {
    return selected.slice().sort().join("|") !== uniqNorm(draft).slice().sort().join("|");
  }, [selected, draft]);

  const limitReached = draft.length >= maxSelected;

  const toggleDraft = useCallback((sportOrKey) => {
    const k = normalizeSport(sportOrKey);
    if (!k) return;
    setDraft((prev) => {
      const cur = uniqNorm(prev);
      if (cur.includes(k)) return cur.filter((x) => x !== k);
      if (cur.length >= maxSelected) return cur;
      return [...cur, k];
    });
  }, [maxSelected]);

  const selectAll  = useCallback(() => setDraft(all.map((x) => x.k).slice(0, maxSelected)), [all, maxSelected]);
  const clearDraft = useCallback(() => setDraft([]), []);

  const apply  = useCallback(() => { setSelectedSports(uniqNorm(draft)); onClose?.(); }, [draft, setSelectedSports, onClose]);
  const cancel = useCallback(() => { setDraft(selected); onClose?.(); }, [selected, onClose]);

  const filtered = useMemo(() => {
    const query = String(q || "").trim().toLowerCase();
    if (!query) return all;
    return all
      .filter((x) => String(x.label || "").toLowerCase().includes(query))
      .sort((a, b) => {
        const sa = scoreMatch(a.label, query), sb = scoreMatch(b.label, query);
        return sa !== sb ? sa - sb : String(a.label).localeCompare(String(b.label));
      });
  }, [q, all]);

  const list = useMemo(() => {
    if (String(q || "").trim()) return filtered;
    const set = new Set(draft);
    return [...all.filter((x) => set.has(x.k)), ...all.filter((x) => !set.has(x.k))];
  }, [q, filtered, all, draft]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10001]">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/40"
        onClick={cancel}
      />

      {/* Panel */}
      <div className="absolute inset-0 flex items-center justify-center px-3 py-4 sm:px-6 sm:py-8">
        <div
          className="w-full flex flex-col"
          style={{
            maxWidth:        "560px",
            maxHeight:       "calc(100dvh - 48px)",
            backgroundColor: DS.cardBg,
            border:          `1px solid ${DS.border}`,
            borderTop:       `3px solid ${DS.brand}`,
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
            <div>
              <p className="text-sm font-black uppercase tracking-wide" style={{ color: DS.bodyText }}>
                Sports Filter
              </p>
              <p className="text-xs mt-0.5" style={{ color: DS.dimText }}>
                Select up to {maxSelected} sports to combine in the calendar view.
              </p>
            </div>
            <button
              type="button"
              onClick={cancel}
              style={{ padding: "6px", border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg, cursor: "pointer" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DS.pageBg; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DS.cardBg; }}
            >
              <X className="w-4 h-4" style={{ color: DS.dimText }} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">

            {/* Search */}
            <div className="relative">
              <Search
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: DS.dimText }}
              />
              <input
                className="w-full pl-9 pr-4 py-2.5 text-sm"
                style={{
                  border:          `1px solid ${DS.border}`,
                  backgroundColor: DS.cardBg,
                  color:           DS.bodyText,
                  outline:         "none",
                }}
                placeholder="Search sports…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onFocus={(e)  => { e.currentTarget.style.borderColor = DS.brand; }}
                onBlur={(e)   => { e.currentTarget.style.borderColor = DS.border; }}
              />
            </div>

            {/* Controls row */}
            <div className="flex flex-wrap items-center gap-2">
              <SmBtn onClick={draft.length ? clearDraft : selectAll}>
                {draft.length ? "Clear all" : `Select top ${Math.min(maxSelected, all.length)}`}
              </SmBtn>
              <SmBtn onClick={() => setDraft(selected)} disabled={!isDirty}>Reset</SmBtn>

              {/* Count badge */}
              <span
                className="px-2.5 py-1 text-xs font-bold"
                style={{ backgroundColor: DS.pageBg, color: DS.labelText, border: `1px solid ${DS.border}` }}
              >
                {draft.length} / {maxSelected}
              </span>

              {limitReached && (
                <span
                  className="px-2.5 py-1 text-xs font-bold"
                  style={{ backgroundColor: DS.cautionBg, color: DS.caution, border: `1px solid ${DS.cautionBorder}` }}
                >
                  Max reached
                </span>
              )}
            </div>

            {/* Selected chips (quick-remove) */}
            {draft.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3" style={{ backgroundColor: DS.pageBg, border: `1px solid ${DS.border}` }}>
                {draft.map((k) => {
                  const item = all.find((x) => x.k === k);
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => toggleDraft(k)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold transition-colors"
                      style={{
                        backgroundColor: DS.brandBg,
                        color:           DS.brand,
                        border:          `1px solid ${DS.brandBorder}`,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DS.brand; e.currentTarget.style.color = "#fff"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DS.brandBg; e.currentTarget.style.color = DS.brand; }}
                    >
                      {item?.label || titleSport(k)}
                      <X className="w-3 h-3" />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Sport grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-px" style={{ backgroundColor: DS.border }}>
              {list.map((it) => {
                const active   = draft.includes(it.k);
                const disabled = !active && limitReached;

                return (
                  <button
                    key={it.k}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleDraft(it.k)}
                    className="px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-left transition-colors"
                    style={{
                      backgroundColor: active   ? DS.brand   : DS.cardBg,
                      color:           active   ? "#fff"     : disabled ? DS.dimText : DS.bodyText,
                      cursor:          disabled ? "not-allowed" : "pointer",
                      opacity:         disabled ? 0.4 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (disabled || active) return;
                      e.currentTarget.style.backgroundColor = DS.brandBg;
                      e.currentTarget.style.color = DS.brand;
                    }}
                    onMouseLeave={(e) => {
                      if (disabled || active) return;
                      e.currentTarget.style.backgroundColor = DS.cardBg;
                      e.currentTarget.style.color = DS.bodyText;
                    }}
                    title={disabled ? `Max ${maxSelected} selected` : active ? "Remove" : "Add"}
                  >
                    {it.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div
            className="px-5 py-3 flex items-center justify-between gap-3 shrink-0"
            style={{ borderTop: `1px solid ${DS.border}`, backgroundColor: DS.pageBg }}
          >
            <p className="text-xs" style={{ color: DS.dimText }}>
              {isDirty ? "Unsaved changes" : "No changes"}
            </p>
            <div className="flex gap-2">
              <SmBtn onClick={cancel}>Cancel</SmBtn>
              <SmBtn onClick={apply} disabled={!isDirty} variant="primary">Apply filter</SmBtn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}