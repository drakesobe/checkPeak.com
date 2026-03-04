// components/ResultsTable-smartstack.js
"use client";

import React, {
  useMemo,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * ResultsTableSmartstack
 *
 * Props:
 *  - matchedRecords: array of Airtable-like records for banned substances
 *      Each record: { id, fields: { "Substance Name", "Synonyms", "Banned By",
 *        "Ban Type", "Dosage Limit", "Notes", "Source / Citation",
 *        "Benefits", "Weaknesses", "Nutrient Antagonism" } }
 *      or a flattened object with similar keys.
 *
 *  - matchedIngredients: array of Airtable-like records for detected ingredients
 *      Each record: { id, fields: { "Name"|"Ingredient Name",
 *        "Synonyms (Extended)", "PubChem CID", "Pharmacology Notes",
 *        "Sources / References" } }
 *      or a flattened object with similar keys.
 *
 * Behaviour:
 *  - Summary banner: animated risk level + flagged vs total counts
 *  - Banned substances as animated accordion cards with filter pills
 *    that show per-type counts and only appear when relevant
 *  - Ingredients as a compact expandable list, clearly secondary
 *  - All logic retained from previous version; only presentation changed
 *  - Does not fetch any data; expects parent to supply arrays
 */

/* -------------------------------------------------------------------------- */
/* Static data                                                                 */
/* -------------------------------------------------------------------------- */

const BAN_TYPES = [
  {
    label:  "Prohibited",
    color:  "#E83A2F",
    bg:     "rgba(232,58,47,0.12)",
    border: "rgba(232,58,47,0.3)",
  },
  {
    label:  "Limited to Out of Competition",
    color:  "#f77f00",
    bg:     "rgba(247,127,0,0.12)",
    border: "rgba(247,127,0,0.3)",
  },
  {
    label:  "Particular Sports",
    color:  "#3fb0ac",
    bg:     "rgba(63,176,172,0.12)",
    border: "rgba(63,176,172,0.3)",
  },
];

// Keyed for O(1) lookups
const BAN_TYPE_MAP = Object.fromEntries(BAN_TYPES.map((b) => [b.label, b]));

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function safeField(rec, ...keys) {
  if (!rec) return "";
  const source = rec.fields ?? rec;
  for (const k of keys) {
    const v = source[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return "";
}

function cell(v) {
  if (v === undefined || v === null) return "—";
  if (typeof v === "string" && v.trim() === "") return "—";
  return v;
}

function getRiskLevel(flaggedCount) {
  if (flaggedCount === 0) return {
    label: "Clear",
    color: "#22c55e",
    bg:    "rgba(34,197,94,0.08)",
    border:"rgba(34,197,94,0.2)",
  };
  if (flaggedCount === 1) return {
    label: "Caution",
    color: "#f77f00",
    bg:    "rgba(247,127,0,0.08)",
    border:"rgba(247,127,0,0.2)",
  };
  return {
    label: "High Risk",
    color: "#E83A2F",
    bg:    "rgba(232,58,47,0.08)",
    border:"rgba(232,58,47,0.2)",
  };
}

/* -------------------------------------------------------------------------- */
/* useScrollShadows                                                            */
/* -------------------------------------------------------------------------- */
function useScrollShadows(ref, deps = []) {
  const [showLeft,    setShowLeft]    = useState(false);
  const [showRight,   setShowRight]   = useState(false);
  const [showHint,    setShowHint]    = useState(false);
  const [hintVisible, setHintVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const check = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setShowLeft(scrollLeft > 0);
      setShowRight(scrollLeft < scrollWidth - clientWidth - 1);
      if (scrollWidth > clientWidth) {
        setShowHint(true);
        setHintVisible(true);
      } else {
        setShowHint(false);
        setHintVisible(false);
      }
    };

    check();

    const onScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setShowLeft(scrollLeft > 0);
      setShowRight(scrollLeft < scrollWidth - clientWidth - 1);
      if (scrollLeft > 5) {
        setShowHint(false);
        setHintVisible(false);
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);

    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (!showHint) return;
    const t1 = setTimeout(() => setHintVisible(false), 2500);
    const t2 = setTimeout(() => setShowHint(false),    3000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [showHint]);

  return { showLeft, showRight, showHint, hintVisible };
}

/* -------------------------------------------------------------------------- */
/* BanTypeBadge                                                                */
/* -------------------------------------------------------------------------- */
function BanTypeBadge({ banType, size = "md" }) {
  const config      = BAN_TYPE_MAP[banType];
  const accentColor = config?.color ?? "#888";
  const sizeClass   = size === "sm"
    ? "px-2 py-0.5 text-[10px]"
    : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold text-white ${sizeClass}`}
      style={{
        backgroundColor: accentColor,
        boxShadow: `0 0 0 1px rgba(255,255,255,0.1) inset, 0 2px 8px ${accentColor}40`,
      }}
    >
      <span
        aria-hidden="true"
        className="w-1.5 h-1.5 rounded-full bg-white/60 inline-block shrink-0"
      />
      {banType || "Unknown"}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* DetailField / ExtendedField — reusable label+value pairs                   */
/* -------------------------------------------------------------------------- */
function DetailField({ label, value, wide = false }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <p className="text-[10px] font-semibold text-white/35 uppercase tracking-widest mb-0.5">
        {label}
      </p>
      <p className="text-sm text-white/75 leading-relaxed">{cell(value)}</p>
    </div>
  );
}

function ExtendedField({ label, value, color }) {
  return (
    <div>
      <p
        className="text-[10px] font-bold uppercase tracking-widest mb-1"
        style={{ color }}
      >
        {label}
      </p>
      <p className="text-xs text-white/65 leading-relaxed">{cell(value)}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SummaryBanner                                                               */
/* -------------------------------------------------------------------------- */
function SummaryBanner({ flaggedCount, totalCount }) {
  const risk = getRiskLevel(flaggedCount);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="rounded-2xl border p-5"
      style={{ background: risk.bg, borderColor: risk.border }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">

        {/* Risk level + pulse indicator */}
        <div className="flex items-center gap-3 flex-1">
          <div className="relative shrink-0" aria-hidden="true">
            <span
              className="absolute inset-0 rounded-full animate-ping opacity-25"
              style={{ backgroundColor: risk.color }}
            />
            <span
              className="relative w-4 h-4 rounded-full block"
              style={{ backgroundColor: risk.color }}
            />
          </div>
          <div>
            <p
              className="text-2xl font-black tracking-tight leading-none"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: risk.color,
              }}
            >
              {risk.label.toUpperCase()}
            </p>
            <p className="text-[10px] text-white/40 mt-0.5 tracking-widest uppercase">
              Scan result
            </p>
          </div>
        </div>

        {/* Stat counters */}
        <div className="flex items-center gap-6 sm:gap-8">
          <div className="text-center">
            <p
              className="text-3xl font-black leading-none"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                color: flaggedCount > 0 ? risk.color : "rgba(255,255,255,0.85)",
              }}
            >
              {flaggedCount}
            </p>
            <p className="text-[10px] text-white/35 uppercase tracking-widest mt-0.5">
              Flagged
            </p>
          </div>

          <div
            aria-hidden="true"
            className="w-px h-8 bg-white/10"
          />

          <div className="text-center">
            <p
              className="text-3xl font-black text-white/75 leading-none"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              {totalCount}
            </p>
            <p className="text-[10px] text-white/35 uppercase tracking-widest mt-0.5">
              Ingredients
            </p>
          </div>
        </div>

        {/* Verification reminder */}
        <p className="text-[10px] text-white/25 leading-relaxed sm:max-w-[180px] sm:text-right">
          Always verify with your governing body or certified professional before use.
        </p>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* BannedSubstanceCard                                                         */
/* -------------------------------------------------------------------------- */
function BannedSubstanceCard({ rec, index }) {
  const [open, setOpen] = useState(false);

  const id         = rec.id ?? index;
  const name       = safeField(rec, "Substance Name", "Name")      || "Unknown Substance";
  const synonyms   = safeField(rec, "Synonyms")                    || null;
  const bannedBy   = safeField(rec, "Banned By")                   || null;
  const banType    = safeField(rec, "Ban Type")                    || "";
  const dosage     = safeField(rec, "Dosage Limit")                || null;
  const notes      = safeField(rec, "Notes")                       || null;
  const source     = safeField(rec, "Source / Citation", "Source") || null;
  const benefits   = safeField(rec, "Benefits")                    || null;
  const weaknesses = safeField(rec, "Weaknesses")                  || null;
  const antagonism = safeField(rec, "Nutrient Antagonism")         || null;

  const hasDetails   = !!(synonyms || bannedBy || dosage || notes || source);
  const hasExtended  = !!(benefits || weaknesses || antagonism);
  const isExpandable = hasDetails || hasExtended;

  const config      = BAN_TYPE_MAP[banType];
  const accentColor = config?.color ?? "#888";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: "easeOut" }}
      className="rounded-xl border overflow-hidden"
      style={{
        background:   config?.bg     ?? "rgba(255,255,255,0.04)",
        borderColor:  config?.border ?? "rgba(255,255,255,0.1)",
      }}
    >
      {/* Card header */}
      <button
        type="button"
        onClick={() => isExpandable && setOpen((v) => !v)}
        className={[
          "w-full text-left px-4 py-3.5 flex items-start gap-3 transition-colors",
          isExpandable
            ? "cursor-pointer hover:bg-white/[0.04]"
            : "cursor-default",
        ].join(" ")}
        aria-expanded={isExpandable ? open : undefined}
        aria-controls={isExpandable ? `banned-detail-${id}` : undefined}
      >
        {/* Left colour bar */}
        <div
          aria-hidden="true"
          className="w-1 self-stretch rounded-full shrink-0 mt-0.5"
          style={{ backgroundColor: accentColor, opacity: 0.75 }}
        />

        {/* Name + badge */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span
              className="text-base font-bold text-white leading-snug"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                letterSpacing: "0.02em",
              }}
            >
              {name}
            </span>
            {banType && <BanTypeBadge banType={banType} size="sm" />}
          </div>

          {bannedBy && (
            <p className="text-[11px] text-white/40 leading-relaxed">
              Banned by:{" "}
              <span className="text-white/60">{bannedBy}</span>
            </p>
          )}
        </div>

        {/* Animated expand chevron */}
        {isExpandable && (
          <motion.span
            aria-hidden="true"
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-white/25 text-[10px] shrink-0 mt-1 select-none"
          >
            ▼
          </motion.span>
        )}
      </button>

      {/* Expandable detail panel */}
      <AnimatePresence initial={false}>
        {open && isExpandable && (
          <motion.div
            id={`banned-detail-${id}`}
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div
              className="px-5 pb-4 pt-2 border-t space-y-4"
              style={{ borderColor: "rgba(255,255,255,0.06)" }}
            >
              {/* Core detail fields */}
              {(synonyms || dosage || notes || source) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                  {synonyms && <DetailField label="Synonyms"          value={synonyms} />}
                  {dosage   && <DetailField label="Dosage Limit"       value={dosage}   />}
                  {notes    && <DetailField label="Notes"              value={notes}    wide />}
                  {source   && <DetailField label="Source / Citation"  value={source}   wide />}
                </div>
              )}

              {/* Extended research fields */}
              {hasExtended && (
                <div
                  className="rounded-xl p-3 grid grid-cols-1 sm:grid-cols-3 gap-4"
                  style={{
                    background:   "rgba(255,255,255,0.03)",
                    border:       "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  {benefits   && (
                    <ExtendedField label="Benefits"            value={benefits}   color="#22c55e" />
                  )}
                  {weaknesses && (
                    <ExtendedField label="Weaknesses"          value={weaknesses} color="#f77f00" />
                  )}
                  {antagonism && (
                    <ExtendedField label="Nutrient Antagonism" value={antagonism} color="#818cf8" />
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* IngredientRow                                                               */
/* -------------------------------------------------------------------------- */
function IngredientRow({ rec, index, showPubchem }) {
  const [open, setOpen] = useState(false);

  const id          = rec.id ?? index;
  const displayName = safeField(rec, "Name", "Ingredient Name", "Ingredient", "name") || "Unknown";
  const syn         = safeField(rec, "Synonyms (Extended)", "Synonyms")               || null;
  const pub         = safeField(rec, "PubChem CID")                                   || null;
  const pharm       = safeField(rec, "Pharmacology Notes", "Notes")                   || null;
  const src         = safeField(
    rec,
    "Sources / References",
    "Source / References",
    "Source",
    "Source / Citation"
  ) || null;

  const hasDetails = !!(syn || pub || pharm || src);

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22, delay: index * 0.025 }}
      className="rounded-xl border border-white/[0.06] overflow-hidden"
      style={{ background: "rgba(255,255,255,0.025)" }}
    >
      <button
        type="button"
        onClick={() => hasDetails && setOpen((v) => !v)}
        className={[
          "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
          hasDetails
            ? "cursor-pointer hover:bg-white/[0.04]"
            : "cursor-default",
        ].join(" ")}
        aria-expanded={hasDetails ? open : undefined}
        aria-controls={hasDetails ? `ing-detail-${id}` : undefined}
      >
        {/* Row index */}
        <span
          className="text-[11px] font-bold text-white/20 shrink-0 w-5 text-right tabular-nums"
          style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          aria-hidden="true"
        >
          {index + 1}
        </span>

        {/* Ingredient name */}
        <span className="flex-1 text-sm font-semibold text-white/80 leading-snug">
          {displayName}
        </span>

        {/* PubChem CID — compact, secondary */}
        {showPubchem && pub && (
          <span className="text-[10px] text-white/25 font-mono shrink-0 hidden sm:block">
            CID {pub}
          </span>
        )}

        {/* Expand indicator */}
        {hasDetails && (
          <motion.span
            aria-hidden="true"
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-white/20 text-[10px] shrink-0 select-none"
          >
            ▼
          </motion.span>
        )}
      </button>

      {/* Ingredient detail panel */}
      <AnimatePresence initial={false}>
        {open && hasDetails && (
          <motion.div
            id={`ing-detail-${id}`}
            key="ing-detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div
              className="px-5 pb-4 pt-2 border-t grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3"
              style={{ borderColor: "rgba(255,255,255,0.05)" }}
            >
              {syn   && <DetailField label="Synonyms"             value={syn}   />}
              {pub   && <DetailField label="PubChem CID"          value={pub}   />}
              {pharm && <DetailField label="Pharmacology / Notes" value={pharm} wide />}
              {src   && <DetailField label="Source / References"  value={src}   wide />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main component                                                              */
/* -------------------------------------------------------------------------- */
export default function ResultsTableSmartstack({
  matchedRecords     = [],
  matchedIngredients = [],
}) {
  const [activeBanType, setActiveBanType] = useState(null);

  /* ── Derived data ─────────────────────────────────────────────────────── */

  const filteredBanned = useMemo(() => {
    if (!activeBanType) return matchedRecords;
    return matchedRecords.filter(
      (r) => (safeField(r, "Ban Type") || "").toString() === activeBanType
    );
  }, [matchedRecords, activeBanType]);

  // Per-type counts for filter pill badges — only computed when matchedRecords changes
  const banTypeCounts = useMemo(
    () =>
      Object.fromEntries(
        BAN_TYPES.map((b) => [
          b.label,
          matchedRecords.filter((r) => safeField(r, "Ban Type") === b.label).length,
        ])
      ),
    [matchedRecords]
  );

  const anyIngredientHasPubchem = useMemo(
    () => matchedIngredients.some((r) => !!safeField(r, "PubChem CID")),
    [matchedIngredients]
  );

  const toggleBanType = useCallback(
    (label) => setActiveBanType((prev) => (prev === label ? null : label)),
    []
  );

  /* ------------------------------------------------------------------------ */
  /* Render                                                                    */
  /* ------------------------------------------------------------------------ */
  return (
    <div
      className="w-full space-y-8"
      style={{ fontFamily: "'Barlow', sans-serif" }}
    >
      {/* ── Summary banner ── */}
      <SummaryBanner
        flaggedCount={matchedRecords.length}
        totalCount={matchedIngredients.length}
      />

      {/* ================================================================
          FLAGGED SUBSTANCES
      ================================================================ */}
      <section aria-labelledby="flagged-heading">

        {/* Section header + filter pills */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <p
              className="text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-0.5"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              Flagged Substances
            </p>
            <h2
              id="flagged-heading"
              className="text-lg font-bold text-white"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                letterSpacing: "0.02em",
              }}
            >
              {matchedRecords.length === 0
                ? "No substances flagged"
                : `${filteredBanned.length} of ${matchedRecords.length} substance${matchedRecords.length > 1 ? "s" : ""} shown`}
            </h2>
          </div>

          {/* Ban type filter pills — only rendered when there are flagged results */}
          {matchedRecords.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {BAN_TYPES.map((b) => {
                const count  = banTypeCounts[b.label] ?? 0;
                const active = activeBanType === b.label;
                if (count === 0) return null;

                return (
                  <button
                    key={b.label}
                    type="button"
                    onClick={() => toggleBanType(b.label)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                    style={{
                      background:  active ? b.bg     : "rgba(255,255,255,0.04)",
                      borderColor: active ? b.border : "rgba(255,255,255,0.08)",
                      color:       active ? b.color  : "rgba(255,255,255,0.45)",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: b.color }}
                    />
                    {b.label}
                    {/* Count badge */}
                    <span
                      className="ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                      style={{
                        background: active ? b.color              : "rgba(255,255,255,0.08)",
                        color:      active ? "#fff"               : "rgba(255,255,255,0.35)",
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}

              {activeBanType && (
                <button
                  type="button"
                  onClick={() => setActiveBanType(null)}
                  className="text-xs text-white/35 hover:text-white/65 underline underline-offset-2 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* Cards or empty state */}
        {filteredBanned.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-10 text-center">
            <p className="text-3xl mb-2" aria-hidden="true">✓</p>
            <p className="text-sm font-semibold text-white/55">
              {activeBanType
                ? `No substances flagged under "${activeBanType}"`
                : "No banned or high-risk substances detected"}
            </p>
            {activeBanType && (
              <button
                type="button"
                onClick={() => setActiveBanType(null)}
                className="mt-3 text-xs text-white/35 hover:text-white/65 underline underline-offset-2 transition-colors"
              >
                Show all results
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {filteredBanned.map((rec, i) => (
                <BannedSubstanceCard
                  key={rec.id ?? i}
                  rec={rec}
                  index={i}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* ================================================================
          INGREDIENTS DETECTED — informational, secondary section
      ================================================================ */}
      {matchedIngredients.length > 0 && (
        <section aria-labelledby="ingredients-heading">

          {/* Section header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p
                className="text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-0.5"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                Scan Results
              </p>
              <h2
                id="ingredients-heading"
                className="text-lg font-bold text-white"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  letterSpacing: "0.02em",
                }}
              >
                {matchedIngredients.length} ingredient
                {matchedIngredients.length > 1 ? "s" : ""} detected
              </h2>
            </div>

            {/* "Informational" label — communicates intent clearly */}
            <span
              className="text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full border shrink-0"
              style={{
                color:       "rgba(255,255,255,0.25)",
                borderColor: "rgba(255,255,255,0.07)",
                background:  "rgba(255,255,255,0.03)",
              }}
            >
              Informational
            </span>
          </div>

          {/* Ingredient rows */}
          <div className="space-y-1.5">
            {matchedIngredients.map((rec, i) => (
              <IngredientRow
                key={rec.id ?? i}
                rec={rec}
                index={i}
                showPubchem={anyIngredientHasPubchem}
              />
            ))}
          </div>

          {/* Footer disclaimer */}
          <p className="mt-4 text-[10px] text-white/20 leading-relaxed">
            Ingredient data is provided for informational purposes only. Presence in this
            list does not indicate a substance is banned. Always consult your governing
            body, certified athletic trainer, or medical professional before consuming
            any supplement.
          </p>

        </section>
      )}
    </div>
  );
}