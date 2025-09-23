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

/**
 * pages/ocr.js
 *
 * - New: uses OCRScanResults (same layout as Search) to display both
 *        banned substances and ingredient DB matches for a scan
 * - Preserves: raw OCR expandable with combined highlighted HTML,
 *              save-to-Airtable behavior, barcode & OCR pipeline
 */

export default function OCRPage() {
  const { user } = useAuthContext();

  // UI tabs & mode
  const [activeTab, setActiveTab] = useState("Scan");
  const [scanMode, setScanMode] = useState("Nutrition Label");

  // OCR / results accumulation
  const [ocrTexts, setOcrTexts] = useState([]); // history of raw OCR chunks
  const [rawOCR, setRawOCR] = useState(""); // accumulated plain OCR text

  // Matches returned from API
  const [detectedBanned, setDetectedBanned] = useState([]); // array of normalized records
  const [detectedIngredients, setDetectedIngredients] = useState([]); // array of normalized records

  // Highlighted HTML versions for the raw OCR display
  const [highlightedBannedOCR, setHighlightedBannedOCR] = useState("");
  const [highlightedIngredientsOCR, setHighlightedIngredientsOCR] = useState("");
  const [combinedHighlightedOCR, setCombinedHighlightedOCR] = useState("");

  // progress / scanning / errors
  const [progress, setProgress] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");

  // UI helpers
  const tabRefs = useRef({});
  const underlineRef = useRef(null);
  const [showRawOCR, setShowRawOCR] = useState(false);

  // Colors
  const banTypeColors = [
    { label: "Prohibited", color: "#d62828" },
    { label: "Limited to Out of Competition", color: "#f77f00" },
    { label: "Particular Sports", color: "#2a9d8f" },
  ];
  const INGREDIENT_HIGHLIGHT_COLOR = "#8556da";

  // Move underline under active tab (visual nicety)
  useEffect(() => {
    const currentTab = tabRefs.current[scanMode];
    const underline = underlineRef.current;
    if (currentTab && underline) {
      const { offsetLeft, offsetWidth } = currentTab;
      underline.style.left = `${offsetLeft}px`;
      underline.style.width = `${offsetWidth}px`;
    }
  }, [scanMode]);

  // --- Helpers

  // escape regex
  const escapeRegex = (s = "") => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Save scan into "Scans" Airtable (preserve existing behavior)
  const saveScanToAirtable = async (scanName, resultSummary, stackDetails) => {
    if (!user || !user.Email) return;
    try {
      const scanDate = new Date().toISOString();
      const res = await fetch("/api/saveScan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail: user.Email, scanName, scanDate, stackDetails, resultSummary }),
      });
      const data = await res.json();
      if (res.ok) toast.success("Scan saved to your account!");
      else toast.error(`Failed to save scan: ${data.error}`);
    } catch (err) {
      console.error("Error saving scan:", err);
      toast.error("Failed to save scan. Try again later.");
    }
  };

  // generateCombinedHighlightedOCR
  // Produce a highlighted HTML string for the raw OCR by inserting <span> with colors
  // Banned highlights are applied first (higher priority), then ingredient highlights.
  const generateCombinedHighlightedOCR = (rawText = "", bannedRecs = [], ingredientRecs = []) => {
    if (!rawText) return "";

    let out = rawText;

    // 1) Apply banned highlights
    if (Array.isArray(bannedRecs) && bannedRecs.length) {
      bannedRecs.forEach((rec) => {
        const fields = rec.fields || rec.rawFields || {};
        const banType = (fields["Ban Type"] || fields["Ban Type"] || "").toString();
        const color = banTypeColors.find((b) => b.label === banType)?.color || banTypeColors[0].color;
        const terms = [
          (fields["Substance Name"] || fields["name"] || fields["Substance Name"] || "").toString(),
          ...(fields["Synonyms"] ? fields["Synonyms"].toString().split(",") : []),
        ]
          .map((t) => t.trim())
          .filter(Boolean);

        terms.forEach((term) => {
          try {
            const rx = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
            out = out.replace(rx, (m) => `<span style="color:${color}; font-weight:600;">${m}</span>`);
          } catch (e) {
            // fallback naive include
            const idx = out.toLowerCase().indexOf(term.toLowerCase());
            if (idx !== -1) {
              out = out.substring(0, idx) + `<span style="color:${color}; font-weight:600;">` + out.substring(idx, idx + term.length) + `</span>` + out.substring(idx + term.length);
            }
          }
        });
      });
    }

    // 2) Apply ingredient highlights in purple, but avoid wrapping things already inside a span
    if (Array.isArray(ingredientRecs) && ingredientRecs.length) {
      ingredientRecs.forEach((rec) => {
        const fields = rec.fields || rec.rawFields || {};
        const terms = [
          (fields["Name"] || fields["Ingredient Name"] || fields["name"] || "").toString(),
          ...(fields["Synonyms (Extended)"] ? fields["Synonyms (Extended)"].toString().split(",") : []),
          ...(fields["Synonyms"] ? fields["Synonyms"].toString().split(",") : []),
        ]
          .map((t) => t.trim())
          .filter(Boolean);

        terms.forEach((term) => {
          try {
            // Try to replace only occurrences not inside existing <span> tags.
            // We attempt a regex that avoids tags; if it fails, fallback to a simpler replace that checks a context.
            const rx = new RegExp(`(?![^<>]*>)\\b(${escapeRegex(term)})\\b`, "gi");
            out = out.replace(rx, (m) => `<span style="color:${INGREDIENT_HIGHLIGHT_COLOR}; font-weight:600;">${m}</span>`);
          } catch (e) {
            const safeRx = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
            out = out.replace(safeRx, (m) => {
              const idx = out.toLowerCase().indexOf(m.toLowerCase());
              if (idx === -1) return m;
              const before = out.slice(Math.max(0, idx - 10), idx + 10);
              if (before.includes("<span") || before.includes("color:")) return m;
              return `<span style="color:${INGREDIENT_HIGHLIGHT_COLOR}; font-weight:600;">${m}</span>`;
            });
          }
        });
      });
    }

    return out;
  };

  // Normalize incoming record into { id, fields } if needed
  const normalizeRecord = (r) => {
    if (!r) return null;
    if (r.fields) return r;
    // flattened shape: treat all keys as fields
    const id = r.id || r.recordId || Math.random().toString(36).slice(2);
    return { id, fields: r };
  };

  // handleScanResult: unify scan pipeline outputs and update UI state
  const handleScanResult = async (result) => {
    if (!result) return;

    const raw = result.rawIngredients || result.ocrText || result.text || "";
    if (!raw) return;

    // update OCR accumulation
    setOcrTexts((prev) => [...prev, raw]);
    setRawOCR((prev) => (prev ? prev + " " + raw : raw));
    setShowRawOCR(false);

    // matched banned (API may use matchedBanned or matchedBannedRecords)
    const bannedMatchesRaw = result.matchedBanned || result.matchedBannedRecords || result.matched_banned || [];
    const bannedMatches = Array.isArray(bannedMatchesRaw) ? bannedMatchesRaw.map(normalizeRecord) : [];

    setDetectedBanned(bannedMatches);

    // matched ingredients (API may use matchedIngredients, detectedIngredients, matched_ingredients)
    const ingredientMatchesRaw =
      result.matchedIngredients ||
      result.detectedIngredients ||
      result.matched_ingredients ||
      result.matchedIngredientRecords ||
      [];
    const ingredientMatches = Array.isArray(ingredientMatchesRaw) ? ingredientMatchesRaw.map(normalizeRecord) : [];

    setDetectedIngredients(ingredientMatches);

    // create highlighted HTML strings for the raw OCR view
    try {
      const bannedHighlighted = generateCombinedHighlightedOCR(raw, bannedMatches, []);
      const ingredientsHighlighted = generateCombinedHighlightedOCR(raw, [], ingredientMatches);
      const combined = generateCombinedHighlightedOCR(raw, bannedMatches, ingredientMatches);

      setHighlightedBannedOCR(bannedHighlighted);
      setHighlightedIngredientsOCR(ingredientsHighlighted);
      setCombinedHighlightedOCR(combined);
    } catch (err) {
      console.warn("Highlight generation failed:", err);
      setHighlightedBannedOCR("");
      setHighlightedIngredientsOCR("");
      setCombinedHighlightedOCR(raw);
    }

    // attempt to auto-save scan for logged-in users (keep previous behavior)
    if (user && user.Email) {
      const scanName = `Scan - ${new Date().toLocaleString()}`;
      const bannedSummary = (bannedMatches || []).map((b) => b.fields?.["Substance Name"] || b.fields?.name || "").join(", ");
      const ingredientSummary = (ingredientMatches || []).map((i) => i.fields?.["Name"] || i.fields?.["Ingredient Name"] || i.fields?.name || "").join(", ");
      const resultSummary = [bannedSummary, ingredientSummary].filter(Boolean).join(" | ");
      try {
        await saveScanToAirtable(scanName, resultSummary, raw);
      } catch (err) {
        console.warn("Auto-save failed:", err);
      }
    }
  };

  // Called by OCRUpload component to scan plain text
  const handleOCRScan = async (text) => {
    if (!text) return;
    setScanning(true);
    setProgress(0);
    setError("");
    try {
      // call /api/check which contains your logic for barcode/ingredient lookups
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      // unify result: pass raw text + api result to handler
      await handleScanResult({ rawIngredients: text, ...data });
    } catch (err) {
      console.error("OCR scan error:", err);
      setError("Nutrition Label scan failed. Please try again.");
    } finally {
      setScanning(false);
      setProgress(100);
    }
  };

  // Called by BarcodeUpload; barcode pipeline may already call APIs and return matched arrays
  const handleBarcodeScan = async (result) => {
    if (!result) return;
    setScanning(true);
    setProgress(0);
    setError("");
    try {
      // result assumed to include rawIngredients and matched arrays; unify and handle
      await handleScanResult(result);
    } catch (err) {
      console.error("Barcode scan error:", err);
      setError("Barcode scan failed. Please try again.");
    } finally {
      setScanning(false);
      setProgress(100);
    }
  };

  // UI handlers
  const handleLegendClick = (label) => {
    // kept for compatibility if you want legend at top; OCRScanResults has its own legend
    // Here we don't manage legend state centrally (OCRScanResults uses its own local state)
  };

  // UI
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <NavBar activeTab={activeTab} setActiveTab={setActiveTab} />
      {scanning && <ProgressBar progress={progress} scanning={scanning} />}

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {activeTab === "Scan" && (
          <>
            {/* Mode Tabs */}
            <div className="relative flex gap-4 mb-6">
              {["Nutrition Label", "Barcode"].map((mode) => (
                <div
                  key={mode}
                  ref={(el) => (tabRefs.current[mode] = el)}
                  onClick={() => setScanMode(mode)}
                  className={`cursor-pointer px-6 py-4 font-semibold rounded-t-xl transition-all duration-200
                    ${scanMode === mode ? "bg-white text-[#46769B] scale-105 shadow-md z-10" : "bg-gray-100 text-gray-700 hover:bg-gray-200 hover:-translate-y-1 scale-100 shadow-sm z-0"}`}
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
            <div className="w-full bg-white p-6 rounded-b-2xl shadow-md mx-auto border border-blue-100">
              {scanMode === "Nutrition Label" ? (
                <OCRUpload multiple={true} onScan={handleOCRScan} />
              ) : (
                <BarcodeUpload onResult={handleBarcodeScan} showScanButton={true} />
              )}
            </div>

            {error && <p className="text-red-500 mt-2 text-center">{error}</p>}

            {/* Raw OCR expandable (shows highlighted combined HTML or plain raw) */}
            {rawOCR && (
              <section className="w-full bg-white p-4 rounded-2xl shadow-md mx-auto border border-blue-100 mt-4">
                <div
                  className="cursor-pointer flex justify-between items-center"
                  onClick={() => setShowRawOCR((s) => !s)}
                >
                  <h2 className="text-xl font-bold">All Ingredients (Raw OCR)</h2>
                  <span className="text-gray-500 text-sm">{showRawOCR ? "Hide" : "Show"}</span>
                </div>

                {showRawOCR && (
                  <pre
                    className="bg-gray-100 p-4 rounded-xl max-h-80 overflow-y-auto whitespace-pre-wrap break-words mt-2"
                    // Show combined highlighted HTML if available, else show plain raw OCR
                    dangerouslySetInnerHTML={{ __html: combinedHighlightedOCR || rawOCR }}
                  />
                )}
              </section>
            )}

            {/* Scan results: use OCRScanResults (exact Search layout replicated) */}
            <section className="w-full bg-white p-6 rounded-2xl shadow-md mx-auto border border-blue-100 mt-4">
              <OCRScanResults
                ocrText={rawOCR} // plain OCR text (OCRScanResults handles matching/highlighting)
                detectedSubstances={detectedBanned}
                detectedIngredients={detectedIngredients}
                showOCR={true}
              />
            </section>
          </>
        )}

        {activeTab === "Search" && (
          <section className="w-full bg-white p-6 rounded-2xl shadow-md mx-auto border border-blue-100 mt-4">
            <p className="text-gray-500 italic">Search functionality coming soon.</p>
          </section>
        )}
      </main>
    </div>
  );
}
