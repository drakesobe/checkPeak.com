"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";

/* ── Helpers ──────────────────────────────────────────────────────────────── */

const escapeRegex = (s = "") => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const escapeHtml  = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

const normalizeBanType = (val) => {
  if (!val) return "Other";
  const s = String(val).trim().toLowerCase();
  if (s === "prohibited") return "Prohibited";
  if (s.includes("out of competition") || s === "limited") return "Limited";
  if (s.includes("particular sport")) return "Sport-Specific";
  return "Other";
};

const SEVERITY = { Prohibited: 0, Limited: 1, "Sport-Specific": 2, Other: 3 };

const BAN_STYLE = {
  Prohibited:       { border: "#E83A2F", pillBg: "rgba(232,58,47,0.32)",   pillText: "#fca5a5", label: "Prohibited"     },
  Limited:          { border: "#f77f00", pillBg: "rgba(247,127,0,0.32)",   pillText: "#fdba74", label: "Limited"        },
  "Sport-Specific": { border: "#5B9EC9", pillBg: "rgba(91,158,201,0.32)",  pillText: "#93c5fd", label: "Sport-Specific" },
  Other:            { border: "#6b7280", pillBg: "rgba(107,114,128,0.32)", pillText: "#e2e8f0", label: "Monitored"      },
};

/* ── React-node highlighter for raw text view ─────────────────────────────── */

function highlightNodes(text = "", bannedList = [], ingList = []) {
  if (!text) return null;
  const terms = [];
  const push = (name, syns, cls) => {
    if (name) terms.push({ term: name, cls });
    String(syns || "").split(",").map(s => s.trim()).filter(Boolean)
      .forEach(s => terms.push({ term: s, cls }));
  };
  bannedList.forEach(r => {
    const bt = normalizeBanType(r.banType || r._raw?.["Ban Type"]);
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

/* ── HTML highlighter for card body text ─────────────────────────────────── */

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
    } catch { /* ignore malformed */ }
  });
  return out;
}

/* ── BannedCard ───────────────────────────────────────────────────────────── */

