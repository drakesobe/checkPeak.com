// components/org/athletes/AthletesList.jsx
"use client";

import { Star, CheckCircle2, ExternalLink, Copy, ChevronRight, Mail, Trophy } from "lucide-react";
import { formatDateTime } from "@/lib/org/athletes/utils";

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
  border:       "#E8ECF0",
  cardBg:       "#FFFFFF",
  rowHover:     "#F8FAFD",
  rowActive:    "#EEF3F9",
  bodyText:     "#1A2535",
  labelText:    "#5A6A7D",
  dimText:      "#9BA8B4",
};

// Derive a clean display label from whatever sport string Airtable returns.
// Handles "football", "Football", "FOOTBALL" → "Football"
function formatSportLabel(val) {
  if (!val) return null;
  const s = String(val).trim();
  if (!s) return null;
  // Title-case single words; leave multi-word as-is but capitalise first letter
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/* ── Sport chip ──────────────────────────────────────────────────────────── */
function SportChip({ sport }) {
  const label = formatSportLabel(sport);
  if (!label) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
        style={{ background: DS.cautionBg, border: `1px solid ${DS.cautionBorder}`, color: DS.caution }}
      >
        No sport
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
      style={{ background: DS.brandBg, border: `1px solid ${DS.brandBorder}`, color: DS.brand }}
    >
      <Trophy className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

function RowBtn({ onClick, disabled, children, primary = false }) {
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onClick?.(); }}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
      style={{
        padding:    "5px 10px",
        background:  primary ? DS.brand  : DS.cardBg,
        border:      primary ? `1px solid ${DS.brand}` : `1px solid ${DS.border}`,
        color:       primary ? "#fff"    : DS.labelText,
      }}
      onMouseEnter={e => {
        if (disabled) return;
        e.currentTarget.style.background = primary ? "#162d4a" : DS.brandBg;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = primary ? DS.brand : DS.cardBg;
      }}
    >
      {children}
    </button>
  );
}

/* ── Mobile card ─────────────────────────────────────────────────────────── */

function AthleteCard({
  a, selectedIds, toggleSelect, openDrawer,
  isDone, isStarred, toggleStarred, toggleDone,
  openPrescriptions, copyEmail,
}) {
  const done     = isDone(a.id);
  const starred  = isStarred(a.id);
  const selected = selectedIds.has(a.id);

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        background:  selected ? DS.brandBg : DS.cardBg,
        border:      `1px solid ${selected ? DS.brandBorder : DS.border}`,
        borderLeft:  `3px solid ${done ? DS.safe : selected ? DS.brand : "transparent"}`,
      }}
    >
      <div className="px-3.5 py-3 flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => toggleSelect(a.id)}
          onClick={e => e.stopPropagation()}
          className="mt-0.5 accent-[#1E3A5F]"
        />
        <div className="flex-1 min-w-0">
          <button type="button" onClick={() => openDrawer(a.id)} className="text-left w-full">
            <p className="text-sm font-bold truncate" style={{ color: DS.bodyText }}>{a.name}</p>
            {a.title && (
              <p className="text-xs truncate mt-0.5" style={{ color: DS.dimText }}>{a.title}</p>
            )}
          </button>

          {/* Sport + status badges */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <SportChip sport={a.sport} />
            {done && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                style={{ background: DS.safeBg, color: DS.safe, border: `1px solid ${DS.safeBorder}` }}
              >
                ✓ Done
              </span>
            )}
            {starred && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                style={{ background: DS.cautionBg, color: DS.caution, border: `1px solid ${DS.cautionBorder}` }}
              >
                ★ Priority
              </span>
            )}
          </div>

          {a.email && (
            <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: DS.dimText }}>
              <Mail className="w-3 h-3" />
              <span className="truncate">{a.email}</span>
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={e => { e.stopPropagation(); toggleStarred(a.id); }}
          className="shrink-0 mt-0.5 transition-opacity"
          style={{ color: starred ? DS.caution : DS.dimText, background: "none", border: "none", cursor: "pointer" }}
        >
          <Star className="w-4 h-4" fill={starred ? "currentColor" : "none"} />
        </button>
      </div>

      <div
        className="px-3.5 pb-3 flex items-center gap-1.5 flex-wrap"
        style={{ borderTop: `1px solid ${DS.border}` }}
      >
        <RowBtn onClick={() => openPrescriptions(a.email)} disabled={!a.email} primary>
          <ExternalLink className="w-3 h-3" />
          Prescriptions
        </RowBtn>
        <RowBtn onClick={() => copyEmail(a.email)} disabled={!a.email}>
          <Copy className="w-3 h-3" />
          Copy
        </RowBtn>
        <RowBtn onClick={() => toggleDone(a.id, false)}>
          <CheckCircle2 className="w-3 h-3" style={{ color: done ? DS.safe : undefined }} />
          {done ? "Done" : "Mark done"}
        </RowBtn>
        <RowBtn onClick={() => openDrawer(a.id)}>
          <ChevronRight className="w-3 h-3" />
          View
        </RowBtn>
      </div>
    </div>
  );
}

