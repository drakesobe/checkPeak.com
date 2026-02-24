"use client";

import { cx, clampPct } from "./utils";

/* ---------------- SummaryCard ---------------- */

export function SummaryCard({
  title,
  value,
  sub,
  tone = "neutral",
  right,
}) {
  const toneBorder =
    tone === "good"
      ? "border-emerald-200/80"
      : tone === "bad"
      ? "border-red-200/80"
      : tone === "warn"
      ? "border-amber-200/80"
      : "border-blue-100/80";

  const toneAccent =
    tone === "good"
      ? "bg-emerald-500"
      : tone === "bad"
      ? "bg-red-500"
      : tone === "warn"
      ? "bg-amber-500"
      : "bg-[#46769B]";

  const toneWash =
    tone === "good"
      ? "from-emerald-50/70"
      : tone === "bad"
      ? "from-red-50/70"
      : tone === "warn"
      ? "from-amber-50/70"
      : "from-blue-50/70";

  const toneRing =
    tone === "good"
      ? "hover:ring-2 hover:ring-emerald-200/50"
      : tone === "bad"
      ? "hover:ring-2 hover:ring-red-200/50"
      : tone === "warn"
      ? "hover:ring-2 hover:ring-amber-200/55"
      : "hover:ring-2 hover:ring-blue-200/50";

  return (
    <div
      className={cx(
        "relative rounded-3xl border bg-white/80 backdrop-blur-xl overflow-hidden",
        "shadow-[0_10px_30px_-18px_rgba(30,58,138,0.35)]",
        "transition-all duration-150 hover:-translate-y-[1px]",
        toneRing,
        toneBorder
      )}
    >
      {/* soft wash */}
      <div className={cx("pointer-events-none absolute inset-0 bg-gradient-to-b to-transparent", toneWash)} />
      {/* top accent */}
      <div className={cx("pointer-events-none absolute left-0 top-0 h-1 w-full", toneAccent)} />
      {/* subtle inner ring */}
      <div className="pointer-events-none absolute inset-0 ring-1 ring-black/5" />

      <div className="relative p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-gray-500">{title}</p>

            <p className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900 break-words leading-tight">
              {value}
            </p>

            {sub ? (
              <p className="mt-2 text-[12px] text-gray-600 leading-relaxed break-words">
                {sub}
              </p>
            ) : null}
          </div>

          {right ? (
            <div className="shrink-0 flex items-start pt-0.5">{right}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ---------------- StatusPill ---------------- */

export function StatusPill({ tone = "neutral", text }) {
  const cls =
    tone === "good"
      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-900 border-amber-200"
      : tone === "bad"
      ? "bg-red-50 text-red-900 border-red-200"
      : "bg-gray-50 text-gray-800 border-gray-200";

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1",
        "text-[11px] font-semibold leading-none whitespace-nowrap",
        "shadow-[0_1px_0_rgba(0,0,0,0.03)]",
        cls
      )}
    >
      {text}
    </span>
  );
}

/* ---------------- Metric ---------------- */

export function Metric({ label, value }) {
  const v = clampPct(value);

  const barTone = v >= 80 ? "bg-emerald-500" : v >= 60 ? "bg-amber-500" : "bg-red-500";
  const trackTone = v >= 80 ? "bg-emerald-50" : v >= 60 ? "bg-amber-50" : "bg-red-50";
  const ringTone =
    v >= 80 ? "ring-emerald-200/50" : v >= 60 ? "ring-amber-200/50" : "ring-red-200/50";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white/80 backdrop-blur p-3 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-gray-700 min-w-0 truncate">{label}</p>
        <p className="text-xs font-extrabold text-gray-900 tabular-nums">{v}%</p>
      </div>

      <div
        className={cx("mt-2 h-2.5 w-full rounded-full overflow-hidden ring-1", trackTone, ringTone)}
        role="progressbar"
        aria-label={label}
        aria-valuenow={v}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cx("h-full rounded-full transition-[width] duration-500 ease-out", barTone)}
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}

/* ---------------- EmptyState ---------------- */

export function EmptyState({ title, body, cta, onCta, icon }) {
  return (
    <div className="mt-4 rounded-3xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-start gap-3">
        {icon ? (
          <div className="shrink-0 w-10 h-10 rounded-2xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
            {icon}
          </div>
        ) : null}

        <div className="min-w-0">
          <p className="text-sm font-extrabold text-gray-900">{title}</p>
          <p className="text-sm text-gray-700 mt-1 leading-relaxed">{body}</p>

          {cta && onCta ? (
            <button
              onClick={onCta}
              className={cx(
                "mt-3 inline-flex items-center justify-center rounded-xl bg-[#46769B] px-4 py-2.5",
                "text-sm font-semibold text-white hover:brightness-110 transition",
                "focus:outline-none focus:ring-2 focus:ring-[#46769B]/35"
              )}
              type="button"
            >
              {cta}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Skeletons ---------------- */

export function SkeletonProfile() {
  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-3 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      <div className="bg-white/80 backdrop-blur rounded-3xl shadow-[0_10px_30px_-18px_rgba(30,58,138,0.35)] border border-blue-100/80 p-5">
        <div className="h-4 w-40 bg-gray-100 rounded shimmer" />
        <div className="mt-3 h-3 w-72 bg-gray-100 rounded shimmer" />
        <div className="mt-4 h-24 w-full bg-gray-100 rounded-2xl shimmer" />
      </div>

      <div className="bg-white/80 backdrop-blur rounded-3xl shadow-[0_10px_30px_-18px_rgba(30,58,138,0.35)] border border-blue-100/80 p-5">
        <div className="h-4 w-44 bg-gray-100 rounded shimmer" />
        <div className="mt-4 space-y-3">
          <div className="h-16 w-full bg-gray-100 rounded-2xl shimmer" />
          <div className="h-16 w-full bg-gray-100 rounded-2xl shimmer" />
        </div>
      </div>

      <style jsx>{`
        .shimmer {
          position: relative;
          overflow: hidden;
        }
        .shimmer:before {
          content: "";
          position: absolute;
          inset: 0;
          transform: translateX(-100%);
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.55) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          animation: shimmer 1.2s infinite;
        }
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white/80 backdrop-blur rounded-3xl shadow-[0_10px_30px_-18px_rgba(30,58,138,0.35)] border border-blue-100/80 p-5">
      <div className="h-3 w-28 bg-gray-100 rounded shimmer" />
      <div className="mt-2 h-8 w-24 bg-gray-100 rounded shimmer" />
      <div className="mt-3 h-3 w-44 bg-gray-100 rounded shimmer" />
      <style jsx>{`
        .shimmer {
          position: relative;
          overflow: hidden;
        }
        .shimmer:before {
          content: "";
          position: absolute;
          inset: 0;
          transform: translateX(-100%);
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.55) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          animation: shimmer 1.2s infinite;
        }
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}