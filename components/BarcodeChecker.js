// components/BarcodeChecker.js
"use client";

import { useState } from "react";

/**
 * Simple manual barcode checker.
 * - Sends the raw input to /api/check (which handles all candidate logic)
 * - Shows product name, ingredient preview, and banned/ingredient matches
 */
export default function BarcodeChecker({ onResult }) {
  const [barcode, setBarcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const handleCheck = async () => {
    const raw = barcode.trim();
    if (!raw) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const payload = {
        barcode: raw,
        isBarcodeFlow: true, // tells /api/check to treat this as a barcode path
      };

      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Barcode lookup failed: ${res.status}`);
      }

      // If API explicitly says "not found"
      if (data.found === false) {
        setError(
          data.message ||
            "We couldn't find this barcode in our product databases."
        );
        setResult(null);
        return;
      }

      console.log("[BarcodeChecker] API response:", data);
      setResult(data);

      if (typeof onResult === "function") onResult(data);
    } catch (err) {
      console.error("Barcode lookup error:", err);
      setError("Could not fetch product info. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCheck();
    }
  };

  const ingredientsPreview = (() => {
    if (!result) return "";
    const text =
      result.ingredientsText ||
      result.ocrText ||
      ""; // /api/check returns ingredientsText + ocrText
    if (!text) return "";
    const trimmed = String(text).trim();
    if (trimmed.length <= 260) return trimmed;
    return trimmed.slice(0, 260) + "…";
  })();

  const bannedMatches = result?.matchedBanned || [];
  const ingredientMatches = result?.matchedIngredients || [];
  const bannedDetails = result?.bannedDetails || null;

  return (
    <div className="p-4 bg-white rounded-2xl shadow-md mt-4 border border-blue-100">
      <h2 className="text-lg font-semibold mb-3 text-gray-900">
        Check Barcode (Manual)
      </h2>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <input
          type="text"
          placeholder="Enter or paste a barcode number"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 border border-gray-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#46769B]"
        />
        <button
          onClick={handleCheck}
          disabled={loading || !barcode.trim()}
          className={`px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-md transition ${
            loading || !barcode.trim()
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-[#46769B] hover:bg-blue-700"
          }`}
        >
          {loading ? "Checking…" : "Check"}
        </button>
      </div>

      {error && (
        <p className="text-red-600 text-sm mt-2 whitespace-pre-line">
          {error}
        </p>
      )}

      {/* Results */}
      {result && !error && (
        <div className="mt-4 space-y-4">
          {/* Basic product info */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
            <h3 className="font-bold text-gray-900 text-sm sm:text-base">
              Product:{" "}
              <span className="font-semibold">
                {result.productName || "Unknown product"}
              </span>
            </h3>
            {ingredientsPreview && (
              <p className="text-xs sm:text-sm text-gray-700 mt-2">
                <span className="font-semibold">Ingredients (preview): </span>
                {ingredientsPreview}
              </p>
            )}
          </div>

          {/* Summary badges */}
          {bannedDetails && (
            <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                <span className="w-2 h-2 rounded-full bg-red-600 mr-2" />
                Prohibited: {bannedDetails.ProhibitedCount ?? 0}
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                <span className="w-2 h-2 rounded-full bg-orange-500 mr-2" />
                Limited / Out-of-Competition:{" "}
                {bannedDetails.LimitedCount ?? 0}
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                <span className="w-2 h-2 rounded-full bg-blue-600 mr-2" />
                Other / Unspecified: {bannedDetails.OtherBannedCount ?? 0}
              </span>
            </div>
          )}

          {/* Banned substances */}
          <div className="mt-2">
            {bannedMatches.length > 0 ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <h4 className="font-semibold text-red-700 mb-1 text-sm">
                  🚨 Banned Substances Detected
                </h4>
                <ul className="list-disc pl-5 text-red-700 text-xs sm:text-sm space-y-1">
                  {bannedMatches.map((item) => (
                    <li key={item.id}>
                      <span className="font-medium">
                        {item.fields?.["Substance Name"] ||
                          item.fields?.name ||
                          "Unknown"}
                      </span>
                      {item.matchedTerms?.length > 0 && (
                        <span> (matched: {item.matchedTerms.join(", ")})</span>
                      )}
                      {item.fields?.["Ban Type"] && (
                        <div className="text-[11px] text-red-800 mt-0.5">
                          Ban type: {item.fields["Ban Type"]}
                        </div>
                      )}
                      {item.fields?.["Banned By"] && (
                        <div className="text-[11px] text-gray-700">
                          Banned by: {item.fields["Banned By"]}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-2 text-green-600 font-medium text-sm">
                ✅ No banned substances detected in this product based on our
                current database.
              </p>
            )}
          </div>

          {/* Matched ingredients */}
          {ingredientMatches.length > 0 && (
            <div className="mt-2 bg-purple-50 border border-purple-200 rounded-lg p-3">
              <h4 className="font-semibold text-sm" style={{ color: "#5b3fa8" }}>
                🟣 Detected Ingredients (From Ingredient DB)
              </h4>
              <ul className="list-disc pl-5 text-purple-800 text-xs sm:text-sm space-y-1 mt-1">
                {ingredientMatches.map((item) => (
                  <li key={item.id}>
                    <span className="font-medium">
                      {item.fields?.["Name"] ||
                        item.fields?.["Ingredient Name"] ||
                        item.fields?.name ||
                        "Unknown"}
                    </span>
                    {item.matchedTerms?.length > 0 && (
                      <span className="text-xs text-gray-700">
                        {" "}
                        (matched: {item.matchedTerms.join(", ")})
                      </span>
                    )}
                    {item.fields?.Benefits && (
                      <div className="text-[11px] text-gray-700 mt-0.5">
                        <span className="font-medium">Benefits: </span>
                        {String(item.fields.Benefits).slice(0, 140)}
                        {String(item.fields.Benefits).length > 140 ? "…" : ""}
                      </div>
                    )}
                    {item.fields?.Weaknesses && (
                      <div className="text-[11px] text-gray-700">
                        <span className="font-medium">Weaknesses: </span>
                        {String(item.fields.Weaknesses).slice(0, 140)}
                        {String(item.fields.Weaknesses).length > 140 ? "…" : ""}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ingredientMatches.length === 0 &&
            !bannedMatches.length &&
            ingredientsPreview && (
              <p className="text-gray-600 text-xs sm:text-sm">
                We parsed the ingredient text but didn&apos;t find any matches
                in our ingredient database yet.
              </p>
            )}
        </div>
      )}
    </div>
  );
}
