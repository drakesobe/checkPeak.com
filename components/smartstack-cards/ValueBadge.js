"use client";

import Tooltip from "./Tooltip";

const defaultThresholds = { good: 0.8, best: 1.5 };

const categoryThresholds = {
  "Pre-Workout": { good: 0.8, best: 1.5 },
  "Protein Powder": { good: 0.8, best: 1.5 },
  "Energy Drinks": { good: 0.8, best: 1.5 },
  "Protein Bars": { good: 0.8, best: 1.5 },
  BCAAs: { good: 0.8, best: 1.5 },
  Creatine: { good: 0.8, best: 1.5 },
  Misc: { good: 0.8, best: 1.5 },
};

export default function ValueBadge({ valueScore, category }) {
  if (valueScore == null || isNaN(valueScore)) return null;

  const thresholds = categoryThresholds[category] || defaultThresholds;

  let label = "Decent Value";
  let color = "bg-yellow-500"; // Decent Value = yellow (matches page filter)

  if (valueScore >= thresholds.best) {
    label = "Best Value";
    color = "bg-green-500"; // Best Value = green
  } else if (valueScore >= thresholds.good) {
    label = "Good Value";
    color = "bg-blue-500"; // Good Value = blue
  }

  return (
    <Tooltip content="A value based on servings-to-price ratio.">
      <span
        className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold text-white ${color}`}
      >
        {label} ({valueScore.toFixed(2)})
      </span>
    </Tooltip>
  );
}
