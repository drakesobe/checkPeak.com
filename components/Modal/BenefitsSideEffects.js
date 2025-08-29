"use client";

/**
 * Placeholder copy for Benefits & Side Effects tab.
 * Replace this with your real content or dynamic analysis later.
 */
export default function BenefitsSideEffects() {
  return (
    <div className="bg-gray-700 p-4 rounded-lg text-gray-200 text-sm min-h-[100px] space-y-3">
      <p className="font-semibold">Benefits & Side Effects</p>
      <p>
        This section will summarize common benefits, likely mechanisms, and
        known side effects for the detected active ingredients in this product.
      </p>
      <ul className="list-disc pl-5 space-y-1 text-gray-300">
        <li>Evidence level (e.g., strong / moderate / limited)</li>
        <li>Typical effective dosing ranges</li>
        <li>Potential interactions or contraindications</li>
      </ul>
      <p className="text-gray-400">
        Coming soon. For now, use the “Detected Banned Substances” tab to review
        compliance risks, and the “Scanned Label” tab to verify ingredients.
      </p>
    </div>
  );
}
