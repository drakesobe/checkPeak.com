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

  useEffect(() => {
    const currentTab = tabRefs.current[scanMode];
    const underline = underlineRef.current;
    if (currentTab && underline) {
      const { offsetLeft, offsetWidth } = currentTab;
      underline.style.left = `${offsetLeft}px`;
      underline.style.width = `${offsetWidth}px`;
    }
  }, [scanMode]);

  const escapeRegex = (s = "") =>
    String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  /**
   * Save a scan row into the Scans Airtable via /api/saveScan
   * Expects: { scanName, resultSummary, stackDetails, bannedDetails }
   */
  const saveScanToAirtable = async ({
    scanName,
    resultSummary,
    stackDetails,
    bannedDetails,
  }) => {
    const email = user?.Email || user?.email;
    if (!email) return; // no logged-in user, skip saving

    try {
      const scanDate = new Date().toISOString();
      const payload = {
        userEmail: email,
        scanName,
        scanDate,
        stackDetails,
        resultSummary,
        bannedDetails,
      };

      const res = await fetch("/api/saveScan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Scan saved to your account!");
      } else {
        console.error("Failed to save scan:", data);
        toast.error(`Failed to save scan: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Error saving scan:", err);
      toast.error("Failed to save scan. Try again later.");
    }
  };

  const generateCombinedHighlightedOCR = (rawText = "", bannedRecs = [], ingredientRecs = []) => {
    if (!rawText) return "";
    let out = rawText;
    // (You can drop your highlight logic back in here later if you want;
    // leaving as a stub so existing code compiles.)
    return out;
  };

  const normalizeRecord = (r) => {
    if (!r) return null;
    if (r.fields) return r;
    const id = r.id || r.recordId || Math.random().toString(36).slice(2);
    return { id, fields: r };
  };

  /**
   * Handle final scan result (from OCR or barcode)
   * - Normalizes banned + ingredient matches
   * - Updates UI
   * - Auto-saves to Scans Airtable using /api/saveScan
   */
  const handleScanResult = async (result) => {
    if (!result) return;

    const raw =
      result.rawIngredients ||
      result.ocrText ||
      result.text ||
      "";

    if (!raw) return;

    // Append to raw OCR buffer
    setOcrTexts((prev) => [...prev, raw]);
    setRawOCR((prev) => (prev ? prev + " " + raw : raw));
    setShowRawOCR(false);

    const bannedMatchesRaw =
      result.matchedBanned ||
      result.matchedBannedRecords ||
      result.matched_banned ||
      [];

    const bannedMatches = Array.isArray(bannedMatchesRaw)
      ? bannedMatchesRaw.map(normalizeRecord).filter(Boolean)
      : [];

    setDetectedBanned(bannedMatches);

    const ingredientMatchesRaw =
      result.matchedIngredients ||
      result.detectedIngredients ||
      result.matched_ingredients ||
      result.matchedIngredientRecords ||
      [];

    const ingredientMatches = Array.isArray(ingredientMatchesRaw)
      ? ingredientMatchesRaw.map(normalizeRecord).filter(Boolean)
      : [];

    setDetectedIngredients(ingredientMatches);

    // ----- Auto-save to Scans Airtable -----
    try {
      const email = user?.Email || user?.email;
      if (!email) return; // not logged in, just show results

      const bannedDetails = result.bannedDetails || null;

      // Build a nice scan name
      const scanName =
        result.productName ||
        `Scan - ${new Date().toLocaleString("en-US", { hour12: false })}`;

      // Build summary string using bannedDetails if present
      let resultSummary = "No banned details available.";
      if (bannedDetails) {
        const {
          ProhibitedCount = 0,
          LimitedCount = 0,
          OtherBannedCount = 0,
        } = bannedDetails;

        if (
          ProhibitedCount === 0 &&
          LimitedCount === 0 &&
          OtherBannedCount === 0
        ) {
          resultSummary = "No banned substances detected.";
        } else {
          resultSummary = `Prohibited: ${ProhibitedCount}, Limited: ${LimitedCount}, Other: ${OtherBannedCount}`;
        }
      }

      // Use the raw OCR/ingredients blob as StackDetails
      const stackDetails = raw;

      await saveScanToAirtable({
        scanName,
        resultSummary,
        stackDetails,
        bannedDetails,
      });
    } catch (err) {
      console.error("Error during auto-save:", err);
      // We already toast inside saveScanToAirtable for errors, so this can stay silent
    }
  };

  const handleOCRScan = async (text) => {
    if (!text) return;
    setScanning(true);
    setProgress(0);
    setError("");

    try {
      const email = user?.Email || user?.email || null;

      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          // optional: include userEmail so /api/check can use it in debug/logs if needed
          userEmail: email,
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

    try {
      // BarcodeUpload should already have called /api/check and returned its response
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
              <p className="text-red-500 mt-2 text-center text-sm sm:text-base">
                {error}
              </p>
            )}

            {/* Raw OCR */}
            {rawOCR && (
              <section className="w-full bg-white p-4 sm:p-6 rounded-2xl shadow-md mx-auto border border-blue-100 mt-4">
                <div
                  className="cursor-pointer flex justify-between items-center"
                  onClick={() => setShowRawOCR((s) => !s)}
                >
                  <h2 className="text-lg sm:text-xl font-bold">
                    All Ingredients (Raw OCR)
                  </h2>
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
