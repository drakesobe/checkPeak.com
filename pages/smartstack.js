import { useState, useEffect } from "react";
import NavBar from "../components/NavBar";
import { motion, AnimatePresence } from "framer-motion";
import { FaDumbbell, FaBolt, FaLeaf, FaCoffee, FaAppleAlt, FaCapsules } from "react-icons/fa";
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
    { label: "High Price", key: "highPrice" },
  ];

  const categories = [
    "All",
    "Pre-Workout",
    "Protein Powder",
    "Energy Drinks",
    "Protein Bars",
    "BCAAs",
    "Misc"
  ];

  const supplementIcons = {
    "Caffeine": <FaCoffee />,
    "L-Theanine": <FaLeaf />,
    "B-Vitamins": <FaCapsules />,
    "Creatine Monohydrate": <FaDumbbell />,
    "L-Glutamine": <FaLeaf />,
    "BCAAs": <FaDumbbell />,
    "Omega-3": <FaCapsules />,
    "Bacopa Monnieri": <FaLeaf />,
    "Rhodiola Rosea": <FaLeaf />,
    "Beta-Alanine": <FaDumbbell />,
    "L-Citrulline": <FaLeaf />,
    "Electrolytes": <FaBolt />,
    "Vitamin C": <FaAppleAlt />,
    "Zinc": <FaCapsules />,
    "Elderberry": <FaAppleAlt />
  };

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

  const handleBanTypeClick = (label) => setActiveBanType(activeBanType === label ? null : label);
  const handleValueClick = (key) => setActiveValueFilter(activeValueFilter === key ? null : key);
  const handleCategoryClick = (category) => setActiveCategory(category);

  const filteredStacks = stacks.filter((stack) => {
    const categoryMatch = activeCategory === "All" ? true : stack.category === activeCategory;
    const banMatch = activeBanType ? stack.banType === activeBanType : true;
    const valueMatch = activeValueFilter ? stack.valueRating === activeValueFilter : true;
    return categoryMatch && banMatch && valueMatch;
  });

  const valueLabel = (valueRating) => {
    switch (valueRating) {
      case "bestValue": return "Best Value 💰";
      case "moderate": return "Moderate 💵";
      case "highPrice": return "Premium 💎";
      default: return "";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-gray-50 font-sans">
      <NavBar />

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Hero */}
        <section className="text-center mb-4">
          <h1 className="text-4xl font-bold text-white mb-2">SmartStack</h1>
          <p className="text-gray-300">Browse stacks by category and discover the best supplements for your goals.</p>
        </section>

        {/* Categories */}
        <div className="flex flex-wrap gap-3 mb-6 justify-center">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryClick(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-transform hover:scale-105 ${
                activeCategory === cat ? "bg-[#46769B] text-white shadow-md" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6 justify-center">
          {banTypeColors.map((type) => (
            <div
              key={type.label}
              className={`flex items-center gap-2 cursor-pointer transition-transform hover:scale-110 px-3 py-1 rounded-full border ${
                activeBanType === type.label ? "border-gray-200 bg-opacity-30" : "border-transparent"
              }`}
              onClick={() => handleBanTypeClick(type.label)}
              title={type.label}
            >
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: type.color }} />
              <span className="text-sm font-medium">{type.label}</span>
            </div>
          ))}

          {valueFilters.map((filter) => (
            <div
              key={filter.key}
              className={`px-3 py-1 rounded-full cursor-pointer border transition-transform hover:scale-110 ${
                activeValueFilter === filter.key ? "border-gray-200 bg-opacity-30" : "border-transparent"
              }`}
              onClick={() => handleValueClick(filter.key)}
            >
              <span className="text-sm font-medium">{filter.label}</span>
            </div>
          ))}
        </div>

        {/* Loading or Grid */}
        {loading ? (
          <div className="text-center py-12">Loading SmartStack…</div>
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
              <p className="italic text-gray-400 text-center">No stacks match your filters.</p>
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
