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
      const res = await fetch(`/api/barcode?barcode=${barcode}`);
      if (!res.ok) throw new Error("Failed to fetch barcode data");
      const data = await res.json();
      setResult(data);

      if (typeof onResult === "function") {
        onResult(data);
      }
    } catch (err) {
      console.error("Barcode lookup failed:", err);
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

      {error && (
        <p className="text-red-600 text-sm mt-2">{error}</p>
      )}

      {result && (
        <div className="mt-4">
          <h3 className="font-bold text-gray-800">
            Product: {result.productName || "Unknown"}
          </h3>
          <p className="text-sm text-gray-700 mt-1">
            <strong>Ingredients:</strong>{" "}
            {result.ingredients || "Not available"}
          </p>

          {result.matchedBanned?.length > 0 ? (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
              <h4 className="font-semibold text-red-700 mb-1">
                🚨 Banned Substances Found
              </h4>
              <ul className="list-disc pl-5 text-red-600 text-sm">
                {result.matchedBanned.map((item) => (
                  <li key={item.id}>
                    <span className="font-medium">
                      {item.fields["Substance Name"]}
                    </span>{" "}
                    {item.matchedTerms?.length > 0 && (
                      <span>
                        (matched terms:{" "}
                        {item.matchedTerms.join(", ")})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-3 text-green-600 font-medium">
              ✅ No banned substances detected
            </p>
          )}
        </div>
      )}
    </div>
  );
}
