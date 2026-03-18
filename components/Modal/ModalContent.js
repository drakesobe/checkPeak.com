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
  if (s === "prohibited")                                   return "Prohibited";
  if (s.includes("out of competition") || s === "limited")  return "Limited";
  if (s.includes("particular sport"))                       return "Sport-Specific";
  return "Other";
};

const SEVERITY = { Prohibited: 0, Limited: 1, "Sport-Specific": 2, Other: 3 };

const BAN_STYLE = {
  Prohibited:       { border: "#E83A2F", pillBg: "rgba(232,58,47,0.28)",   pillText: "#fca5a5", label: "Prohibited"     },
  Limited:          { border: "#f77f00", pillBg: "rgba(247,127,0,0.28)",   pillText: "#fdba74", label: "Limited"        },
  "Sport-Specific": { border: "#5B9EC9", pillBg: "rgba(91,158,201,0.28)",  pillText: "#93c5fd", label: "Sport-Specific" },
  Other:            { border: "#6b7280", pillBg: "rgba(107,114,128,0.28)", pillText: "#e2e8f0", label: "Monitored"      },
};

// First-visit flag — resets on page reload
let _legendSeen = false;

const LEGEND = [
  {
    dot:   "#E83A2F", text: "#fca5a5", title: "Prohibited",
    desc:  "Banned in and out of competition by the NCAA, WADA, or USADA. A positive test risks disqualification regardless of intent.",
  },
  {
    dot:   "#f77f00", text: "#fdba74", title: "Limited",
    desc:  "Permitted out of competition only. Restricted or banned during the competitive season — timing and dosage rules apply.",
  },
  {
    dot:   "#5B9EC9", text: "#93c5fd", title: "Sport-Specific",
    desc:  "Banned in certain sports only. Rules vary by governing body — confirm with your specific sport's regulations.",
  },
  {
    dot:   "#9ca3af", text: "#e2e8f0", title: "Monitored",
    desc:  "Under active observation by anti-doping agencies. Not currently banned, but confirm with your athletics staff.",
  },
];

/* ─────────────────────────────────────────────────────────────────────────── */
/* HTML highlighter for card body text                                         */
/* ─────────────────────────────────────────────────────────────────────────── */

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
    } catch { /* ignore */ }
  });
  return out;
}

/* React-node highlighter for raw text view */
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

/* ─────────────────────────────────────────────────────────────────────────── */
/* VerdictBanner — the single clear answer at the top                          */
/* ─────────────────────────────────────────────────────────────────────────── */

