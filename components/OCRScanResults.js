// components/OCRScanResults.js
import { useState } from "react";
import OCRResultsBase from "./OCRResultsBase";

// Escape regex special characters safely
const escapeRegex = (string) => String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default function OCRScanResults({ ocrText, matchedSubstances }) {
  const [showOCR, setShowOCR] = useState(false); // parent-level toggle
  if (!matchedSubstances) return null;

  // Normalize OCR text: remove line breaks, collapse spaces, lowercase
  const normalizedOCRText = (ocrText || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();

  // Exact-match detection for OCR scan:
  // - skip names that are empty or a single digit (to avoid matches like "1" from serving sizes)
  // - require whole-word match using word boundaries; escape special chars to avoid regex errors
  const detectedSubstances = matchedSubstances.filter((record) => {
    const names = [
      (record.fields["Substance Name"] || "").trim(),
      ...((record.fields["Synonyms"]?.split(",") || []).map((s) => s.trim())),
    ];

    return names.some((name) => {
      if (!name) return false;
      const cleaned = name.trim();
      // Avoid matching short/number-only tokens from labels (e.g., "1", "2")
      if (cleaned.length < 2) return false;
      if (/^[0-9]+$/.test(cleaned)) return false;

      const safeName = escapeRegex(cleaned);
      // Use word boundary matching for exact-match behavior.
      // This avoids catching single digits inside nutrition values.
      try {
        const regex = new RegExp(`\\b${safeName}\\b`, "i");
        return regex.test(normalizedOCRText);
      } catch (err) {
        // Fallback: if regex construction fails for some odd reason, do case-insensitive substring match
        return normalizedOCRText.includes(cleaned.toLowerCase());
      }
    });
  });

  return (
    <div className="w-full max-w-4xl mx-auto mt-4 font-sans space-y-4">
      {/* Toggle OCR Raw Results - friendly label */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowOCR(!showOCR)}
          className="px-4 py-2 bg-gray-200 rounded-lg font-medium hover:bg-gray-300 transition"
        >
          {showOCR ? "Hide Scanned Label" : "View Scanned Label"}
        </button>
      </div>

      {/* OCRResultsBase handles both OCR text (controlled via showOCR) and table */}
      <OCRResultsBase
        ocrText={ocrText}
        detectedSubstances={detectedSubstances}
        showOCR={showOCR}
        hideTitle={false}
      />
    </div>
  );
}