function BannedCard({ rec, ocrText }) {
  const [open, setOpen] = useState(false);

  const banType  = normalizeBanType(rec.banType || rec._raw?.["Ban Type"]);
  const style    = BAN_STYLE[banType] || BAN_STYLE.Other;
  const raw      = rec._raw || {};

  const name        = rec.name       || "Unnamed substance";
  const synonyms    = rec.synonyms   || raw["Synonyms"]       || "";
  const bannedBy    = rec.bannedBy   || raw["Banned By"]       || "";
  const dosage      = rec.dosageLimit || raw["Dosage Limit"]   || "";
  const source      = rec.source     || raw["Source"]          || raw["Source / Citation"] || raw["Sources / References"] || "";
  const whatItDoes  = (rec.benefits  || raw["Benefits"] || rec.notes || raw["Notes"] || "").toString();
  const watchFor    = (rec.weaknesses || raw["Weaknesses"] || "").toString();
  const interactions = (rec.antagonism || raw["Nutrient Antagonism"] || "").toString();

  const terms = [name, ...String(synonyms).split(",").map(s => s.trim()).filter(Boolean)];
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
      {/* ── Card header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 px-4 py-3.5">
        <div className="flex-1 min-w-0 space-y-1.5">

          {/* Meta row: pill + banned-by + dosage */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-[11px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full"
              style={{ background: style.pillBg, color: style.pillText, fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              {style.label}
            </span>
            {bannedBy && (
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
                {bannedBy}
              </span>
            )}
            {dosage && (
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
                Limit: {dosage}
              </span>
            )}
          </div>

          {/* Substance name */}
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

      {/* ── Expanded detail ─────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="detail"
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

/* ── IngredientCard ───────────────────────────────────────────────────────── */

function IngredientCard({ ing, ocrText }) {
  const [open, setOpen] = useState(false);

  const raw         = ing._raw || {};
  const name        = ing.name        || raw["Ingredient Name"] || "Unnamed ingredient";
  const synonyms    = ing.synonyms    || raw["Synonyms (Extended)"] || raw["Synonyms"] || "";
  const benefits    = (ing.benefits   || raw["Benefits"]           || "").toString();
  const weaknesses  = (ing.weaknesses || raw["Weaknesses"]         || "").toString();
  const antagonism  = (ing.antagonism || raw["Nutrient Antagonism"] || "").toString();
  const source      = (ing.source     || raw["Sources / References"] || raw["Source"] || "").toString();
  const hasDetail   = benefits || weaknesses || antagonism || source;

  const terms = [name, ...String(synonyms).split(",").map(s => s.trim()).filter(Boolean)];

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

/* ── Loading dots ─────────────────────────────────────────────────────────── */

function LoadingDots({ label }) {
  return (
    <div className="py-8 text-center space-y-3">
      <div className="flex items-center justify-center gap-1.5">
        {[0, 150, 300].map(delay => (
          <div
            key={delay}
            className="w-1.5 h-1.5 rounded-full animate-bounce"
            style={{ backgroundColor: "rgba(91,158,201,0.6)", animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
      <p
        className="text-[11px] uppercase tracking-widest"
        style={{ color: "rgba(255,255,255,0.55)", fontFamily: "'Barlow Condensed', sans-serif" }}
      >
        {label}
      </p>
    </div>
  );
}

/* ── Main export ──────────────────────────────────────────────────────────── */

export default function ModalContent({
  loadingOCR       = false,
  loadingRecords   = false,
  animDots         = "",
  ocrText          = "",
  matchedRecords   = [],
  matchedIngredients = [],
  error            = "",
  runOCR           = null,
  stackId          = null,
  // activeTab kept for backward compat — content is self-contained
}) {
  const [showIngredients, setShowIngredients] = useState(false);
  const [showRawText,     setShowRawText]     = useState(false);

  /* Sort banned by severity automatically — no filter bar needed */
  const sortedBanned = [...matchedRecords]
    .map(r => ({ ...r, _norm: normalizeBanType(r.banType || r._raw?.["Ban Type"]) }))
    .sort((a, b) => (SEVERITY[a._norm] ?? 3) - (SEVERITY[b._norm] ?? 3));

  /* ── Loading ─────────────────────────────────────────────────────────── */
  if (loadingOCR || loadingRecords) {
    const label = loadingOCR
      ? `Reading label${animDots}`
      : `Matching ingredients${animDots}`;
    return <LoadingDots label={label} />;
  }

  /* ── Error ───────────────────────────────────────────────────────────── */
  if (error) {
    return (
      <div className="rounded-xl px-4 py-3 text-sm"
           style={{ background: "rgba(232,58,47,0.08)", border: "1px solid rgba(232,58,47,0.2)", color: "#f87171" }}>
        <p className="mb-2">{error}</p>
        {typeof runOCR === "function" && (
          <button
            type="button"
            onClick={runOCR}
            className="text-xs underline opacity-60 hover:opacity-100 transition-opacity"
          >
            Retry scan
          </button>
        )}
      </div>
    );
  }

  /* ── Main content ────────────────────────────────────────────────────── */
  return (
    <div className="space-y-4">

      {/* ── Banned / monitored section ──────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2.5 px-0.5">
          <p
            className="text-[11px] font-bold uppercase tracking-widest"
            style={{ color: "rgba(255,255,255,0.55)", fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            Banned / Monitored
          </p>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
            {sortedBanned.length} {sortedBanned.length === 1 ? "match" : "matches"}
          </span>
        </div>

        {sortedBanned.length > 0 ? (
          <div className="space-y-2">
            {sortedBanned.map((rec, i) => (
              <BannedCard key={rec.id || rec.name || i} rec={rec} ocrText={ocrText} />
            ))}
          </div>
        ) : (
          <div
            className="rounded-xl px-4 py-4 text-center"
            style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.12)" }}
          >
            <p
              className="text-sm font-bold uppercase tracking-wide"
              style={{ color: "#4ade80", fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              No banned substances detected
            </p>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
              Always confirm with your athletics staff before use.
            </p>
          </div>
        )}
      </div>

      {/* ── Ingredients section — collapsed by default ──────────────────── */}
      {matchedIngredients.length > 0 && (
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
            <div className="flex items-center gap-2.5">
              <p
                className="text-[11px] font-bold uppercase tracking-widest"
                style={{ color: "rgba(255,255,255,0.6)", fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                Ingredients detected
              </p>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
              >
                {matchedIngredients.length}
              </span>
            </div>
            <div style={{ color: "rgba(255,255,255,0.45)" }}>
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

      {/* ── Compliance nudge — only shown when something was flagged ──────── */}
      {sortedBanned.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="rounded-xl px-4 py-3 flex items-start gap-2.5"
          style={{ background: "rgba(232,58,47,0.05)", border: "1px solid rgba(232,58,47,0.12)" }}
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" stroke="#f87171" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.62)" }}>
            This is a first-pass screening only. Always confirm flagged substances with your{" "}
            <span style={{ color: "rgba(255,255,255,0.85)" }}>athletics staff or compliance office</span>{" "}
            before use.
          </p>
        </motion.div>
      )}

      {/* ── Raw scan text — debug disclosure at bottom ────────────────────── */}
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
                    background:  "rgba(255,255,255,0.04)",
                    border:      "1px solid rgba(255,255,255,0.08)",
                    color:       "rgba(255,255,255,0.62)",
                    lineHeight:  1.7,
                    fontFamily:  "monospace",
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