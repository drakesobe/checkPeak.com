// pages/share/[token].js
"use client";

import { useRouter } from "next/router";
import { useEffect, useState, useCallback } from "react";
import NavBar from "@/components/NavBar";
import OCRScanResults from "@/components/OCRScanResults";

export default function SharedScanPage() {
  const router = useRouter();
  const { token } = router.query;

  const [scan, setScan] = useState(null);
  const [loadingScan, setLoadingScan] = useState(false);
  const [error, setError] = useState("");

  const [ocrText, setOcrText] = useState("");
  const [detectedBanned, setDetectedBanned] = useState([]);
  const [detectedIngredients, setDetectedIngredients] = useState([]);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState("");

  useEffect(() => {
    if (!token) return;

    async function fetchSharedScan() {
      try {
        setLoadingScan(true);
        setError("");

        const res = await fetch(
          `/api/getSharedScan?token=${encodeURIComponent(token)}`
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load shared scan.");
        }

        setScan(data.scan || null);
      } catch (err) {
        console.error("Shared scan load failed:", err);
        setError(err.message || "Failed to load shared scan.");
        setScan(null);
      } finally {
        setLoadingScan(false);
      }
    }

    fetchSharedScan();
  }, [token]);

  const runAnalysis = useCallback(async () => {
    if (!scan || !scan.stackDetails) {
      setAnalysisError("No ingredient text saved for this scan.");
      return;
    }

    try {
      setLoadingAnalysis(true);
      setAnalysisError("");

      const text = String(scan.stackDetails || "").trim();
      setOcrText(text);

      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Analysis failed.");
      }

      setDetectedBanned(Array.isArray(data.matchedBanned) ? data.matchedBanned : []);
      setDetectedIngredients(
        Array.isArray(data.matchedIngredients) ? data.matchedIngredients : []
      );
      setOcrText(
        data.ocrText && typeof data.ocrText === "string"
          ? data.ocrText
          : text
      );
    } catch (err) {
      console.error("Shared analysis failed:", err);
      setAnalysisError(err.message || "Failed to analyze ingredients.");
      setDetectedBanned([]);
      setDetectedIngredients([]);
    } finally {
      setLoadingAnalysis(false);
    }
  }, [scan]);

  useEffect(() => {
    if (scan && scan.stackDetails) {
      runAnalysis();
    }
  }, [scan, runAnalysis]);

  const renderRiskChips = () => {
    if (!scan) return null;
    const prohibitedCount = scan.prohibitedCount || 0;
    const limitedCount = scan.limitedCount || 0;
    const otherCount = scan.otherCount || 0;

    return (
      <div className="flex flex-wrap gap-2 mt-2 text-[11px] sm:text-xs">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-100">
          <span className="w-1.5 h-1.5 rounded-full bg-red-600 mr-1.5" />
          Prohibited: {prohibitedCount}
        </span>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-100">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mr-1.5" />
          Limited / Threshold: {limitedCount}
        </span>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mr-1.5" />
          Other flagged: {otherCount}
        </span>
      </div>
    );
  };

  let formattedDate = scan?.date;
  try {
    if (scan?.date) {
      formattedDate = new Date(scan.date).toLocaleString();
    }
  } catch {
    // keep raw
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 font-sans">
      {/* For shared views we don't really have an active tab */}
      <NavBar activeTab={null} setActiveTab={() => {}} />

      <main className="max-w-5xl mx-auto px-4 py-8 sm:py-10 space-y-6 sm:space-y-8">
        <section className="bg-white rounded-2xl shadow-md border border-blue-100 p-5 sm:p-6">
          <p className="text-[11px] sm:text-xs uppercase tracking-wide text-gray-400 mb-1">
            Shared Scan
          </p>

          {loadingScan ? (
            <p className="text-gray-500">Loading scan…</p>
          ) : error ? (
            <p className="text-red-600 text-sm">{error}</p>
          ) : !scan ? (
            <p className="text-gray-500 text-sm">
              This shared scan could not be found or is no longer available.
            </p>
          ) : (
            <>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                {scan.name || "Unnamed Scan"}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500">
                {formattedDate || ""}
              </p>

              {renderRiskChips()}

              {scan.productName && (
                <p className="mt-2 text-xs sm:text-sm text-gray-700">
                  <span className="font-semibold">Product:</span>{" "}
                  {scan.productName}
                </p>
              )}
            </>
          )}

          {analysisError && (
            <p className="mt-2 text-xs sm:text-sm text-red-600">
              {analysisError}
            </p>
          )}
        </section>

        {scan && !loadingScan && (
          <section className="bg-white rounded-2xl shadow-md border border-blue-100 p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3">
              Ingredient Breakdown & Highlights
            </h2>
            <OCRScanResults
              ocrText={ocrText}
              detectedSubstances={detectedBanned}
              detectedIngredients={detectedIngredients}
            />
          </section>
        )}
      </main>
    </div>
  );
}
