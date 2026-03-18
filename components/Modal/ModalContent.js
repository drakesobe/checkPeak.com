"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";

/* ─────────────────────────────────────────────────────────────────────────── */
/* Helpers                                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

const escapeRegex = (s = "") => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const escapeHtml = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

const normalizeBanType = (val) => {
  if (!val) return "Other";
  const s = String(val).trim().toLowerCase();
  if (s === "prohibited")                               return "Prohibited";
  if (s.includes("out of competition") || s === "limited") return "Limited";
  if (s.includes("particular sport"))                   return "Sport-Specific";
  return "Other";
};

const SEVERITY = { Prohibited: 0, Limited: 1, "Sport-Specific": 2, Other: 3 };

const BAN_STYLE = {
  Prohibited:       { border: "#E83A2F", pillBg: "rgba(232,58,47,0.32)",   pillText: "#fca5a5", label: "Prohibited"     },
  Limited:          { border: "#f77f00", pillBg: "rgba(247,127,0,0.32)",   pillText: "#fdba74", label: "Limited"        },
  "Sport-Specific": { border: "#5B9EC9", pillBg: "rgba(91,158,201,0.32)",  pillText: "#93c5fd", label: "Sport-Specific" },
  Other:            { border: "#6b7280", pillBg: "rgba(107,114,128,0.32)", pillText: "#e2e8f0", label: "Monitored"      },
};

const getRisk = (count) => {
  if (count === 0) return { label: "Label Cleared", color: "#22c55e", bg: "rgba(34,197,94,0.08)",  border: "rgba(34,197,94,0.22)",  glow: "rgba(34,197,94,0.12)"  };
  if (count === 1) return { label: "Caution",       color: "#f77f00", bg: "rgba(247,127,0,0.08)",  border: "rgba(247,127,0,0.22)",  glow: "rgba(247,127,0,0.12)"  };
  return              { label: "High Risk",       color: "#E83A2F", bg: "rgba(232,58,47,0.08)",  border: "rgba(232,58,47,0.22)",  glow: "rgba(232,58,47,0.14)"  };
};

/* ─────────────────────────────────────────────────────────────────────────── */
/* First-visit flag — module-scoped, resets on page reload                     */
/* ─────────────────────────────────────────────────────────────────────────── */

let _legendSeen = false;

/* ─────────────────────────────────────────────────────────────────────────── */
/* Legend data — single source of truth for all category descriptions          */
/* ─────────────────────────────────────────────────────────────────────────── */

const LEGEND = [
  {
    type:  "Prohibited",
    dot:   "#E83A2F",
    bg:    "rgba(232,58,47,0.14)",
    text:  "#fca5a5",
    title: "Prohibited",
    desc:  "Banned in and out of competition by the NCAA, WADA, or USADA. A positive test risks disqualification regardless of intent or dosage.",
  },
  {
    type:  "Limited",
    dot:   "#f77f00",
    bg:    "rgba(247,127,0,0.14)",
    text:  "#fdba74",
    title: "Limited",
    desc:  "Permitted out of competition only. These substances are restricted or banned during the competitive season — timing and dosage rules apply.",
  },
  {
    type:  "Sport-Specific",
    dot:   "#5B9EC9",
    bg:    "rgba(91,158,201,0.14)",
    text:  "#93c5fd",
    title: "Sport-Specific",
    desc:  "Banned in certain sports only. Rules vary by governing body — check the specific regulations for your sport and competition level.",
  },
  {
    type:  "Monitored",
    dot:   "#9ca3af",
    bg:    "rgba(156,163,175,0.14)",
    text:  "#e2e8f0",
    title: "Monitored",
    desc:  "Under active observation by anti-doping agencies. Not currently banned, but watch for status changes and confirm with your athletics staff.",
  },
];

/* ─────────────────────────────────────────────────────────────────────────── */
/* Highlighters                                                                 */
/* ─────────────────────────────────────────────────────────────────────────── */

