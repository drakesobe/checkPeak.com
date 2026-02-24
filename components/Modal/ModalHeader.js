// components/ModalHeader.jsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ValueRating from "./ValueRating";

/**
 * ModalHeader.jsx
 *
 * Mobile-first spacing + close button behavior
 * ✅ Close button pinned top-right INSIDE header (absolute)
 * ✅ Adds header right padding so title/chips never collide with X
 * ✅ Tappable close target (44x44)
 * ✅ Tooltip behavior:
 *    - Hover still works on desktop
 *    - Tap toggles on mobile
 *    - Tooltip uses pointer-events-auto so users can tap/scroll without weirdness
 * ✅ Tooltip positioning improved so it doesn't overflow as badly on mobile
 *
 * Note:
 * - If you use a FIXED close button in the parent modal (recommended for mobile),
 *   you can disable this header X by passing showClose={false}.
 */

export default function ModalHeader({
  stack,
  servingsNumber,
  priceNumber,
  matchedRecords = [], // banned matches
  matchedIngredients = [], // ingredient matches
  onClose,
  showClose = true, // ✅ optional: allow parent modal to own the fixed X
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
    Limited: "Matches limited to out-of-competition use or with special timing rules.",
    Other: "Sport-specific or monitored substances, plus all non-banned ingredients.",
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
    if (s === "limited to out of competition" || s === "limited out of competition")
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

    const bannedProhibited = normalized.filter((r) => r._banTypeNorm === "Prohibited");
    const bannedLimited = normalized.filter((r) => r._banTypeNorm === "Limited to Out of Competition");
    const bannedOther = normalized.filter(
      (r) => r._banTypeNorm !== "Prohibited" && r._banTypeNorm !== "Limited to Out of Competition"
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

  // A stable product name fallback
  const title = useMemo(() => {
    const raw = stack?.name || stack?.Name || stack?.fields?.Name || "Product";
    return String(raw).trim() || "Product";
  }, [stack]);

  // Mobile helper: close tooltip when tapping elsewhere
  // (Optional: parent modal can also close tooltips, but this is lightweight)
  const closeTooltip = () => setTooltipVisible(null);

  return (
    <div className="relative">
      {/* ✅ Close button pinned top-right of the header area */}
      {showClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={[
            "absolute right-0 top-0",
            // touch target
            "h-11 w-11 rounded-full",
            "grid place-items-center",
            "bg-gray-700/90 hover:bg-gray-600 text-white",
            "border border-white/10",
            "shadow-md shadow-black/20",
            "transition active:scale-95",
            // keep it above chips/tooltips
            "z-20",
          ].join(" ")}
        >
          <span className="text-lg leading-none">✕</span>
        </button>
      )}

      {/* Header content */}
      <div
        className={[
          "flex flex-col md:flex-row md:items-center md:justify-between gap-3",
          // ✅ reserve space so text/chips don't sit under the X
          showClose ? "pr-12 sm:pr-14" : "",
        ].join(" ")}
        onClick={closeTooltip}
      >
        {/* LEFT: title + meta + chips */}
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-extrabold mb-1 text-white leading-tight break-words">
            {title}
          </h2>

          <div className="text-sm text-gray-300 flex flex-wrap gap-x-4 gap-y-2 items-center">
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
              {["All", "Prohibited", "Limited", "Other"].map((type) => {
                const open = tooltipVisible === type;

                return (
                  <div
                    key={type}
                    className="relative flex items-center"
                    onMouseEnter={() => setTooltipVisible(type)}
                    onMouseLeave={() => setTooltipVisible(null)}
                  >
                    {/* Chip button - tap toggles tooltip on mobile */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTooltipVisible((prev) => (prev === type ? null : type));
                      }}
                      className="focus:outline-none"
                      aria-expanded={open ? "true" : "false"}
                      aria-label={`${type} matches: ${displayCounts[type]}`}
                    >
                      <motion.span
                        className={[
                          "px-2 py-0.5 rounded-full text-xs font-semibold",
                          "inline-flex items-center gap-1",
                          filterColors[type],
                        ].join(" ")}
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                      >
                        {type}: {displayCounts[type]}
                      </motion.span>
                    </button>

                    <AnimatePresence>
                      {open && (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.18 }}
                          className={[
                            // ✅ better mobile positioning: align left, not center, avoid going off-screen
                            "absolute top-full left-0 mt-2",
                            "w-[min(320px,90vw)]",
                            "bg-gray-900 text-white text-xs rounded-md p-2",
                            "shadow-lg border border-white/10",
                            "z-30",
                            // allow interaction if needed
                            "pointer-events-auto",
                          ].join(" ")}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {tooltips[type]}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: On desktop you can still place extra actions here if you want */}
        <div className="hidden md:flex items-center gap-2" />
      </div>
    </div>
  );
}