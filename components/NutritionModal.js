"use client";
import { useState, useRef, useEffect } from "react";
import NutritionBreakdown from "./NutritionBreakdown";
import ResultsTableSmartstack from "./ResultsTable-smartstack";

// Caches
const ocrCache = {};
const recordsCache = {};
const loadingCache = {};

export default function NutritionModal({ stack, onClose }) {
  const [activeTab, setActiveTab] = useState("detected"); // 'detected' | 'benefits' | 'raw'
  const [ocrText, setOcrText] = useState("");
  const [loadingOCR, setLoadingOCR] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [matchedRecords, setMatchedRecords] = useState([]);
  const [animDots, setAnimDots] = useState("");

  const imageRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!loadingOCR && !loadingRecords) return;
    const interval = setInterval(() => {
      setAnimDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, [loadingOCR, loadingRecords]);

  if (!stack) return null;
  const imageUrl = stack.nutritionLabel || "";

  // =========================
  // OCR helpers
  // =========================
  const preprocessImage = async () => {
    if (!imageRef.current) return null;
    const img = imageRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);

    // grayscale + contrast
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let min = 255,
      max = 0;
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
      if (gray < min) min = gray;
      if (gray > max) max = gray;
    }
    const scaleContrast = 255 / (max - min || 1);
    for (let i = 0; i < data.length; i += 4) {
      let gray = 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
      gray = Math.max(0, Math.min(255, (gray - min) * scaleContrast));
      data[i] = data[i + 1] = data[i + 2] = gray;
    }
    ctx.putImageData(imageData, 0, 0);

    // detect darker region
    let top = canvas.height,
      bottom = 0,
      left = canvas.width,
      right = 0;
    for (let y = 0; y < canvas.height; y += 2) {
      for (let x = 0; x < canvas.width; x += 2) {
        const idx = (y * canvas.width + x) * 4;
        const gray = data[idx];
        if (gray < 100) {
          if (x < left) left = x;
          if (x > right) right = x;
          if (y < top) top = y;
          if (y > bottom) bottom = y;
        }
      }
    }

    if (right - left < 20 || bottom - top < 20) return canvas;

    const cropWidth = right - left;
    const cropHeight = bottom - top;
    const scaleFactor = 3;

    const croppedCanvas = document.createElement("canvas");
    croppedCanvas.width = cropWidth * scaleFactor;
    croppedCanvas.height = cropHeight * scaleFactor;

    const cctx = croppedCanvas.getContext("2d");
    cctx.drawImage(
      canvas,
      left,
      top,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth * scaleFactor,
      cropHeight * scaleFactor
    );

    try {
      const Tesseract = (await import("tesseract.js")).default;
      const orientationResult = await Tesseract.recognize(croppedCanvas, "eng", {
        tessedit_char_whitelist:
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,%()-: ",
        oem: 1,
        psm: 0,
      });

      const angle = orientationResult.data.orientation?.degrees || 0;
      if (Math.abs(angle) > 1) {
        const deskewedCanvas = document.createElement("canvas");
        deskewedCanvas.width = croppedCanvas.width;
        deskewedCanvas.height = croppedCanvas.height;
        const dctx = deskewedCanvas.getContext("2d");
        dctx.translate(deskewedCanvas.width / 2, deskewedCanvas.height / 2);
        dctx.rotate((-angle * Math.PI) / 180);
        dctx.drawImage(croppedCanvas, -croppedCanvas.width / 2, -croppedCanvas.height / 2);
        return deskewedCanvas;
      }
    } catch (err) {
      console.warn("Deskew failed, using scaled cropped image:", err);
    }

    return croppedCanvas;
  };

  const runOCR = async () => {
    if (!imageUrl) return;

    if (ocrCache[imageUrl]) {
      setOcrText(ocrCache[imageUrl]);
      // kick records fetch if we have cache miss for records
      if (!recordsCache[imageUrl]) fetchRecords(ocrCache[imageUrl]);
      return;
    }
    if (loadingCache[imageUrl]) return;
    loadingCache[imageUrl] = true;

    setLoadingOCR(true);
    try {
      const Tesseract = (await import("tesseract.js")).default;
      const preprocessedCanvas = await preprocessImage();
      const result = await Tesseract.recognize(preprocessedCanvas, "eng", {
        logger: (m) => console.log("OCR progress:", m),
        tessedit_char_whitelist:
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,%()-: ",
        oem: 1,
        psm: 6,
      });
      const text = result.data.text || "No OCR text detected.";
      ocrCache[imageUrl] = text;
      setOcrText(text);
      // immediately fetch matched records for Detected tab
      fetchRecords(text);
    } catch (err) {
      console.error("OCR Error:", err);
      const text = "No OCR text detected.";
      ocrCache[imageUrl] = text;
      setOcrText(text);
    } finally {
      setLoadingOCR(false);
      loadingCache[imageUrl] = false;
    }
  };

  const fetchRecords = async (text) => {
    if (!text || recordsCache[imageUrl]) {
      setMatchedRecords(recordsCache[imageUrl] || []);
      return;
    }
    setLoadingRecords(true);
    try {
      const res = await fetch("/api/check-smartstack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ocrText: text }),
      });
      const data = await res.json();
      const records = data.records || [];
      recordsCache[imageUrl] = records;
      setMatchedRecords(records);
    } catch (e) {
      console.error("Failed to fetch matched records", e);
      setMatchedRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  };

  const handleImageLoad = () => {
    runOCR();
  };

  const highlightMatches = (text, records) => {
    if (!text || !records?.length) return { __html: text || "" };
    let highlighted = text;

    // Use substance name + synonyms
    const words = new Set();
    records.forEach((rec) => {
      const f = rec.fields || {};
      if (f["Substance Name"]) words.add(f["Substance Name"]);
      (f["Synonyms"] || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => words.add(s));
    });

    // Highlight (simple, case-insensitive)
    words.forEach((w) => {
      const safe = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`(${safe})`, "gi");
      highlighted = highlighted.replace(
        re,
        `<span class="bg-yellow-300 text-black font-bold px-1 rounded">$1</span>`
      );
    });

    return { __html: highlighted };
  };

  // =========================
  // Render
  // =========================
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl p-6 max-w-4xl w-full relative overflow-auto max-h-[90vh]">
        <button
          className="absolute top-3 right-3 text-white text-lg font-bold"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>

        <h2 className="text-2xl font-bold mb-4">{stack.name} - Nutrition Label</h2>

        {imageUrl ? (
          <>
            <img
              ref={imageRef}
              src={imageUrl}
              alt={`${stack.name} Nutrition Label`}
              className="w-full object-contain rounded-lg mb-4"
              crossOrigin="anonymous"
              onLoad={handleImageLoad}
            />
            <canvas ref={canvasRef} style={{ display: "none" }} />
          </>
        ) : (
          <div className="w-full h-40 bg-gray-700 flex items-center justify-center rounded-lg mb-4 text-gray-400 text-sm">
            No Nutrition Image Available
          </div>
        )}

        {/* Tabs */}
        {imageUrl && (
          <div className="flex flex-wrap justify-start gap-2 mb-4">
            {[
              { key: "detected", label: "Detected Banned Substances" },
              { key: "benefits", label: "Benefits & Side Effects" },
              { key: "raw", label: "Raw OCR" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1 rounded-2xl text-sm font-medium transition-colors border ${
                  activeTab === tab.key
                    ? "bg-[#46769B] text-white border-transparent"
                    : "bg-gray-700 text-gray-200 border-gray-600 hover:bg-gray-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Tab content */}
        {imageUrl && (
          <div>
            {activeTab === "detected" && (
              <div className="bg-gray-800">
                {loadingOCR || loadingRecords ? (
                  <div className="bg-gray-700 p-4 rounded-lg text-gray-100 min-h-[100px] text-sm flex items-center">
                    <svg
                      className="animate-spin h-5 w-5 mr-2 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                    <p>Analyzing label{animDots}</p>
                  </div>
                ) : (
                  <ResultsTableSmartstack matchedRecords={matchedRecords} />
                )}
              </div>
            )}

            {activeTab === "benefits" && (
              <div>
                {/* Pass prefetched records so NutritionBreakdown doesn't refetch */}
                <NutritionBreakdown
                  ocrText={ocrText}
                  showOCR={false}
                  prefetchedRecords={matchedRecords}
                />
              </div>
            )}

            {activeTab === "raw" && (
              <div className="bg-gray-700 p-4 rounded-lg text-gray-100 min-h-[100px] text-sm whitespace-pre-wrap">
                {loadingOCR ? (
                  <div className="flex items-center">
                    <svg
                      className="animate-spin h-5 w-5 mr-2 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                    <p>Loading OCR{animDots}</p>
                  </div>
                ) : (
                  <div dangerouslySetInnerHTML={highlightMatches(ocrText, matchedRecords)} />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
