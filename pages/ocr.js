"use client";

import { useState, useEffect } from "react";
import NavBar from "../components/NavBar";
import OCRUpload from "../components/OCRUpload";
import ResultsTable from "../components/ResultsTable";
import ProgressBar from "../components/ProgressBar";

/**
 * OCRPage
 * - Handles OCR scanning and banned substance detection
 * - Displays detected banned substances with ban-type colored matches
 * - Raw OCR is above the results and minimized on scan
 * - Highlights banned substances in the raw OCR with correct ban type color
 */
export default function OCRPage() {
  const [activeTab, setActiveTab] = useState("Scan");
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

  const banTypeColors = [
    { label: "Prohibited", color: "#d62828" },
    { label: "Limited to Out of Competition", color: "#f77f00" },
    { label: "Particular Sports", color: "#2a9d8f" },
  ];

  const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  /**
   * Handle OCR scan from OCRUpload
   */
  const handleOCRScan = async (text) => {
    if (!text) return;
    setOcrTexts((prev) => [...prev, text]);
    setRawOCR((prev) => (prev ? prev + " " + text : text));
    setShowRawOCR(false);
  };

  /**
   * Trigger banned substance check after OCR texts update
   */
  useEffect(() => {
    if (!rawOCR) return;

    const checkBannedSubstances = async () => {
      setScanning(true);
      setProgress(0);
      setError("");
      setDetectedSubstances([]);
      setHighlightedCells({});
      setHighlightedOCR("");

      const interval = setInterval(() => {
        setProgress((prev) => Math.min(prev + Math.random() * 5, 80));
      }, 200);

      try {
        const res = await fetch("/api/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: rawOCR }),
        });

        const data = await res.json();

        if (Array.isArray(data.matchedBanned)) {
          setDetectedSubstances(data.matchedBanned);

          const highlights = {};
          let ocrCopy = rawOCR;

          data.matchedBanned.forEach((rec) => {
            const fields = rec.fields || {};
            const substanceName = fields["Substance Name"] || "";
            const synonyms = fields["Synonyms"] || "";
            const banType = fields["Ban Type"] || "None";

            const color =
              banTypeColors.find((b) => b.label === banType)?.color || "#111827";

            // Highlight only terms actually in OCR for table
            const wrapWithColor = (textToWrap) => {
              if (!textToWrap) return textToWrap;
              const terms = textToWrap
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean);

              let highlighted = textToWrap;
              terms.forEach((term) => {
                const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
                if (rawOCR.toLowerCase().includes(term.toLowerCase())) {
                  highlighted = highlighted.replace(
                    regex,
                    `<span style="color:${color}; font-weight:600;">$&</span>`
                  );
                }
              });
              return highlighted;
            };

            highlights[rec.id] = {
              substanceName: wrapWithColor(substanceName),
              synonyms: wrapWithColor(synonyms),
              color,
            };

            // Highlight in raw OCR for each term found
            [substanceName, ...synonyms.split(",")]
              .map((t) => t.trim())
              .filter(Boolean)
              .forEach((term) => {
                const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
                if (rawOCR.toLowerCase().includes(term.toLowerCase())) {
                  ocrCopy = ocrCopy.replace(
                    regex,
                    `<span style="color:${color}; font-weight:600;">$&</span>`
                  );
                }
              });
          });

          setHighlightedCells(highlights);
          setHighlightedOCR(ocrCopy);
        }

        clearInterval(interval);
        setProgress(100);
        setTimeout(() => setScanning(false), 500);
      } catch (err) {
        console.error("OCR check error:", err);
        setError("OCR scan failed. Please try again.");
        clearInterval(interval);
        setProgress(0);
        setScanning(false);
      }
    };

    checkBannedSubstances();
  }, [rawOCR]);

  const handleLegendClick = (label) => {
    setActiveBanType(activeBanType === label ? null : label);
  };

  const filteredSubstances = activeBanType
    ? detectedSubstances.filter(
        (record) => (record.fields["Ban Type"] || "None") === activeBanType
      )
    : detectedSubstances;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <NavBar activeTab={activeTab} setActiveTab={setActiveTab} />
      {scanning && <ProgressBar progress={progress} scanning={scanning} />}

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {activeTab === "Scan" && (
          <>
            <div className="w-full bg-white p-6 rounded-2xl shadow-md mx-auto border border-blue-100">
              <OCRUpload multiple={true} onScan={handleOCRScan} />
            </div>

            {error && <p className="text-red-500 mt-2 text-center">{error}</p>}

            {/* Raw OCR Section */}
            {rawOCR && (
              <section className="w-full bg-white p-4 rounded-2xl shadow-md mx-auto border border-blue-100 mt-4">
                <div
                  className="cursor-pointer flex justify-between items-center"
                  onClick={() => setShowRawOCR(!showRawOCR)}
                >
                  <h2 className="text-xl font-bold">All Ingredients</h2>
                  <span className="text-gray-500 text-sm">
                    {showRawOCR ? "Hide" : "Show"}
                  </span>
                </div>
                {showRawOCR && (
                  <pre
                    className="bg-gray-100 p-4 rounded-xl max-h-80 overflow-y-auto whitespace-pre-wrap break-words mt-2"
                    dangerouslySetInnerHTML={{
                      __html: highlightedOCR || rawOCR,
                    }}
                  />
                )}
              </section>
            )}

            {/* Detected Banned Substances Section */}
            <section className="w-full bg-white p-6 rounded-2xl shadow-md mx-auto border border-blue-100 mt-4">
              <h2 className="text-2xl font-bold mb-2">
                Detected Banned Substances
              </h2>

              {/* Ban Type Legend */}
              <div className="overflow-x-auto mb-4">
                <div className="flex gap-4 w-[420px] min-w-max pl-2">
                  {banTypeColors.map((type) => (
                    <div
                      key={type.label}
                      className="flex items-center gap-1 cursor-pointer transition-transform hover:scale-110"
                      onClick={() => handleLegendClick(type.label)}
                    >
                      <div
                        className={`w-3 h-3 rounded-full border-2 ${
                          activeBanType === type.label
                            ? "border-gray-700"
                            : "border-transparent"
                        }`}
                        style={{ backgroundColor: type.color }}
                      />
                      <span className="text-gray-800 text-sm font-medium">
                        {type.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {filteredSubstances.length > 0 ? (
                <ResultsTable
                  records={filteredSubstances}
                  highlightedCells={highlightedCells}
                  rawOCR={rawOCR}
                />
              ) : (
                <p className="italic text-gray-500 mt-2">
                  No banned substances detected.
                </p>
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
