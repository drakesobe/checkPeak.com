"use client";

import { useMemo } from "react";
import { Hash, Repeat, Dumbbell, Timer, Gauge } from "lucide-react";
import { cx, hasText } from "./helpers";

/**
 * WorkoutTargets (polished)
 *
 * Goals:
 * - Cleaner scan order (most important first)
 * - Smarter formatting (adds units where helpful, normalizes common inputs)
 * - Better mobile layout (prevents value clipping, consistent height)
 * - Tone-aware styling (base / pending / completed) + muted mode
 * - Optional “compact” mode for tight rows if you ever need it later
 *
 * Props:
 * - sets, reps, weight, rest, rpe: strings/numbers
 * - muted: dims the block (used for checked-off rows)
 * - tone: "base" | "pending" | "completed"
 * - compact: tighter padding + font sizes
 */
export default function WorkoutTargets({
  sets,
  reps,
  weight,
  rest,
  rpe,
  muted = false,
  tone = "base",
  compact = false,
}) {
  /* ---------------------------------------------------------------------- */
  /* Normalizers                                                            */
  /* ---------------------------------------------------------------------- */

  const toStr = (v) => String(v ?? "").trim();

  const isNumLike = (s) => {
    const x = String(s ?? "").trim();
    if (!x) return false;
    return /^-?\d+(\.\d+)?$/.test(x);
  };

  const normalizeSets = (v) => {
    const s = toStr(v);
    if (!s) return "";
    // If just a number, keep it
    if (isNumLike(s)) return s;
    return s;
  };

  const normalizeReps = (v) => {
    const s = toStr(v);
    if (!s) return "";
    // common forms: "8-10", "AMRAP", "to failure"
    return s;
  };

  const normalizeRpe = (v) => {
    const s = toStr(v);
    if (!s) return "";
    // if numeric, constrain visually
    if (isNumLike(s)) return s;
    return s;
  };

  const normalizeRest = (v) => {
    const s = toStr(v);
    if (!s) return "";

    // If user enters a plain number, assume seconds when <= 300; else minutes.
    if (isNumLike(s)) {
      const n = Number(s);
      if (Number.isFinite(n)) {
        if (n <= 0) return "";
        if (n <= 300) return `${Math.round(n)}s`;
        // 360 -> 6m
        const mins = Math.round(n / 60);
        return `${mins}m`;
      }
    }

    // If they already included units, keep it
    // Normalize common variants (e.g., "60 sec" => "60s", "2 min" => "2m")
    const lower = s.toLowerCase();
    const secMatch = lower.match(/^(\d+)\s*(s|sec|secs|second|seconds)$/i);
    if (secMatch) return `${secMatch[1]}s`;

    const minMatch = lower.match(/^(\d+)\s*(m|min|mins|minute|minutes)$/i);
    if (minMatch) return `${minMatch[1]}m`;

    return s;
  };

  const normalizeWeight = (v) => {
    const s = toStr(v);
    if (!s) return "";

    // If numeric only, assume lbs (US gym default); you can change to "kg" if desired.
    if (isNumLike(s)) return `${s} lb`;

    // If they typed "225lbs" or "100 kg", keep as-is but trim spacing
    return s.replace(/\s+/g, " ");
  };

  /* ---------------------------------------------------------------------- */
  /* Build tiles                                                            */
  /* ---------------------------------------------------------------------- */

  const tiles = useMemo(() => {
    const list = [];

    const repsV = normalizeReps(reps);
    const weightV = normalizeWeight(weight);
    const restV = normalizeRest(rest);
    const setsV = normalizeSets(sets);
    const rpeV = normalizeRpe(rpe);

    // Athlete scan order: Reps -> Weight -> Rest -> Sets -> RPE
    if (hasText(repsV)) {
      list.push({
        k: "Reps",
        v: repsV,
        icon: <Repeat className="w-4 h-4" />,
      });
    }

    if (hasText(weightV)) {
      list.push({
        k: "Weight",
        v: weightV,
        icon: <Dumbbell className="w-4 h-4" />,
      });
    }

    if (hasText(restV)) {
      list.push({
        k: "Rest",
        v: restV,
        icon: <Timer className="w-4 h-4" />,
      });
    }

    if (hasText(setsV)) {
      list.push({
        k: "Sets",
        v: setsV,
        icon: <Hash className="w-4 h-4" />,
      });
    }

    if (hasText(rpeV)) {
      list.push({
        k: "RPE",
        v: rpeV,
        icon: <Gauge className="w-4 h-4" />,
      });
    }

    return list;
  }, [sets, reps, weight, rest, rpe]);

  if (!tiles.length) return null;

  /* ---------------------------------------------------------------------- */
  /* Styles (tone-aware)                                                    */
  /* ---------------------------------------------------------------------- */

  const wrapOpacity = muted ? "opacity-[0.82]" : "";
  const headerText =
    tone === "pending"
      ? "text-sky-700"
      : tone === "completed"
      ? "text-emerald-700"
      : "text-gray-500";

  const tileBase =
    "rounded-2xl border min-w-0 overflow-hidden " +
    (compact ? "px-2.5 py-2" : "px-3 py-2");

  const tileTone =
    tone === "pending"
      ? "border-sky-200/80 bg-white/70"
      : tone === "completed"
      ? "border-emerald-200/80 bg-white/70"
      : "border-gray-200 bg-gray-50";

  // subtle ring on tone states (helps pop without loud background)
  const tileRing =
    tone === "pending"
      ? "ring-1 ring-sky-200/40"
      : tone === "completed"
      ? "ring-1 ring-emerald-200/40"
      : "ring-0";

  // icons match tone slightly (without fighting the rest of the card)
  const iconTone =
    tone === "pending"
      ? "text-sky-700"
      : tone === "completed"
      ? "text-emerald-700"
      : "text-gray-700";

  // value styles: allow wrapping on small screens, but keep readable
  const valueText =
    "mt-1 font-extrabold text-gray-900 leading-snug tabular-nums " +
    (compact ? "text-[13px]" : "text-[14px]") +
    " break-words";

  const labelText =
    "text-[10px] font-semibold text-gray-500 truncate";

  /* ---------------------------------------------------------------------- */
  /* Layout                                                                  */
  /* ---------------------------------------------------------------------- */

  // Use responsive grid that feels good on mobile:
  // - Always 2 columns on smallest screens
  // - 3 on sm
  // - 5 on lg
  // This keeps targets from feeling like a long row of pills.
  const gridCls = "mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2";

  return (
    <div className={cx("mt-3", wrapOpacity)}>
      <div className="flex items-center justify-between gap-2">
        <p className={cx("text-[11px] font-semibold uppercase tracking-wide", headerText)}>
          Workout targets
        </p>

        {/* Optional hint for checked-off rows (keeps UI calm; no extra emojis) */}
        {tone === "pending" ? (
          <span className="text-[11px] font-semibold text-sky-700/80">
            Submitted
          </span>
        ) : tone === "completed" ? (
          <span className="text-[11px] font-semibold text-emerald-700/80">
            Completed
          </span>
        ) : null}
      </div>

      <div className={gridCls}>
        {tiles.map((t) => (
          <div key={t.k} className={cx(tileBase, tileTone, tileRing)}>
            <div className="flex items-center justify-between gap-2">
              <p className={labelText}>{t.k}</p>

              <span className={cx("shrink-0", iconTone)} aria-hidden="true">
                {t.icon}
              </span>
            </div>

            <p className={valueText}>{t.v}</p>

            {/* Micro-subtext (only for certain keys, keeps it informative but quiet) */}
            {t.k === "RPE" && isNumLike(t.v) ? (
              <p className="mt-1 text-[10px] text-gray-500">
                Effort scale
              </p>
            ) : null}
            {t.k === "Rest" && /m$|s$/i.test(String(t.v)) ? (
              <p className="mt-1 text-[10px] text-gray-500">
                Between sets
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
