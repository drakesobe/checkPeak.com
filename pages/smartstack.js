// pages/smartstack.js
"use client";

import { useState, useEffect } from "react";
import { useAuthContext } from "../hooks/useAuth";
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
} from "react-icons/fa";
import StackCard from "../components/smartstack-cards/StackCard";
import NutritionModal from "../components/Modal/NutritionModal";
import CompareModal from "../components/Modal/CompareModal";

/* -------------------------------------------------------------------------- */
/* Debounce Hook                                                              */
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
/* Value Score → Label Helper                                                 */
/* -------------------------------------------------------------------------- */
function getValueLabel(stack) {
  if (stack.valueScore == null || isNaN(stack.valueScore)) return "Decent Value";

  const thresholds = {
    "Pre-Workout": { good: 0.8, best: 1.5 },
    "Protein Powder": { good: 0.8, best: 1.5 },
    "Energy Drinks": { good: 0.8, best: 1.5 },
    "Protein Bars": { good: 0.8, best: 1.5 },
    BCAAs: { good: 0.8, best: 1.5 },
    Creatine: { good: 0.8, best: 1.5 },
    Misc: { good: 0.8, best: 1.5 },
  };

  const t = thresholds[stack.category] || { good: 0.8, best: 1.5 };
  if (stack.valueScore >= t.best) return "Best Value";
  if (stack.valueScore >= t.good) return "Good Value";
  return "Decent Value";
}

