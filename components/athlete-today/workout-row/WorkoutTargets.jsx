// components/athlete-today/workout/WorkoutTargets.jsx
"use client";

import { useMemo } from "react";
import { Hash, Repeat, Dumbbell, Timer, Gauge } from "lucide-react";
import { cx, hasText } from "./helpers";

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
  const toStr = (v) => String(v ?? "").trim();
  const isNumLike = (s) => /^-?\d+(\.\d+)?$/.test(String(s ?? "").trim());

  const normalizeRest = (v) => {
    const s = toStr(v);
    if (!s) return "";
    if (isNumLike(s)) {
      const n = Number(s);
      if (!Number.isFinite(n) || n <= 0) return "";
      if (n <= 300) return `${Math.round(n)}s`;
      return `${Math.round(n / 60)}m`;
    }
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
    if (isNumLike(s)) return `${s} lb`;
    return s.replace(/\s+/g, " ");
  };

  const tiles = useMemo(() => {
    const list = [];
    const repsV   = toStr(reps);
    const weightV = normalizeWeight(weight);
    const restV   = normalizeRest(rest);
    const setsV   = toStr(sets);
    const rpeV    = toStr(rpe);

    if (hasText(repsV))   list.push({ k: "Reps",   v: repsV,   icon: <Repeat  className="w-3.5 h-3.5" /> });
    if (hasText(weightV)) list.push({ k: "Weight", v: weightV, icon: <Dumbbell className="w-3.5 h-3.5" /> });
    if (hasText(restV))   list.push({ k: "Rest",   v: restV,   icon: <Timer   className="w-3.5 h-3.5" /> });
    if (hasText(setsV))   list.push({ k: "Sets",   v: setsV,   icon: <Hash    className="w-3.5 h-3.5" /> });
    if (hasText(rpeV))    list.push({ k: "RPE",    v: rpeV,    icon: <Gauge   className="w-3.5 h-3.5" /> });

    return list;
  }, [sets, reps, weight, rest, rpe]);

  if (!tiles.length) return null;

  const statusLabel =
    tone === "pending" ? "Submitted" :
    tone === "completed" ? "Done" : null;

  const statusColor =
    tone === "pending" ? "text-sky-600" :
    tone === "completed" ? "text-emerald-600" : "";

  // Tile accent colors per tone — base now uses brand #4FABFF
  const tileAccent =
    tone === "pending"
      ? { border: "border-sky-100", bg: "bg-sky-50/60", icon: "text-sky-500", value: "text-sky-900", label: "text-sky-500/80" }
      : tone === "completed"
      ? { border: "border-emerald-100", bg: "bg-emerald-50/60", icon: "text-emerald-500", value: "text-emerald-900", label: "text-emerald-500/80" }
      : { border: "border-gray-100", bg: "bg-white", icon: "text-[#4FABFF]", value: "text-gray-900", label: "text-gray-400" };

  return (
    <div className={cx("mt-3", muted ? "opacity-70" : "")}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
          Targets
        </p>
        {statusLabel ? (
          <span className={cx("text-[10px] font-bold uppercase tracking-wide", statusColor)}>
            {statusLabel}
          </span>
        ) : null}
      </div>

      <div className={cx(
        "grid gap-1.5",
        tiles.length <= 2 ? "grid-cols-2" :
        tiles.length === 3 ? "grid-cols-3" :
        tiles.length === 4 ? "grid-cols-4" :
        "grid-cols-3 sm:grid-cols-5"
      )}>
        {tiles.map((t) => (
          <div
            key={t.k}
            className={cx(
              "rounded-xl border px-2.5 py-2 flex flex-col",
              tileAccent.border,
              tileAccent.bg,
              compact ? "py-1.5" : ""
            )}
          >
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className={cx("text-[9px] font-black uppercase tracking-widest", tileAccent.label)}>
                {t.k}
              </span>
              <span className={cx("shrink-0", tileAccent.icon)} aria-hidden>
                {t.icon}
              </span>
            </div>
            <span className={cx(
              "font-black leading-none tabular-nums",
              compact ? "text-[13px]" : "text-[15px]",
              tileAccent.value
            )}>
              {t.v}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}