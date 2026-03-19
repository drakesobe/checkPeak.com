// components/org/athletes/QueueBar.jsx
"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const DS = {
  brand:       "#1E3A5F",
  brandBg:     "#EEF3F9",
  brandBorder: "#C0D0E0",
  safe:        "#00873E",
  safeBg:      "#F0FBF4",
  safeBorder:  "#A8DFB8",
  caution:     "#B86000",
  cautionBg:   "#FFFBF0",
  cautionBorder:"#FFD580",
  border:      "#E8ECF0",
  cardBg:      "#FFFFFF",
  bodyText:    "#1A2535",
  labelText:   "#5A6A7D",
  dimText:     "#9BA8B4",
};

function clampPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export default function QueueBar({
  onNextUp,
  disabled,
  batchProgress,
  filteredCount,
  nextUpName,
}) {
  const done      = Number(batchProgress?.done  || 0);
  const total     = Number(batchProgress?.total || 0);
  const pct       = useMemo(() => clampPct(batchProgress?.pct), [batchProgress?.pct]);
  const remaining = total - done;
  const allDone   = total > 0 && done >= total;

  const pctColor    = allDone ? DS.safe    : pct >= 50 ? DS.brand   : DS.caution;
  const barColor    = allDone ? DS.safe    : pct >= 50 ? "#46769B"  : "#E09030";
  const bgStyle     = allDone ? { background: DS.safeBg,    border: `1px solid ${DS.safeBorder}`    }
                              : { background: DS.brandBg,   border: `1px solid ${DS.brandBorder}`   };

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm" style={bgStyle}>
      <div className="px-5 py-4 flex items-center gap-5">

        {/* Left: progress */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: pctColor }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: DS.labelText }}>
                Queue progress
              </span>
            </div>
            <span className="text-xs font-bold tabular-nums" style={{ color: pctColor }}>
              {done}/{total} · {pct}%
            </span>
          </div>

          {/* Bar */}
          <div
            className="h-2 w-full rounded-full overflow-hidden"
            style={{ background: "rgba(0,0,0,0.08)" }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: barColor }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            />
          </div>

          <p className="mt-1.5 text-xs" style={{ color: DS.dimText }}>
            {allDone
              ? "All athletes in this view are marked done."
              : remaining > 0
              ? `${remaining} ${remaining === 1 ? "athlete" : "athletes"} remaining`
              : "No athletes in current view"}
            {filteredCount > 0 && total !== filteredCount && (
              <span style={{ color: DS.dimText }}> · {filteredCount} filtered</span>
            )}
          </p>
        </div>

        {/* Divider */}
        <div
          className="hidden sm:block self-stretch w-px shrink-0"
          style={{ background: DS.brandBorder }}
          aria-hidden="true"
        />

        {/* Right: Next Up button */}
        <div className="shrink-0 flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={onNextUp}
            disabled={disabled || allDone}
            className="inline-flex items-center gap-2.5 rounded-xl font-extrabold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              padding:    "11px 20px",
              background:  allDone ? DS.safeBg  : disabled ? "#E8ECF0" : DS.brand,
              border:      allDone ? `1px solid ${DS.safeBorder}` : `1px solid ${DS.brand}`,
              color:       allDone ? DS.safe    : disabled ? DS.labelText : "#fff",
              fontSize:    14,
              letterSpacing: "0.02em",
            }}
            onMouseEnter={e => {
              if (disabled || allDone) return;
              e.currentTarget.style.background = "#162d4a";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = allDone ? DS.safeBg : disabled ? "#E8ECF0" : DS.brand;
            }}
          >
            {allDone ? (
              <>
                <CheckCircle2 className="w-4 h-4" style={{ color: DS.safe }} />
                All done
              </>
            ) : (
              <>
                Next Up
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {nextUpName && !allDone && !disabled && (
            <p className="text-[10px] text-center max-w-[140px] truncate" style={{ color: DS.dimText }}>
              → {nextUpName}
            </p>
          )}
        </div>

      </div>
    </div>
  );
}