function highlightNodes(text = "", bannedList = [], ingList = []) {
  if (!text) return null;
  const terms = [];
  const push = (name, syns, cls) => {
    if (name) terms.push({ term: name, cls });
    String(syns || "").split(",").map(s => s.trim()).filter(Boolean)
      .forEach(s => terms.push({ term: s, cls }));
  };
  bannedList.forEach(r => {
    const bt  = normalizeBanType(r.banType || r._raw?.["Ban Type"]);
    const cls = bt === "Prohibited" ? "bg-red-600/80 text-white px-0.5 rounded"
              : bt === "Limited"    ? "bg-orange-500/80 text-white px-0.5 rounded"
              :                       "bg-blue-600/80 text-white px-0.5 rounded";
    push(r.name, r.synonyms, cls);
  });
  ingList.forEach(r => push(r.name, r.synonyms, "bg-purple-600/70 text-white px-0.5 rounded"));
  terms.sort((a, b) => b.term.length - a.term.length);
  let segs = [text];
  for (const { term, cls } of terms) {
    if (!term) continue;
    const rx = new RegExp(`(${escapeRegex(term)})`, "gi");
    segs = segs.flatMap((seg, si) => {
      if (typeof seg !== "string") return [seg];
      return seg.split(rx).map((p, pi) =>
        rx.test(p) ? <span key={`${term}-${si}-${pi}`} className={cls}>{p}</span> : p
      );
    });
  }
  return segs;
}