/* ── Desktop table row ───────────────────────────────────────────────────── */

function TableRow({
  a, selectedIds, toggleSelect, openDrawer,
  isDone, isStarred, toggleStarred, toggleDone,
  openPrescriptions, copyEmail,
  activeRowId, setActiveRowId,
}) {
  const done     = isDone(a.id);
  const starred  = isStarred(a.id);
  const selected = selectedIds.has(a.id);
  const active   = activeRowId === a.id;

  return (
    <tr
      onClick={() => setActiveRowId(a.id)}
      onDoubleClick={() => openDrawer(a.id)}
      style={{
        background:  active   ? DS.rowActive : selected ? DS.brandBg : "transparent",
        borderLeft:  `2px solid ${done ? DS.safe : "transparent"}`,
        cursor:      "pointer",
        transition:  "background 0.1s ease",
      }}
      onMouseEnter={e => { if (!active && !selected) e.currentTarget.style.background = DS.rowHover; }}
      onMouseLeave={e => { if (!active && !selected) e.currentTarget.style.background = "transparent"; }}
    >
      {/* Checkbox */}
      <td className="py-3 px-3 w-10">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => toggleSelect(a.id)}
          onClick={e => e.stopPropagation()}
          className="accent-[#1E3A5F]"
        />
      </td>

      {/* Star */}
      <td className="py-3 px-2 w-10">
        <button
          type="button"
          onClick={e => { e.stopPropagation(); toggleStarred(a.id); }}
          style={{ color: starred ? DS.caution : DS.dimText, background: "none", border: "none", cursor: "pointer" }}
          onMouseEnter={e => { e.currentTarget.style.color = DS.caution; }}
          onMouseLeave={e => { e.currentTarget.style.color = starred ? DS.caution : DS.dimText; }}
        >
          <Star className="w-3.5 h-3.5" fill={starred ? "currentColor" : "none"} />
        </button>
      </td>

      {/* Name */}
      <td className="py-3 px-3">
        <button
          type="button"
          onClick={e => { e.stopPropagation(); openDrawer(a.id); }}
          className="text-left font-semibold text-sm transition-colors"
          style={{ color: DS.bodyText, background: "none", border: "none", cursor: "pointer" }}
          onMouseEnter={e => { e.currentTarget.style.color = DS.brand; }}
          onMouseLeave={e => { e.currentTarget.style.color = DS.bodyText; }}
        >
          {a.name}
        </button>
        {a.title && (
          <p className="text-[11px] mt-0.5" style={{ color: DS.dimText }}>{a.title}</p>
        )}
      </td>

      {/* Email */}
      <td className="py-3 px-3 max-w-[200px]">
        {a.email ? (
          <div className="flex items-center gap-2">
            <span className="text-xs truncate" style={{ color: DS.labelText }}>{a.email}</span>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); copyEmail(a.email); }}
              className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold transition-all"
              style={{ background: DS.brandBg, border: `1px solid ${DS.brandBorder}`, color: DS.brand }}
            >
              Copy
            </button>
          </div>
        ) : (
          <span className="text-xs font-semibold" style={{ color: DS.banned }}>Missing</span>
        )}
      </td>

      {/* Sport - replaces the old Status/Ready column */}
      <td className="py-3 px-3">
        <SportChip sport={a.sport} />
      </td>

      {/* Created */}
      <td className="py-3 px-3 text-xs" style={{ color: DS.dimText }}>
        {formatDateTime(a.createdAt)}
      </td>

      {/* Done */}
      <td className="py-3 px-3">
        <button
          type="button"
          onClick={e => { e.stopPropagation(); toggleDone(a.id, false); }}
          className="rounded-lg text-xs font-semibold transition-all"
          style={{
            padding:    "5px 10px",
            background:  done ? DS.safeBg  : DS.cardBg,
            border:      done ? `1px solid ${DS.safeBorder}` : `1px solid ${DS.border}`,
            color:       done ? DS.safe    : DS.labelText,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = done ? "#dcfae6" : DS.brandBg; }}
          onMouseLeave={e => { e.currentTarget.style.background = done ? DS.safeBg : DS.cardBg; }}
        >
          {done ? "✓ Done" : "Mark"}
        </button>
      </td>

      {/* Actions */}
      <td className="py-3 px-3">
        <div className="flex items-center gap-1.5">
          <RowBtn onClick={() => openPrescriptions(a.email)} disabled={!a.email} primary>
            <ExternalLink className="w-3 h-3" />
            Prescriptions
          </RowBtn>
          <RowBtn onClick={() => openDrawer(a.id)}>View</RowBtn>
        </div>
      </td>
    </tr>
  );
}

