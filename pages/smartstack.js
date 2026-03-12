// pages/smartstack.js
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuthContext } from "../hooks/useAuth";
import useMediaQuery from "../hooks/useMediaQuery";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaDumbbell,
  FaBolt,
  FaLeaf,
  FaCoffee,
  FaAppleAlt,
  FaCapsules,
  FaStar,
  FaRegStar,
  FaTimes,
  FaFilter,
  FaChevronDown,
} from "react-icons/fa";
import StackCard from "../components/smartstack-cards/StackCard";
import NutritionModal from "../components/Modal/NutritionModal";
import CompareModal from "../components/Modal/CompareModal";
import { useTrack } from "../hooks/useTrack";
import { EVENTS } from "../lib/events";

/* -------------------------------------------------------------------------- */
/* Shimmer keyframe                                                            */
/* -------------------------------------------------------------------------- */
const SHIMMER_STYLE = `
  @keyframes ss-shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position:  400px 0; }
  }
  .ss-shimmer {
    background: linear-gradient(
      90deg,
      rgba(255,255,255,0.04) 0px,
      rgba(255,255,255,0.08) 80px,
      rgba(255,255,255,0.04) 160px
    );
    background-size: 400px 100%;
    animation: ss-shimmer 1.4s ease-in-out infinite;
  }
`;

/* -------------------------------------------------------------------------- */
/* Debounce hook                                                               */
/* -------------------------------------------------------------------------- */
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

/* -------------------------------------------------------------------------- */
/* Static data                                                                 */
/* -------------------------------------------------------------------------- */
const CATEGORIES = [
  { name: "All",            icon: null           },
  { name: "Pre-Workout",    icon: <FaBolt />     },
  { name: "Protein Powder", icon: <FaDumbbell /> },
  { name: "Energy Drinks",  icon: <FaCoffee />   },
  { name: "Protein Bars",   icon: <FaAppleAlt /> },
  { name: "BCAAs",          icon: <FaLeaf />     },
  { name: "Vitamins",       icon: <FaCapsules /> },
  { name: "Berberine",      icon: <FaCapsules /> },
  { name: "Ashwagandha",    icon: <FaLeaf />     },
  { name: "Creatine",       icon: <FaCapsules /> },
  { name: "Misc",           icon: <FaCapsules /> },
];

const VITAMIN_SUBCATEGORIES = [
  "All Vitamins",
  "Vitamin A",
  "Vitamin B",
  "Vitamin C",
  "Vitamin D",
];

const VALUE_FILTERS = ["Best Value", "Good Value", "Decent Value", "Value N/A"];

const VALUE_THRESHOLD_GOOD = 0.9;
const VALUE_THRESHOLD_BEST = 1.15;
const VALUE_MIN_BUCKET_SIZE = 3;

