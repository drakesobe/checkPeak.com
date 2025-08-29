"use client";

import { motion } from "framer-motion";
import {
  FaDumbbell,
  FaBolt,
  FaLeaf,
  FaCoffee,
  FaAppleAlt,
  FaCapsules,
} from "react-icons/fa";
import ValueBadge from "./ValueBadge";

// Map common supplements to icons
const supplementIcons = {
  Caffeine: <FaCoffee />,
  "L-Theanine": <FaLeaf />,
  "B-Vitamins": <FaCapsules />,
  "Creatine Monohydrate": <FaDumbbell />,
  "L-Glutamine": <FaLeaf />,
  BCAAs: <FaDumbbell />,
  "Omega-3": <FaCapsules />,
  "Bacopa Monnieri": <FaLeaf />,
  "Rhodiola Rosea": <FaLeaf />,
  "Beta-Alanine": <FaDumbbell />,
  "L-Citrulline": <FaLeaf />,
  Electrolytes: <FaBolt />,
  "Vitamin C": <FaAppleAlt />,
  Zinc: <FaCapsules />,
  Elderberry: <FaAppleAlt />,
};

export default function StackCard({
  stack,
  setModalStack,
  selectedCompareStacks,
  setSelectedCompareStacks,
}) {
  const isSelected = selectedCompareStacks.some((s) => s.id === stack.id);

  const toggleCompare = (e) => {
    e.stopPropagation();
    if (isSelected) {
      setSelectedCompareStacks(
        selectedCompareStacks.filter((s) => s.id !== stack.id)
      );
    } else if (selectedCompareStacks.length < 3) {
      setSelectedCompareStacks([...selectedCompareStacks, stack]);
    }
  };

  return (
    <motion.div
      className={`relative bg-gradient-to-br from-gray-800 to-gray-700 p-5 rounded-2xl shadow-lg cursor-pointer flex flex-col transition-transform hover:scale-105 hover:shadow-2xl ${
        isSelected ? "ring-4 ring-green-500" : ""
      }`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      onClick={() => stack.nutritionLabel && setModalStack(stack)}
    >
      {/* Compare Checkbox / X */}
      <motion.button
        onClick={toggleCompare}
        className={`absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
          isSelected
            ? "bg-green-500 border-green-600 text-white"
            : "bg-gray-900 border-gray-600 text-transparent"
        }`}
        whileHover={{ scale: 1.2 }}
        transition={{ type: "spring", stiffness: 300 }}
        title={isSelected ? "Remove from compare" : "Select for compare (max 3)"}
      >
        {isSelected ? "✕" : "✓"}
      </motion.button>

      {/* Image */}
      {stack.imageUrl ? (
        <img
          src={stack.imageUrl}
          alt={stack.name}
          className="w-full h-52 md:h-56 lg:h-60 object-cover rounded-xl mb-4 flex-shrink-0 border border-gray-600"
          onError={(e) => {
            e.currentTarget.src = "/fallback-image.svg";
          }}
        />
      ) : (
        <div className="w-full h-52 md:h-56 lg:h-60 bg-gray-700 flex items-center justify-center rounded-xl mb-4 text-gray-400 text-sm border border-gray-600">
          No Image Available
        </div>
      )}

      {/* Stack Name */}
      <h3 className="text-2xl md:text-2xl font-bold mb-2 text-white truncate">{stack.name}</h3>

      {/* Supplements */}
      <div className="flex flex-wrap gap-2 mb-3">
        {Array.isArray(stack.supplements) && stack.supplements.length ? (
          stack.supplements.map((supp) => (
            <span
              key={supp}
              className="flex items-center gap-1 px-3 py-1 bg-gray-600 rounded-full text-xs md:text-sm text-white font-medium shadow-sm"
            >
              {supplementIcons[supp] || <FaCapsules />}
              {supp}
            </span>
          ))
        ) : (
          <span className="text-xs text-gray-400">No supplements listed</span>
        )}
      </div>

      {/* Value Badge */}
      {stack.valueScore != null && !isNaN(stack.valueScore) && (
        <div className="flex flex-wrap gap-2 mb-3">
          <ValueBadge valueScore={stack.valueScore} category={stack.category} />
        </div>
      )}

      {/* Notes */}
      {stack.notes && (
        <p className="text-gray-300 text-sm md:text-base mb-4 line-clamp-4">{stack.notes}</p>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 mt-auto flex-wrap">
        {stack.affiliateLink && (
          <a
            href={stack.affiliateLink}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 bg-[#46769B] hover:bg-[#375b7a] rounded-2xl text-white text-sm md:text-base font-semibold shadow-sm transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            See Price
          </a>
        )}

        {stack.nutritionLabel && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setModalStack(stack);
            }}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded-2xl text-white text-sm md:text-base font-semibold transition-colors"
          >
            View Nutrition
          </button>
        )}
      </div>

      {/* Compare Hint */}
      <p className="mt-2 text-gray-400 text-xs md:text-sm">
        {isSelected
          ? `Selected for comparison (${selectedCompareStacks.length}/3)`
          : "Click the ✓ to select for comparison (up to 3)"}
      </p>
    </motion.div>
  );
}