function highlightHtml(text, terms, ocrText, color = "#93c5fd") {
  if (!text) return "";
  const html  = escapeHtml(text);
  if (!ocrText || !terms?.length) return html;
  const lower = ocrText.toLowerCase();
  let out = html;
  terms.forEach(t => {
    const term = (t || "").trim();
    if (!term || !lower.includes(term.toLowerCase())) return;
    try {
      out = out.replace(
        new RegExp(escapeRegex(term), "gi"),
        m => `<span style="color:${color};font-weight:600;">${escapeHtml(m)}</span>`
      );
    } catch { /* ignore malformed regex */ }
  });
  return out;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* LabelThumbnail — small image with sweep animation + status badge            */
/* ─────────────────────────────────────────────────────────────────────────── */

function LabelThumbnail({ imageUrl, isScanning, scanComplete, flaggedCount }) {
  const risk = scanComplete ? getRisk(flaggedCount) : null;

  return (
    <div
      className="relative rounded-xl overflow-hidden shrink-0"
      style={{
        width:      76,
        height:     76,
        background: "#0D1117",
        border:     risk
          ? `1.5px solid ${risk.border}`
          : "1px solid rgba(255,255,255,0.09)",
        transition: "border-color 0.3s ease",
      }}
    >
      {/* Image or fallback icon */}
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Nutrition label"
          className="w-full h-full"
          style={{ objectFit: "contain", objectPosition: "center" }}
          crossOrigin="anonymous"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
      )}

      {/* Scanning overlay + sweep line */}
      <AnimatePresence>
        {isScanning && (
          <motion.div
            className="absolute inset-0 overflow-hidden"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background: "rgba(10,12,16,0.5)" }}
          >
            <motion.div
              className="absolute left-0 right-0 h-px"
              style={{
                background: "rgba(91,158,201,0.9)",
                boxShadow:  "0 0 8px rgba(91,158,201,0.7)",
              }}
              initial={{ top: "0%" }}
              animate={{ top: "100%" }}
              transition={{ duration: 1.4, ease: "linear", repeat: Infinity }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status badge after scan completes */}
      <AnimatePresence>
        {scanComplete && !isScanning && risk && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="absolute bottom-0 left-0 right-0 py-1 text-center"
            style={{ background: `${risk.color}dd`, backdropFilter: "blur(4px)" }}
          >
            <span
              className="text-[9px] font-black uppercase tracking-widest text-white"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              {flaggedCount === 0 ? "✓ Clear" : `${flaggedCount} Found`}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* ResultBanner — the risk assessment panel sitting right of the thumbnail      */
/* ─────────────────────────────────────────────────────────────────────────── */

function ResultBanner({ flaggedCount, totalCount, scanComplete, isScanning, animDots, presentBanTypes }) {

  /* Still scanning ──────────────────────────────────────────────────────── */
  if (isScanning) {
    return (
      <div
        className="flex-1 rounded-xl flex flex-col justify-center px-4 py-3.5"
        style={{ background: "rgba(91,158,201,0.05)", border: "1px solid rgba(91,158,201,0.14)" }}
      >
        <div className="flex items-center gap-1.5 mb-2">
          {[0, 120, 240].map(d => (
            <div
              key={d}
              className="w-1.5 h-1.5 rounded-full animate-bounce"
              style={{ backgroundColor: "rgba(91,158,201,0.7)", animationDelay: `${d}ms` }}
            />
          ))}
        </div>
        <p
          className="text-xs uppercase tracking-widest"
          style={{ color: "rgba(255,255,255,0.5)", fontFamily: "'Barlow Condensed', sans-serif" }}
        >
          Analysing label
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.32)" }}>
          Checking against NCAA · WADA · USADA
        </p>
      </div>
    );
  }

  /* Not yet scanned ─────────────────────────────────────────────────────── */
  if (!scanComplete) {
    return (
      <div
        className="flex-1 rounded-xl flex flex-col justify-center px-4 py-3.5"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <p className="text-sm font-semibold text-white mb-1">Scan starts automatically</p>
        <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
          Label loads, then gets compared against our database of banned and monitored substances.
        </p>
      </div>
    );
  }

  const risk = getRisk(flaggedCount);

  /* Cleared ─────────────────────────────────────────────────────────────── */
  if (flaggedCount === 0) {
    return (
      <motion.div
        className="flex-1 rounded-xl px-4 py-3.5 flex flex-col justify-center"
        style={{
          background:  risk.bg,
          border:      `1px solid ${risk.border}`,
          boxShadow:   `0 0 18px ${risk.glow}`,
        }}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {/* Status */}
        <div className="flex items-center gap-2 mb-1.5">
          <div className="relative shrink-0">
            <span className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ backgroundColor: risk.color }} />
            <span className="relative w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: risk.color }} />
          </div>
          <p
            className="text-2xl font-black leading-none tracking-tight"
            style={{ color: risk.color, fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            {risk.label.toUpperCase()}
          </p>
        </div>

        {/* Supporting line */}
        <p className="text-xs mb-2.5" style={{ color: "rgba(255,255,255,0.65)" }}>
          No banned or monitored substances detected.
        </p>

        {/* Databases checked — adds credibility */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="text-[10px] uppercase tracking-widest"
            style={{ color: "rgba(255,255,255,0.4)", fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            Checked:
          </span>
          {["NCAA", "WADA", "USADA"].map(db => (
            <span
              key={db}
              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{
                background: "rgba(34,197,94,0.18)",
                color:      "#86efac",
                fontFamily: "'Barlow Condensed', sans-serif",
              }}
            >
              {db}
            </span>
          ))}
        </div>
      </motion.div>
    );
  }

  /* Flagged ─────────────────────────────────────────────────────────────── */
  return (
    <motion.div
      className="flex-1 rounded-xl px-4 py-3.5 flex flex-col justify-center"
      style={{
        background:  risk.bg,
        border:      `1px solid ${risk.border}`,
        boxShadow:   `0 0 18px ${risk.glow}`,
      }}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {/* Risk label */}
      <div className="flex items-center gap-2 mb-1">
        <div className="relative shrink-0">
          <span className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ backgroundColor: risk.color }} />
          <span className="relative w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: risk.color }} />
        </div>
        <p
          className="text-2xl font-black leading-none tracking-tight"
          style={{ color: risk.color, fontFamily: "'Barlow Condensed', sans-serif" }}
        >
          {risk.label.toUpperCase()}
        </p>
      </div>

      {/* Counts */}
      <p className="text-xs mb-2.5" style={{ color: "rgba(255,255,255,0.65)" }}>
        <span className="font-bold" style={{ color: "rgba(255,255,255,0.92)" }}>{flaggedCount}</span>{" "}
        {flaggedCount === 1 ? "substance" : "substances"} flagged
        {totalCount > 0 && (
          <>
            {" · "}
            <span className="font-bold" style={{ color: "rgba(255,255,255,0.92)" }}>{totalCount}</span>{" "}
            {totalCount === 1 ? "ingredient" : "ingredients"} identified
          </>
        )}
      </p>

      {/* Mini dot legend — only categories actually present in results */}
      {presentBanTypes.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {presentBanTypes.map(type => {
            const s = BAN_STYLE[type] || BAN_STYLE.Other;
            return (
              <div key={type} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.border }} aria-hidden="true" />
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: s.pillText, fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* BannedCard                                                                   */
/* ─────────────────────────────────────────────────────────────────────────── */

function BannedCard({ rec, ocrText }) {
  const [open, setOpen] = useState(false);

  const banType = normalizeBanType(rec.banType || rec._raw?.["Ban Type"]);
  const style   = BAN_STYLE[banType] || BAN_STYLE.Other;
  const raw     = rec._raw || {};

  const name         = rec.name        || "Unnamed substance";
  const synonyms     = rec.synonyms    || raw["Synonyms"]         || "";
  const bannedBy     = rec.bannedBy    || raw["Banned By"]         || "";
  const dosage       = rec.dosageLimit || raw["Dosage Limit"]      || "";
  const source       = rec.source      || raw["Source"]            || raw["Source / Citation"] || raw["Sources / References"] || "";
  const whatItDoes   = (rec.benefits   || raw["Benefits"] || rec.notes || raw["Notes"] || "").toString();
  const watchFor     = (rec.weaknesses || raw["Weaknesses"]        || "").toString();
  const interactions = (rec.antagonism || raw["Nutrient Antagonism"] || "").toString();

  const terms     = [name, ...String(synonyms).split(",").map(s => s.trim()).filter(Boolean)];
  const hasDetail = whatItDoes || watchFor || interactions || source;

  return (
    <motion.div
      layout="position"
      className="overflow-hidden rounded-xl"
      style={{
        background: "rgba(255,255,255,0.06)",
        border:     "1px solid rgba(255,255,255,0.09)",
        borderLeft: `3px solid ${style.border}`,
        cursor:     hasDetail ? "pointer" : "default",
      }}
      onClick={() => hasDetail && setOpen(o => !o)}
    >
      <div className="flex items-start justify-between gap-3 px-4 py-3.5">
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Pill + meta */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-[11px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full"
              style={{ background: style.pillBg, color: style.pillText, fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              {style.label}
            </span>
            {bannedBy && (
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>{bannedBy}</span>
            )}
            {dosage && (
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>Limit: {dosage}</span>
            )}
          </div>
          {/* Name */}
          <p className="text-base font-bold text-white leading-snug">{name}</p>
          {/* Synonyms */}
          {synonyms && (
            <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "rgba(255,255,255,0.6)" }}>
              {synonyms}
            </p>
          )}
        </div>
        {hasDetail && (
          <div className="shrink-0 mt-2" style={{ color: "rgba(255,255,255,0.45)" }}>
            {open ? <FaChevronUp size={11} /> : <FaChevronDown size={11} />}
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="banned-detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div
              className="px-4 pb-4 pt-3 space-y-3.5"
              style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
              onClick={e => e.stopPropagation()}
            >
              {whatItDoes && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest mb-1.5"
                     style={{ color: "rgba(255,255,255,0.55)", fontFamily: "'Barlow Condensed', sans-serif" }}>
                    What it does
                  </p>
                  <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.78)" }}
                     dangerouslySetInnerHTML={{ __html: highlightHtml(whatItDoes, terms, ocrText, "#bfdbfe") }} />
                </div>
              )}
              {watchFor && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest mb-1.5"
                     style={{ color: "rgba(255,255,255,0.55)", fontFamily: "'Barlow Condensed', sans-serif" }}>
                    Watch for
                  </p>
                  <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.78)" }}
                     dangerouslySetInnerHTML={{ __html: highlightHtml(watchFor, terms, ocrText, "#fecaca") }} />
                </div>
              )}
              {interactions && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest mb-1.5"
                     style={{ color: "rgba(255,255,255,0.55)", fontFamily: "'Barlow Condensed', sans-serif" }}>
                    Nutrient interactions
                  </p>
                  <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.78)" }}
                     dangerouslySetInnerHTML={{ __html: highlightHtml(interactions, terms, ocrText, "#facc15") }} />
                </div>
              )}
              {source && (
                <p className="text-xs pt-0.5" style={{ color: "rgba(255,255,255,0.38)" }}>
                  <span className="font-semibold">Source: </span>{source}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* IngredientCard                                                               */
/* ─────────────────────────────────────────────────────────────────────────── */

function IngredientCard({ ing, ocrText }) {
  const [open, setOpen] = useState(false);

  const raw        = ing._raw || {};
  const name       = ing.name        || raw["Ingredient Name"] || "Unnamed ingredient";
  const synonyms   = ing.synonyms    || raw["Synonyms (Extended)"] || raw["Synonyms"] || "";
  const benefits   = (ing.benefits   || raw["Benefits"]            || "").toString();
  const weaknesses = (ing.weaknesses || raw["Weaknesses"]          || "").toString();
  const antagonism = (ing.antagonism || raw["Nutrient Antagonism"] || "").toString();
  const source     = (ing.source     || raw["Sources / References"] || raw["Source"] || "").toString();
  const hasDetail  = benefits || weaknesses || antagonism || source;
  const terms      = [name, ...String(synonyms).split(",").map(s => s.trim()).filter(Boolean)];

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.04)",
        border:     "1px solid rgba(255,255,255,0.07)",
        cursor:     hasDetail ? "pointer" : "default",
      }}
      onClick={() => hasDetail && setOpen(o => !o)}
    >
      <div className="flex items-center justify-between gap-3 px-3.5 py-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold truncate" style={{ color: "rgba(255,255,255,0.85)" }}>{name}</p>
          {synonyms && (
            <p className="text-xs truncate mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>{synonyms}</p>
          )}
        </div>
        {hasDetail && (
          <div className="shrink-0" style={{ color: "rgba(255,255,255,0.4)" }}>
            {open ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="ing-detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div
              className="px-3.5 pb-3 pt-2.5 space-y-2.5"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
              onClick={e => e.stopPropagation()}
            >
              {benefits && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest mb-1"
                     style={{ color: "rgba(255,255,255,0.55)", fontFamily: "'Barlow Condensed', sans-serif" }}>
                    What it does
                  </p>
                  <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.72)" }}
                     dangerouslySetInnerHTML={{ __html: highlightHtml(benefits, terms, ocrText, "#a5b4fc") }} />
                </div>
              )}
              {weaknesses && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest mb-1"
                     style={{ color: "rgba(255,255,255,0.55)", fontFamily: "'Barlow Condensed', sans-serif" }}>
                    Watch for
                  </p>
                  <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.72)" }}
                     dangerouslySetInnerHTML={{ __html: highlightHtml(weaknesses, terms, ocrText, "#fecaca") }} />
                </div>
              )}
              {antagonism && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest mb-1"
                     style={{ color: "rgba(255,255,255,0.55)", fontFamily: "'Barlow Condensed', sans-serif" }}>
                    Interactions
                  </p>
                  <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.72)" }}
                     dangerouslySetInnerHTML={{ __html: highlightHtml(antagonism, terms, ocrText, "#facc15") }} />
                </div>
              )}
              {source && (
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.38)" }}>
                  <span className="font-semibold">Source: </span>{source}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* WhatDoesThisMean — bottom disclosure, auto-expands on first visit           */
/* ─────────────────────────────────────────────────────────────────────────── */

function WhatDoesThisMean() {
  const isFirstVisit = !_legendSeen;
  const [expanded, setExpanded] = useState(isFirstVisit);

  // Mark as seen after a beat — next modal open starts collapsed
  useEffect(() => {
    if (!isFirstVisit) return;
    const t = setTimeout(() => { _legendSeen = true; }, 1500);
    return () => clearTimeout(t);
  }, [isFirstVisit]);

  return (
    <div>
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setExpanded(o => !o)}
        className="w-full flex items-center justify-between rounded-xl px-4 py-3 transition-all"
        style={{
          background:  expanded ? "rgba(91,158,201,0.07)" : "rgba(255,255,255,0.03)",
          border:      expanded ? "1px solid rgba(91,158,201,0.2)" : "1px solid rgba(255,255,255,0.07)",
          borderLeft:  expanded ? "3px solid rgba(91,158,201,0.55)" : "3px solid rgba(255,255,255,0.1)",
          cursor:      "pointer",
        }}
        onMouseEnter={e => { if (!expanded) { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; } }}
        onMouseLeave={e => { if (!expanded) { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; } }}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2.5">
          <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none"
               stroke={expanded ? "#5B9EC9" : "rgba(255,255,255,0.45)"} strokeWidth={2} aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" d="M12 8v4m0 4h.01" />
          </svg>
          <span
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: expanded ? "#5B9EC9" : "rgba(255,255,255,0.55)", fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            What do these categories mean?
          </span>
          {isFirstVisit && (
            <span
              className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(91,158,201,0.22)", color: "#5B9EC9", fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              New
            </span>
          )}
        </div>
        <div style={{ color: expanded ? "#5B9EC9" : "rgba(255,255,255,0.35)" }}>
          {expanded ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
        </div>
      </button>

      {/* Expanded legend */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="wtdtm-detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="pt-2 space-y-1.5 pb-1">
              {LEGEND.map((item, i) => (
                <motion.div
                  key={item.type}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18, delay: i * 0.05 }}
                  className="flex items-start gap-3 rounded-lg px-3 py-2.5"
                  style={{ background: item.bg, border: `1px solid ${item.dot}33` }}
                >
                  <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: item.dot }} aria-hidden="true" />
                  <div>
                    <p
                      className="text-xs font-bold mb-0.5"
                      style={{ color: item.text, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.02em" }}
                    >
                      {item.title}
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
                      {item.desc}
                    </p>
                  </div>
                </motion.div>
              ))}

              {/* Source credibility note */}
              <div
                className="rounded-lg px-3 py-2.5 flex items-start gap-2.5 mt-1"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 mt-0.5 shrink-0"
                     fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                </svg>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Classifications reflect{" "}
                  <span style={{ color: "rgba(255,255,255,0.78)" }}>NCAA Bylaw 31, the WADA Prohibited List, and USADA guidelines</span>.
                  CheckPeak is a first-pass educational tool — always confirm with qualified athletics staff before making any decisions.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* ModalContent — main export                                                   */
/* ─────────────────────────────────────────────────────────────────────────── */

export default function ModalContent({
  loadingOCR         = false,
  loadingRecords     = false,
  animDots           = "",
  ocrText            = "",
  matchedRecords     = [],
  matchedIngredients = [],
  error              = "",
  runOCR             = null,
  stackId            = null,
  scanComplete       = false,
  isScanning         = false,
  imageUrl           = "",
}) {
  const [showIngredients, setShowIngredients] = useState(false);
  const [showRawText,     setShowRawText]     = useState(false);

  // Sort banned by severity automatically
  const sortedBanned = [...matchedRecords]
    .map(r => ({ ...r, _norm: normalizeBanType(r.banType || r._raw?.["Ban Type"]) }))
    .sort((a, b) => (SEVERITY[a._norm] ?? 3) - (SEVERITY[b._norm] ?? 3));

  // Only show categories that are actually present in results
  const presentBanTypes = [...new Set(sortedBanned.map(r => r._norm))];

  const isActive   = isScanning || loadingOCR || loadingRecords;
  const flagged    = sortedBanned.length;
  const totalCount = matchedIngredients.length;

  /* ── Error ───────────────────────────────────────────────────────────── */
  if (error && !isActive) {
    return (
      <div className="space-y-3">
        {/* Keep thumbnail visible even on error */}
        <div className="flex items-stretch gap-3">
          <LabelThumbnail imageUrl={imageUrl} isScanning={false} scanComplete={false} flaggedCount={0} />
          <div
            className="flex-1 rounded-xl px-4 py-3.5 flex flex-col justify-center"
            style={{ background: "rgba(232,58,47,0.08)", border: "1px solid rgba(232,58,47,0.22)", color: "#f87171" }}
          >
            <p className="text-sm font-semibold mb-1">Scan failed</p>
            <p className="text-xs mb-2.5" style={{ color: "rgba(248,113,113,0.75)" }}>{error}</p>
            {typeof runOCR === "function" && (
              <button
                type="button"
                onClick={runOCR}
                className="self-start text-xs font-semibold rounded-full px-3 py-1 transition-all"
                style={{ background: "rgba(232,58,47,0.18)", border: "1px solid rgba(232,58,47,0.35)", color: "#fca5a5" }}
              >
                Retry scan
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────────────── */
  /* Main render — 6 clearly separated zones                                  */
  /* ─────────────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-4">

      {/* ══ Zone 1: Thumbnail + Result Banner ══════════════════════════════
          Side-by-side. Thumbnail shows the actual label (object-contain so
          nothing is cropped). Banner shows scan state / cleared / risk level.
          This is the first thing a user sees — answer comes before detail.
      ════════════════════════════════════════════════════════════════════ */}
      <div className="flex items-stretch gap-3">
        <LabelThumbnail
          imageUrl={imageUrl}
          isScanning={isActive}
          scanComplete={scanComplete}
          flaggedCount={flagged}
        />
        <ResultBanner
          flaggedCount={flagged}
          totalCount={totalCount}
          scanComplete={scanComplete}
          isScanning={isActive}
          animDots={animDots}
          presentBanTypes={presentBanTypes}
        />
      </div>

      {/* ══ Zone 2: Banned substance cards ═════════════════════════════════
          Only shown after scan completes. Auto-sorted by severity.
          Each card expandable — detail stays out of the way until needed.
      ════════════════════════════════════════════════════════════════════ */}
      {scanComplete && (
        <div>
          <div className="flex items-center justify-between mb-2.5 px-0.5">
            <p
              className="text-[11px] font-bold uppercase tracking-widest"
              style={{ color: "rgba(255,255,255,0.55)", fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              Banned / Monitored
            </p>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
              {flagged} {flagged === 1 ? "match" : "matches"}
            </span>
          </div>

          {flagged > 0 ? (
            <div className="space-y-2">
              {sortedBanned.map((rec, i) => (
                <BannedCard key={rec.id || rec.name || i} rec={rec} ocrText={ocrText} />
              ))}
            </div>
          ) : (
            <div
              className="rounded-xl px-4 py-3.5"
              style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.12)" }}
            >
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.52)" }}>
                This label returned no matches in our banned substances database.
                Still confirm with your athletics staff before use.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ══ Zone 3: Ingredients ════════════════════════════════════════════
          Collapsed by default — not every user needs this depth.
          Subtitle explains what "detected" actually means: a real database
          lookup, not just reading the label back at you.
      ════════════════════════════════════════════════════════════════════ */}
      {scanComplete && totalCount > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowIngredients(o => !o)}
            className="w-full flex items-center justify-between rounded-xl px-4 py-3.5 transition-all"
            style={{
              background: "rgba(255,255,255,0.06)",
              border:     "1px solid rgba(255,255,255,0.09)",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.09)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
          >
            <div className="flex flex-col items-start gap-0.5 min-w-0">
              <div className="flex items-center gap-2.5">
                <p
                  className="text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: "rgba(255,255,255,0.7)", fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  Ingredients detected
                </p>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
                >
                  {totalCount}
                </span>
              </div>
              <p className="text-xs leading-snug" style={{ color: "rgba(255,255,255,0.42)" }}>
                Matched against our pharmacology database — benefits, interactions &amp; sources
              </p>
            </div>
            <div className="shrink-0 ml-3" style={{ color: "rgba(255,255,255,0.45)" }}>
              {showIngredients ? <FaChevronUp size={11} /> : <FaChevronDown size={11} />}
            </div>
          </button>

          <AnimatePresence initial={false}>
            {showIngredients && (
              <motion.div
                key="ingredients"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                <div className="space-y-1.5 mt-2">
                  {matchedIngredients.map((ing, i) => (
                    <IngredientCard key={ing.id || ing.name || i} ing={ing} ocrText={ocrText} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ══ Zone 4: Compliance nudge ════════════════════════════════════════
          Only shown when something was flagged. Closes the loop — user knows
          what to do next. Stays out of the way when the label is clear.
      ════════════════════════════════════════════════════════════════════ */}
      {scanComplete && flagged > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="rounded-xl px-4 py-3 flex items-start gap-2.5"
          style={{ background: "rgba(232,58,47,0.05)", border: "1px solid rgba(232,58,47,0.16)" }}
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" stroke="#f87171" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
            This is a first-pass screening only. Always confirm flagged substances with your{" "}
            <span style={{ color: "rgba(255,255,255,0.9)" }}>athletics staff or compliance office</span>{" "}
            before use.
          </p>
        </motion.div>
      )}

      {/* ══ Zone 5: Raw scan text ═══════════════════════════════════════════
          Power-user / debug disclosure. Buried at the bottom, quiet styling.
          Highlighted matches visible for anyone who wants to verify.
      ════════════════════════════════════════════════════════════════════ */}
      {ocrText && (
        <div>
          <button
            type="button"
            onClick={() => setShowRawText(o => !o)}
            className="flex items-center gap-1.5 transition-all"
            style={{
              color:         "rgba(255,255,255,0.35)",
              fontFamily:    "'Barlow Condensed', sans-serif",
              fontSize:      11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              background:    "none",
              border:        "none",
              cursor:        "pointer",
              padding:       0,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "rgba(255,255,255,0.65)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}
          >
            {showRawText ? <FaChevronUp size={9} /> : <FaChevronDown size={9} />}
            {showRawText ? "Hide" : "View"} raw scan text
          </button>

          <AnimatePresence initial={false}>
            {showRawText && (
              <motion.div
                key="rawtext"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div
                  className="mt-2 rounded-xl p-3 text-xs whitespace-pre-wrap break-words max-h-48 overflow-y-auto"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border:     "1px solid rgba(255,255,255,0.08)",
                    color:      "rgba(255,255,255,0.62)",
                    lineHeight: 1.7,
                    fontFamily: "monospace",
                  }}
                >
                  {highlightNodes(ocrText, sortedBanned, matchedIngredients)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ══ Zone 6: What do these categories mean? ══════════════════════════
          Bottom disclosure. Auto-expands on a user's FIRST visit — explains
          the colour system and database sources before they leave.
          Collapses on every subsequent visit — stays out of the way.
      ════════════════════════════════════════════════════════════════════ */}
      {scanComplete && <WhatDoesThisMean />}

    </div>
  );
}