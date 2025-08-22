// pages/smartstack.js
import { useState, useEffect } from "react";
import NavBar from "../components/NavBar";
import { motion, AnimatePresence } from "framer-motion";
import { FaDumbbell, FaBolt, FaLeaf, FaCoffee, FaAppleAlt, FaCapsules } from "react-icons/fa";

export default function SmartStackPage() {
  const [activeBanType, setActiveBanType] = useState(null);
  const [activeValueFilter, setActiveValueFilter] = useState(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [stacks, setStacks] = useState([]);

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
    fetch("/api/smartstack")
      .then((res) => res.json())
      .then((data) => setStacks(data.records || []))
      .catch((err) => console.error(err));
  }, []);

  const handleBanTypeClick = (label) => {
    setActiveBanType(activeBanType === label ? null : label);
  };

  const handleValueClick = (key) => {
    setActiveValueFilter(activeValueFilter === key ? null : key);
  };

  const handleCategoryClick = (category) => {
    setActiveCategory(category);
  };

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
        {/* Hero Section */}
        <section className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">SmartStack</h1>
          <p className="text-gray-300">
            Browse stacks by category and discover the best supplements for your goals.
          </p>
        </section>

        {/* Category Tabs */}
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
            <div
              key={type.label}
              className={`flex items-center gap-2 cursor-pointer transition-transform hover:scale-110 px-3 py-1 rounded-full border ${
                activeBanType === type.label ? "border-gray-200 bg-opacity-30" : "border-transparent"
              }`}
              onClick={() => handleBanTypeClick(type.label)}
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

        {/* Cards Grid */}
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
                <motion.div
                  key={stack.id}
                  className="bg-gray-800 p-5 rounded-2xl shadow-md hover:shadow-lg relative group overflow-hidden"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Magnifier hover overlay */}
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-12 w-12 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z"
                      />
                    </svg>
                  </div>

                  <h3 className="text-xl font-bold mb-2">{stack.name}</h3>
                  <p className="text-gray-300 text-sm mb-2 flex flex-wrap gap-2">
                    {stack.supplements.map((supp) => (
                      <span key={supp} className="flex items-center gap-1 px-2 py-1 bg-gray-700 rounded-full text-xs">
                        {supplementIcons[supp] || <FaCapsules />}
                        {supp}
                      </span>
                    ))}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      stack.valueRating === "bestValue" ? "bg-green-600 text-white" :
                      stack.valueRating === "moderate" ? "bg-yellow-600 text-white" :
                      stack.valueRating === "highPrice" ? "bg-red-600 text-white" : ""
                    }`}>{valueLabel(stack.valueRating)}</span>

                    <span className="px-2 py-1 rounded-full text-xs font-medium" style={{
                      backgroundColor: stack.banType === "Prohibited" ? "#d62828" :
                                       stack.banType === "Limited to Out of Competition" ? "#f77f00" :
                                       stack.banType === "Particular Sports" ? "#003049" : "#555",
                      color: "white"
                    }}>{stack.banType}</span>
                  </div>

                  <p className="text-gray-400 text-sm mb-4">{stack.notes}</p>

                  <a
                    href={stack.affiliateLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute bottom-4 right-4 px-3 py-1 bg-[#46769B] hover:bg-blue-700 rounded-2xl text-white text-sm font-medium transition-colors"
                  >
                    See Price
                  </a>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <p className="italic text-gray-400 text-center">No stacks match your filters.</p>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
