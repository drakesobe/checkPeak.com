// pages/scans/[id].js
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import NavBar from "@/components/NavBar";
import OCRScanResults from "@/components/OCRScanResults";
import { useAuthContext } from "@/hooks/useAuth";
import { trackEvent } from "@/lib/analytics";

export default function ScanDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuthContext();

  const [activeTab, setActiveTab] = useState("My Scans");
  const [scan, setScan] = useState(null);
  const [loadingScan, setLoadingScan] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState("");
  const [analysisError, setAnalysisError] = useState("");

  const [ocrText, setOcrText] = useState("");
  const [detectedBanned, setDetectedBanned] = useState([]);
  const [detectedIngredients, setDetectedIngredients] = useState([]);

  // Redirect if not logged in
  useEffect(() => {
    if (user === undefined) return; // still resolving
    if (!user) router.push("/login");
  }, [user, router]);

  // Fetch scan by ID
  useEffect(() => {
    if (!user || !id) return;

    async function fetchScan() {
      try {
        setLoadingScan(true);
        setError("");

        const res = await fetch(`/api/getScanById?id=${encodeURIComponent(id)}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Failed to fetch scan (${res.status})`);
        }
        const data = await res.json();
        if (!data.scan) {
          throw new Error("Scan not found");
        }

        setScan(data.scan);

        // track page view for this specific scan
        try {
          trackEvent("scan_detail_view", {
            eventType: "scan_detail_view",
            userEmail: user.Email || user.email || "",
            path: typeof window !== "undefined" ? window.location.pathname : "",
            source: "scan_detail_page",
            device:
              typeof navigator !== "undefined" ? navigator.userAgent : "",
            payload: {
              scanId: data.scan.id,
              scanName: data.scan.name || "Unnamed Scan",
              prohibitedCount: data.scan.prohibitedCount || 0,
              limitedCount: data.scan.limitedCount || 0,
              otherCount: data.scan.otherCount || 0,
            },
          });
        } catch (err) {
          console.error("scan_detail_view tracking failed:", err);
        }
      } catch (err) {
        console.error("Failed to fetch scan:", err);
        setError(err.message || "Failed to fetch scan.");
        setScan(null);
      } finally {
        setLoadingScan(false);
      }
    }

    fetchScan();
  }, [user, id]);

  const runAnalysis = useCallback(
    async (options = { track: true }) => {
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

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body.error || `Analysis failed with status ${res.status}`
          );
        }

        const data = await res.json();

        setDetectedBanned(Array.isArray(data.matchedBanned) ? data.matchedBanned : []);
        setDetectedIngredients(
          Array.isArray(data.matchedIngredients) ? data.matchedIngredients : []
        );
        setOcrText(
          data.ocrText && typeof data.ocrText === "string"
            ? data.ocrText
            : text
        );

        if (options.track) {
          try {
            await trackEvent("scan_detail_reanalyzed", {
              eventType: "scan_reanalyze",
              userEmail: user.Email || user.email || "",
              path:
                typeof window !== "undefined" ? window.location.pathname : "",
              source: "scan_detail_page",
              device:
                typeof navigator !== "undefined"
                  ? navigator.userAgent
                  : "",
              payload: {
                scanId: scan.id,
                scanName: scan.name || "Unnamed Scan",
                bannedCount: (data.matchedBanned || []).length,
                ingredientCount: (data.matchedIngredients || []).length,
              },
            });
          } catch (err) {
            console.error("scan_detail_reanalyzed tracking failed:", err);
          }
        }
      } catch (err) {
        console.error("Analysis failed:", err);
        setAnalysisError(err.message || "Failed to analyze ingredients.");
        setDetectedBanned([]);
        setDetectedIngredients([]);
      } finally {
        setLoadingAnalysis(false);
      }
    },
    [scan, user]
  );

  // Auto-run analysis once scan is loaded (first time)
  useEffect(() => {
    if (scan && scan.stackDetails) {
      runAnalysis({ track: false });
    }
  }, [scan, runAnalysis]);

  if (!user) return null;

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

  const renderStackPreview = () => {
    if (!scan || !scan.stackDetails) return null;
    const text = String(scan.stackDetails).replace(/\s+/g, " ").trim();
    if (!text) return null;
    const snippet = text.length > 220 ? text.slice(0, 220) + "…" : text;
    return (
      <p className="mt-3 text-xs sm:text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
        <span className="font-semibold text-gray-800">Saved stack:</span>{" "}
        {snippet}
      </p>
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
      <NavBar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="max-w-5xl mx-auto px-4 py-8 sm:py-10 space-y-6 sm:space-y-8">
        {/* Header / Summary Card */}
        <section className="bg-white rounded-2xl shadow-md border border-blue-100 p-5 sm:p-6">
          <button
            onClick={() => router.push("/scans")}
            className="text-xs sm:text-sm text-gray-500 hover:text-gray-700 mb-3"
          >
            ← Back to My Scans
          </button>

          {loadingScan ? (
            <p className="text-gray-500">Loading scan…</p>
          ) : error ? (
            <p className="text-red-600 text-sm">{error}</p>
          ) : !scan ? (
            <p className="text-gray-500 text-sm">
              Scan not found or could not be loaded.
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
              {renderStackPreview()}

              <div className="mt-4 flex flex-wrap gap-2 sm:gap-3">
                <button
                  onClick={() => runAnalysis({ track: true })}
                  disabled={loadingAnalysis || !scan?.stackDetails}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition ${
                    loadingAnalysis || !scan?.stackDetails
                      ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                      : "bg-[#46769B] text-white hover:bg-blue-700"
                  }`}
                >
                  {loadingAnalysis ? "Re-analyzing…" : "Re-run Analysis"}
                </button>

                {scan?.productName && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-xs text-gray-700 border border-gray-200">
                    Product:{" "}
                    <span className="ml-1 font-medium">
                      {scan.productName}
                    </span>
                  </span>
                )}
              </div>

              {analysisError && (
                <p className="mt-2 text-xs sm:text-sm text-red-600">
                  {analysisError}
                </p>
              )}
            </>
          )}
        </section>

        {/* Full ingredient breakdown using your existing OCRScanResults */}
        {scan && !loadingScan && (
          <section className="bg-white rounded-2xl shadow-md border border-blue-100 p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3">
              Ingredient Breakdown & Highlights
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mb-4">
              This view uses your saved ingredient text and re-checks it against
              the latest banned substances and ingredient database. Highlight
              colors match the legend at the bottom.
            </p>

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