function VerdictBanner({ flaggedCount, scanComplete, isScanning }) {

  if (isScanning) {
    return (
      <div
        className="rounded-xl px-5 py-4 flex items-center gap-4"
        style={{ background: "rgba(91,158,201,0.06)", border: "1px solid rgba(91,158,201,0.15)" }}
      >
        <div className="flex items-center gap-1.5 shrink-0">
          {[0, 120, 240].map(d => (
            <div
              key={d}
              className="w-1.5 h-1.5 rounded-full animate-bounce"
              style={{ backgroundColor: "rgba(91,158,201,0.7)", animationDelay: `${d}ms` }}
            />
          ))}
        </div>
        <div>
          <p
            className="text-sm font-bold text-white mb-0.5"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.04em" }}
          >
            Scanning label…
          </p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
            Checking against NCAA · WADA · USADA databases
          </p>
        </div>
      </div>
    );
  }

  if (!scanComplete) return null;

  if (flaggedCount === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-xl px-5 py-4"
        style={{
          background:  "rgba(34,197,94,0.07)",
          border:      "1px solid rgba(34,197,94,0.22)",
          boxShadow:   "0 0 20px rgba(34,197,94,0.08)",
        }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="relative shrink-0">
            <span className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ backgroundColor: "#22c55e" }} />
            <span className="relative w-3 h-3 rounded-full block" style={{ backgroundColor: "#22c55e" }} />
          </div>
          <p
            className="text-2xl font-black leading-none"
            style={{ color: "#22c55e", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.04em" }}
          >
            LABEL CLEARED
          </p>
        </div>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>
          No banned or monitored substances detected.
        </p>
        <div className="flex items-center gap-2 mt-2.5">
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "'Barlow Condensed', sans-serif" }}>
            Checked against:
          </span>
          {["NCAA", "WADA", "USADA"].map(db => (
            <span
              key={db}
              className="text-xs font-bold px-2 py-0.5 rounded"
              style={{ background: "rgba(34,197,94,0.18)", color: "#86efac", fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              {db}
            </span>
          ))}
        </div>
      </motion.div>
    );
  }

  const color  = flaggedCount === 1 ? "#f77f00" : "#E83A2F";
  const glow   = flaggedCount === 1 ? "rgba(247,127,0,0.08)" : "rgba(232,58,47,0.08)";
  const border = flaggedCount === 1 ? "rgba(247,127,0,0.22)" : "rgba(232,58,47,0.22)";
  const label  = flaggedCount === 1 ? "CAUTION" : "HIGH RISK";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl px-5 py-4"
      style={{ background: glow, border: `1px solid ${border}`, boxShadow: `0 0 20px ${glow}` }}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="relative shrink-0">
          <span className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ backgroundColor: color }} />
          <span className="relative w-3 h-3 rounded-full block" style={{ backgroundColor: color }} />
        </div>
        <p
          className="text-2xl font-black leading-none"
          style={{ color, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.04em" }}
        >
          {label}
        </p>
      </div>
      <p className="text-sm" style={{ color: "rgba(255,255,255,0.72)" }}>
        <span style={{ color: "rgba(255,255,255,0.95)", fontWeight: 700 }}>{flaggedCount}</span>{" "}
        {flaggedCount === 1 ? "substance" : "substances"} flagged —{" "}
        confirm with your athletics staff before use.
      </p>
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
  const synonyms     = rec.synonyms    || raw["Synonyms"]          || "";
  const bannedBy     = rec.bannedBy    || raw["Banned By"]          || "";
  const dosage       = rec.dosageLimit || raw["Dosage Limit"]       || "";
  const source       = rec.source      || raw["Source"]             || raw["Source / Citation"] || raw["Sources / References"] || "";
  const whatItDoes   = (rec.benefits   || raw["Benefits"] || rec.notes || raw["Notes"] || "").toString();
  const watchFor     = (rec.weaknesses || raw["Weaknesses"]         || "").toString();
  const interactions = (rec.antagonism || raw["Nutrient Antagonism"] || "").toString();

  const terms     = [name, ...String(synonyms).split(",").map(s => s.trim()).filter(Boolean)];
  const hasDetail = whatItDoes || watchFor || interactions || source;

  return (
    <motion.div
      layout="position"
      className="overflow-hidden rounded-xl"
      style={{
        background: "rgba(255,255,255,0.05)",
        border:     "1px solid rgba(255,255,255,0.08)",
        borderLeft: `3px solid ${style.border}`,
        cursor:     hasDetail ? "pointer" : "default",
      }}
      onClick={() => hasDetail && setOpen(o => !o)}
    >
      <div className="flex items-start justify-between gap-3 px-4 py-3.5">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-[11px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full"
              style={{ background: style.pillBg, color: style.pillText, fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              {style.label}
            </span>
            {bannedBy && (
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{bannedBy}</span>
            )}
            {dosage && (
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Limit: {dosage}</span>
            )}
          </div>
          <p className="text-base font-bold text-white leading-snug">{name}</p>
          {synonyms && (
            <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "rgba(255,255,255,0.55)" }}>
              {synonyms}
            </p>
          )}
        </div>
        {hasDetail && (
          <div className="shrink-0 mt-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
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
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div
              className="px-4 pb-4 pt-3 space-y-3"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
              onClick={e => e.stopPropagation()}
            >
              {whatItDoes && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest mb-1.5"
                     style={{ color: "rgba(255,255,255,0.5)", fontFamily: "'Barlow Condensed', sans-serif" }}>
                    What it does
                  </p>
                  <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}
                     dangerouslySetInnerHTML={{ __html: highlightHtml(whatItDoes, terms, ocrText, "#bfdbfe") }} />
                </div>
              )}
              {watchFor && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest mb-1.5"
                     style={{ color: "rgba(255,255,255,0.5)", fontFamily: "'Barlow Condensed', sans-serif" }}>
                    Watch for
                  </p>
                  <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}
                     dangerouslySetInnerHTML={{ __html: highlightHtml(watchFor, terms, ocrText, "#fecaca") }} />
                </div>
              )}
              {interactions && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest mb-1.5"
                     style={{ color: "rgba(255,255,255,0.5)", fontFamily: "'Barlow Condensed', sans-serif" }}>
                    Nutrient interactions
                  </p>
                  <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}
                     dangerouslySetInnerHTML={{ __html: highlightHtml(interactions, terms, ocrText, "#facc15") }} />
                </div>
              )}
              {source && (
                <p className="text-xs pt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
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
        background: "rgba(255,255,255,0.03)",
        border:     "1px solid rgba(255,255,255,0.06)",
        cursor:     hasDetail ? "pointer" : "default",
      }}
      onClick={() => hasDetail && setOpen(o => !o)}
    >
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
        <div className="min-w-0">
          <p className="text-[13px] font-medium truncate" style={{ color: "rgba(255,255,255,0.82)" }}>{name}</p>
          {synonyms && (
            <p className="text-xs truncate mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{synonyms}</p>
          )}
        </div>
        {hasDetail && (
          <div className="shrink-0" style={{ color: "rgba(255,255,255,0.35)" }}>
            {open ? <FaChevronUp size={9} /> : <FaChevronDown size={9} />}
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
              style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
              onClick={e => e.stopPropagation()}
            >
              {benefits && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest mb-1"
                     style={{ color: "rgba(255,255,255,0.5)", fontFamily: "'Barlow Condensed', sans-serif" }}>
                    What it does
                  </p>
                  <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}
                     dangerouslySetInnerHTML={{ __html: highlightHtml(benefits, terms, ocrText, "#a5b4fc") }} />
                </div>
              )}
              {weaknesses && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest mb-1"
                     style={{ color: "rgba(255,255,255,0.5)", fontFamily: "'Barlow Condensed', sans-serif" }}>
                    Watch for
                  </p>
                  <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}
                     dangerouslySetInnerHTML={{ __html: highlightHtml(weaknesses, terms, ocrText, "#fecaca") }} />
                </div>
              )}
              {antagonism && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest mb-1"
                     style={{ color: "rgba(255,255,255,0.5)", fontFamily: "'Barlow Condensed', sans-serif" }}>
                    Interactions
                  </p>
                  <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}
                     dangerouslySetInnerHTML={{ __html: highlightHtml(antagonism, terms, ocrText, "#facc15") }} />
                </div>
              )}
              {source && (
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
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
/* WhatDoesThisMean — bottom disclosure, auto-expands on first visit            */
/* ─────────────────────────────────────────────────────────────────────────── */

function WhatDoesThisMean() {
  const isFirstVisit = !_legendSeen;
  const [open, setOpen] = useState(isFirstVisit);

  useEffect(() => {
    if (!isFirstVisit) return;
    const t = setTimeout(() => { _legendSeen = true; }, 2000);
    return () => clearTimeout(t);
  }, [isFirstVisit]);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background:  "rgba(255,255,255,0.03)",
        border:      "1px solid rgba(255,255,255,0.07)",
        borderLeft:  open ? "3px solid rgba(91,158,201,0.5)" : "3px solid rgba(255,255,255,0.08)",
        transition:  "border-color 0.2s ease",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors"
        style={{ cursor: "pointer", background: "none", border: "none" }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
      >
        <div className="flex items-center gap-2.5">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="none"
               stroke={open ? "#5B9EC9" : "rgba(255,255,255,0.4)"} strokeWidth={2} aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" d="M12 8v4m0 4h.01" />
          </svg>
          <span
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: open ? "#5B9EC9" : "rgba(255,255,255,0.5)", fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            What do these categories mean?
          </span>
          {isFirstVisit && (
            <span
              className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
              style={{ background: "rgba(91,158,201,0.2)", color: "#5B9EC9", fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              Tap to learn
            </span>
          )}
        </div>
        <div style={{ color: open ? "#5B9EC9" : "rgba(255,255,255,0.3)" }}>
          {open ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div
              className="px-4 pt-1 pb-4 space-y-2"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
            >
              {LEGEND.map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15, delay: i * 0.04 }}
                  className="flex items-start gap-3 rounded-lg px-3 py-2.5"
                  style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${item.dot}22` }}
                >
                  <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: item.dot }} />
                  <div>
                    <p className="text-xs font-bold mb-0.5"
                       style={{ color: item.text, fontFamily: "'Barlow Condensed', sans-serif" }}>
                      {item.title}
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                      {item.desc}
                    </p>
                  </div>
                </motion.div>
              ))}

              <p className="text-xs leading-relaxed px-1 pt-1" style={{ color: "rgba(255,255,255,0.38)" }}>
                Based on{" "}
                <span style={{ color: "rgba(255,255,255,0.65)" }}>NCAA Bylaw 31, the WADA Prohibited List, and USADA guidelines</span>.
                {" "}This is a first-pass educational tool — always confirm with qualified athletics staff.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Main export                                                                  */
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
}) {
  const [showIngredients, setShowIngredients] = useState(false);
  const [showRawText,     setShowRawText]     = useState(false);

  const sortedBanned = [...matchedRecords]
    .map(r => ({ ...r, _norm: normalizeBanType(r.banType || r._raw?.["Ban Type"]) }))
    .sort((a, b) => (SEVERITY[a._norm] ?? 3) - (SEVERITY[b._norm] ?? 3));

  const isActive = isScanning || loadingOCR || loadingRecords;

  /* ── Error ───────────────────────────────────────────────────────────── */
  if (error && !isActive) {
    return (
      <div
        className="rounded-xl px-4 py-3.5"
        style={{ background: "rgba(232,58,47,0.07)", border: "1px solid rgba(232,58,47,0.2)" }}
      >
        <p className="text-sm font-semibold text-white mb-1">Scan failed</p>
        <p className="text-xs mb-3" style={{ color: "rgba(248,113,113,0.8)" }}>{error}</p>
        {typeof runOCR === "function" && (
          <button
            type="button" onClick={runOCR}
            className="text-xs font-semibold rounded-full px-3 py-1.5 transition-all"
            style={{ background: "rgba(232,58,47,0.18)", border: "1px solid rgba(232,58,47,0.3)", color: "#fca5a5" }}
          >
            Retry scan
          </button>
        )}
      </div>
    );
  }

  /* ── Main render ─────────────────────────────────────────────────────── */
  return (
    <div className="space-y-3">

      {/* 1 ── Verdict — one clear answer, always first ─────────────────── */}
      <VerdictBanner
        flaggedCount={sortedBanned.length}
        scanComplete={scanComplete}
        isScanning={isActive}
      />

      {/* 2 ── Flagged substances ────────────────────────────────────────── */}
      {scanComplete && sortedBanned.length > 0 && (
        <div className="space-y-2">
          <p
            className="text-[11px] font-bold uppercase tracking-widest px-0.5"
            style={{ color: "rgba(255,255,255,0.45)", fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            {sortedBanned.length} {sortedBanned.length === 1 ? "substance" : "substances"} flagged — tap to expand
          </p>
          {sortedBanned.map((rec, i) => (
            <BannedCard key={rec.id || rec.name || i} rec={rec} ocrText={ocrText} />
          ))}
        </div>
      )}

      {/* 3 ── Ingredients — collapsed, explained ────────────────────────── */}
      {scanComplete && matchedIngredients.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowIngredients(o => !o)}
            className="w-full flex items-center justify-between rounded-xl px-4 py-3.5 transition-all"
            style={{
              background: "rgba(255,255,255,0.05)",
              border:     "1px solid rgba(255,255,255,0.08)",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
          >
            <div className="flex flex-col items-start gap-0.5">
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: "rgba(255,255,255,0.65)", fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  Ingredients detected
                </span>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.65)" }}
                >
                  {matchedIngredients.length}
                </span>
              </div>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.38)" }}>
                Matched against our pharmacology database
              </span>
            </div>
            <div style={{ color: "rgba(255,255,255,0.4)" }}>
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
                transition={{ duration: 0.2 }}
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

      {/* 4 ── What do these categories mean? ────────────────────────────── */}
      {scanComplete && <WhatDoesThisMean />}

      {/* 5 ── Raw scan text — debug, very quiet ─────────────────────────── */}
      {ocrText && (
        <div>
          <button
            type="button"
            onClick={() => setShowRawText(o => !o)}
            className="flex items-center gap-1.5"
            style={{
              color:         "rgba(255,255,255,0.3)",
              fontFamily:    "'Barlow Condensed', sans-serif",
              fontSize:      10,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              background:    "none",
              border:        "none",
              cursor:        "pointer",
              padding:       0,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.3)"; }}
          >
            {showRawText ? <FaChevronUp size={8} /> : <FaChevronDown size={8} />}
            {showRawText ? "Hide" : "View"} raw scan text
          </button>

          <AnimatePresence initial={false}>
            {showRawText && (
              <motion.div
                key="rawtext"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div
                  className="mt-2 rounded-xl p-3 text-xs whitespace-pre-wrap break-words max-h-48 overflow-y-auto"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border:     "1px solid rgba(255,255,255,0.07)",
                    color:      "rgba(255,255,255,0.55)",
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

    </div>
  );
}