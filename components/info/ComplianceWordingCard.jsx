"use client";

import { FaExternalLinkAlt, FaQuoteLeft } from "react-icons/fa";

function asParas(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  const s = String(v).trim();
  if (!s) return [];
  return s.split("\n").map((x) => x.trim()).filter(Boolean);
}

// Utility: clamp lines without needing Tailwind line-clamp plugin
function clampStyle(lines) {
  return {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: lines,
    overflow: "hidden",
  };
}

export default function ComplianceWordingCard({ item }) {
  const whyParas = asParas(item?.whyItMatters);
  const tags = Array.isArray(item?.tags) ? item.tags : [];

  // Normalize “Why this matters” into 1 string (so clamping is uniform)
  const whyText = whyParas.join(" ");

  return (
    <a
      href={item?.href || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="group block h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-transform hover:-translate-y-0.5"
    >
      {/* Make internal layout consistent */}
      <div className="min-w-0 h-full flex flex-col">
        {/* Title row */}
        <div className="flex items-start justify-between gap-3">
          <p
            className="text-sm font-extrabold text-slate-900 leading-snug"
            style={clampStyle(2)}
            title={item?.title || ""}
          >
            {item?.title}
          </p>
          <FaExternalLinkAlt className="mt-0.5 shrink-0 text-slate-400 group-hover:text-slate-600 text-xs" />
        </div>

        {/* Quote block (fixed visual weight) */}
        <div className="mt-3 rounded-2xl bg-slate-50 border border-slate-200 p-4">
          <div className="flex items-start gap-2">
            <FaQuoteLeft className="shrink-0 text-slate-400 mt-0.5" />
            <p
              className="text-sm text-slate-800 leading-relaxed font-semibold"
              style={clampStyle(3)}
              title={item?.quote || ""}
            >
              {item?.quote}
            </p>
          </div>
        </div>

        {/* Why it matters (always present for uniformity) */}
        <div className="mt-3">
          <p className="text-[11px] font-extrabold tracking-widest text-slate-500 uppercase">
            Why this matters
          </p>

          <p
            className="mt-2 text-sm text-slate-700 leading-relaxed"
            style={clampStyle(4)}
            title={whyText || ""}
          >
            {whyText || "This item is included as an official reference point for program-first compliance messaging."}
          </p>
        </div>

        {/* Spacer pushes tags to bottom */}
        <div className="flex-1" />

        {/* Tags */}
        {tags.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700"
              >
                {t}
              </span>
            ))}
          </div>
        ) : (
          // Keep bottom rhythm even if no tags
          <div className="mt-4 h-[22px]" aria-hidden />
        )}
      </div>
    </a>
  );
}