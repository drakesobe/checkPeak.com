// components/org/athletes/AthletesStats.jsx
"use client";

import { useMemo } from "react";

const DS = {
  brand:       "#1E3A5F",
  brandBg:     "#EEF3F9",
  brandBorder: "#C0D0E0",
  safe:        "#00873E",
  safeBg:      "#F0FBF4",
  caution:     "#B86000",
  cautionBg:   "#FFFBF0",
  border:      "#E8ECF0",
  cardBg:      "#FFFFFF",
  bodyText:    "#1A2535",
  labelText:   "#5A6A7D",
  dimText:     "#9BA8B4",
};

function Stat({ label, value, valueColor, divider = true }) {
  return (
    <>
      <div className="flex items-center gap-1.5">
        <span
          className="text-sm font-extrabold tabular-nums"
          style={{ color: valueColor || DS.bodyText }}
        >
          {value}
        </span>
        <span className="text-xs" style={{ color: DS.dimText }}>{label}</span>
      </div>
      {divider && (
        <div aria-hidden="true" className="h-3.5 w-px shrink-0" style={{ background: DS.border }} />
      )}
    </>
  );
}

export default function AthletesStats({ stats, filteredStats }) {
  const s  = stats         || {};
  const fs = filteredStats || s;

  const total      = Number(fs.total        ?? s.total        ?? 0);
  const ready      = Number(fs.ready        ?? s.ready        ?? 0);
  const incomplete = Number(fs.incomplete   ?? s.incomplete   ?? 0);
  const done       = Number(fs.doneCount    ?? s.doneCount    ?? 0);
  const starred    = Number(fs.starredCount ?? s.starredCount ?? 0);

  const readyPct = useMemo(
    () => (total ? Math.round((ready / total) * 100) : 0),
    [ready, total]
  );

  if (total === 0) return null;

  return (
    <div
      className="rounded-xl px-4 py-2.5 flex flex-wrap items-center gap-3 shadow-sm"
      style={{ background: DS.cardBg, border: `1px solid ${DS.border}` }}
    >
      <Stat label="total"      value={total}      valueColor={DS.bodyText} />
      <Stat label="ready"      value={ready}      valueColor={DS.safe} />
      <Stat label="incomplete" value={incomplete} valueColor={incomplete > 0 ? DS.caution : DS.dimText} />
      <Stat label="done"       value={done}       valueColor={done > 0 ? DS.brand : DS.dimText} />
      <Stat label="starred"    value={starred}    valueColor={starred > 0 ? DS.caution : DS.dimText} divider={false} />

      {readyPct > 0 && (
        <span className="ml-auto text-xs" style={{ color: DS.dimText }}>
          {readyPct}% have email
        </span>
      )}
    </div>
  );
}