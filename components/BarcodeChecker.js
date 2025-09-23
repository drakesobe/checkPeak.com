// components/BarcodeChecker.js
"use client";

import { useState } from "react";

export default function BarcodeChecker({ onResult }) {
  const [barcode, setBarcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const handleCheck = async () => {
    if (!barcode.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(`/api/barcode?barcode=${encodeURIComponent(barcode)}`);
      if (!res.ok) throw new Error(`Barcode lookup failed: ${res.status}`);
      const data = await res.json();

      setResult(data);

      if (typeof onResult === "function") {
        onResult(data);
      }
    } catch (err) {
      console.error("Barcode lookup error:", err);
      setError("Could not fetch product info. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded-2xl shadow-md mt-4">
      <h2 className="text-lg font-semibold mb-2">Check Barcode</h2>

      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Enter or scan a barcode"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          className="flex-1 border p-2 rounded-md text-sm"
        />
        <button
          onClick={handleCheck}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Checking..." : "Check"}
        </button>
      </div>

      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

      {result && (
        <div className="mt-4 space-y-4">
          <div>
            <h3 className="font-bold text-gray-800">Product: {result.productName || "Unknown"}</h3>
            <p className="text-sm text-gray-700 mt-1">
              <strong>Ingredients:</strong> {result.ingredients || "Not available"}
            </p>
          </div>

          {/* Banned substances */}
          {result.matchedBanned?.length > 0 ? (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
              <h4 className="font-semibold text-red-700 mb-1">🚨 Banned Substances Found</h4>
              <ul className="list-disc pl-5 text-red-600 text-sm">
                {result.matchedBanned.map((item) => (
                  <li key={item.id}>
                    <span className="font-medium">{item.fields?.["Substance Name"] || item.fields?.name || "Unknown"}</span>{" "}
                    {item.matchedTerms?.length > 0 && (
                      <span>(matched: {item.matchedTerms.join(", ")})</span>
                    )}
                    {item.fields?.["Banned By"] && (
                      <div className="text-xs text-gray-600">Banned by: {item.fields["Banned By"]}</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-3 text-green-600 font-medium">✅ No banned substances detected</p>
          )}

          {/* Matched ingredients */}
          {result.matchedIngredients?.length > 0 ? (
            <div className="mt-3 bg-purple-50 border border-purple-200 rounded-lg p-3">
              <h4 className="font-semibold" style={{ color: "#5b3fa8" }}>🟣 Detected Ingredients</h4>
              <ul className="list-disc pl-5 text-purple-700 text-sm">
                {result.matchedIngredients.map((item) => (
                  <li key={item.id}>
                    <span className="font-medium">{item.fields?.["Name"] || item.fields?.name || "Unknown"}</span>{" "}
                    {item.matchedTerms?.length > 0 && (
                      <span className="text-sm text-gray-700"> (matched: {item.matchedTerms.join(", ")})</span>
                    )}
                    {item.fields?.Benefits && (
                      <div className="text-xs text-gray-600">
                        Benefits: {String(item.fields.Benefits).slice(0, 120)}
                        {String(item.fields.Benefits).length > 120 ? "…" : ""}
                      </div>
                    )}
                    {item.fields?.Weaknesses && (
                      <div className="text-xs text-gray-600">
                        Weaknesses: {String(item.fields.Weaknesses).slice(0, 120)}
                        {String(item.fields.Weaknesses).length > 120 ? "…" : ""}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            result.ingredients ? (
              <p className="text-gray-600 text-sm">No known ingredients matched in our database.</p>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
