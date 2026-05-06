// components/Modal/CompareModalContent.jsx
"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import ModalTabs from "./ModalTabs";
import OCRScanResults from "../OCRUpload/OCRScanResults";

/* -----------------------------------------------------------------------------
  ✅ Capped caches (prevents memory leaks across long sessions)
----------------------------------------------------------------------------- */
const MAX_CACHE_ITEMS = 50;

const ocrCache = Object.create(null); // imageUrl -> ocrText
const recordsCache = Object.create(null); // imageUrl -> { banned: [], ingredients: [] }
const loadingCache = Object.create(null); // imageUrl -> boolean
const cacheOrder = [];

function touchCache(map, key, value) {
  if (!key) return;
  if (!(key in map)) {
    cacheOrder.push(key);
    while (cacheOrder.length > MAX_CACHE_ITEMS) {
      const oldest = cacheOrder.shift();
      if (!oldest) continue;
      delete ocrCache[oldest];
      delete recordsCache[oldest];
      delete loadingCache[oldest];
    }
  }
  map[key] = value;
}

function deleteCacheKey(key) {
  if (!key) return;
  delete ocrCache[key];
  delete recordsCache[key];
  delete loadingCache[key];
  const idx = cacheOrder.indexOf(key);
  if (idx >= 0) cacheOrder.splice(idx, 1);
}

/* -----------------------------------------------------------------------------
  ✅ Cache tesseract import (avoid re-import per scan)
----------------------------------------------------------------------------- */
let tesseractPromise = null;
async function getTesseract() {
  if (!tesseractPromise) {
    tesseractPromise = import("tesseract.js").then((m) => m.default);
  }
  return tesseractPromise;
}

