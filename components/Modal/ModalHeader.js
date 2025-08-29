"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ValueRating from "./ValueRating";

export default function ModalHeader({ stack, servingsNumber, priceNumber, matchedRecords = [], onClose }) {
  const [displayCounts, setDisplayCounts] = useState({
    All: "–",
    Prohibited: "–",
    "Limited to Out of Competition": "–",
    Other: "–",
  });

  const [tooltipVisible, setTooltipVisible] = useState(null);

  const filterColors = {
    All: "bg-gray-600 text-white",
    Prohibited: "bg-red-600 text-white",
    "Limited to Out of Competition": "bg-orange-500 text-white",
    Other: "bg-blue-600 text-white",
  };

  const tooltips = {
    All: "Total number of detected substances",
    Prohibited: "Substances prohibited in competition",
    "Limited to Out of Competition": "Substances limited to out-of-competition use",
    Other: "Monitored or less critical substances",
  };

  // Animate counts when matchedRecords changes
  useEffect(() => {
    const counts = {
      All: matchedRecords.length || "–",
      Prohibited: matchedRecords.length
        ? matchedRecords.filter(
            (r) => (r.banType || r.fields?.["Ban Type"]) === "Prohibited"
          ).length
        : "–",
      "Limited to Out of Competition": matchedRecords.length
        ? matchedRecords.filter(
            (r) => (r.banType || r.fields?.["Ban Type"]) === "Limited to Out of Competition"
          ).length
        : "–",
      Other: matchedRecords.length
        ? matchedRecords.filter(
            (r) =>
              !["Prohibited", "Limited to Out of Competition"].includes(
                r.banType || r.fields?.["Ban Type"]
              )
          ).length
        : "–",
    };
    setDisplayCounts(counts);
  }, [matchedRecords]);

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div>
        <h2 className="text-2xl font-bold mb-1">{stack.name}</h2>

        <div className="text-sm text-gray-300 flex flex-wrap gap-4 items-center">
          {/* Price & Servings */}
          <div className="text-xs text-gray-400">
            Servings: <span className="font-semibold text-white">{servingsNumber || "N/A"}</span>
          </div>
          <div className="text-xs text-gray-400">
            Price:{" "}
            <span className="font-semibold text-white">
              {priceNumber ? `$${Number(priceNumber).toFixed(2)}` : "N/A"}
            </span>
          </div>

          {/* ValueRating badge */}
          <div className="ml-0">
            <ValueRating stack={stack} />
          </div>

          {/* Banned substance counts with interactive tooltips */}
          <div className="flex flex-wrap gap-2 mt-1 relative">
            {Object.keys(displayCounts).map((type) => (
              <div
                key={type}
                className="relative flex items-center"
                onMouseEnter={() => setTooltipVisible(type)}
                onMouseLeave={() => setTooltipVisible(null)}
                onClick={() =>
                  setTooltipVisible((prev) => (prev === type ? null : type))
                }
              >
                <motion.span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${filterColors[type]}`}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {type}: {displayCounts[type]}
                </motion.span>

                <AnimatePresence>
                  {tooltipVisible === type && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.2 }}
                      className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-max max-w-xs bg-gray-900 text-white text-xs rounded-md p-2 shadow-lg z-50 pointer-events-none"
                    >
                      {tooltips[type]}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Close button */}
      <div className="flex items-center gap-2">
        <button
          onClick={onClose}
          aria-label="Close"
          className="text-white text-lg font-bold bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
