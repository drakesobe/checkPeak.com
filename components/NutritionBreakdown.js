// components/NutritionBreakdown.js
"use client";
import { useState, useEffect } from "react";
import OCRResultsBase from "./OCRResultsBase";

export default function NutritionBreakdown({
  ocrText = "",
  showOCR = false,
  prefetchedRecords = null, // NEW: use these if provided
}) {
  const [matchedSubstances, setMatchedSubstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [highlightedOCR, setHighlightedOCR] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function go() {
      setLoading(true);
      setError("");

      try {
        let records = prefetchedRecords;

        // If no prefetched results, fetch from API
        if (!records) {
          const res = await fetch("/api/check-smartstack", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ocrText }),
          });
          const data = await res.json();
          records = data.records || [];
        }

        if (cancelled) return;

        setMatchedSubstances(records);

        // Highlight inside OCR text
        if (ocrText && records?.length) {
          let txt = ocrText;
          const words = new Set();
          records.forEach((r) => {
            const f = r.fields || {};
            if (f["Substance Name"]) words.add(f["Substance Name"]);
            (f["Synonyms"] || "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
              .forEach((s) => words.add(s));
          });

          words.forEach((w) => {
            const safe = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const re = new RegExp(`(${safe})`, "gi");
            txt = txt.replace(
              re,
              `<mark class="bg-yellow-300 text-black font-semibold px-0.5 rounded">$1</mark>`
            );
          });
          setHighlightedOCR(txt);
        } else {
          setHighlightedOCR(ocrText || "");
        }
      } catch (e) {
        console.error("SmartStack fetch error:", e);
        if (!cancelled) setError("Failed to fetch SmartStack data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    go();
    return () => {
      cancelled = true;
    };
  }, [ocrText, prefetchedRecords]);

  if (loading) return <p className="text-gray-300 animate-pulse">Analyzing ingredients…</p>;
  if (error) return <p className="text-red-400">{error}</p>;

  return (
    <div className="space-y-6">
      {showOCR ? (
        <div
          className="bg-gray-700 p-4 rounded-lg text-gray-200 whitespace-pre-wrap max-h-[60vh] overflow-auto"
          dangerouslySetInnerHTML={{ __html: highlightedOCR || "No OCR text detected." }}
        />
      ) : (
        <>
          <OCRResultsBase
            ocrText={ocrText}
            detectedSubstances={matchedSubstances}
            showOCR={false}
          />

          {matchedSubstances.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-green-900/40 p-4 rounded-xl">
                <h3 className="text-lg font-bold text-green-300 mb-2">Potential Benefits</h3>
                <ul className="list-disc pl-4 space-y-1 text-gray-200">
                  {matchedSubstances.map((s) =>
                    s.fields?.Benefits ? <li key={s.id}>{s.fields.Benefits}</li> : null
                  )}
                </ul>
              </div>
              <div className="bg-red-900/40 p-4 rounded-xl">
                <h3 className="text-lg font-bold text-red-300 mb-2">Potential Side Effects</h3>
                <ul className="list-disc pl-4 space-y-1 text-gray-200">
                  {matchedSubstances.map((s) =>
                    s.fields?.["Side Effects"] ? (
                      <li key={s.id}>{s.fields["Side Effects"]}</li>
                    ) : null
                  )}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