export default function CompareModalContent({ stack, allStacks = [], onClose }) {
  const [activeTab, setActiveTab] = useState("detected");

  const [ocrText, setOcrText] = useState("");
  const [matchedBanned, setMatchedBanned] = useState([]);
  const [matchedIngredients, setMatchedIngredients] = useState([]);
  const [loadingOCR, setLoadingOCR] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [animDots, setAnimDots] = useState("");
  const [error, setError] = useState("");

  const imageRef = useRef(null);
  const canvasRef = useRef(null);

  const imageUrl =
    stack?.nutritionLabel ||
    stack?.imageUrl ||
    stack?.fields?.["Nutrition Label URL"] ||
    stack?.rawFields?.["Nutrition Label URL"] ||
    stack?.image ||
    "";

  // Animate dots during OCR / records fetch
  useEffect(() => {
    if (!loadingOCR && !loadingRecords) {
      setAnimDots("");
      return;
    }
    const interval = setInterval(() => {
      setAnimDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 450);
    return () => clearInterval(interval);
  }, [loadingOCR, loadingRecords]);

  const preprocessImage = useCallback(async () => {
    const img = imageRef.current;
    const canvas = canvasRef.current;

    // If we can't preprocess, we will fall back to the <img> element for OCR
    if (!img || !canvas) return null;

    // Ensure image is ready
    if (!img.complete || (img.naturalWidth ?? 0) === 0) {
      await new Promise((r) => setTimeout(r, 120));
    }

    const ctx = canvas.getContext("2d");
    canvas.width = img.naturalWidth || img.width || 800;
    canvas.height = img.naturalHeight || img.height || 600;
    ctx.drawImage(img, 0, 0);

    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      let min = 255;
      let max = 0;

      // grayscale + find min/max
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

      // detect dark region (likely text area)
      let top = canvas.height;
      let bottom = 0;
      let left = canvas.width;
      let right = 0;

      for (let y = 0; y < canvas.height; y += 2) {
        for (let x = 0; x < canvas.width; x += 2) {
          const idx = (y * canvas.width + x) * 4;
          if (data[idx] < 100) {
            if (x < left) left = x;
            if (x > right) right = x;
            if (y < top) top = y;
            if (y > bottom) bottom = y;
          }
        }
      }

      // If no clear dark region, use full canvas
      if (right - left < 20 || bottom - top < 20) return canvas;

      const scaleFactor = 3;
      const croppedCanvas = document.createElement("canvas");
      croppedCanvas.width = (right - left) * scaleFactor;
      croppedCanvas.height = (bottom - top) * scaleFactor;
      const cctx = croppedCanvas.getContext("2d");

      cctx.drawImage(
        canvas,
        left,
        top,
        right - left,
        bottom - top,
        0,
        0,
        croppedCanvas.width,
        croppedCanvas.height
      );

      return croppedCanvas;
    } catch (err) {
      console.warn("Preprocess failed; using full canvas", err);
      return canvas;
    }
  }, []);

  const fetchRecords = useCallback(
    async (text) => {
      const cleaned = String(text || "").trim();
      if (!imageUrl) return;
      if (!cleaned || cleaned.length < 2) return;

      const lower = cleaned.toLowerCase();
      if (
        lower === "no ocr text detected." ||
        lower === "no ocr text detected" ||
        lower === "no text detected." ||
        lower === "no text detected"
      ) {
        return;
      }

      // Cache hit
      if (recordsCache[imageUrl]) {
        const c = recordsCache[imageUrl];
        setMatchedBanned(c.banned || []);
        setMatchedIngredients(c.ingredients || []);
        return;
      }

      setLoadingRecords(true);

      try {
        const res = await fetch("/api/check-smartstack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // ✅ new contract
          body: JSON.stringify({ ingredientsText: cleaned }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Failed to fetch records");

        const banned = Array.isArray(data?.bannedSubstances)
          ? data.bannedSubstances
          : [];
        const ingredients = Array.isArray(data?.ingredients)
          ? data.ingredients
          : [];

        touchCache(recordsCache, imageUrl, { banned, ingredients });

        setMatchedBanned(banned);
        setMatchedIngredients(ingredients);
      } catch (err) {
        console.error("Fetch matched records failed", err);
        setMatchedBanned([]);
        setMatchedIngredients([]);
      } finally {
        setLoadingRecords(false);
      }
    },
    [imageUrl]
  );

  const runOCR = useCallback(
    async (force = false) => {
      if (!imageUrl) {
        setOcrText("");
        setMatchedBanned([]);
        setMatchedIngredients([]);
        return;
      }

      // Force = true clears caches so it truly re-scans
      if (force) deleteCacheKey(imageUrl);

      // Use cached OCR if available
      if (ocrCache[imageUrl] && !force) {
        const cached = ocrCache[imageUrl];
        setOcrText(cached);

        if (recordsCache[imageUrl]) {
          const c = recordsCache[imageUrl];
          setMatchedBanned(c.banned || []);
          setMatchedIngredients(c.ingredients || []);
        } else {
          await fetchRecords(cached);
        }
        return;
      }

      // Already scanning this image somewhere else
      if (loadingCache[imageUrl]) return;
      loadingCache[imageUrl] = true;

      setLoadingOCR(true);
      setError("");

      try {
        const Tesseract = await getTesseract();
        const preprocessed = await preprocessImage();

        // If preprocess returns null, fall back to the image element
        const target = preprocessed || imageRef.current;
        if (!target) throw new Error("Image not ready for OCR.");

        const result = await Tesseract.recognize(target, "eng", {
          logger: () => {},
          tessedit_char_whitelist:
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,%()-: ",
          oem: 1,
          psm: 6,
        });

        const text =
          (result?.data?.text || "").trim() || "No OCR text detected.";

        touchCache(ocrCache, imageUrl, text);
        setOcrText(text);

        await fetchRecords(text);
      } catch (err) {
        console.error("OCR Error:", err);
        setError("OCR failed. Try a clearer photo or re-open this comparison.");
        const fallback = "No OCR text detected.";
        touchCache(ocrCache, imageUrl, fallback);
        setOcrText(fallback);
        setMatchedBanned([]);
        setMatchedIngredients([]);
      } finally {
        setLoadingOCR(false);
        loadingCache[imageUrl] = false;
      }
    },
    [imageUrl, fetchRecords, preprocessImage]
  );

  // Auto-run OCR when image is ready (and hydrate from cache instantly)
  useEffect(() => {
    if (!imageUrl) return;

    // If cached OCR exists, hydrate immediately and fetch records if needed
    if (ocrCache[imageUrl]) {
      const cached = ocrCache[imageUrl];
      setOcrText(cached);

      if (recordsCache[imageUrl]) {
        const c = recordsCache[imageUrl];
        setMatchedBanned(c.banned || []);
        setMatchedIngredients(c.ingredients || []);
      } else {
        fetchRecords(cached).catch(() => {});
      }
      return;
    }

    // If image already loaded, kick off OCR with small delay
    const img = imageRef.current;
    if (img && (img.complete || img.naturalWidth)) {
      const timer = setTimeout(() => runOCR(false), 120);
      return () => clearTimeout(timer);
    }
  }, [imageUrl, fetchRecords, runOCR]);

  const handleImageLoad = () => {
    // Event handlers don’t support returning a cleanup - just run the timer.
    setTimeout(() => runOCR(false), 120);
  };

  const statusLabel = useMemo(() => {
    if (!imageUrl) return "No label image available";
    if (loadingOCR) return `Scanning label${animDots}`;
    if (loadingRecords) return `Checking ingredients${animDots}`;
    if (ocrText && (matchedBanned.length || matchedIngredients.length))
      return "Scan complete · results ready";
    if (ocrText) return "Scan complete · no matches found";
    return "Ready to scan this label";
  }, [imageUrl, loadingOCR, loadingRecords, animDots, ocrText, matchedBanned.length, matchedIngredients.length]);

  return (
    <div className="flex flex-col gap-4 w-full text-slate-50">
      {/* Label image */}
      {imageUrl ? (
        <>
          <div className="rounded-xl overflow-hidden border border-slate-700/80 bg-slate-900/70">
            <img
              ref={imageRef}
              src={imageUrl}
              alt={`${stack?.name || "Product"} Nutrition Label`}
              className="w-full max-h-64 object-contain bg-slate-900"
              crossOrigin="anonymous"
              onLoad={handleImageLoad}
              onError={(e) => {
                // Avoid infinite loops
                if (!e.currentTarget.dataset.fallback) {
                  e.currentTarget.dataset.fallback = "1";
                  e.currentTarget.src = "/fallback-image.svg";
                }
              }}
            />
          </div>
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </>
      ) : (
        <div className="w-full h-40 bg-slate-800 flex items-center justify-center rounded-xl text-slate-400 text-sm">
          No nutrition label available for this stack.
        </div>
      )}

      {/* Status pill */}
      <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs text-slate-300">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-800/80 border border-slate-700/70">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          {statusLabel}
        </span>

        {ocrText && (
          <span className="hidden sm:inline text-slate-400 truncate max-w-[180px] text-right">
            {ocrText.slice(0, 48)}
            {ocrText.length > 48 ? "…" : ""}
          </span>
        )}
      </div>

      {/* Tabs */}
      <ModalTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Actions + results */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <motion.button
            type="button"
            onClick={() => runOCR(true)}
            disabled={loadingOCR || !imageUrl}
            whileTap={{ scale: loadingOCR || !imageUrl ? 1 : 0.97 }}
            className={`flex-1 px-4 py-2.5 rounded-2xl font-semibold text-xs sm:text-sm transition flex items-center justify-center ${
              loadingOCR || !imageUrl
                ? "bg-slate-600 text-slate-200 cursor-not-allowed"
                : "bg-[#46769B] hover:brightness-110 text-white shadow-sm"
            }`}
          >
            {loadingOCR
              ? `Scanning${animDots}`
              : !imageUrl
              ? "No label to scan"
              : "Rescan (force)"}
          </motion.button>

          <motion.button
            type="button"
            onClick={() => runOCR(false)}
            disabled={loadingOCR || loadingRecords || !imageUrl}
            whileTap={{ scale: loadingOCR || loadingRecords || !imageUrl ? 1 : 0.97 }}
            className={`px-4 py-2.5 rounded-2xl font-semibold text-xs sm:text-sm transition flex items-center justify-center ${
              loadingOCR || loadingRecords || !imageUrl
                ? "bg-slate-700 text-slate-300 cursor-not-allowed"
                : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
            }`}
            title="Uses cache when available"
          >
            Refresh
          </motion.button>
        </div>

        {activeTab === "detected" ? (
          <OCRScanResults
            ocrText={ocrText}
            matchedSubstances={matchedBanned}
            matchedIngredients={matchedIngredients}
          />
        ) : (
          <div className="mt-1 rounded-xl border border-slate-700/80 bg-slate-900/80 p-3 text-xs sm:text-sm text-slate-100 max-h-64 overflow-y-auto">
            {ocrText ? (
              <pre className="whitespace-pre-wrap break-words font-mono text-[11px] sm:text-xs text-slate-100">
                {ocrText}
              </pre>
            ) : (
              <p className="text-slate-400 text-xs">
                OCR text will appear here after a scan.
              </p>
            )}
          </div>
        )}

        {error && (
          <p className="text-[11px] sm:text-xs text-rose-400 font-medium mt-1">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
