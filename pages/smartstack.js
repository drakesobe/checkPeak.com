// pages/smartstack.js
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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

/* -------------------------------------------------------------------------- */
/* Shimmer keyframe — injected once, used by LoadingGrid                       */
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
  { name: "Pre-Workout",    icon: <FaBolt />      },
  { name: "Protein Powder", icon: <FaDumbbell />  },
  { name: "Energy Drinks",  icon: <FaCoffee />    },
  { name: "Protein Bars",   icon: <FaAppleAlt />  },
  { name: "BCAAs",          icon: <FaLeaf />      },
  { name: "Creatine",       icon: <FaCapsules />  },
  { name: "Misc",           icon: <FaCapsules />  },
];

const VALUE_FILTERS = ["Best Value", "Good Value", "Decent Value"];

const VALUE_THRESHOLD_GOOD = 0.8;
const VALUE_THRESHOLD_BEST = 1.5;

// Semantic colour per value tier — used in filter buttons and active pills
const VALUE_COLOR = {
  "Best Value":   { bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.35)",  text: "#4ade80" },
  "Good Value":   { bg: "rgba(56,189,248,0.12)", border: "rgba(56,189,248,0.35)", text: "#38bdf8" },
  "Decent Value": { bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.35)", text: "#fbbf24" },
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */
function getValueLabel(stack) {
  const score = stack.valueScore;
  if (score == null || isNaN(score)) return "Decent Value";
  if (score >= VALUE_THRESHOLD_BEST) return "Best Value";
  if (score >= VALUE_THRESHOLD_GOOD) return "Good Value";
  return "Decent Value";
}

/* -------------------------------------------------------------------------- */
/* FilterDrawer — slides in from the left on mobile                           */
/* -------------------------------------------------------------------------- */
function FilterDrawer({
  open,
  onClose,
  activeCategory,
  setActiveCategory,
  activeValueFilters,
  toggleValueFilter,
  showSavedOnly,
  setShowSavedOnly,
  onClearAll,
  hasActiveFilters,
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed left-0 top-0 bottom-0 z-50 w-80 max-w-[90vw] flex flex-col"
            style={{
              background:  "#0D1117",
              borderRight: "1px solid rgba(255,255,255,0.07)",
              boxShadow:   "8px 0 32px rgba(0,0,0,0.5)",
              fontFamily:  "'Barlow', sans-serif",
            }}
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 border-b shrink-0"
              style={{ borderColor: "rgba(255,255,255,0.06)" }}
            >
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-widest"
                  style={{
                    color:      "rgba(255,255,255,0.35)",
                    fontFamily: "'Barlow Condensed', sans-serif",
                  }}
                >
                  SmartStack
                </p>
                <h2
                  className="text-base font-bold text-white"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  Filters
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}
                aria-label="Close filters"
              >
                <FaTimes size={12} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

              {/* Categories */}
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-widest mb-3"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  Category
                </p>
                <div className="flex flex-col gap-1">
                  {CATEGORIES.map((cat) => {
                    const active = activeCategory === cat.name;
                    return (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() => { setActiveCategory(cat.name); onClose(); }}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left"
                        style={{
                          background: active ? "rgba(91,158,201,0.12)" : "transparent",
                          border:     active ? "1px solid rgba(91,158,201,0.3)" : "1px solid transparent",
                          color:      active ? "#5B9EC9" : "rgba(255,255,255,0.72)",
                        }}
                      >
                        {cat.icon && (
                          <span style={{ color: active ? "#5B9EC9" : "rgba(255,255,255,0.4)" }}>
                            {cat.icon}
                          </span>
                        )}
                        {cat.name}
                        {active && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#5B9EC9] inline-block" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Value signal */}
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-widest mb-3"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  Value signal
                </p>
                <div className="flex flex-col gap-2">
                  {VALUE_FILTERS.map((filter) => {
                    const active = activeValueFilters.includes(filter);
                    const colors = VALUE_COLOR[filter];
                    return (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => toggleValueFilter(filter)}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left"
                        style={{
                          background: active ? colors.bg   : "rgba(255,255,255,0.03)",
                          border:     active ? `1px solid ${colors.border}` : "1px solid rgba(255,255,255,0.07)",
                          color:      active ? colors.text : "rgba(255,255,255,0.72)",
                        }}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: active ? colors.text : "rgba(255,255,255,0.25)" }}
                        />
                        {filter}
                        {active && <FaTimes size={10} className="ml-auto opacity-50" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Saved only */}
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-widest mb-3"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  Saved stacks
                </p>
                <button
                  type="button"
                  onClick={() => setShowSavedOnly((prev) => !prev)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left"
                  style={{
                    background: showSavedOnly ? "rgba(91,158,201,0.12)" : "rgba(255,255,255,0.03)",
                    border:     showSavedOnly ? "1px solid rgba(91,158,201,0.3)" : "1px solid rgba(255,255,255,0.07)",
                    color:      showSavedOnly ? "#5B9EC9" : "rgba(255,255,255,0.72)",
                  }}
                >
                  {showSavedOnly
                    ? <FaStar    size={12} style={{ color: "#5B9EC9" }} />
                    : <FaRegStar size={12} style={{ color: "rgba(255,255,255,0.4)" }} />
                  }
                  {showSavedOnly ? "Showing saved only" : "Show saved only"}
                </button>
              </div>
            </div>

            {/* Footer — clear all */}
            {hasActiveFilters && (
              <div
                className="shrink-0 px-5 py-4 border-t"
                style={{ borderColor: "rgba(255,255,255,0.06)" }}
              >
                <button
                  type="button"
                  onClick={() => { onClearAll(); onClose(); }}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold transition-colors"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border:     "1px solid rgba(255,255,255,0.08)",
                    color:      "rgba(255,255,255,0.65)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.65)"; }}
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
  activeCategory,
  setActiveCategory,
  activeValueFilters,
  toggleValueFilter,
  showSavedOnly,
  setShowSavedOnly,
}) {
  const pills = [];

  if (activeCategory !== "All") {
    pills.push({
      key:      `cat-${activeCategory}`,
      label:    activeCategory,
      onRemove: () => setActiveCategory("All"),
      color:    { text: "#5B9EC9", border: "rgba(91,158,201,0.3)", bg: "rgba(91,158,201,0.1)" },
    });
  }

  activeValueFilters.forEach((f) => {
    const c = VALUE_COLOR[f];
    pills.push({
      key:      `val-${f}`,
      label:    f,
      onRemove: () => toggleValueFilter(f),
      color:    { text: c.text, border: c.border, bg: c.bg },
    });
  });

  if (showSavedOnly) {
    pills.push({
      key:      "saved",
      label:    "Saved only",
      onRemove: () => setShowSavedOnly(false),
      color:    { text: "#5B9EC9", border: "rgba(91,158,201,0.3)", bg: "rgba(91,158,201,0.1)" },
    });
  }

  if (pills.length === 0) return null;

  return (
    <motion.div
      className="flex flex-wrap gap-2 items-center"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
    >
      <span
        className="text-[10px] font-semibold uppercase tracking-widest shrink-0"
        style={{ color: "rgba(255,255,255,0.35)" }}
      >
        Active:
      </span>
      {pills.map((pill) => (
        <motion.button
          key={pill.key}
          type="button"
          onClick={pill.onRemove}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all"
          style={{
            background: pill.color.bg,
            border:     `1px solid ${pill.color.border}`,
            color:      pill.color.text,
          }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
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
/* LoadingGrid — shimmer skeleton cards while data fetches                    */
/* -------------------------------------------------------------------------- */
function LoadingGrid() {
  return (
    <>
      <style>{SHIMMER_STYLE}</style>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <motion.div
            key={i}
            className="overflow-hidden flex flex-col"
            style={{
              background:   "#0D1117",
              border:       "1px solid rgba(255,255,255,0.06)",
              borderRadius: "16px",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.04 }}
          >
            {/* Image — matches aspect-[4/3] with overlay button ghosts */}
            <div className="relative w-full ss-shimmer" style={{ aspectRatio: "4/3" }}>
              <div className="absolute top-2.5 left-2.5 w-8 h-8 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }} />
              <div className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }} />
              <div className="absolute bottom-2.5 left-2.5 h-4 w-16 rounded-md" style={{ background: "rgba(255,255,255,0.04)" }} />
            </div>

            {/* Body — mirrors px-3.5 pt-3 pb-3.5 gap-2.5 */}
            <div className="flex flex-col flex-1 px-3.5 pt-3 pb-3.5 gap-2.5">
              <div className="space-y-1.5">
                <div className="h-4 rounded ss-shimmer" style={{ width: "85%" }} />
                <div className="h-4 rounded ss-shimmer" style={{ width: "55%" }} />
              </div>
              <div className="flex flex-wrap gap-1">
                {[52, 68, 44, 58].map((w) => (
                  <div key={w} className="h-5 rounded-md ss-shimmer" style={{ width: w }} />
                ))}
              </div>
              <div className="h-5 rounded-full ss-shimmer" style={{ width: 80 }} />
              <div className="mt-auto pt-1 space-y-1.5">
                <div className="h-8 rounded-xl w-full ss-shimmer" />
                <div className="h-3 rounded ss-shimmer mx-auto" style={{ width: "50%" }} />
              </div>
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
function EmptyState({ onClearAll }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-20 text-center"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Icon with subtle glow ring */}
      <div className="relative mb-6">
        <div
          className="absolute inset-0 rounded-2xl blur-xl opacity-20"
          style={{ background: "#5B9EC9" }}
          aria-hidden="true"
        />
        <div
          className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{
            background: "rgba(91,158,201,0.08)",
            border:     "1px solid rgba(91,158,201,0.2)",
          }}
        >
          <FaCapsules size={24} style={{ color: "rgba(91,158,201,0.7)" }} />
        </div>
      </div>

      <p
        className="text-lg font-bold text-white mb-2"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.03em" }}
      >
        No stacks match your filters
      </p>
      <p
        className="text-sm mb-6 max-w-xs leading-relaxed"
        style={{ color: "rgba(255,255,255,0.6)" }}
      >
        Try a broader search, a different category, or clear your active filters.
      </p>
      <button
        type="button"
        onClick={onClearAll}
        className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-white transition-all"
        style={{
          background: "rgba(91,158,201,0.12)",
          border:     "1px solid rgba(91,158,201,0.3)",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(91,158,201,0.2)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(91,158,201,0.12)"; }}
      >
        <FaTimes size={10} />
        Clear all filters
      </button>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* SmartStackPage                                                              */
/* -------------------------------------------------------------------------- */
export default function SmartStackPage() {
  const { user } = useAuthContext();

  const userEmail = (user?.Email || user?.email || "")
    .toString().trim().toLowerCase();
  const hasUserEmail = userEmail.includes("@");

  /* ── Data ───────────────────────────────────────────────────────────────── */
  const [allStacks,   setAllStacks]   = useState([]);
  const [savedStacks, setSavedStacks] = useState([]);
  const [loadError,   setLoadError]   = useState(null);

  /* ── UI state ───────────────────────────────────────────────────────────── */
  const [modalStack,            setModalStack]            = useState(null);
  const [compareModalOpen,      setCompareModalOpen]      = useState(false);
  const [selectedCompareStacks, setSelectedCompareStacks] = useState([]);
  const [filterDrawerOpen,      setFilterDrawerOpen]      = useState(false);

  const [loading,            setLoading]            = useState(false);
  const [activeCategory,     setActiveCategory]     = useState("All");
  const [activeValueFilters, setActiveValueFilters] = useState([]);
  const [searchQuery,        setSearchQuery]        = useState("");
  const [showSavedOnly,      setShowSavedOnly]      = useState(false);

  const isXL          = useMediaQuery("(min-width: 1280px)");
  const itemsPerChunk = isXL ? 25 : 24;
  const [visibleLimit, setVisibleLimit] = useState(itemsPerChunk);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  /* ── Derived ────────────────────────────────────────────────────────────── */

  const savedStackIDs = useMemo(
    () =>
      (savedStacks || []).flatMap((s) => {
        const raw = s?.StackID;
        if (!raw) return [];
        if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
        return [String(raw)];
      }),
    [savedStacks]
  );

  const compareCount = selectedCompareStacks.length;
  const canCompare   = compareCount >= 2 && compareCount <= 3;

  const hasActiveFilters =
    activeCategory !== "All" ||
    activeValueFilters.length > 0 ||
    showSavedOnly ||
    debouncedSearchQuery.length > 0;

  // Count of active non-search filters (used on the mobile Filters button badge)
  const activeFilterCount =
    (activeCategory !== "All" ? 1 : 0) +
    activeValueFilters.length +
    (showSavedOnly ? 1 : 0);

  const gridKey = useMemo(
    () =>
      JSON.stringify({
        cat:   activeCategory,
        val:   [...activeValueFilters].sort(),
        q:     debouncedSearchQuery.toLowerCase(),
        saved: showSavedOnly,
        limit: visibleLimit,
      }),
    [activeCategory, activeValueFilters, debouncedSearchQuery, showSavedOnly, visibleLimit]
  );

  /* ── Data loading ───────────────────────────────────────────────────────── */

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

  useEffect(() => {
    if (!hasUserEmail) { setSavedStacks([]); return; }
    let cancelled = false;
    async function loadSaved() {
      try {
        const res = await fetch(
          `/api/getSavedStacks?UserEmail=${encodeURIComponent(userEmail)}&t=${Date.now()}`
        );
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

  /* ── Reset limit when filters change ───────────────────────────────────── */

  useEffect(() => {
    setVisibleLimit(itemsPerChunk);
  }, [activeCategory, activeValueFilters, debouncedSearchQuery, showSavedOnly, itemsPerChunk]);

  /* ── Filtered stacks ────────────────────────────────────────────────────── */

  const filteredStacks = useMemo(() => {
    let result = allStacks;

    if (activeCategory !== "All") {
      result = result.filter((s) => s.category === activeCategory);
    }
    if (activeValueFilters.length > 0) {
      result = result.filter((s) => activeValueFilters.includes(getValueLabel(s)));
    }
    if (showSavedOnly) {
      result = savedStackIDs.length === 0
        ? []
        : result.filter((s) => savedStackIDs.includes(String(s.id)));
    }
    if (debouncedSearchQuery) {
      const q = debouncedSearchQuery.toLowerCase();
      result = result.filter((s) => s.name?.toLowerCase().includes(q));
    }

    return result;
  }, [allStacks, activeCategory, activeValueFilters, showSavedOnly, savedStackIDs, debouncedSearchQuery]);

  /* ── Pagination ─────────────────────────────────────────────────────────── */

  const totalCount     = allStacks.length;
  const visibleCount   = filteredStacks.length;
  const effectiveLimit = visibleCount === 0 ? 0 : Math.min(visibleLimit, visibleCount);
  const pageStacks     = filteredStacks.slice(0, effectiveLimit);
  const canLoadMore    = effectiveLimit < visibleCount;

  const handleLoadMore = useCallback(
    () => setVisibleLimit((prev) => prev + itemsPerChunk),
    [itemsPerChunk]
  );

  /* ── Filter helpers ─────────────────────────────────────────────────────── */

  const toggleValueFilter = useCallback((label) => {
    setActiveValueFilters((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  }, []);

  const clearAllFilters = useCallback(() => {
    setActiveCategory("All");
    setActiveValueFilters([]);
    setShowSavedOnly(false);
    setSearchQuery("");
  }, []);

  /* ------------------------------------------------------------------------ */
  /* Render                                                                    */
  /* ------------------------------------------------------------------------ */
  return (
    <div
      className="min-h-screen text-white"
      style={{ background: "#0A0C10", fontFamily: "'Barlow', sans-serif" }}
    >
      {/* Mobile filter drawer */}
      <FilterDrawer
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        activeValueFilters={activeValueFilters}
        toggleValueFilter={toggleValueFilter}
        showSavedOnly={showSavedOnly}
        setShowSavedOnly={setShowSavedOnly}
        onClearAll={clearAllFilters}
        hasActiveFilters={hasActiveFilters}
      />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-8 pb-24 space-y-6">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">

              {/* Badge + count */}
              <div className="flex items-center gap-3 mb-3">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest shrink-0"
                  style={{
                    background: "rgba(91,158,201,0.1)",
                    border:     "1px solid rgba(91,158,201,0.25)",
                    color:      "#5B9EC9",
                    fontFamily: "'Barlow Condensed', sans-serif",
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-[#5B9EC9] inline-block animate-pulse"
                    aria-hidden="true"
                  />
                  SmartStack
                </span>

                {/* Catalog count — shown once data loads */}
                {totalCount > 0 && !loading && (
                  <span
                    className="text-[11px]"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    {totalCount} stacks in catalog
                    {visibleCount !== totalCount && (
                      <span style={{ color: "rgba(255,255,255,0.55)" }}>
                        {" "}· {visibleCount} matching
                      </span>
                    )}
                  </span>
                )}
              </div>

              <h1
                className="text-3xl sm:text-4xl font-black text-white leading-tight"
                style={{
                  fontFamily:    "'Barlow Condensed', sans-serif",
                  letterSpacing: "0.02em",
                }}
              >
                Discover better stacks.
              </h1>
              <p
                className="mt-2 text-sm max-w-lg leading-relaxed"
                style={{ color: "rgba(255,255,255,0.65)" }}
              >
                Browse formulations, compare products side by side, and filter by
                category or value signal.
              </p>
            </div>
          </div>
        </section>

        {/* ── Sticky filter bar ───────────────────────────────────────────── */}
        {/*
          Two-row layout:
            Row 1 — search + filter controls
            Row 2 — active filter pills (only rendered when filters are on,
                     lives INSIDE the bar so pills are clearly owned by it
                     and don't float ambiguously over the card grid)

          Category filters and value filters are visually separated:
            Categories — rounded-lg pills with icons, labelled "Category"
            Value       — rounded-full pills with a colored dot prefix,
                          labelled "Value", separated by a vertical rule
          This makes it immediately clear that the two groups filter
          different dimensions of the data.
        */}
        <div
          className="sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6"
          style={{
            background:     "rgba(10,12,16,0.96)",
            backdropFilter: "blur(14px)",
            borderBottom:   "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {/* ── Row 1: search (full width) ── */}
          <div className="max-w-7xl mx-auto pt-3 pb-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search stacks…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl py-2.5 pl-9 pr-8 text-sm text-white placeholder-white/30 transition-all outline-none"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border:     "1px solid rgba(255,255,255,0.08)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.border     = "1px solid rgba(91,158,201,0.4)";
                  e.currentTarget.style.background = "rgba(91,158,201,0.05)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border     = "1px solid rgba(255,255,255,0.08)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                }}
                aria-label="Search stacks"
              />
              <svg
                viewBox="0 0 24 24"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                style={{ color: "rgba(255,255,255,0.3)" }}
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path strokeLinecap="round" d="m21 21-4.35-4.35" />
              </svg>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full transition-colors"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}
                  aria-label="Clear search"
                >
                  <FaTimes size={10} />
                </button>
              )}
            </div>
          </div>

          {/* ── Row 2: Category + mobile Filters button ── */}
          <div
            className="max-w-7xl mx-auto flex items-center gap-2.5 py-1.5"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
          >
            {/* lg:+ — category pills */}
            <div className="hidden lg:flex items-center gap-1.5 flex-1 min-w-0">
              <span
                className="text-[9px] font-bold uppercase tracking-widest shrink-0 select-none"
                style={{ color: "rgba(255,255,255,0.25)" }}
              >
                Category
              </span>
              {CATEGORIES.map((cat) => {
                const active = activeCategory === cat.name;
                return (
                  <motion.button
                    key={cat.name}
                    type="button"
                    onClick={() => setActiveCategory(cat.name)}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all shrink-0"
                    style={{
                      background: active ? "rgba(91,158,201,0.15)" : "rgba(255,255,255,0.04)",
                      border:     active ? "1px solid rgba(91,158,201,0.35)" : "1px solid rgba(255,255,255,0.07)",
                      color:      active ? "#5B9EC9" : "rgba(255,255,255,0.6)",
                    }}
                  >
                    {cat.icon && (
                      <span style={{ fontSize: 10 }} aria-hidden="true">{cat.icon}</span>
                    )}
                    {cat.name}
                  </motion.button>
                );
              })}
            </div>

            {/* < lg: Filter button */}
            <button
              type="button"
              onClick={() => setFilterDrawerOpen(true)}
              className="lg:hidden flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all shrink-0"
              style={{
                background: activeFilterCount > 0 ? "rgba(91,158,201,0.12)" : "rgba(255,255,255,0.05)",
                border:     activeFilterCount > 0 ? "1px solid rgba(91,158,201,0.3)" : "1px solid rgba(255,255,255,0.08)",
                color:      activeFilterCount > 0 ? "#5B9EC9" : "rgba(255,255,255,0.65)",
              }}
              aria-label="Open filters"
            >
              <FaFilter size={10} />
              Filters
              {activeFilterCount > 0 && (
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ background: "#5B9EC9" }}
                  aria-label={`${activeFilterCount} active filters`}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* ── Row 3: Value + Saved (lg:+ only) ── */}
          <div
            className="hidden lg:flex max-w-7xl mx-auto items-center gap-2.5 py-1.5 pb-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
          >
            <span
              className="text-[9px] font-bold uppercase tracking-widest shrink-0 select-none"
              style={{ color: "rgba(255,255,255,0.25)" }}
            >
              Value
            </span>
            {VALUE_FILTERS.map((filter) => {
              const active = activeValueFilters.includes(filter);
              const colors = VALUE_COLOR[filter];
              return (
                <motion.button
                  key={filter}
                  type="button"
                  onClick={() => toggleValueFilter(filter)}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all shrink-0"
                  style={{
                    background: active ? colors.bg   : "rgba(255,255,255,0.04)",
                    border:     active ? `1px solid ${colors.border}` : "1px solid rgba(255,255,255,0.07)",
                    color:      active ? colors.text : "rgba(255,255,255,0.6)",
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: colors.text, opacity: active ? 1 : 0.35 }}
                  />
                  {filter}
                </motion.button>
              );
            })}

            {/* Saved — lives here since it's a secondary dimension like value */}
            <div
              aria-hidden="true"
              className="w-px self-stretch ml-1"
              style={{ background: "rgba(255,255,255,0.08)", minHeight: 20 }}
            />
            <motion.button
              type="button"
              onClick={() => setShowSavedOnly((prev) => !prev)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all shrink-0"
              style={{
                background: showSavedOnly ? "rgba(91,158,201,0.12)" : "rgba(255,255,255,0.04)",
                border:     showSavedOnly ? "1px solid rgba(91,158,201,0.3)" : "1px solid rgba(255,255,255,0.07)",
                color:      showSavedOnly ? "#5B9EC9" : "rgba(255,255,255,0.6)",
              }}
              aria-pressed={showSavedOnly}
            >
              {showSavedOnly
                ? <FaStar    size={11} style={{ color: "#5B9EC9" }} />
                : <FaRegStar size={11} />
              }
              Saved
            </motion.button>
          </div>

          {/* ── Row 3: active filter pills — inside the bar, clearly owned by it ── */}
          <AnimatePresence>
            {hasActiveFilters && (
              <motion.div
                className="max-w-7xl mx-auto pb-2.5"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                style={{ overflow: "hidden" }}
              >
                {/* Top rule to separate row 1 from row 2 */}
                <div
                  aria-hidden="true"
                  className="mb-2.5"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                />
                <ActiveFilterPills
                  activeCategory={activeCategory}
                  setActiveCategory={setActiveCategory}
                  activeValueFilters={activeValueFilters}
                  toggleValueFilter={toggleValueFilter}
                  showSavedOnly={showSavedOnly}
                  setShowSavedOnly={setShowSavedOnly}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Error banner ─────────────────────────────────────────────────── */}
        <AnimatePresence>
          {loadError && !loading && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl px-5 py-4 text-sm"
              style={{
                background: "rgba(232,58,47,0.08)",
                border:     "1px solid rgba(232,58,47,0.25)",
                color:      "#E83A2F",
              }}
              role="alert"
            >
              {loadError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Results ──────────────────────────────────────────────────────── */}
        <section>
          {loading ? (
            <LoadingGrid />
          ) : (
            <>
              {/* Result count — readable but not dominant */}
              {visibleCount > 0 && (
                <p
                  className="mb-4 text-[11px]"
                  style={{ color: "rgba(255,255,255,0.45)" }}
                >
                  Showing{" "}
                  <span style={{ color: "rgba(255,255,255,0.8)" }}>{effectiveLimit}</span>
                  {" "}of{" "}
                  <span style={{ color: "rgba(255,255,255,0.8)" }}>{visibleCount}</span>
                  {visibleCount !== totalCount && " matching stacks"}
                </p>
              )}

              <AnimatePresence mode="wait">
                {pageStacks.length > 0 ? (
                  <motion.div
                    key={gridKey}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                    className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                  >
                    {pageStacks.map((stack) => (
                      <StackCard
                        key={stack.id}
                        stack={stack}
                        setModalStack={setModalStack}
                        selectedCompareStacks={selectedCompareStacks}
                        setSelectedCompareStacks={setSelectedCompareStacks}
                        savedStacks={savedStacks}
                        setSavedStacks={setSavedStacks}
                        userEmail={hasUserEmail ? userEmail : ""}
                      />
                    ))}
                  </motion.div>
                ) : (
                  !loadError && <EmptyState onClearAll={clearAllFilters} />
                )}
              </AnimatePresence>

              {/* Load more */}
              {canLoadMore && (
                <div className="mt-10 flex justify-center">
                  <motion.button
                    type="button"
                    onClick={handleLoadMore}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold text-white transition-all"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border:     "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    <FaChevronDown size={10} style={{ color: "rgba(255,255,255,0.4)" }} />
                    Load {Math.min(itemsPerChunk, visibleCount - effectiveLimit)} more stacks
                  </motion.button>
                </div>
              )}

              {/* End of results */}
              {!canLoadMore && visibleCount > 0 && (
                <p
                  className="mt-10 text-center text-[11px]"
                  style={{ color: "rgba(255,255,255,0.28)" }}
                >
                  All {visibleCount} stacks shown — adjust filters to explore more.
                </p>
              )}
            </>
          )}
        </section>

      </main>

      {/* ── Compare bar ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {compareCount > 0 && (
          <>
            {/*
              Mobile compare bar
              FIX: now shows stack name chips above the button so users
              know exactly which stacks are selected without having to
              remember or scroll back up to check the cards.
            */}
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 px-4 pt-3 pb-safe md:hidden"
              style={{
                background:     "rgba(10,12,16,0.97)",
                backdropFilter: "blur(12px)",
                borderTop:      "1px solid rgba(255,255,255,0.07)",
                paddingBottom:  "max(12px, env(safe-area-inset-bottom))",
              }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {/* Stack name chips */}
              <div className="flex items-center gap-2 mb-2.5 overflow-x-auto scrollbar-none">
                <span
                  className="text-[10px] font-semibold uppercase tracking-widest shrink-0"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  Comparing:
                </span>
                {selectedCompareStacks.map((stack) => (
                  <div
                    key={stack.id}
                    className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium shrink-0"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border:     "1px solid rgba(255,255,255,0.1)",
                      color:      "rgba(255,255,255,0.8)",
                    }}
                  >
                    <span className="max-w-[100px] truncate">{stack.name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedCompareStacks((prev) =>
                          prev.filter((s) => s.id !== stack.id)
                        )
                      }
                      style={{ color: "rgba(255,255,255,0.35)" }}
                      aria-label={`Remove ${stack.name} from compare`}
                    >
                      <FaTimes size={8} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Action button */}
              <button
                type="button"
                disabled={!canCompare}
                onClick={() => setCompareModalOpen(true)}
                className="w-full rounded-xl py-3 text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background:    canCompare ? "#5B9EC9" : "rgba(255,255,255,0.1)",
                  fontFamily:    "'Barlow Condensed', sans-serif",
                  letterSpacing: "0.05em",
                }}
              >
                {canCompare
                  ? `Compare ${compareCount} Stacks`
                  : `Select ${2 - compareCount} more to compare`
                }
              </button>
            </motion.div>

            {/* Desktop chip bar */}
            <motion.div
              className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 hidden md:flex items-center gap-2 rounded-2xl px-4 py-2.5"
              style={{
                background:     "rgba(13,17,23,0.96)",
                border:         "1px solid rgba(255,255,255,0.08)",
                backdropFilter: "blur(12px)",
                boxShadow:      "0 8px 32px rgba(0,0,0,0.5)",
                fontFamily:     "'Barlow', sans-serif",
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
            >
              <span
                className="text-[10px] font-semibold uppercase tracking-widest shrink-0"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                Comparing
              </span>

              {selectedCompareStacks.map((stack) => (
                <motion.div
                  key={stack.id}
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border:     "1px solid rgba(255,255,255,0.1)",
                    color:      "rgba(255,255,255,0.85)",
                  }}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                >
                  <span className="max-w-[120px] truncate">{stack.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedCompareStacks((prev) =>
                        prev.filter((s) => s.id !== stack.id)
                      )
                    }
                    className="transition-colors"
                    style={{ color: "rgba(255,255,255,0.3)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#E83A2F"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.3)"; }}
                    aria-label={`Remove ${stack.name} from compare`}
                  >
                    <FaTimes size={8} />
                  </button>
                </motion.div>
              ))}

              {!canCompare && (
                <span
                  className="text-[10px]"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                >
                  {2 - compareCount} more needed
                </span>
              )}

              <button
                type="button"
                disabled={!canCompare}
                onClick={() => setCompareModalOpen(true)}
                className="rounded-full px-4 py-1.5 text-xs font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                style={{
                  background:    canCompare ? "#5B9EC9" : "rgba(255,255,255,0.08)",
                  fontFamily:    "'Barlow Condensed', sans-serif",
                  letterSpacing: "0.05em",
                }}
              >
                Compare now
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {modalStack && (
        <NutritionModal
          key={modalStack.id}
          stack={modalStack}
          onClose={() => setModalStack(null)}
        />
      )}

      {compareModalOpen && canCompare && (
        <CompareModal
          stacks={selectedCompareStacks}
          onClose={() => {
            setCompareModalOpen(false);
            setSelectedCompareStacks([]);
          }}
        />
      )}
    </div>
  );
}