const VALUE_COLOR = {
  "Best Value":   { bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.35)",  text: "#4ade80" },
  "Good Value":   { bg: "rgba(56,189,248,0.12)",  border: "rgba(56,189,248,0.35)",  text: "#38bdf8" },
  "Decent Value": { bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.35)",  text: "#fbbf24" },
  "Value N/A":    { bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.3)",  text: "#cbd5e1" },
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */
function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeBucket(v) {
  return String(v || "").trim();
}

function getComparisonBucket(stack) {
  return normalizeBucket(stack?.category);
}

function getPricePerServing(stack) {
  const directCandidates = [
    stack?.pricePerServing, stack?.PricePerServing,
    stack?.costPerServing,  stack?.CostPerServing,
    stack?.valueBasis,      stack?.ValueBasis,
  ];
  for (const c of directCandidates) {
    const n = toNum(c);
    if (n != null && n > 0) return n;
  }
  const priceCandidates = [
    stack?.price, stack?.Price, stack?.salePrice, stack?.SalePrice,
    stack?.retailPrice, stack?.RetailPrice, stack?.currentPrice,
    stack?.CurrentPrice, stack?.amazonPrice, stack?.AmazonPrice,
  ];
  const servingsCandidates = [
    stack?.servings, stack?.Servings, stack?.servingsPerContainer,
    stack?.ServingsPerContainer, stack?.ServingCount, stack?.servingCount,
  ];
  let totalPrice = null, servings = null;
  for (const c of priceCandidates) {
    const n = toNum(c);
    if (n != null && n > 0) { totalPrice = n; break; }
  }
  for (const c of servingsCandidates) {
    const n = toNum(c);
    if (n != null && n > 0) { servings = n; break; }
  }
  if (totalPrice != null && servings != null && servings > 0) return totalPrice / servings;
  return null;
}

function getMedian(values) {
  const nums = (Array.isArray(values) ? values : [])
    .map(toNum).filter((v) => v != null && v > 0).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 === 1 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

function buildBucketStats(stacks) {
  const grouped = new Map();
  (Array.isArray(stacks) ? stacks : []).forEach((stack) => {
    const bucket = getComparisonBucket(stack);
    const pps = getPricePerServing(stack);
    if (!bucket || pps == null || pps <= 0) return;
    if (!grouped.has(bucket)) grouped.set(bucket, []);
    grouped.get(bucket).push(pps);
  });
  const stats = {};
  grouped.forEach((prices, bucket) => {
    stats[bucket] = { count: prices.length, medianPricePerServing: getMedian(prices) };
  });
  return stats;
}

function getValueScore(stack, bucketStats) {
  const bucket = getComparisonBucket(stack);
  const pps = getPricePerServing(stack);
  const bucketInfo = bucketStats?.[bucket];
  if (!bucket || pps == null || pps <= 0) return null;
  if (!bucketInfo?.medianPricePerServing || bucketInfo.count < VALUE_MIN_BUCKET_SIZE) return null;
  return bucketInfo.medianPricePerServing / pps;
}

function getValueLabel(stack, bucketStats) {
  const score = getValueScore(stack, bucketStats);
  if (score == null || Number.isNaN(score)) return "Value N/A";
  if (score >= VALUE_THRESHOLD_BEST) return "Best Value";
  if (score >= VALUE_THRESHOLD_GOOD) return "Good Value";
  return "Decent Value";
}

/* -------------------------------------------------------------------------- */
/* CompareNudge — shown before any compare selection                          */
/* -------------------------------------------------------------------------- */
function CompareNudge() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25, delay: 0.4 }}
      className="mx-4 sm:mx-6 rounded-xl px-3.5 py-2.5 flex items-center gap-3"
      style={{
        background: "rgba(91,158,201,0.07)",
        border:     "1px solid rgba(91,158,201,0.2)",
      }}
    >
      <div
        className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
        style={{ background: "rgba(91,158,201,0.15)", border: "1px solid rgba(91,158,201,0.25)" }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="#5B9EC9" strokeWidth={2}>
          <path strokeLinecap="round" d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h4M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M9 3v18M15 3v18" />
        </svg>
      </div>
      <p className="text-[12px] leading-snug flex-1" style={{ color: "rgba(255,255,255,0.65)", fontFamily: "'Barlow', sans-serif" }}>
        <span className="font-semibold text-white">Tap Compare on any card</span> to start a side-by-side. Pick up to 3.
      </p>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="shrink-0 p-1 rounded-full"
        style={{ color: "rgba(255,255,255,0.3)" }}
        aria-label="Dismiss tip"
      >
        <FaTimes size={9} />
      </button>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* FilterDrawer — slides in from the left on mobile (power-user filters)      */
/* -------------------------------------------------------------------------- */
function FilterDrawer({
  open, onClose,
  activeCategory, activeVitaminCategory, setActiveVitaminCategory,
  handleCategoryChange, activeValueFilters, toggleValueFilter,
  showSavedOnly, setShowSavedOnly, onClearAll, hasActiveFilters,
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(5,7,10,0.75)", backdropFilter: "blur(4px)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed left-0 top-0 bottom-0 z-50 w-80 max-w-[90vw] flex flex-col"
            style={{
              background: "#0D1117",
              borderRight: "1px solid rgba(255,255,255,0.07)",
              boxShadow: "8px 0 32px rgba(0,0,0,0.5)",
              fontFamily: "'Barlow', sans-serif",
            }}
            initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "'Barlow Condensed', sans-serif" }}>SmartStack</p>
                <h2 className="text-base font-bold text-white" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Filters</h2>
              </div>
              <button type="button" onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }} aria-label="Close filters">
                <FaTimes size={12} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>Category</p>
                <div className="flex flex-col gap-1">
                  {CATEGORIES.map((cat) => {
                    const active = activeCategory === cat.name;
                    return (
                      <button key={cat.name} type="button" onClick={() => handleCategoryChange(cat.name)}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left"
                        style={{ background: active ? "rgba(91,158,201,0.12)" : "transparent", border: active ? "1px solid rgba(91,158,201,0.3)" : "1px solid transparent", color: active ? "#5B9EC9" : "rgba(255,255,255,0.72)" }}
                      >
                        {cat.icon && <span style={{ color: active ? "#5B9EC9" : "rgba(255,255,255,0.4)" }}>{cat.icon}</span>}
                        {cat.name}
                        {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#5B9EC9] inline-block" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeCategory === "Vitamins" && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>Vitamin type</p>
                  <div className="flex flex-col gap-1">
                    {VITAMIN_SUBCATEGORIES.map((subcat) => {
                      const active = activeVitaminCategory === subcat;
                      return (
                        <button key={subcat} type="button" onClick={() => setActiveVitaminCategory(subcat)}
                          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left"
                          style={{ background: active ? "rgba(91,158,201,0.12)" : "transparent", border: active ? "1px solid rgba(91,158,201,0.3)" : "1px solid transparent", color: active ? "#5B9EC9" : "rgba(255,255,255,0.72)" }}
                        >
                          {subcat}
                          {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#5B9EC9] inline-block" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>Value signal</p>
                <div className="flex flex-col gap-2">
                  {VALUE_FILTERS.map((filter) => {
                    const active = activeValueFilters.includes(filter);
                    const colors = VALUE_COLOR[filter];
                    return (
                      <button key={filter} type="button" onClick={() => toggleValueFilter(filter)}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left"
                        style={{ background: active ? colors.bg : "rgba(255,255,255,0.03)", border: active ? `1px solid ${colors.border}` : "1px solid rgba(255,255,255,0.07)", color: active ? colors.text : "rgba(255,255,255,0.72)" }}
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: active ? colors.text : "rgba(255,255,255,0.25)" }} />
                        {filter}
                        {active && <FaTimes size={10} className="ml-auto opacity-50" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>Saved stacks</p>
                <button type="button" onClick={() => setShowSavedOnly((prev) => !prev)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left"
                  style={{ background: showSavedOnly ? "rgba(91,158,201,0.12)" : "rgba(255,255,255,0.03)", border: showSavedOnly ? "1px solid rgba(91,158,201,0.3)" : "1px solid rgba(255,255,255,0.07)", color: showSavedOnly ? "#5B9EC9" : "rgba(255,255,255,0.72)" }}
                >
                  {showSavedOnly ? <FaStar size={12} style={{ color: "#5B9EC9" }} /> : <FaRegStar size={12} style={{ color: "rgba(255,255,255,0.4)" }} />}
                  {showSavedOnly ? "Showing saved only" : "Show saved only"}
                </button>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="shrink-0 px-5 py-4 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <button type="button" onClick={() => { onClearAll(); onClose(); }}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold transition-colors"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.65)" }}
                >
                  Clear all filters
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* -------------------------------------------------------------------------- */
/* ActiveFilterPills                                                           */
/* -------------------------------------------------------------------------- */
function ActiveFilterPills({
  activeCategory, setActiveCategory,
  activeVitaminCategory, setActiveVitaminCategory,
  activeValueFilters, toggleValueFilter,
  showSavedOnly, setShowSavedOnly,
}) {
  const pills = [];

  if (activeCategory !== "All") {
    pills.push({ key: `cat-${activeCategory}`, label: activeCategory, onRemove: () => setActiveCategory("All"), color: { text: "#5B9EC9", border: "rgba(91,158,201,0.3)", bg: "rgba(91,158,201,0.1)" } });
  }
  if (activeCategory === "Vitamins" && activeVitaminCategory !== "All Vitamins") {
    pills.push({ key: `vit-${activeVitaminCategory}`, label: activeVitaminCategory, onRemove: () => setActiveVitaminCategory("All Vitamins"), color: { text: "#5B9EC9", border: "rgba(91,158,201,0.3)", bg: "rgba(91,158,201,0.1)" } });
  }
  activeValueFilters.forEach((f) => {
    const c = VALUE_COLOR[f];
    pills.push({ key: `val-${f}`, label: f, onRemove: () => toggleValueFilter(f), color: { text: c.text, border: c.border, bg: c.bg } });
  });
  if (showSavedOnly) {
    pills.push({ key: "saved", label: "Saved only", onRemove: () => setShowSavedOnly(false), color: { text: "#5B9EC9", border: "rgba(91,158,201,0.3)", bg: "rgba(91,158,201,0.1)" } });
  }

  if (pills.length === 0) return null;

  return (
    <motion.div className="flex flex-wrap gap-2 items-center" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
      <span className="text-[10px] font-semibold uppercase tracking-widest shrink-0" style={{ color: "rgba(255,255,255,0.35)" }}>Active:</span>
      {pills.map((pill) => (
        <motion.button key={pill.key} type="button" onClick={pill.onRemove}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all"
          style={{ background: pill.color.bg, border: `1px solid ${pill.color.border}`, color: pill.color.text }}
          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
          aria-label={`Remove filter: ${pill.label}`}
        >
          {pill.label}
          <FaTimes size={8} className="opacity-60" />
        </motion.button>
      ))}
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* LoadingGrid — matches 2-col mobile / multi-col desktop                     */
/* -------------------------------------------------------------------------- */
function LoadingGrid() {
  return (
    <>
      <style>{SHIMMER_STYLE}</style>
      <div className="grid grid-cols-2 gap-3 sm:gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <motion.div key={i} className="overflow-hidden flex flex-col"
            style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
          >
            {/* image placeholder */}
            <div className="relative w-full ss-shimmer" style={{ aspectRatio: "3/2" }}>
              <div className="absolute top-2 left-2 w-14 h-5 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }} />
              <div className="absolute top-2 right-2 w-7 h-7 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }} />
            </div>
            <div className="flex flex-col flex-1 px-2.5 pt-2.5 pb-3 gap-2">
              <div className="space-y-1.5">
                <div className="h-3.5 rounded ss-shimmer" style={{ width: "90%" }} />
                <div className="h-3.5 rounded ss-shimmer" style={{ width: "65%" }} />
              </div>
              <div className="h-5 rounded-full ss-shimmer" style={{ width: 72 }} />
              <div className="mt-auto h-7 rounded-xl w-full ss-shimmer" />
            </div>
          </motion.div>
        ))}
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* EmptyState                                                                  */
/* -------------------------------------------------------------------------- */
function EmptyState({ onClearAll, searchQuery, onCategoryChange }) {
  const suggestedCategories = ["Pre-Workout", "Protein Powder", "Vitamins", "Creatine"];

  return (
    <motion.div className="flex flex-col items-center justify-center py-16 text-center" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-2xl blur-xl opacity-20" style={{ background: "#5B9EC9" }} aria-hidden="true" />
        <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(91,158,201,0.08)", border: "1px solid rgba(91,158,201,0.2)" }}>
          <FaCapsules size={22} style={{ color: "rgba(91,158,201,0.7)" }} />
        </div>
      </div>

      <p className="text-lg font-bold text-white mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.03em" }}>
        {searchQuery ? `No results for "${searchQuery}"` : "No stacks match your filters"}
      </p>
      <p className="text-sm mb-5 max-w-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
        {searchQuery ? "Try a different name or browse by category below." : "Try broadening your search or clearing active filters."}
      </p>

      {/* Suggested categories */}
      {onCategoryChange && (
        <div className="flex flex-wrap gap-2 justify-center mb-5">
          {suggestedCategories.map((cat) => (
            <button key={cat} type="button" onClick={() => { onClearAll(); onCategoryChange(cat); }}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
              style={{ background: "rgba(91,158,201,0.08)", border: "1px solid rgba(91,158,201,0.2)", color: "#5B9EC9" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(91,158,201,0.15)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(91,158,201,0.08)"; }}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <button type="button" onClick={onClearAll}
        className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-white transition-all"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
      >
        <FaTimes size={10} />
        Clear all filters
      </button>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* ScrollToTopButton — floats above compare tray once user scrolls            */
/* -------------------------------------------------------------------------- */
function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed right-4 z-40 w-10 h-10 rounded-full flex items-center justify-center sm:hidden"
          style={{
            bottom: "max(88px, calc(88px + env(safe-area-inset-bottom)))",
            background: "rgba(13,17,23,0.92)",
            border: "1px solid rgba(255,255,255,0.12)",
            backdropFilter: "blur(8px)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          aria-label="Scroll to top"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/* -------------------------------------------------------------------------- */
/* SmartStackPage                                                              */
/* -------------------------------------------------------------------------- */
export default function SmartStackPage() {
  const { user } = useAuthContext();
  const track = useTrack();

  const userEmail = (user?.Email || user?.email || "").toString().trim().toLowerCase();
  const hasUserEmail = userEmail.includes("@");

  const [allStacks,             setAllStacks]             = useState([]);
  const [savedStacks,           setSavedStacks]           = useState([]);
  const [loadError,             setLoadError]             = useState(null);
  const [modalStack,            setModalStack]            = useState(null);
  const [compareModalOpen,      setCompareModalOpen]      = useState(false);
  const [selectedCompareStacks, setSelectedCompareStacks] = useState([]);
  const [filterDrawerOpen,      setFilterDrawerOpen]      = useState(false);
  const [loading,               setLoading]               = useState(false);
  const [activeCategory,        setActiveCategory]        = useState("All");
  const [activeVitaminCategory, setActiveVitaminCategory] = useState("All Vitamins");
  const [activeValueFilters,    setActiveValueFilters]    = useState([]);
  const [searchQuery,           setSearchQuery]           = useState("");
  const [showSavedOnly,         setShowSavedOnly]         = useState(false);
  const [nudgeDismissed,        setNudgeDismissed]        = useState(false);

  const isMobile = useMediaQuery("(max-width: 639px)");
  const isXL     = useMediaQuery("(min-width: 1280px)");
  const itemsPerChunk = isXL ? 25 : 24;
  const [visibleLimit, setVisibleLimit] = useState(itemsPerChunk);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const savedStackIDs = useMemo(
    () => (savedStacks || []).flatMap((s) => {
      const raw = s?.StackID;
      if (!raw) return [];
      if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
      return [String(raw)];
    }),
    [savedStacks]
  );

  const bucketStats  = useMemo(() => buildBucketStats(allStacks), [allStacks]);
  const compareCount = selectedCompareStacks.length;
  const canCompare   = compareCount >= 2 && compareCount <= 3;

  const hasActiveFilters =
    activeCategory !== "All" ||
    (activeCategory === "Vitamins" && activeVitaminCategory !== "All Vitamins") ||
    activeValueFilters.length > 0 ||
    showSavedOnly ||
    debouncedSearchQuery.length > 0;

  const activeFilterCount =
    (activeCategory !== "All" ? 1 : 0) +
    (activeCategory === "Vitamins" && activeVitaminCategory !== "All Vitamins" ? 1 : 0) +
    activeValueFilters.length +
    (showSavedOnly ? 1 : 0);

  const gridKey = useMemo(
    () => JSON.stringify({ cat: activeCategory, vitamin: activeVitaminCategory, val: [...activeValueFilters].sort(), q: debouncedSearchQuery.toLowerCase(), saved: showSavedOnly, limit: visibleLimit }),
    [activeCategory, activeVitaminCategory, activeValueFilters, debouncedSearchQuery, showSavedOnly, visibleLimit]
  );

  // ── Page view ──────────────────────────────────────────────────────────────
  useEffect(() => {
    track(EVENTS.PAGE_VIEW, { userEmail, path: "/smartstack", source: "smartstack_page" });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Search engagement ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!debouncedSearchQuery) return;
    track(EVENTS.ENGAGEMENT, { userEmail, source: "smartstack_search", payload: { query: debouncedSearchQuery } });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchQuery]);

  // ── Load stacks ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function loadStacks() {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch("/api/smartstack");
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const data = await res.json();
        if (!cancelled) setAllStacks(data.records || []);
      } catch (err) {
        console.error("[SmartStack] Failed to load:", err);
        if (!cancelled) setLoadError("Failed to load stacks. Please refresh and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadStacks();
    return () => { cancelled = true; };
  }, []);

  // ── Load saved stacks ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!hasUserEmail) { setSavedStacks([]); return; }
    let cancelled = false;
    async function loadSaved() {
      try {
        const res = await fetch(`/api/getSavedStacks?UserEmail=${encodeURIComponent(userEmail)}&t=${Date.now()}`);
        const data = res.ok ? await res.json() : { savedStacks: [] };
        if (!cancelled) setSavedStacks(data.savedStacks || []);
      } catch (err) {
        console.error("[SmartStack] Error loading saved stacks:", err);
        if (!cancelled) setSavedStacks([]);
      }
    }
    loadSaved();
    return () => { cancelled = true; };
  }, [hasUserEmail, userEmail]);

  useEffect(() => {
    setVisibleLimit(itemsPerChunk);
  }, [activeCategory, activeVitaminCategory, activeValueFilters, debouncedSearchQuery, showSavedOnly, itemsPerChunk]);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filteredStacks = useMemo(() => {
    let result = allStacks;
    if (activeCategory !== "All") {
      if (activeCategory === "Vitamins") {
        const vitaminCategories = ["Vitamin A", "Vitamin B", "Vitamin C", "Vitamin D"];
        result = result.filter((s) => vitaminCategories.includes(String(s.category || "").trim()));
        if (activeVitaminCategory !== "All Vitamins") {
          result = result.filter((s) => String(s.category || "").trim() === activeVitaminCategory);
        }
      } else {
        result = result.filter((s) => String(s.category || "").trim() === activeCategory);
      }
    }
    if (activeValueFilters.length > 0) {
      result = result.filter((s) => activeValueFilters.includes(getValueLabel(s, bucketStats)));
    }
    if (showSavedOnly) {
      result = savedStackIDs.length === 0 ? [] : result.filter((s) => savedStackIDs.includes(String(s.id)));
    }
    if (debouncedSearchQuery) {
      const q = debouncedSearchQuery.toLowerCase();
      result = result.filter((s) => s.name?.toLowerCase().includes(q));
    }
    return result;
  }, [allStacks, activeCategory, activeVitaminCategory, activeValueFilters, bucketStats, showSavedOnly, savedStackIDs, debouncedSearchQuery]);

  const totalCount    = allStacks.length;
  const visibleCount  = filteredStacks.length;
  const effectiveLimit = visibleCount === 0 ? 0 : Math.min(visibleLimit, visibleCount);
  const pageStacks    = filteredStacks.map((stack) => ({
    ...stack,
    valueScore:       getValueScore(stack, bucketStats),
    valueLabel:       getValueLabel(stack, bucketStats),
    comparisonBucket: getComparisonBucket(stack),
  })).slice(0, effectiveLimit);
  const canLoadMore = effectiveLimit < visibleCount;

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleLoadMore = useCallback(() => {
    setVisibleLimit((prev) => prev + itemsPerChunk);
    track(EVENTS.CTA_CLICK, { userEmail, source: "smartstack_load_more", payload: { currentLimit: visibleLimit, visibleCount, category: activeCategory } });
  }, [itemsPerChunk, track, userEmail, visibleLimit, visibleCount, activeCategory]);

  const toggleValueFilter = useCallback((label) => {
    setActiveValueFilters((prev) => {
      const next = prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label];
      track(EVENTS.ENGAGEMENT, { userEmail, source: "smartstack_value_filter", payload: { filter: label, active: !prev.includes(label), activeFilters: next } });
      return next;
    });
  }, [track, userEmail]);

  const handleCategoryChange = useCallback((category) => {
    setActiveCategory(category);
    if (category === "Vitamins") {
      setActiveVitaminCategory((prev) => prev || "All Vitamins");
    } else {
      setActiveVitaminCategory("All Vitamins");
    }
    track(EVENTS.ENGAGEMENT, { userEmail, source: "smartstack_category_filter", payload: { category } });
  }, [track, userEmail]);

  const clearAllFilters = useCallback(() => {
    setActiveCategory("All");
    setActiveVitaminCategory("All Vitamins");
    setActiveValueFilters([]);
    setShowSavedOnly(false);
    setSearchQuery("");
    track(EVENTS.ENGAGEMENT, { userEmail, source: "smartstack_clear_filters" });
  }, [track, userEmail]);

  const handleOpenModal = useCallback((stack) => {
    setModalStack(stack);
    if (stack) {
      track(EVENTS.ENGAGEMENT, { userEmail, source: "smartstack_detail_open", payload: { stackId: stack.id, stackName: stack.name, category: stack.category, valueLabel: stack.valueLabel } });
    }
  }, [track, userEmail]);

  const handleOpenCompareModal = useCallback(() => {
    setCompareModalOpen(true);
    track(EVENTS.CTA_CLICK, { userEmail, source: "smartstack_compare_open", payload: { count: selectedCompareStacks.length, stacks: selectedCompareStacks.map((s) => ({ id: s.id, name: s.name })) } });
  }, [track, userEmail, selectedCompareStacks]);

  const handleToggleSavedOnly = useCallback((updater) => {
    setShowSavedOnly((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      track(EVENTS.ENGAGEMENT, { userEmail, source: "smartstack_saved_filter", payload: { showSavedOnly: next } });
      return next;
    });
  }, [track, userEmail]);

  /* ─────────────────────────────────────────────────────────────────────── */
  /* Render                                                                   */
  /* ─────────────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen text-white" style={{ background: "#0A0C10", fontFamily: "'Barlow', sans-serif" }}>
      <style>{SHIMMER_STYLE}</style>

      <FilterDrawer
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        activeCategory={activeCategory}
        activeVitaminCategory={activeVitaminCategory}
        setActiveVitaminCategory={setActiveVitaminCategory}
        handleCategoryChange={(cat) => { handleCategoryChange(cat); if (cat !== "Vitamins") setFilterDrawerOpen(false); }}
        activeValueFilters={activeValueFilters}
        toggleValueFilter={toggleValueFilter}
        showSavedOnly={showSavedOnly}
        setShowSavedOnly={handleToggleSavedOnly}
        onClearAll={clearAllFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-8 pb-3 sm:pb-4">
        <div className="max-w-7xl mx-auto">

          {/* Badge row */}
          <div className="flex items-center gap-2.5 mb-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest shrink-0"
              style={{ background: "rgba(91,158,201,0.1)", border: "1px solid rgba(91,158,201,0.25)", color: "#5B9EC9", fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#5B9EC9] inline-block animate-pulse" aria-hidden="true" />
              SmartStack
            </span>
            {totalCount > 0 && !loading && (
              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                {totalCount} supplements catalogued
              </span>
            )}
          </div>

          {/* Headline — SEO-targeted, always visible */}
          <h1
            className="font-black text-white leading-none"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.01em", fontSize: "clamp(1.75rem, 6vw, 2.6rem)" }}
          >
            Supplement Comparison
            <span className="block" style={{ color: "#5B9EC9" }}>Made Simple.</span>
          </h1>

          {/* Sub-headline — hidden on mobile */}
          <p className="hidden sm:block mt-2 text-sm max-w-xl leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
            Compare pre-workouts, protein powders, vitamins, and more — side-by-side value ratings,
            price-per-serving, and ingredient breakdowns{totalCount > 0 ? ` for ${totalCount} supplements` : ""} in one place.
          </p>

          {/* Social proof stat bar — mobile only shows inline, desktop full row */}
          {!loading && totalCount > 0 && (
            <div className="flex items-center gap-3 mt-2.5 sm:mt-3 flex-wrap">
              {[
                { label: "supplements", value: totalCount.toLocaleString() },
                { label: "categories", value: "10" },
                { label: "free to use", value: "100%" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className="font-black text-white" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "clamp(0.85rem, 2.5vw, 1rem)", letterSpacing: "0.02em" }}>{value}</span>
                  <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>{label}</span>
                  <span className="w-px h-3 ml-1.5" style={{ background: "rgba(255,255,255,0.12)" }} aria-hidden="true" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── COMPARE NUDGE — shown until first compare selection ──────────── */}
      <AnimatePresence>
        {!nudgeDismissed && compareCount === 0 && !loading && allStacks.length > 0 && (
          <div className="max-w-7xl mx-auto" onClick={() => setNudgeDismissed(true)}>
            <CompareNudge />
          </div>
        )}
      </AnimatePresence>

      {/* ── STICKY CONTROLS ──────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-30"
        style={{
          background:     "rgba(10,12,16,0.97)",
          backdropFilter: "blur(14px)",
          borderBottom:   "1px solid rgba(255,255,255,0.06)",
          overflow:       "hidden", /* clip blur artifact, but children scroll via -mx trick */
        }}
      >
        <div className="max-w-7xl mx-auto">

          {/* Search row */}
          <div className="px-4 sm:px-6 pt-2.5 pb-1.5">
            <div className="relative">
              <input
                type="text"
                placeholder="Search supplements…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl py-2.5 pl-9 pr-8 text-sm text-white placeholder-white/30 transition-all outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(91,158,201,0.4)"; e.currentTarget.style.background = "rgba(91,158,201,0.05)"; }}
                onBlur={(e)  => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                aria-label="Search supplements"
              />
              <svg viewBox="0 0 24 24" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ color: "rgba(255,255,255,0.3)" }} aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <path strokeLinecap="round" d="m21 21-4.35-4.35" />
              </svg>
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full" style={{ color: "rgba(255,255,255,0.4)" }} aria-label="Clear search">
                  <FaTimes size={10} />
                </button>
              )}
            </div>
          </div>

          {/* Mobile: single pill row — Category, Value filters, Saved */}
          <div className="sm:hidden flex items-center gap-2 px-4 pb-2.5 pt-1">

            {/* Category button — opens drawer, shows active category */}
            <button
              type="button"
              onClick={() => setFilterDrawerOpen(true)}
              className="flex items-center gap-1.5 rounded-full text-[12px] font-semibold transition-all"
              style={{
                flexShrink: 0,
                padding: "6px 12px",
                background: activeCategory !== "All" ? "rgba(91,158,201,0.15)" : "rgba(255,255,255,0.06)",
                border:     activeCategory !== "All" ? "1px solid rgba(91,158,201,0.4)" : "1px solid rgba(255,255,255,0.1)",
                color:      activeCategory !== "All" ? "#5B9EC9" : "rgba(255,255,255,0.7)",
                fontFamily: "'Barlow Condensed', sans-serif",
              }}
              aria-label="Select category"
            >
              <FaFilter size={9} style={{ opacity: 0.7 }} />
              {activeCategory === "All" ? "Category" : activeCategory}
              {activeCategory !== "All" && (
                <span
                  onClick={(e) => { e.stopPropagation(); handleCategoryChange("All"); }}
                  style={{ display: "inline-flex", alignItems: "center", marginLeft: 2, color: "rgba(91,158,201,0.7)" }}
                  role="button"
                  aria-label="Clear category"
                >
                  <FaTimes size={8} />
                </span>
              )}
            </button>

            {/* Divider */}
            <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} aria-hidden="true" />

            {/* Value filter pills — inline, no scroll needed (only 4) */}
            {VALUE_FILTERS.map((filter) => {
              const active = activeValueFilters.includes(filter);
              const colors = VALUE_COLOR[filter];
              // Short labels to fit on one line
              const shortLabel = { "Best Value": "Best", "Good Value": "Good", "Decent Value": "Decent", "Value N/A": "N/A" }[filter];
              return (
                <button key={filter} type="button" onClick={() => toggleValueFilter(filter)}
                  className="flex items-center gap-1 rounded-full text-[11px] font-semibold transition-all"
                  style={{
                    flexShrink: 0, padding: "5px 9px",
                    background: active ? colors.bg : "rgba(255,255,255,0.04)",
                    border: active ? `1px solid ${colors.border}` : "1px solid rgba(255,255,255,0.08)",
                    color: active ? colors.text : "rgba(255,255,255,0.45)",
                  }}
                  aria-pressed={active}
                  aria-label={filter}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: colors.text, opacity: active ? 1 : 0.35 }} aria-hidden="true" />
                  {shortLabel}
                </button>
              );
            })}

            {/* Divider */}
            <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} aria-hidden="true" />

            {/* Saved toggle */}
            <button type="button"
              onClick={() => handleToggleSavedOnly((prev) => !prev)}
              className="flex items-center gap-1.5 rounded-full text-[11px] font-semibold transition-all"
              style={{
                flexShrink: 0, padding: "5px 9px",
                background: showSavedOnly ? "rgba(91,158,201,0.12)" : "rgba(255,255,255,0.04)",
                border: showSavedOnly ? "1px solid rgba(91,158,201,0.3)" : "1px solid rgba(255,255,255,0.08)",
                color: showSavedOnly ? "#5B9EC9" : "rgba(255,255,255,0.45)",
              }}
              aria-pressed={showSavedOnly}
            >
              {showSavedOnly ? <FaStar size={9} style={{ color: "#5B9EC9" }} /> : <FaRegStar size={9} />}
            </button>
          </div>

          {/* Desktop: category + value filter rows */}
          <div className="hidden sm:block">
            <div className="px-6 flex items-center gap-1.5 py-1.5 flex-wrap" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <span className="text-[9px] font-bold uppercase tracking-widest shrink-0 select-none" style={{ color: "rgba(255,255,255,0.25)" }}>Category</span>
              {CATEGORIES.map((cat) => {
                const active = activeCategory === cat.name;
                return (
                  <motion.button key={cat.name} type="button" onClick={() => handleCategoryChange(cat.name)}
                    whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all shrink-0"
                    style={{ background: active ? "rgba(91,158,201,0.15)" : "rgba(255,255,255,0.04)", border: active ? "1px solid rgba(91,158,201,0.35)" : "1px solid rgba(255,255,255,0.07)", color: active ? "#5B9EC9" : "rgba(255,255,255,0.6)" }}
                  >
                    {cat.icon && <span style={{ fontSize: 10 }}>{cat.icon}</span>}
                    {cat.name}
                  </motion.button>
                );
              })}
            </div>

            {activeCategory === "Vitamins" && (
              <div className="px-6 hidden lg:flex items-center gap-2.5 py-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <span className="text-[9px] font-bold uppercase tracking-widest shrink-0 select-none" style={{ color: "rgba(255,255,255,0.25)" }}>Vitamin</span>
                {VITAMIN_SUBCATEGORIES.map((subcat) => {
                  const active = activeVitaminCategory === subcat;
                  return (
                    <motion.button key={subcat} type="button" onClick={() => setActiveVitaminCategory(subcat)}
                      whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                      className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-all shrink-0"
                      style={{ background: active ? "rgba(91,158,201,0.15)" : "rgba(255,255,255,0.04)", border: active ? "1px solid rgba(91,158,201,0.35)" : "1px solid rgba(255,255,255,0.07)", color: active ? "#5B9EC9" : "rgba(255,255,255,0.6)" }}
                    >
                      {subcat}
                    </motion.button>
                  );
                })}
              </div>
            )}

            <div className="px-6 hidden lg:flex items-center gap-2.5 py-1.5 pb-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <span className="text-[9px] font-bold uppercase tracking-widest shrink-0 select-none" style={{ color: "rgba(255,255,255,0.25)" }}>Value</span>
              {VALUE_FILTERS.map((filter) => {
                const active = activeValueFilters.includes(filter);
                const colors = VALUE_COLOR[filter];
                return (
                  <motion.button key={filter} type="button" onClick={() => toggleValueFilter(filter)}
                    whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all shrink-0"
                    style={{ background: active ? colors.bg : "rgba(255,255,255,0.04)", border: active ? `1px solid ${colors.border}` : "1px solid rgba(255,255,255,0.07)", color: active ? colors.text : "rgba(255,255,255,0.6)" }}
                  >
                    <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: colors.text, opacity: active ? 1 : 0.35 }} />
                    {filter}
                  </motion.button>
                );
              })}
              <div aria-hidden="true" className="w-px self-stretch ml-1" style={{ background: "rgba(255,255,255,0.08)", minHeight: 20 }} />
              <motion.button type="button" onClick={() => handleToggleSavedOnly((prev) => !prev)}
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all shrink-0"
                style={{ background: showSavedOnly ? "rgba(91,158,201,0.12)" : "rgba(255,255,255,0.04)", border: showSavedOnly ? "1px solid rgba(91,158,201,0.3)" : "1px solid rgba(255,255,255,0.07)", color: showSavedOnly ? "#5B9EC9" : "rgba(255,255,255,0.6)" }}
                aria-pressed={showSavedOnly}
              >
                {showSavedOnly ? <FaStar size={11} style={{ color: "#5B9EC9" }} /> : <FaRegStar size={11} />}
                Saved
              </motion.button>
            </div>

            <AnimatePresence>
              {hasActiveFilters && (
                <motion.div
                  className="px-6 pb-2.5"
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }} style={{ overflow: "hidden" }}
                >
                  <div aria-hidden="true" className="mb-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }} />
                  <ActiveFilterPills
                    activeCategory={activeCategory} setActiveCategory={setActiveCategory}
                    activeVitaminCategory={activeVitaminCategory} setActiveVitaminCategory={setActiveVitaminCategory}
                    activeValueFilters={activeValueFilters} toggleValueFilter={toggleValueFilter}
                    showSavedOnly={showSavedOnly} setShowSavedOnly={handleToggleSavedOnly}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ──────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-4 pb-24">
        <AnimatePresence>
          {loadError && !loading && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-xl px-5 py-4 text-sm mb-4"
              style={{ background: "rgba(232,58,47,0.08)", border: "1px solid rgba(232,58,47,0.25)", color: "#E83A2F" }}
              role="alert"
            >
              {loadError}
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <LoadingGrid />
        ) : (
          <>
            {/* Desktop count */}
            {visibleCount > 0 && (
              <p className="hidden sm:block mb-4 text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                Showing <span style={{ color: "rgba(255,255,255,0.8)" }}>{effectiveLimit}</span> of{" "}
                <span style={{ color: "rgba(255,255,255,0.8)" }}>{visibleCount}</span>
                {visibleCount !== totalCount && " matching stacks"}
              </p>
            )}

            <AnimatePresence mode="wait">
              {pageStacks.length > 0 ? (
                <motion.div
                  key={gridKey}
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className="grid grid-cols-2 gap-3 sm:gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                >
                  {pageStacks.map((stack, index) => (
                    <StackCard
                      key={stack.id}
                      stack={stack}
                      index={index}
                      setModalStack={handleOpenModal}
                      selectedCompareStacks={selectedCompareStacks}
                      setSelectedCompareStacks={setSelectedCompareStacks}
                      savedStacks={savedStacks}
                      setSavedStacks={setSavedStacks}
                      userEmail={hasUserEmail ? userEmail : ""}
                      compact={isMobile}
                    />
                  ))}
                </motion.div>
              ) : (
                !loadError && <EmptyState onClearAll={clearAllFilters} searchQuery={debouncedSearchQuery} onCategoryChange={handleCategoryChange} />
              )}
            </AnimatePresence>

            {canLoadMore && (
              <div className="mt-10 flex justify-center">
                <motion.button type="button" onClick={handleLoadMore}
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold text-white transition-all"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <FaChevronDown size={10} style={{ color: "rgba(255,255,255,0.4)" }} />
                  Load {Math.min(itemsPerChunk, visibleCount - effectiveLimit)} more
                </motion.button>
              </div>
            )}

            {!canLoadMore && visibleCount > 0 && (
              <p className="mt-10 text-center text-[11px]" style={{ color: "rgba(255,255,255,0.28)" }}>
                All {visibleCount} stacks shown — adjust filters to explore more.
              </p>
            )}

            {/* Scroll to top — appears after scrolling down on mobile */}
            <ScrollToTopButton />
          </>
        )}
      </main>

      {/* ── COMPARE TRAY ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {compareCount > 0 && (
          <>
            {/* Mobile tray */}
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 px-4 pt-3 md:hidden"
              style={{
                background: "rgba(10,12,16,0.97)",
                backdropFilter: "blur(12px)",
                borderTop: "1px solid rgba(255,255,255,0.07)",
                paddingBottom: "max(12px, env(safe-area-inset-bottom))",
              }}
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <div className="flex items-center gap-2 mb-2.5 overflow-x-auto scrollbar-none">
                <span className="text-[10px] font-semibold uppercase tracking-widest shrink-0" style={{ color: "rgba(255,255,255,0.35)" }}>Comparing:</span>
                {selectedCompareStacks.map((stack) => (
                  <div key={stack.id}
                    className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium shrink-0"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)" }}
                  >
                    <span className="max-w-[100px] truncate">{stack.name}</span>
                    <button type="button" onClick={() => setSelectedCompareStacks((prev) => prev.filter((s) => s.id !== stack.id))} style={{ color: "rgba(255,255,255,0.35)" }} aria-label={`Remove ${stack.name}`}>
                      <FaTimes size={8} />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" disabled={!canCompare} onClick={handleOpenCompareModal}
                className="w-full rounded-xl py-3 text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: canCompare ? "#5B9EC9" : "rgba(255,255,255,0.1)", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.05em" }}
              >
                {canCompare ? `Compare ${compareCount} Stacks` : `Select ${2 - compareCount} more to compare`}
              </button>
            </motion.div>

            {/* Desktop floating bar */}
            <motion.div
              className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 hidden md:flex items-center gap-2 rounded-2xl px-4 py-2.5"
              style={{ background: "rgba(13,17,23,0.96)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", fontFamily: "'Barlow', sans-serif" }}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-widest shrink-0" style={{ color: "rgba(255,255,255,0.4)" }}>Comparing</span>
              {selectedCompareStacks.map((stack) => (
                <motion.div key={stack.id}
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.85)" }}
                  initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
                >
                  <span className="max-w-[120px] truncate">{stack.name}</span>
                  <button type="button"
                    onClick={() => setSelectedCompareStacks((prev) => prev.filter((s) => s.id !== stack.id))}
                    className="transition-colors" style={{ color: "rgba(255,255,255,0.3)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#E83A2F"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.3)"; }}
                    aria-label={`Remove ${stack.name}`}
                  >
                    <FaTimes size={8} />
                  </button>
                </motion.div>
              ))}
              {!canCompare && (
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {2 - compareCount} more needed
                </span>
              )}
              <button type="button" disabled={!canCompare} onClick={handleOpenCompareModal}
                className="rounded-full px-4 py-1.5 text-xs font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                style={{ background: canCompare ? "#5B9EC9" : "rgba(255,255,255,0.08)", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.05em" }}
              >
                Compare now
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── MODALS ────────────────────────────────────────────────────────── */}
      {modalStack && (
        <NutritionModal key={modalStack.id} stack={modalStack} onClose={() => setModalStack(null)} />
      )}
      {compareModalOpen && canCompare && (
        <CompareModal stacks={selectedCompareStacks} onClose={() => { setCompareModalOpen(false); setSelectedCompareStacks([]); }} />
      )}
    </div>
  );
}