"use client";

import { useState, useRef, useEffect } from "react";
import NavBar from "../components/NavBar";
import OCRUpload from "../components/OCRUpload";
import BarcodeUpload from "../components/BarcodeUpload";
import ResultsTable from "../components/ResultsTable";
import ProgressBar from "../components/ProgressBar";
import { useAuthContext } from "../hooks/useAuth";
import { toast } from "react-hot-toast";

export default function OCRPage() {
  const { user } = useAuthContext();
  const [activeTab, setActiveTab] = useState("Scan");
  const [scanMode, setScanMode] = useState("Nutrition Label");
  const [ocrTexts, setOcrTexts] = useState([]);
  const [rawOCR, setRawOCR] = useState("");
  const [detectedSubstances, setDetectedSubstances] = useState([]);
  const [highlightedCells, setHighlightedCells] = useState({});
  const [highlightedOCR, setHighlightedOCR] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [activeBanType, setActiveBanType] = useState(null);
  const [showRawOCR, setShowRawOCR] = useState(false);

  const tabRefs = useRef({});
  const underlineRef = useRef(null);

  const banTypeColors = [
    { label: "Prohibited", color: "#d62828" },
    { label: "Limited to Out of Competition", color: "#f77f00" },
    { label: "Particular Sports", color: "#2a9d8f" },
  ];

  const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  useEffect(() => {
    const currentTab = tabRefs.current[scanMode];
    const underline = underlineRef.current;
    if (currentTab && underline) {
      const { offsetLeft, offsetWidth } = currentTab;
      underline.style.left = `${offsetLeft}px`;
      underline.style.width = `${offsetWidth}px`;
    }
  }, [scanMode]);

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

  const handleScanResult = async (result) => {
    if (!result || !result.rawIngredients) return;
    setOcrTexts((prev) => [...prev, result.rawIngredients]);
    setRawOCR((prev) => (prev ? prev + " " + result.rawIngredients : result.rawIngredients));
    setShowRawOCR(false);

    if (Array.isArray(result.matchedBanned) && result.matchedBanned.length > 0) {
      const highlights = {};
      let ocrCopy = result.rawIngredients;

      result.matchedBanned.forEach((rec) => {
        const fields = rec.fields || {};
        const substanceName = fields["Substance Name"] || "";
        const synonyms = fields["Synonyms"] || "";
        const banType = fields["Ban Type"] || "None";
        const color = banTypeColors.find((b) => b.label === banType)?.color || "#111827";

        const wrapWithColor = (textToWrap) => {
          if (!textToWrap) return textToWrap;
          return textToWrap
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .reduce((acc, term) => {
              const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
              return acc.replace(regex, `<span style="color:${color}; font-weight:600;">$&</span>`);
            }, textToWrap);
        };

        highlights[rec.id] = { substanceName: wrapWithColor(substanceName), synonyms: wrapWithColor(synonyms), color };

        [substanceName, ...synonyms.split(",")]
          .map((t) => t.trim())
          .filter(Boolean)
          .forEach((term) => {
            const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
            if (result.rawIngredients.toLowerCase().includes(term.toLowerCase())) {
              ocrCopy = ocrCopy.replace(regex, `<span style="color:${color}; font-weight:600;">$&</span>`);
            }
          });
      });

      setDetectedSubstances(result.matchedBanned);
      setHighlightedCells(highlights);
      setHighlightedOCR(ocrCopy);

      if (user && user.Email) {
        const scanName = `Scan - ${new Date().toLocaleString()}`;
        const resultSummary = result.matchedBanned.map((rec) => rec.fields["Substance Name"] || "").join(", ");
        saveScanToAirtable(scanName, resultSummary, result.rawIngredients);
      }
    }
  };

  const handleOCRScan = async (text) => {
    if (!text) return;
    setScanning(true);
    setProgress(0);
    setError("");
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      await handleScanResult({ rawIngredients: text, matchedBanned: data.matchedBanned || [] });
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
      await handleScanResult({ rawIngredients: result.rawIngredients, matchedBanned: result.matchedBanned || [] });
    } catch (err) {
      console.error("Barcode scan error:", err);
      setError("Barcode scan failed. Please try again.");
    } finally {
      setScanning(false);
      setProgress(100);
    }
  };

  const handleLegendClick = (label) => setActiveBanType(activeBanType === label ? null : label);

  const filteredSubstances = activeBanType
    ? detectedSubstances.filter((record) => (record.fields["Ban Type"] || "None") === activeBanType)
    : detectedSubstances;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <NavBar activeTab={activeTab} setActiveTab={setActiveTab} />
      {scanning && <ProgressBar progress={progress} scanning={scanning} />}

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {activeTab === "Scan" && (
          <>
            <div className="relative flex gap-4 mb-6">
              {["Nutrition Label", "Barcode"].map((mode) => (
                <div
                  key={mode}
                  ref={(el) => (tabRefs.current[mode] = el)}
                  onClick={() => setScanMode(mode)}
                  className={`cursor-pointer px-6 py-4 font-semibold rounded-t-xl transition-all duration-200
                    ${scanMode === mode
                      ? "bg-white text-[#46769B] scale-105 shadow-md z-10"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 hover:-translate-y-1 scale-100 shadow-sm z-0"
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

            <div className="w-full bg-white p-6 rounded-b-2xl shadow-md mx-auto border border-blue-100">
              {scanMode === "Nutrition Label" ? (
                <OCRUpload multiple={true} onScan={handleOCRScan} />
              ) : (
                <BarcodeUpload onResult={handleBarcodeScan} showScanButton={true} />
              )}
            </div>

            {error && <p className="text-red-500 mt-2 text-center">{error}</p>}

            {rawOCR && (
              <section className="w-full bg-white p-4 rounded-2xl shadow-md mx-auto border border-blue-100 mt-4">
                <div className="cursor-pointer flex justify-between items-center" onClick={() => setShowRawOCR(!showRawOCR)}>
                  <h2 className="text-xl font-bold">All Ingredients</h2>
                  <span className="text-gray-500 text-sm">{showRawOCR ? "Hide" : "Show"}</span>
                </div>
                {showRawOCR && (
                  <pre
                    className="bg-gray-100 p-4 rounded-xl max-h-80 overflow-y-auto whitespace-pre-wrap break-words mt-2"
                    dangerouslySetInnerHTML={{ __html: highlightedOCR || rawOCR }}
                  />
                )}
              </section>
            )}

            <section className="w-full bg-white p-6 rounded-2xl shadow-md mx-auto border border-blue-100 mt-4">
              <h2 className="text-2xl font-bold mb-2">Detected Banned Substances</h2>

              <div className="overflow-x-auto mb-4">
                <div className="flex gap-4 w-[420px] min-w-max pl-2">
                  {banTypeColors.map((type) => (
                    <div key={type.label} className="flex items-center gap-1 cursor-pointer transition-transform hover:scale-110" onClick={() => handleLegendClick(type.label)}>
                      <div className={`w-3 h-3 rounded-full border-2 ${activeBanType === type.label ? "border-gray-700" : "border-transparent"}`} style={{ backgroundColor: type.color }} />
                      <span className="text-gray-800 text-sm font-medium">{type.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {filteredSubstances.length > 0 ? (
                <ResultsTable records={filteredSubstances} highlightedCells={highlightedCells} rawOCR={rawOCR} />
              ) : (
                <p className="italic text-gray-500 mt-2">No banned substances detected.</p>
              )}
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