/* -------------------------------------------------------------------------- */
/* SmartStack Page                                                            */
/* -------------------------------------------------------------------------- */
export default function SmartStackPage() {
  const { user } = useAuthContext();
  // Match saved-stacks: support user.Email and user.email
  const userEmail = user?.Email || user?.email || null;

  // Data
  const [allStacks, setAllStacks] = useState([]); // all SmartStack records
  const [filteredStacks, setFilteredStacks] = useState([]);
  const [savedStacks, setSavedStacks] = useState([]); // raw saved records from SavedStacks table
  const [savedStackIDs, setSavedStackIDs] = useState([]); // derived list of SmartStack IDs

  // UI state
  const [modalStack, setModalStack] = useState(null);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [selectedCompareStacks, setSelectedCompareStacks] = useState([]);

  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeValueFilters, setActiveValueFilters] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSavedOnly, setShowSavedOnly] = useState(false);

  // "Load more" pagination
  const [visibleLimit, setVisibleLimit] = useState(25);
  const itemsPerChunk = 25;

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  /* ------------------------------------------------------------------------ */
  /* Load all SmartStack records                                              */
  /* ------------------------------------------------------------------------ */
  useEffect(() => {
    async function loadStacks() {
      setLoading(true);
      try {
        const res = await fetch("/api/smartstack");
        const data = await res.json();
        const records = data.records || [];
        setAllStacks(records);
        setFilteredStacks(records);
      } catch (err) {
        console.error("[SmartStack] Failed to load SmartStack data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadStacks();
  }, []);

  /* ------------------------------------------------------------------------ */
  /* Load saved stacks for the current user (same pattern as saved-stacks)    */
  /* ------------------------------------------------------------------------ */
  useEffect(() => {
    if (!userEmail) {
      setSavedStacks([]);
      return;
    }

    async function loadSaved() {
      try {
        const resSaved = await fetch(
          `/api/getSavedStacks?UserEmail=${encodeURIComponent(userEmail)}`
        );
        const savedData = resSaved.ok
          ? await resSaved.json()
          : { savedStacks: [] };

        // Raw saved records (for StackCard, notes, etc.)
        setSavedStacks(savedData.savedStacks || []);
      } catch (err) {
        console.error("[SmartStack] Error loading saved stacks:", err);
        setSavedStacks([]);
      }
    }

    loadSaved();
  }, [userEmail]);

  /* ------------------------------------------------------------------------ */
  /* Derive savedStackIDs from savedStacks                                    */
  /*  - StackID is what saved-stacks uses to match stack.id                   */
  /* ------------------------------------------------------------------------ */
  useEffect(() => {
    const ids = (savedStacks || []).flatMap((s) => {
      const raw = s.StackID;
      if (!raw) return [];
      if (Array.isArray(raw)) {
        return raw.filter(Boolean).map((id) => id.toString());
      }
      return [raw.toString()];
    });

    setSavedStackIDs(ids);
  }, [savedStacks]);

  /* ------------------------------------------------------------------------ */
  /* Filtering                                                                */
  /* ------------------------------------------------------------------------ */
  useEffect(() => {
    let result = allStacks;

    // Category filter
    if (activeCategory !== "All") {
      result = result.filter((stack) => stack.category === activeCategory);
    }

    // Value filters
    if (activeValueFilters.length > 0) {
      result = result.filter((stack) =>
        activeValueFilters.includes(getValueLabel(stack))
      );
    }

    // Saved-only filter: match stack.id against SavedStacks.StackID
    if (showSavedOnly && savedStackIDs.length > 0) {
      result = result.filter((stack) => savedStackIDs.includes(stack.id));
    }

    // Search filter
    if (debouncedSearchQuery) {
      const q = debouncedSearchQuery.toLowerCase();
      result = result.filter((stack) =>
        stack.name?.toLowerCase().includes(q)
      );
    }

    setFilteredStacks(result);
  }, [
    allStacks,
    activeCategory,
    activeValueFilters,
    debouncedSearchQuery,
    showSavedOnly,
    savedStackIDs,
  ]);

  /* ------------------------------------------------------------------------ */
  /* Reset visibleLimit ONLY when filters/search toggle/change                */
  /* ------------------------------------------------------------------------ */
  useEffect(() => {
    setVisibleLimit(itemsPerChunk);
  }, [activeCategory, activeValueFilters, debouncedSearchQuery, showSavedOnly]);

  /* ------------------------------------------------------------------------ */
  /* Filter UI config                                                          */
  /* ------------------------------------------------------------------------ */
  const categories = [
    { name: "All", icon: null },
    { name: "Pre-Workout", icon: <FaBolt /> },
    { name: "Protein Powder", icon: <FaDumbbell /> },
    { name: "Energy Drinks", icon: <FaCoffee /> },
    { name: "Protein Bars", icon: <FaAppleAlt /> },
    { name: "BCAAs", icon: <FaLeaf /> },
    { name: "Creatine", icon: <FaCapsules /> },
    { name: "Misc", icon: <FaCapsules /> },
  ];

  const valueFilters = ["Best Value", "Good Value", "Decent Value"];

  const toggleValueFilter = (label) => {
    setActiveValueFilters((prev) =>
      prev.includes(label)
        ? prev.filter((l) => l !== label)
        : [...prev, label]
    );
  };

  const totalCount = allStacks.length;
  const visibleCount = filteredStacks.length;

  /* ------------------------------------------------------------------------ */
  /* "Load more" pagination derivation                                         */
  /* ------------------------------------------------------------------------ */
  const effectiveLimit =
    visibleCount === 0 ? 0 : Math.min(visibleLimit, visibleCount);
  const pageStacks = filteredStacks.slice(0, effectiveLimit);
  const canLoadMore = effectiveLimit < visibleCount;

  const humanStart = visibleCount === 0 ? 0 : 1;
  const humanEnd = effectiveLimit;

  const handleLoadMore = () => {
    setVisibleLimit((prev) => prev + itemsPerChunk);
  };

  /* ------------------------------------------------------------------------ */
  /* Render                                                                    */
  /* ------------------------------------------------------------------------ */
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans">
      <main className="mx-auto max-w-7xl px-4 pt-10 pb-20 space-y-10">
        {/* Header */}
        <section className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] uppercase tracking-wide text-emerald-300 font-medium">
              SmartStack
            </span>

            <h1 className="mt-3 text-3xl font-semibold text-white tracking-tight">
              Discover better supplement stacks — built on value & transparency.
            </h1>

            <p className="mt-2 max-w-xl text-sm text-gray-400 leading-relaxed">
              Browse formulations, compare products side-by-side, and filter by
              category, value, or your own saved picks. SmartStack helps you
              understand what you&apos;re actually paying for — and what
              you&apos;re actually getting.
            </p>
          </div>

          <div className="text-[11px] text-gray-500 text-right">
            {totalCount > 0 && (
              <>
                <p>
                  Loaded from catalog:{" "}
                  <span className="font-semibold text-emerald-300">
                    {totalCount}
                  </span>{" "}
                  stacks
                </p>
                {visibleCount > 0 && (
                  <p className="mt-1">
                    Matching current filters:{" "}
                    <span className="font-semibold text-gray-300">
                      {visibleCount}
                    </span>
                  </p>
                )}
                {userEmail && (
                  <p className="mt-1">
                    Viewing as{" "}
                    <span className="font-semibold text-gray-300">
                      {userEmail}
                    </span>
                  </p>
                )}
                {userEmail && (
                  <p className="mt-1 text-gray-600">
                    Saved stacks linked:{" "}
                    <span className="font-semibold">
                      {savedStackIDs.length}
                    </span>
                  </p>
                )}
              </>
            )}
          </div>
        </section>

        {/* Filters Panel */}
        <section className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5 space-y-6">
          {/* Search + Saved Toggle */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Search */}
            <div className="w-full sm:max-w-md">
              <label
                htmlFor="smartstack-search"
                className="block text-[11px] font-medium uppercase tracking-wide text-gray-500 mb-1"
              >
                Search stacks
              </label>
              <div className="relative">
                <input
                  id="smartstack-search"
                  type="text"
                  placeholder="Search by product name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-gray-950/70 px-9 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">
                  🔍
                </span>
              </div>
            </div>

            {/* Saved stacks toggle */}
            <div className="flex items-center gap-3 sm:justify-end">
              <div className="text-[11px] text-gray-500 text-left sm:text-right">
                <p className="font-medium text-gray-300">Saved stacks</p>
                <p>Filter to products you&apos;ve personally saved.</p>
              </div>

              <button
                type="button"
                onClick={() => setShowSavedOnly((prev) => !prev)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  showSavedOnly
                    ? "border-emerald-400 bg-emerald-500/15 text-emerald-200 hover:border-emerald-300"
                    : "border-gray-700 bg-gray-900 text-gray-300 hover:border-emerald-400/70 hover:text-emerald-200"
                }`}
              >
                {showSavedOnly ? (
                  <FaStar className="text-emerald-300" size={12} />
                ) : (
                  <FaRegStar className="text-gray-400" size={12} />
                )}
                {showSavedOnly ? "Showing saved" : "Show saved only"}
              </button>
            </div>
          </div>

          {/* Categories */}
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">
              Categories
            </p>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => {
                const active = activeCategory === cat.name;
                return (
                  <motion.button
                    key={cat.name}
                    type="button"
                    onClick={() => setActiveCategory(cat.name)}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? "border-emerald-400 bg-emerald-500/15 text-emerald-200 shadow-sm"
                        : "border-gray-700 bg-gray-950 text-gray-300 hover:border-emerald-400/60 hover:text-emerald-200"
                    }`}
                  >
                    {cat.icon && (
                      <span className="text-[13px]">{cat.icon}</span>
                    )}
                    <span>{cat.name}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Value Filters */}
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">
              Value signal
            </p>
            <div className="flex flex-wrap gap-2">
              {valueFilters.map((filter) => {
                const active = activeValueFilters.includes(filter);

                const activeStyles =
                  filter === "Best Value"
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-400 text-white shadow-md"
                    : filter === "Good Value"
                    ? "bg-gradient-to-r from-sky-500 to-sky-400 text-white shadow-md"
                    : "bg-gradient-to-r from-amber-500 to-amber-400 text-white shadow-md";

                return (
                  <motion.button
                    key={filter}
                    type="button"
                    onClick={() => toggleValueFilter(filter)}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? activeStyles
                        : "border border-gray-700 bg-gray-950 text-gray-300 hover:border-emerald-400/60 hover:text-emerald-200"
                    }`}
                  >
                    {filter}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Results Grid + Range Summary + Load More */}
        <section>
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-300">
              Loading SmartStack…
            </div>
          ) : (
            <>
              {/* Summary above grid */}
              {visibleCount > 0 && (
                <div className="mb-3 text-xs text-gray-500">
                  Showing{" "}
                    <span className="font-semibold text-gray-200">
                      {humanStart}
                    </span>{" "}
                  –{" "}
                  <span className="font-semibold text-gray-200">
                    {humanEnd}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-gray-200">
                    {visibleCount}
                  </span>{" "}
                  matching stacks
                </div>
              )}

              <AnimatePresence mode="wait">
                {pageStacks.length > 0 ? (
                  <motion.div
                    key={
                      activeCategory +
                      activeValueFilters.join(",") +
                      debouncedSearchQuery.toLowerCase() +
                      showSavedOnly +
                      `-limit-${effectiveLimit}`
                    }
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                    className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
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
                        userEmail={userEmail}
                      />
                    ))}
                  </motion.div>
                ) : (
                  <div className="mt-10 rounded-xl border border-gray-800 bg-gray-900/70 px-5 py-8 text-center text-sm text-gray-400">
                    <p className="font-medium text-gray-200 mb-1">
                      No stacks match your filters.
                    </p>
                    <p className="mb-3">
                      Try clearing filters, searching by a broader term, or
                      turning off the saved-only toggle.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCategory("All");
                        setActiveValueFilters([]);
                        setShowSavedOnly(false);
                        setSearchQuery("");
                      }}
                      className="inline-flex items-center rounded-full border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs font-semibold text-gray-100 hover:border-emerald-400 hover:text-emerald-200"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </AnimatePresence>

              {/* Load more */}
              {canLoadMore && (
                <div className="mt-8 flex justify-center">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    className="rounded-full border border-gray-700 bg-gray-900 px-4 py-2 text-xs font-semibold text-gray-100 hover:border-emerald-400 hover:text-emerald-200"
                  >
                    Load{" "}
                    {Math.min(
                      itemsPerChunk,
                      visibleCount - effectiveLimit
                    )}{" "}
                    more stacks
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      {/* Compare Bar */}
      {selectedCompareStacks.length > 0 && (
        <>
          {/* Mobile full-width button */}
          <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-800 bg-gray-950/97 px-4 py-3 md:hidden shadow-[0_-4px_16px_rgba(0,0,0,0.6)]">
            <button
              disabled={selectedCompareStacks.length < 2}
              onClick={() => setCompareModalOpen(true)}
              className={`w-full rounded-xl py-3 text-sm font-semibold text-white ${
                selectedCompareStacks.length < 2
                  ? "cursor-not-allowed bg-gray-700 opacity-60"
                  : "bg-emerald-600 hover:bg-emerald-500 shadow-lg"
              }`}
            >
              Compare {selectedCompareStacks.length} Stack
              {selectedCompareStacks.length > 1 ? "s" : ""}
            </button>
          </div>

          {/* Desktop chip bar */}
          <motion.div
            className="fixed bottom-4 left-1/2 z-50 hidden -translate-x-1/2 transform items-center gap-3 rounded-2xl border border-gray-800 bg-gray-950/95 px-4 py-2 shadow-lg backdrop-blur-sm sm:flex"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
          >
            <span className="text-xs font-medium text-gray-300">
              Selected for compare:
            </span>
            {selectedCompareStacks.map((stack) => (
              <div
                key={stack.id}
                className="flex items-center gap-2 rounded-full bg-gray-900 px-3 py-1 text-xs"
              >
                <span className="max-w-[140px] truncate font-medium">
                  {stack.name}
                </span>
                <button
                  className="text-gray-400 hover:text-red-400"
                  onClick={() =>
                    setSelectedCompareStacks((prev) =>
                      prev.filter((s) => s.id !== stack.id)
                    )
                  }
                  title="Remove from compare"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              disabled={
                selectedCompareStacks.length < 2 ||
                selectedCompareStacks.length > 3
              }
              onClick={() => setCompareModalOpen(true)}
              className={`rounded-xl px-4 py-1.5 text-xs font-semibold text-white ${
                selectedCompareStacks.length >= 2 &&
                selectedCompareStacks.length <= 3
                  ? "bg-emerald-600 hover:bg-emerald-500"
                  : "bg-gray-700 cursor-not-allowed"
              }`}
            >
              Compare now
            </button>
          </motion.div>
        </>
      )}

      {/* Modals */}
      {modalStack && (
        <NutritionModal
          key={modalStack.id}
          stack={modalStack}
          onClose={() => setModalStack(null)}
        />
      )}

      {compareModalOpen &&
        selectedCompareStacks.length >= 2 &&
        selectedCompareStacks.length <= 3 && (
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
