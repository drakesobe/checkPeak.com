// pages/saved-stacks.js
"use client";

import { useState, useEffect } from "react";
import { useAuthContext } from "../hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import StackCard from "../components/smartstack-cards/StackCard";
import NutritionModal from "../components/Modal/NutritionModal";
import CompareModal from "../components/Modal/CompareModal";

// Debounce hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function SavedStacksPage() {
  const { user } = useAuthContext();
  const userEmail = user?.Email || user?.email || null;

  const [allStacks, setAllStacks] = useState([]); // Only saved stacks
  const [savedStacks, setSavedStacks] = useState([]); // Raw saved records
  const [filteredStacks, setFilteredStacks] = useState([]);
  const [modalStack, setModalStack] = useState(null);
  const [loading, setLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const [selectedCompareStacks, setSelectedCompareStacks] = useState([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);

  // --- Load saved stacks and merge with full stack info
  useEffect(() => {
    if (!userEmail) return;

    async function loadSavedStacks() {
      setLoading(true);
      try {
        // 1. Fetch saved stack records from Airtable
        const resSaved = await fetch(
          `/api/getSavedStacks?UserEmail=${encodeURIComponent(userEmail)}`
        );
        const savedData = resSaved.ok ? await resSaved.json() : { savedStacks: [] };
        const savedStackIDs = (savedData.savedStacks || []).map((s) => s.StackID);

        // 2. Fetch all SmartStack records
        const resAll = await fetch("/api/smartstack");
        const allData = resAll.ok ? await resAll.json() : { records: [] };

        // 3. Filter to only saved stacks
        const filteredSavedStacks = allData.records
          .filter((stack) => savedStackIDs.includes(stack.id))
          .map((stack) => {
            // 4. Merge saved info (notes + recordId)
            const savedRecord = savedData.savedStacks.find((s) => s.StackID === stack.id);
            return {
              ...stack,
              notes: savedRecord?.Notes || stack.notes,
              recordId: savedRecord?.recordId || null,
            };
          });

        setAllStacks(filteredSavedStacks);
        setSavedStacks(savedData.savedStacks || []);
        setFilteredStacks(filteredSavedStacks);
      } catch (err) {
        console.error("Error loading saved stacks:", err);
        setAllStacks([]);
        setSavedStacks([]);
        setFilteredStacks([]);
      } finally {
        setLoading(false);
      }
    }

    loadSavedStacks();
  }, [userEmail]);

  // --- Filtering by search
  useEffect(() => {
    if (!allStacks) return;

    let result = allStacks;

    if (debouncedSearchQuery) {
      result = result.filter((stack) =>
        stack.name?.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
      );
    }

    setFilteredStacks(result);
  }, [debouncedSearchQuery, allStacks]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans">

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <section className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">My Saved Stacks</h1>
          <p className="text-gray-300 text-lg">
            Quickly access all the stacks you’ve saved for later.
          </p>
        </section>

        {/* Search */}
        <div className="flex justify-center mb-6">
          <div className="relative w-full max-w-md">
            <input
              type="text"
              placeholder="Search saved stacks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-3 pl-10 rounded-xl border border-gray-700 bg-gray-800 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            />
            <span
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            >
              🔍
            </span>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="text-center py-12 text-gray-300">Loading saved stacks…</div>
        ) : (
          <AnimatePresence>
            {filteredStacks.length > 0 ? (
              <motion.div
                key={debouncedSearchQuery}
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
                    savedStacks={savedStacks}
                    setSavedStacks={setSavedStacks}
                  />
                ))}
              </motion.div>
            ) : (
              <p className="italic text-gray-400 text-center">No saved stacks found.</p>
            )}
          </AnimatePresence>
        )}
      </main>

      {/* Compare Bar */}
      {selectedCompareStacks.length > 0 && (
        <motion.div
          className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-xl px-4 py-2 flex items-center gap-4 shadow-lg z-50"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
        >
          <span className="text-sm text-gray-300 font-medium">Selected for Compare:</span>
          {selectedCompareStacks.map((stack) => (
            <div
              key={stack.id}
              className="flex items-center gap-2 bg-gray-800 px-3 py-1 rounded-full text-sm relative"
            >
              <span className="font-medium">{stack.name}</span>
              <button
                className="text-gray-400 hover:text-red-400"
                onClick={() =>
                  setSelectedCompareStacks(selectedCompareStacks.filter((s) => s.id !== stack.id))
                }
                title="Remove from compare"
              >
                ✕
              </button>
            </div>
          ))}
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
          </div>
        </motion.div>
      )}

      {/* Modals */}
      {modalStack && <NutritionModal stack={modalStack} onClose={() => setModalStack(null)} />}
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