/* ── Main export ─────────────────────────────────────────────────────────── */

export default function AthletesList({
  paged,
  selectedIds,
  toggleSelect,
  openDrawer,
  isDone,
  isStarred,
  toggleStarred,
  toggleDone,
  openPrescriptions,
  copyEmail,
  activeRowId,
  setActiveRowId,
}) {
  if (paged.length === 0) {
    return (
      <div
        className="rounded-2xl px-5 py-10 text-center shadow-sm"
        style={{ background: DS.cardBg, border: `1px solid ${DS.border}` }}
      >
        <p className="text-sm" style={{ color: DS.dimText }}>
          No athletes found - try clearing filters or search.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-sm"
      style={{ background: DS.cardBg, border: `1px solid ${DS.border}` }}
    >
      {/* Mobile cards */}
      <div className="md:hidden p-3 space-y-2">
        {paged.map(a => (
          <AthleteCard
            key={a.id}
            a={a}
            selectedIds={selectedIds}
            toggleSelect={toggleSelect}
            openDrawer={openDrawer}
            isDone={isDone}
            isStarred={isStarred}
            toggleStarred={toggleStarred}
            toggleDone={toggleDone}
            openPrescriptions={openPrescriptions}
            copyEmail={copyEmail}
          />
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <p className="px-4 pt-3 text-[11px]" style={{ color: DS.dimText }}>
          Single click to highlight · Double click to open Quick View
        </p>
        <table className="w-full text-sm group">
          <thead>
            <tr style={{ borderBottom: `1px solid ${DS.border}` }}>
              {/* Sport replaces the old "Status" header */}
              {["", "", "Name", "Email", "Sport", "Created", "Done", "Actions"].map((h, i) => (
                <th
                  key={i}
                  className="py-2.5 px-3 text-left text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: DS.dimText }}
                >
                  {h === "Sport" ? (
                    <span className="flex items-center gap-1">
                      <Trophy className="w-3 h-3" />
                      {h}
                    </span>
                  ) : h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map(a => (
              <TableRow
                key={a.id}
                a={a}
                selectedIds={selectedIds}
                toggleSelect={toggleSelect}
                openDrawer={openDrawer}
                isDone={isDone}
                isStarred={isStarred}
                toggleStarred={toggleStarred}
                toggleDone={toggleDone}
                openPrescriptions={openPrescriptions}
                copyEmail={copyEmail}
                activeRowId={activeRowId}
                setActiveRowId={setActiveRowId}
              />
            ))}
          </tbody>
        </table>
        <p className="px-4 pb-3 pt-2 text-[11px]" style={{ color: DS.dimText }}>
          Done / Star / Notes stored locally · Exports include coach notes
        </p>
      </div>
    </div>
  );
}