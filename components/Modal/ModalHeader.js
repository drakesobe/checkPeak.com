// components/ModalHeader.jsx
"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ValueRating from "./ValueRating";

export default function ModalHeader({
  stack,
  servingsNumber,
  priceNumber,
  matchedRecords = [],       // banned matches
  matchedIngredients = [],   // ingredient matches
  onClose,
}) {
  const [displayCounts, setDisplayCounts] = useState({
    All: "–",
    Prohibited: "–",
    Limited: "–",
    Other: "–",
  });

  const [tooltipVisible, setTooltipVisible] = useState(null);

  // Must match SmartStack / ModalContent palette
  const filterColors = {
    All: "bg-gray-600 text-white",
    Prohibited: "bg-red-600 text-white",
    Limited: "bg-orange-500 text-white",
    Other: "bg-blue-600 text-white",
  };

  const tooltips = {
    All: "Total banned + ingredient matches found for this product.",
    Prohibited: "Matches classified as fully prohibited in competition.",
    Limited:
      "Matches limited to out-of-competition use or with special timing rules.",
    Other:
      "Sport-specific or monitored substances, plus all non-banned ingredients.",
  };

  // --- ban-type helpers (same normalization as the rest of the app) ---

  const getBanTypeRaw = (rec) => {
    if (!rec) return null;
    if (rec.banType) return rec.banType;
    if (rec.fields && rec.fields["Ban Type"]) return rec.fields["Ban Type"];
    if (rec._raw && rec._raw["Ban Type"]) return rec._raw["Ban Type"];
    return null;
  };

  const normalizeBanLabel = (val) => {
    if (!val) return null;
    const s = String(val).trim().toLowerCase();
    if (s === "prohibited") return "Prohibited";
    if (
      s === "limited to out of competition" ||
      s === "limited out of competition"
    )
      return "Limited to Out of Competition";
    if (s === "particular sports") return "Particular Sports";
    return val;
  };

  // --- sync counts whenever banned / ingredients change ---

  useEffect(() => {
    const banned = Array.isArray(matchedRecords) ? matchedRecords : [];
    const ings = Array.isArray(matchedIngredients) ? matchedIngredients : [];

    const totalMatches = banned.length + ings.length;

    if (!totalMatches) {
      setDisplayCounts({
        All: "–",
        Prohibited: "–",
        Limited: "–",
        Other: "–",
      });
      return;
    }

    const normalized = banned.map((rec) => {
      const raw = getBanTypeRaw(rec);
      const norm = normalizeBanLabel(raw);
      return { ...rec, _banTypeNorm: norm };
    });

    const bannedProhibited = normalized.filter(
      (r) => r._banTypeNorm === "Prohibited"
    );
    const bannedLimited = normalized.filter(
      (r) => r._banTypeNorm === "Limited to Out of Competition"
    );
    const bannedOther = normalized.filter(
      (r) =>
        r._banTypeNorm !== "Prohibited" &&
        r._banTypeNorm !== "Limited to Out of Competition"
    );

    // Mirror ModalContent's counts model:
    //   All    = banned + ingredients
    //   Prohib = prohibited only
    //   Limited= limited only
    //   Other  = other banned + all ingredients
    setDisplayCounts({
      All: totalMatches,
      Prohibited: bannedProhibited.length,
      Limited: bannedLimited.length,
      Other: bannedOther.length + ings.length,
    });
  }, [matchedRecords, matchedIngredients]);

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      {/* LEFT: title + meta + chips */}
      <div>
        <h2 className="text-2xl font-bold mb-1 text-white">
          {stack.name}
        </h2>

        <div className="text-sm text-gray-300 flex flex-wrap gap-4 items-center">
          {/* Servings */}
          <div className="text-xs text-gray-400">
            Servings:{" "}
            <span className="font-semibold text-white">
              {servingsNumber || "N/A"}
            </span>
          </div>

          {/* Price */}
          <div className="text-xs text-gray-400">
            Price:{" "}
            <span className="font-semibold text-white">
              {priceNumber ? `$${Number(priceNumber).toFixed(2)}` : "N/A"}
            </span>
          </div>

          {/* Value rating */}
          <div className="ml-0">
            <ValueRating stack={stack} />
          </div>

          {/* Banned / ingredient summary chips */}
          <div className="flex flex-wrap gap-2 mt-1 relative">
            {["All", "Prohibited", "Limited", "Other"].map((type) => (
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

      {/* RIGHT: close button */}
      <div className="flex items-center gap-2 self-start md:self-auto">
        <button
          onClick={onClose}
          aria-label="Close"
          className="text-white text-lg font-bold bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded transition"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
