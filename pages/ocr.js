// pages/ocr.js
"use client";

import { useState, useRef, useEffect } from "react";
import NavBar from "../components/NavBar";
import OCRUpload from "../components/OCRUpload";
import BarcodeUpload from "../components/BarcodeUpload";
import OCRScanResults from "../components/OCRScanResults";
import ProgressBar from "../components/ProgressBar";
import { useAuthContext } from "../hooks/useAuth";
import { toast } from "react-hot-toast";
import { trackEvent } from "@/lib/analytics";

export default function OCRPage() {
  const { user } = useAuthContext();

  const [activeTab, setActiveTab] = useState("Scan");
  const [scanMode, setScanMode] = useState("Nutrition Label");
  const [ocrTexts, setOcrTexts] = useState([]);
  const [rawOCR, setRawOCR] = useState("");
  const [detectedBanned, setDetectedBanned] = useState([]);
  const [detectedIngredients, setDetectedIngredients] = useState([]);
  const [highlightedBannedOCR, setHighlightedBannedOCR] = useState("");
  const [highlightedIngredientsOCR, setHighlightedIngredientsOCR] = useState("");
  const [combinedHighlightedOCR, setCombinedHighlightedOCR] = useState("");
  const [progress, setProgress] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const tabRefs = useRef({});
  const underlineRef = useRef(null);
  const [showRawOCR, setShowRawOCR] = useState(false);

  const banTypeColors = [
    { label: "Prohibited", color: "#d62828" },
    { label: "Limited to Out of Competition", color: "#f77f00" },
    { label: "Particular Sports", color: "#2a9d8f" },
  ];
  const INGREDIENT_HIGHLIGHT_COLOR = "#8556da";

  // Tab underline animation
  useEffect(() => {
    const currentTab = tabRefs.current[scanMode];
    const underline = underlineRef.current;
    if (currentTab && underline) {
      const { offsetLeft, offsetWidth } = currentTab;
      underline.style.left = `${offsetLeft}px`;
      underline.style.width = `${offsetWidth}px`;
    }
  }, [scanMode]);

  // 🔥 Analytics: Scan page view
  useEffect(() => {
    if (activeTab !== "Scan") return;

    try {
      trackEvent("page_view_scan", {
        eventType: "page_view",
        userEmail: user?.Email || user?.email || "",
        path: typeof window !== "undefined" ? window.location.pathname : "",
        source: "ocr_page",
        device: typeof navigator !== "undefined" ? navigator.userAgent : "",
      });
    } catch (err) {
      console.error("page_view_scan tracking failed:", err);
    }
  }, [activeTab, user]);

  const escapeRegex = (s = "") =>
    String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Not wired yet, but left in case you want smart OCR highlighting later
  const generateCombinedHighlightedOCR = (rawText = "", bannedRecs = [], ingredientRecs = []) => {
    if (!rawText) return "";
    let out = rawText;
    // You can plug in your OCR highlight logic here later
    return out;
  };

  // For legacy / future separate scan saving (still available)
  const saveScanToAirtable = async (scanName, resultSummary, stackDetails) => {
    if (!user || !user.Email) return;
    try {
      const scanDate = new Date().toISOString();
      const res = await fetch("/api/saveScan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: user.Email,
          scanName,
          scanDate,
          stackDetails,
          resultSummary,
        }),
      });
      const data = await res.json();
      if (res.ok) toast.success("Scan saved to your account!");
      else toast.error(`Failed to save scan: ${data.error}`);
    } catch (err) {
      console.error("Error saving scan:", err);
      toast.error("Failed to save scan. Try again later.");
    }
  };

  const normalizeRecord = (r) => {
    if (!r) return null;
    if (r.fields) return r;
    const id = r.id || r.recordId || Math.random().toString(36).slice(2);
    return { id, fields: r };
  };

  // 🔥 Core: handle scan results + analytics
  const handleScanResult = async (result) => {
    if (!result) return;

    const raw = result.rawIngredients || result.ocrText || result.text || "";
    if (!raw) return;

    setOcrTexts((prev) => [...prev, raw]);
    setRawOCR((prev) => (prev ? prev + " " + raw : raw));
    setShowRawOCR(false);

    const bannedMatchesRaw =
      result.matchedBanned ||
      result.matchedBannedRecords ||
      result.matched_banned ||
      [];
    const bannedMatches = Array.isArray(bannedMatchesRaw)
      ? bannedMatchesRaw.map(normalizeRecord)
      : [];
    setDetectedBanned(bannedMatches);

    const ingredientMatchesRaw =
      result.matchedIngredients ||
      result.detectedIngredients ||
      result.matched_ingredients ||
      result.matchedIngredientRecords ||
      [];
    const ingredientMatches = Array.isArray(ingredientMatchesRaw)
      ? ingredientMatchesRaw.map(normalizeRecord)
      : [];
    setDetectedIngredients(ingredientMatches);

    // Optional: keep a hook here if you want OCR highlighting later
    // setCombinedHighlightedOCR(
    //   generateCombinedHighlightedOCR(raw, bannedMatches, ingredientMatches)
    // );

    // 🔥 Analytics: log completed scan
    try {
      const bannedDetails = result.bannedDetails || {};
      await trackEvent("scan_completed", {
        eventType: "scan",
        userEmail: user?.Email || user?.email || "",
        path: typeof window !== "undefined" ? window.location.pathname : "",
        source: scanMode === "Nutrition Label" ? "nutrition_label" : "barcode",
        device: typeof navigator !== "undefined" ? navigator.userAgent : "",
        payload: {
          scanMode,
          productName: result.productName || null,
          bannedCount: bannedMatches.length,
          ingredientCount: ingredientMatches.length,
          bannedDetails,
          found: result.found ?? true,
        },
      });
    } catch (err) {
      console.error("scan_completed tracking failed:", err);
    }
  };

  const handleOCRScan = async (text) => {
    if (!text) return;
    setScanning(true);
    setProgress(0);
    setError("");

    // 🔥 Analytics: scan start (nutrition label)
    try {
      trackEvent("scan_started", {
        eventType: "scan_start",
        userEmail: user?.Email || user?.email || "",
        path: typeof window !== "undefined" ? window.location.pathname : "",
        source: "nutrition_label",
        device: typeof navigator !== "undefined" ? navigator.userAgent : "",
      });
    } catch (err) {
      console.error("scan_started tracking failed:", err);
    }

    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          // Optional: if you want /api/check to also save to Scans Airtable internally
          userEmail: user?.Email || user?.email || "",
        }),
      });
      const data = await res.json();
      await handleScanResult({ rawIngredients: text, ...data });
    } catch (err) {
      console.error("OCR scan error:", err);
      setError("Nutrition Label scan failed. Please try again.");
    } finally {
      setScanning(false);
      setProgress(100);
    }
  };

  const handleBarcodeScan = async (result) => {
    if (!result) return;
    setScanning(true);
    setProgress(0);
    setError("");

    // 🔥 Analytics: scan start (barcode)
    try {
      trackEvent("scan_started", {
        eventType: "scan_start",
        userEmail: user?.Email || user?.email || "",
        path: typeof window !== "undefined" ? window.location.pathname : "",
        source: "barcode",
        device: typeof navigator !== "undefined" ? navigator.userAgent : "",
      });
    } catch (err) {
      console.error("scan_started tracking failed:", err);
    }

    try {
      await handleScanResult(result);
    } catch (err) {
      console.error("Barcode scan error:", err);
      setError("Barcode scan failed. Please try again.");
    } finally {
      setScanning(false);
      setProgress(100);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <NavBar activeTab={activeTab} setActiveTab={setActiveTab} />
      {scanning && <ProgressBar progress={progress} scanning={scanning} />}

      <main className="max-w-6xl mx-auto px-2 sm:px-4 py-4 sm:py-8 space-y-6 sm:space-y-8">
        {activeTab === "Scan" && (
          <>
            {/* Mode Tabs */}
            <div className="relative flex flex-wrap justify-center sm:justify-start gap-2 sm:gap-4 mb-4 sm:mb-6">
              {["Nutrition Label", "Barcode"].map((mode) => (
                <div
                  key={mode}
                  ref={(el) => (tabRefs.current[mode] = el)}
                  onClick={() => setScanMode(mode)}
                  className={`cursor-pointer px-4 sm:px-6 py-3 sm:py-4 font-semibold rounded-t-xl transition-all duration-200 text-sm sm:text-base
                    ${
                      scanMode === mode
                        ? "bg-white text-[#46769B] scale-105 shadow-md z-10"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200 hover:-translate-y-1 shadow-sm z-0"
                    }`}
                >
                  {mode}
                </div>
              ))}
              <div
                ref={underlineRef}
                className="absolute bottom-0 h-1 bg-[#46769B] rounded-full transition-all duration-300 z-20"
                style={{ width: 0, left: 0 }}
              />
            </div>

            {/* Upload area */}
            <div className="w-full bg-white p-4 sm:p-6 rounded-b-2xl shadow-md mx-auto border border-blue-100">
              {scanMode === "Nutrition Label" ? (
                <OCRUpload multiple={true} onScan={handleOCRScan} />
              ) : (
                <BarcodeUpload onResult={handleBarcodeScan} showScanButton={true} />
              )}
            </div>

            {error && (
              <p className="text-red-500 mt-2 text-center text-sm sm:text-base">{error}</p>
            )}

            {/* Raw OCR */}
            {rawOCR && (
              <section className="w-full bg-white p-4 sm:p-6 rounded-2xl shadow-md mx-auto border border-blue-100 mt-4">
                <div
                  className="cursor-pointer flex justify-between items-center"
                  onClick={() => setShowRawOCR((s) => !s)}
                >
                  <h2 className="text-lg sm:text-xl font-bold">All Ingredients (Raw OCR)</h2>
                  <span className="text-gray-500 text-sm">
                    {showRawOCR ? "Hide" : "Show"}
                  </span>
                </div>

                {showRawOCR && (
                  <pre
                    className="bg-gray-100 p-3 sm:p-4 rounded-xl max-h-64 sm:max-h-80 overflow-y-auto whitespace-pre-wrap break-words mt-2 text-sm sm:text-base"
                    dangerouslySetInnerHTML={{
                      __html: combinedHighlightedOCR || rawOCR,
                    }}
                  />
                )}
              </section>
            )}

            {/* Scan results */}
            <section className="w-full bg-white p-4 sm:p-6 rounded-2xl shadow-md mx-auto border border-blue-100 mt-4">
              <OCRScanResults
                ocrText={rawOCR}
                detectedSubstances={detectedBanned}
                detectedIngredients={detectedIngredients}
                showOCR={true}
              />
            </section>
          </>
        )}

        {activeTab === "Search" && (
          <section className="w-full bg-white p-4 sm:p-6 rounded-2xl shadow-md mx-auto border border-blue-100 mt-4">
            <p className="text-gray-500 italic text-center text-sm sm:text-base">
              Search functionality coming soon.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
