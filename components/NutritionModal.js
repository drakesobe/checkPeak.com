// components/NutritionModal.js
"use client";
import { useState, useRef, useEffect } from "react";
import NutritionBreakdown from "./NutritionBreakdown";
import ResultsTableSmartstack from "./ResultsTable-smartstack";

// Simple caches so repeated opens are fast
const ocrCache = {};
const recordsCache = {};
const loadingCache = {};

export default function NutritionModal({ stack, allStacks = [], onClose }) {
  const [activeTab, setActiveTab] = useState("detected"); // 'detected' | 'benefits' | 'raw'
  const [ocrText, setOcrText] = useState("");
  const [loadingOCR, setLoadingOCR] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [matchedRecords, setMatchedRecords] = useState([]);
  const [animDots, setAnimDots] = useState("");
  const [error, setError] = useState("");

  const imageRef = useRef(null);
  const canvasRef = useRef(null);

  // animate "Analyzing" dots
  useEffect(() => {
    if (!loadingOCR && !loadingRecords) return;
    const interval = setInterval(() => {
      setAnimDots((p) => (p.length >= 3 ? "" : p + "."));
    }, 450);
    return () => clearInterval(interval);
  }, [loadingOCR, loadingRecords]);

  if (!stack) return null;
  const imageUrl = stack.nutritionLabel || stack.rawFields?.["Nutrition Label URL"] || "";
  const affiliateLink = stack.affiliateLink || stack.rawFields?.["Lo. Amazon/Stripe Link"] || "";

  // =========================
  // Value Rating Calculation
  // =========================
  const servings = Number(stack.fields?.Servings || stack.rawFields?.Servings || 0);
  const price = Number(stack.fields?.Price || stack.rawFields?.Price || 1); // avoid divide by zero
  const valueRating = price > 0 ? servings / price : 0;

  // calculate percentiles for color coding
  const allValues = allStacks.map((s) => {
    const sVal = Number(s.fields?.Servings || s.rawFields?.Servings || 0);
    const pVal = Number(s.fields?.Price || s.rawFields?.Price || 1);
    return pVal > 0 ? sVal / pVal : 0;
  }).sort((a,b) => a-b);

  const getPercentileColor = (val) => {
    const idx = allValues.findIndex(v => v >= val);
    const percentile = idx / (allValues.length || 1);
    if (percentile >= 0.66) return "text-green-400"; // top 33%
    else if (percentile >= 0.33) return "text-yellow-400"; // middle 33%
    else return "text-red-400"; // bottom 33%
  };

  const valueColor = getPercentileColor(valueRating);

  // =========================
  // Image preprocessing (SmartStack style)
  // =========================
  const preprocessImage = async () => {
    if (!imageRef.current) return null;
    const img = imageRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    canvas.width = img.naturalWidth || img.width || 800;
    canvas.height = img.naturalHeight || img.height || 600;
    ctx.drawImage(img, 0, 0);

    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      let min = 255, max = 0;
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
        if (gray < min) min = gray;
        if (gray > max) max = gray;
      }
      const scale = 255 / (max - min || 1);
      for (let i = 0; i < data.length; i += 4) {
        let gray = 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
        gray = Math.max(0, Math.min(255, (gray - min) * scale));
        data[i] = data[i + 1] = data[i + 2] = gray;
      }
      ctx.putImageData(imageData, 0, 0);

      // detect dark region
      let top = canvas.height, bottom = 0, left = canvas.width, right = 0;
      for (let y = 0; y < canvas.height; y += 2) {
        for (let x = 0; x < canvas.width; x += 2) {
          const idx = (y * canvas.width + x) * 4;
          const gray = imageData.data[idx];
          if (gray < 100) {
            if (x < left) left = x;
            if (x > right) right = x;
            if (y < top) top = y;
            if (y > bottom) bottom = y;
          }
        }
      }

      if (right - left < 20 || bottom - top < 20) return canvas;

      const cropW = right - left;
      const cropH = bottom - top;
      const scaleFactor = 3;
      const croppedCanvas = document.createElement("canvas");
      croppedCanvas.width = cropW * scaleFactor;
      croppedCanvas.height = cropH * scaleFactor;
      const cctx = croppedCanvas.getContext("2d");
      cctx.drawImage(canvas, left, top, cropW, cropH, 0, 0, croppedCanvas.width, croppedCanvas.height);

      try {
        const Tesseract = (await import("tesseract.js")).default;
        const orientation = await Tesseract.recognize(croppedCanvas, "eng", {
          tessedit_char_whitelist:
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,%()-: ",
          oem: 1,
          psm: 0,
        });
        const angle = orientation?.data?.orientation?.degrees || 0;
        if (Math.abs(angle) > 1) {
          const deskew = document.createElement("canvas");
          deskew.width = croppedCanvas.width;
          deskew.height = croppedCanvas.height;
          const dctx = deskew.getContext("2d");
          dctx.translate(deskew.width / 2, deskew.height / 2);
          dctx.rotate((-angle * Math.PI) / 180);
          dctx.drawImage(croppedCanvas, -croppedCanvas.width / 2, -croppedCanvas.height / 2);
          return deskew;
        }
      } catch (e) {
        console.warn("Orientation check failed; continuing with cropped image.", e);
      }

      return croppedCanvas;
    } catch (err) {
      console.warn("Preprocess failed; returning base canvas", err);
      return canvas;
    }
  };

  // =========================
  // OCR + Records fetch
  // =========================
  const fetchRecords = async (text) => {
    if (!text) return;
    if (recordsCache[imageUrl]) {
      setMatchedRecords(recordsCache[imageUrl]);
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
      const recs = data.records || [];
      recordsCache[imageUrl] = recs;
      setMatchedRecords(recs);
    } catch (err) {
      console.error("Failed to fetch matched records", err);
      setMatchedRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  };

  const runOCR = async () => {
    if (!imageUrl) {
      setOcrText("");
      setMatchedRecords([]);
      return;
    }

    if (ocrCache[imageUrl]) {
      setOcrText(ocrCache[imageUrl]);
      if (!recordsCache[imageUrl]) fetchRecords(ocrCache[imageUrl]);
      return;
    }
    if (loadingCache[imageUrl]) return;
    loadingCache[imageUrl] = true;

    setLoadingOCR(true);
    setError("");
    try {
      const Tesseract = (await import("tesseract.js")).default;
      const preprocessed = await preprocessImage();
      const result = await Tesseract.recognize(preprocessed, "eng", {
        logger: (m) => {},
        tessedit_char_whitelist:
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,%()-: ",
        oem: 1,
        psm: 6,
      });

      const text = result?.data?.text?.trim() || "No OCR text detected.";
      ocrCache[imageUrl] = text;
      setOcrText(text);
      fetchRecords(text);
    } catch (err) {
      console.error("OCR Error:", err);
      setError("OCR failed. Try rescanning or a clearer photo.");
      const fallback = "No OCR text detected.";
      ocrCache[imageUrl] = fallback;
      setOcrText(fallback);
    } finally {
      setLoadingOCR(false);
      loadingCache[imageUrl] = false;
    }
  };

  const handleImageLoad = () => {
    setTimeout(() => runOCR(), 120);
  };

  const highlightMatches = (text, records) => {
    if (!text) return { __html: "" };
    if (!records?.length) return { __html: text };

    let highlighted = text;
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

    words.forEach((w) => {
      const safe = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`(${safe})`, "gi");
      highlighted = highlighted.replace(
        re,
        `<mark class="bg-yellow-300 text-black font-semibold px-0.5 rounded">$1</mark>`
      );
    });

    return { __html: highlighted };
  };

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

        {/* header / product info */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold mb-1">{stack.name}</h2>
            <div className="text-sm text-gray-300 flex flex-wrap gap-2 items-center">
              {stack.notes || ""}
              {stack.rating != null && (
                <span className="ml-0.5 inline-block text-sm font-semibold text-yellow-300">
                  ★ {Number(stack.rating).toFixed(2)}
                </span>
              )}
              {!isNaN(valueRating) && (
                <span className={`inline-block text-sm font-semibold ${valueColor}`}>
                  ★ Value: {valueRating.toFixed(2)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* image & hidden canvas */}
        <div className="mt-4">
          {imageUrl ? (
            <>
              <img
                ref={imageRef}
                src={imageUrl}
                alt={`${stack.name} Nutrition Label`}
                className="w-full object-contain rounded-lg mb-4 border border-gray-700"
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
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { key: "detected", label: "Detected Banned Substances" },
            { key: "benefits", label: "Benefits & Side Effects" },
            { key: "raw", label: "Scanned Label" },
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

        {/* Tab content */}
        <div>
          {activeTab === "detected" && (
            <div className="bg-gray-800 p-3 rounded-lg">
              {loadingOCR || loadingRecords ? (
                <div className="bg-gray-700 p-4 rounded-lg text-gray-100 min-h-[100px] text-sm flex items-center gap-3">
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" />
                  </svg>
                  <p>
                    {loadingOCR ? `Analyzing label${animDots}` : `Looking up detected ingredients${animDots}`}
                  </p>
                </div>
              ) : (
                <ResultsTableSmartstack matchedRecords={matchedRecords} />
              )}
              {error && <p className="text-red-400 mt-3">{error}</p>}
            </div>
          )}

          {activeTab === "benefits" && (
            <div className="bg-gray-700 p-4 rounded-lg text-gray-200 text-sm min-h-[100px]">
              In app development
            </div>
          )}

          {activeTab === "raw" && (
            <div className="bg-gray-700 p-4 rounded-lg text-gray-100 min-h-[100px] text-sm whitespace-pre-wrap">
              {loadingOCR ? (
                <div className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" />
                  </svg>
                  <p>Loading OCR{animDots}</p>
                </div>
              ) : (
                <div dangerouslySetInnerHTML={highlightMatches(ocrText, matchedRecords)} />
              )}
            </div>
          )}
        </div>

        {/* Sticky button bar */}
        <div className="mt-4 sticky bottom-0 left-0 right-0 bg-gray-800 p-3 flex justify-end gap-2 rounded-b-xl border-t border-gray-700 z-10">
          {affiliateLink && (
            <a
              href={affiliateLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#46769B] hover:bg-[#35607f] text-white px-3 py-2 rounded-lg shadow-md text-sm"
            >
              Buy Now
            </a>
          )}
          <button
            onClick={() => runOCR()}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
            title="Rescan label"
          >
            Rescan
          </button>
        </div>
      </div>
    </div>
  );
}
