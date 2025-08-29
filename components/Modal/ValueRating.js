"use client";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * ValueRating - badge with a mouse-following tooltip that matches ModalHeader style
 */
export default function ValueRating({ stack }) {
  const parseNumber = (v) => {
    if (v == null) return 0;
    if (typeof v === "number") return isFinite(v) ? v : 0;
    const cleaned = String(v).replace(/[^0-9.\-]/g, "");
    const n = parseFloat(cleaned);
    return isFinite(n) ? n : 0;
  };

  const price =
    parseNumber(stack?.fields?.Price) ||
    parseNumber(stack?.rawFields?.Price) ||
    parseNumber(stack?.price);

  const servings =
    parseNumber(stack?.fields?.Servings) ||
    parseNumber(stack?.rawFields?.Servings) ||
    parseNumber(stack?.servings);

  const valueScore = price > 0 ? servings / price : 0;

  let valueColor = "";
  let valueLabel = "";

  if (valueScore >= 1.5) {
    valueColor = "bg-blue-600 text-white";
    valueLabel = "Best Value";
  } else if (valueScore >= 0.75) {
    valueColor = "bg-yellow-500 text-gray-900";
    valueLabel = "Moderate";
  } else {
    valueColor = "bg-red-600 text-white";
    valueLabel = "Premium";
  }

  const tooltipText = "A value based on servings-to-price ratio.";
  const [visible, setVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0 });
  const badgeRef = useRef(null);
  const tooltipRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!badgeRef.current || !tooltipRef.current) return;

    const badgeRect = badgeRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    // Mouse X relative to badge
    let x = e.clientX - badgeRect.left;

    // Keep tooltip inside modal horizontally
    const modalWidth = badgeRect.width + 400; // approximate modal width
    if (x + tooltipRect.width / 2 > modalWidth) {
      x = modalWidth - tooltipRect.width / 2;
    }
    if (x - tooltipRect.width / 2 < 0) {
      x = tooltipRect.width / 2;
    }

    setTooltipPos({ x });
  };

  return (
    <div
      className="relative inline-block"
      ref={badgeRef}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onMouseMove={handleMouseMove}
    >
      <motion.span
        className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${valueColor} cursor-default`}
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        {valueLabel}{" "}
        {isFinite(valueScore) && valueScore > 0 && price > 0 ? (
          <span className="ml-1 text-xs opacity-80">(${(price / servings).toFixed(2)}/serv)</span>
        ) : null}
      </motion.span>

      {/* Tooltip */}
      <AnimatePresence>
        {visible && (
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full -translate-x-1/2 mt-1 w-max max-w-xs bg-gray-900 text-white text-xs rounded-md p-2 shadow-lg z-50 pointer-events-none"
            style={{ left: tooltipPos.x }}
          >
            {tooltipText}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
