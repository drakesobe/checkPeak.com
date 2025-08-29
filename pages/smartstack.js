"use client";

import { useState, useEffect } from "react";
import NavBar from "../components/NavBar";
import { motion, AnimatePresence } from "framer-motion";
import { FaDumbbell, FaBolt, FaLeaf, FaCoffee, FaAppleAlt, FaCapsules } from "react-icons/fa";
import StackCard from "../components/smartstack-cards/StackCard";
import NutritionModal from "../components/Modal/NutritionModal";
import CompareModal from "../components/Modal/CompareModal";

// Utility debounce function
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// Helper to match ValueBadge thresholds per category
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

export default function SmartStackPage() {
  const [activeValueFilters, setActiveValueFilters] = useState([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const [stacks, setStacks] = useState([]);
  const [filteredStacks, setFilteredStacks] = useState([]);
  const [modalStack, setModalStack] = useState(null);
  const [loading, setLoading] = useState(false);

  // Compare UX
  const [selectedCompareStacks, setSelectedCompareStacks] = useState([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/smartstack");
        const data = await res.json();
        setStacks(data.records || []);
        setFilteredStacks(data.records || []);
      } catch (e) {
        console.error("Failed to load SmartStack data", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const valueFilters = ["Best Value", "Good Value", "Decent Value"];

  const toggleValueFilter = (key) => {
    setActiveValueFilters((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

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

  // Filtering logic
  useEffect(() => {
    let result = stacks;

    // Category filter
    if (activeCategory !== "All") {
      result = result.filter((stack) => stack.category === activeCategory);
    }

    // Value filter
    if (activeValueFilters.length > 0) {
      result = result.filter((stack) =>
        activeValueFilters.includes(getValueLabel(stack))
      );
    }

    // Search by stack name
    if (debouncedSearchQuery) {
      result = result.filter((stack) =>
        stack.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
      );
    }

    setFilteredStacks(result);
  }, [stacks, activeCategory, activeValueFilters, debouncedSearchQuery]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans">
      <NavBar />

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Hero */}
        <section className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
            SmartStack
          </h1>
          <p className="text-gray-300 text-lg">
            Discover and filter supplements with verified safety and value insights.
          </p>
        </section>

        {/* Search Bar */}
        <div className="flex justify-center mb-6">
          <div className="relative w-full max-w-md">
            <input
              type="text"
              placeholder="Search stacks by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-3 pl-10 rounded-xl border border-gray-700 bg-gray-800 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            />
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              🔍
            </span>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-3 mb-4 justify-center">
          {categories.map((cat) => {
            const active = activeCategory === cat.name;
            return (
              <motion.button
                key={cat.name}
                onClick={() => setActiveCategory(cat.name)}
                className={`px-4 py-2 rounded-full font-semibold flex items-center gap-2 transition-all ${
                  active
                    ? "bg-indigo-600 text-white shadow-lg"
                    : "bg-gray-700 text-gray-300"
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {cat.icon}
                {cat.name}
              </motion.button>
            );
          })}
        </div>

        {/* Value Filters */}
        <div className="flex gap-3 flex-wrap justify-center mb-6">
          {valueFilters.map((filter) => {
            const active = activeValueFilters.includes(filter);
            const styles =
              filter === "Best Value"
                ? "bg-gradient-to-r from-green-500 to-green-400 text-white shadow-lg"
                : filter === "Good Value"
                ? "bg-gradient-to-r from-blue-500 to-blue-400 text-white shadow-lg"
                : "bg-gradient-to-r from-yellow-500 to-yellow-400 text-white shadow-lg";

            return (
              <motion.button
                key={filter}
                onClick={() => toggleValueFilter(filter)}
                className={`px-4 py-2 rounded-full font-semibold transition-all ${
                  active ? styles : "bg-gray-700 text-gray-300"
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {filter}
              </motion.button>
            );
          })}
        </div>

        {/* Loading or Grid */}
        {loading ? (
          <div className="text-center py-12 text-gray-300">Loading SmartStack…</div>
        ) : (
          <AnimatePresence>
            {filteredStacks.length > 0 ? (
              <motion.div
                key={
                  activeCategory +
                  activeValueFilters.join(",") +
                  debouncedSearchQuery.toLowerCase()
                }
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
              >
                {filteredStacks.map((stack) => (
                  <StackCard
                    key={stack.id}
                    stack={stack}
                    setModalStack={setModalStack}
                    selectedCompareStacks={selectedCompareStacks}
                    setSelectedCompareStacks={setSelectedCompareStacks}
                  />
                ))}
              </motion.div>
            ) : (
              <p className="italic text-gray-400 text-center">
                No stacks match your filters.
              </p>
            )}
          </AnimatePresence>
        )}
      </main>

      {/* Persistent Compare Bar */}
      {selectedCompareStacks.length > 0 && (
        <motion.div
          className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-xl px-4 py-2 flex items-center gap-4 shadow-lg z-50"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
        >
          <span className="text-sm text-gray-300 font-medium">
            Selected for Compare:
          </span>
          {selectedCompareStacks.map((stack) => (
            <div
              key={stack.id}
              className="flex items-center gap-2 bg-gray-800 px-3 py-1 rounded-full text-sm relative"
            >
              <span className="font-medium">{stack.name}</span>
              <button
                className="text-gray-400 hover:text-red-400"
                onClick={() =>
                  setSelectedCompareStacks(
                    selectedCompareStacks.filter((s) => s.id !== stack.id)
                  )
                }
                title="Remove from compare"
              >
                ✕
              </button>
            </div>
          ))}

          {/* Compare button */}
          <div className="relative">
            <button
              disabled={selectedCompareStacks.length < 2}
              onClick={() => setCompareModalOpen(true)}
              className={`px-4 py-2 rounded-2xl font-medium text-white ${
                selectedCompareStacks.length >= 2 && selectedCompareStacks.length <= 3
                  ? "bg-green-600 hover:bg-green-500 shadow-lg"
                  : "bg-gray-700 cursor-not-allowed"
              }`}
            >
              Compare {selectedCompareStacks.length} Stack
              {selectedCompareStacks.length > 1 ? "s" : ""}
            </button>

            {/* Tooltip for max 3 stacks */}
            {selectedCompareStacks.length > 3 && (
              <div className="absolute -top-8 right-0 bg-red-600 text-white text-xs px-2 py-1 rounded shadow-md z-50">
                Max 3 stacks can be selected
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Nutrition Modal */}
      {modalStack && (
        <NutritionModal stack={modalStack} onClose={() => setModalStack(null)} />
      )}

      {/* Compare Modal */}
      {compareModalOpen && selectedCompareStacks.length >= 2 && selectedCompareStacks.length <= 3 && (
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
