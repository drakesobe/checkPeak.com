// components/ModalHeader.jsx
"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ValueRating from "./ValueRating";

export default function ModalHeader({
  stack,
  servingsNumber,
  priceNumber,
  matchedRecords = [],
  onClose,
}) {
  const [displayCounts, setDisplayCounts] = useState({
    All: "–",
    Prohibited: "–",
    Limited: "–",
    Other: "–",
  });

  const [tooltipVisible, setTooltipVisible] = useState(null);

  // Match ModalContent’s brand colors
  const filterColors = {
    All: "bg-gray-600 text-white",
    Prohibited: "bg-red-600 text-white",
    Limited: "bg-orange-500 text-white",
    Other: "bg-blue-600 text-white",
  };

  const tooltips = {
    All: "Total number of banned / monitored substances detected for this product.",
    Prohibited: "Substances fully prohibited in competition.",
    Limited:
      "Substances that are limited to out-of-competition use or have special timing rules.",
    Other:
      "Substances that are monitored, sport-specific, or otherwise not fully prohibited.",
  };

  // --- ban-type helpers (mirror ModalContent logic) ---

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

  // Animate & sync counts whenever the records change
  useEffect(() => {
    if (!matchedRecords || matchedRecords.length === 0) {
      setDisplayCounts({
        All: "–",
        Prohibited: "–",
        Limited: "–",
        Other: "–",
      });
      return;
    }

    const normalized = matchedRecords.map((rec) => {
      const raw = getBanTypeRaw(rec);
      const norm = normalizeBanLabel(raw);
      return { ...rec, _banTypeNorm: norm };
    });

    const total = normalized.length;
    const prohibited = normalized.filter(
      (r) => r._banTypeNorm === "Prohibited"
    ).length;

    const limited = normalized.filter(
      (r) => r._banTypeNorm === "Limited to Out of Competition"
    ).length;

    const other = normalized.filter(
      (r) =>
        r._banTypeNorm !== "Prohibited" &&
        r._banTypeNorm !== "Limited to Out of Competition"
    ).length;

    setDisplayCounts({
      All: total,
      Prohibited: prohibited,
      Limited: limited,
      Other: other,
    });
  }, [matchedRecords]);

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      {/* LEFT SIDE: TITLE + PRODUCT META + BANNED SUMMARY */}
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

          {/* Banned substance summary */}
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

      {/* RIGHT SIDE: CLOSE BUTTON */}
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
