import { useState, useEffect } from "react";
import NavBar from "../components/NavBar";
import { motion, AnimatePresence } from "framer-motion";
import StackCard from "../components/StackCard";
import NutritionModal from "../components/NutritionModal";

export default function SmartStackPage() {
  const [activeBanType, setActiveBanType] = useState(null);
  const [activeValueFilter, setActiveValueFilter] = useState(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [stacks, setStacks] = useState([]);
  const [modalStack, setModalStack] = useState(null);
  const [loading, setLoading] = useState(false);

  const banTypeColors = [
    { label: "Prohibited", color: "#d62828" },
    { label: "Limited to Out of Competition", color: "#f77f00" },
    { label: "Particular Sports", color: "#003049" },
  ];

  const valueFilters = [
    { label: "Best Value", key: "bestValue" },
    { label: "Moderate", key: "moderate" },
    { label: "Premium", key: "highPrice" },
  ];

  const categories = [
    "All",
    "Pre-Workout",
    "Protein Powder",
    "Energy Drinks",
    "Protein Bars",
    "BCAAs",
    "Misc",
  ];

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/smartstack");
        const data = await res.json();
        setStacks(data.records || []);
      } catch (e) {
        console.error("Failed to load SmartStack data", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleBanTypeClick = (label) =>
    setActiveBanType(activeBanType === label ? null : label);
  const handleValueClick = (key) =>
    setActiveValueFilter(activeValueFilter === key ? null : key);
  const handleCategoryClick = (category) => setActiveCategory(category);

  // Filtering
  const filteredStacks = stacks
    .filter((stack) => {
      const categoryMatch =
        activeCategory === "All" ? true : stack.category === activeCategory;
      const banMatch = activeBanType ? stack.banType === activeBanType : true;
      const valueMatch = activeValueFilter
        ? stack.valueRating === activeValueFilter
        : true;
      return categoryMatch && banMatch && valueMatch;
    })
    // Sorting by Value Rating (Best → Moderate → Premium)
    .sort((a, b) => {
      const order = { bestValue: 1, moderate: 2, highPrice: 3 };
      return (order[a.valueRating] || 99) - (order[b.valueRating] || 99);
    });

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-gray-50 font-sans">
      <NavBar />

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Hero */}
        <section className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
            SmartStack
          </h1>
          <p className="text-gray-300 text-lg">
            Discover and filter supplements with verified safety and value
            insights.
          </p>
        </section>

        {/* Categories */}
        <div className="flex flex-wrap gap-3 mb-6 justify-center">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryClick(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-transform hover:scale-105 ${
                activeCategory === cat
                  ? "bg-[#46769B] text-white shadow-md"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6 justify-center">
          {banTypeColors.map((type) => (
            <button
              key={type.label}
              onClick={() => handleBanTypeClick(type.label)}
              className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-transform hover:scale-105 ${
                activeBanType === type.label
                  ? "border-gray-200 bg-opacity-30"
                  : "border-transparent"
              }`}
              title={type.label}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: type.color }}
              />
              <span className="text-sm font-medium">{type.label}</span>
            </button>
          ))}

          {valueFilters.map((filter) => (
            <button
              key={filter.key}
              onClick={() => handleValueClick(filter.key)}
              className={`px-3 py-1 rounded-full cursor-pointer border transition-transform hover:scale-105 ${
                activeValueFilter === filter.key
                  ? "border-gray-200 bg-opacity-30"
                  : "border-transparent"
              }`}
            >
              <span className="text-sm font-medium">{filter.label}</span>
            </button>
          ))}
        </div>

        {/* Loading or Grid */}
        {loading ? (
          <div className="text-center py-12 text-gray-300">
            Loading SmartStack…
          </div>
        ) : (
          <AnimatePresence>
            {filteredStacks.length > 0 ? (
              <motion.div
                key={activeCategory + activeBanType + activeValueFilter}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {filteredStacks.map((stack) => (
                  <StackCard
                    key={stack.id}
                    stack={stack}
                    setModalStack={setModalStack}
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

      {/* Nutrition Modal */}
      {modalStack && (
        <NutritionModal
          stack={modalStack}
          onClose={() => setModalStack(null)}
        />
      )}
    </div>
  );
}
