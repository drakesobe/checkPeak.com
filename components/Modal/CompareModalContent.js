// components/Modal/CompareModalContent.jsx
"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import ModalTabs from "./ModalTabs";
import OCRScanResults from "../OCRUpload/OCRScanResults";

/* Caches for OCR and records (per image URL) */
const ocrCache = {};
const recordsCache = {};
const loadingCache = {};

export default function CompareModalContent({ stack, allStacks = [], onClose }) {
  // 'detected' | 'all' (or whatever your ModalTabs expects)
  const [activeTab, setActiveTab] = useState("detected");

  const [ocrText, setOcrText] = useState("");
  const [matchedRecords, setMatchedRecords] = useState([]);
  const [loadingOCR, setLoadingOCR] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [animDots, setAnimDots] = useState("");
  const [error, setError] = useState("");

  const imageRef = useRef(null);
  const canvasRef = useRef(null);

  const imageUrl = stack?.nutritionLabel || stack?.imageUrl || "";

  // Animate dots during OCR / records fetch
  useEffect(() => {
    if (!loadingOCR && !loadingRecords) return;
    const interval = setInterval(() => {
      setAnimDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 450);
    return () => clearInterval(interval);
  }, [loadingOCR, loadingRecords]);

  const runOCR = async () => {
    if (!imageUrl) {
      setOcrText("");
      setMatchedRecords([]);
      return;
    }

    // Use cached OCR if available
    if (ocrCache[imageUrl]) {
      const cached = ocrCache[imageUrl];
      setOcrText(cached);
      if (!recordsCache[imageUrl]) {
        await fetchRecords(cached);
      } else {
        setMatchedRecords(recordsCache[imageUrl]);
      }
      return;
    }

    // Already scanning this image somewhere else
    if (loadingCache[imageUrl]) return;
    loadingCache[imageUrl] = true;

    setLoadingOCR(true);
    setError("");

    try {
      const Tesseract = (await import("tesseract.js")).default;
      const preprocessed = await preprocessImage();
      const result = await Tesseract.recognize(preprocessed, "eng", {
        logger: () => {},
        tessedit_char_whitelist:
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,%()-: ",
        oem: 1,
        psm: 6,
      });

      const text = (result?.data?.text || "").trim() || "No OCR text detected.";
      ocrCache[imageUrl] = text;
      setOcrText(text);

      await fetchRecords(text);
    } catch (err) {
      console.error("OCR Error:", err);
      setError("OCR failed. Try a clearer photo or re-open this comparison.");
      const fallback = "No OCR text detected.";
      ocrCache[imageUrl] = fallback;
      setOcrText(fallback);
      setMatchedRecords([]);
    } finally {
      setLoadingOCR(false);
      loadingCache[imageUrl] = false;
    }
  };

  const preprocessImage = async () => {
    if (!imageRef.current || !canvasRef.current) return null;

    const img = imageRef.current;
    const canvas = canvasRef.current;
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
        const gray =
          0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
        if (gray < min) min = gray;
        if (gray > max) max = gray;
      }

      const scale = 255 / (max - min || 1);

      for (let i = 0; i < data.length; i += 4) {
        let gray =
          0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
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
  };

  const fetchRecords = async (text) => {
    if (!text) return;

    // Use cache if present
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
      const raw = data?.records || [];

      const recs = raw.map((r) => {
        if (r && typeof r === "object" && r.name) {
          return {
            id: r.id || r.recordId || null,
            name: (r.name || "").toString().trim(),
            banType: (r.banType || r["Ban Type"] || "").toString().trim(),
            synonyms: r.synonyms || r["Synonyms"] || "",
            bannedBy: r.bannedBy || r["Banned By"] || "",
            dosageLimit: r.dosageLimit || r["Dosage Limit"] || "",
            notes: r.notes || r["Notes"] || "",
            source: r.source || r["Source / Citation"] || "",
            _raw: r,
          };
        }

        if (r?.fields) {
          const f = r.fields;
          return {
            id: r.id || null,
            name: (f["Substance Name"] || "").toString().trim(),
            banType: (f["Ban Type"] || "").toString().trim(),
            synonyms: f["Synonyms"] || "",
            bannedBy: f["Banned By"] || "",
            dosageLimit: f["Dosage Limit"] || "",
            notes: f["Notes"] || "",
            source: f["Source / Citation"] || "",
            _raw: r,
          };
        }

        return {
          id: r?.id || null,
          name: r?.name || "",
          banType: r?.banType || "",
          _raw: r,
        };
      });

      recordsCache[imageUrl] = recs;
      setMatchedRecords(recs);
    } catch (err) {
      console.error("Fetch matched records failed", err);
      setMatchedRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  };

  // Auto-run OCR when image is ready
  useEffect(() => {
    if (!imageUrl) return;

    const img = imageRef.current;

    if (ocrCache[imageUrl]) {
      const cached = ocrCache[imageUrl];
      setOcrText(cached);
      if (!recordsCache[imageUrl]) {
        fetchRecords(cached);
      } else {
        setMatchedRecords(recordsCache[imageUrl]);
      }
      return;
    }

    if (img && (img.complete || img.naturalWidth)) {
      // small delay so layout has stabilized
      const timer = setTimeout(() => runOCR(), 120);
      return () => clearTimeout(timer);
    }
  }, [imageUrl]);

  const handleImageLoad = () => {
    const timer = setTimeout(() => runOCR(), 120);
    return () => clearTimeout(timer);
  };

  const statusLabel = (() => {
    if (!imageUrl) return "No label image available";
    if (loadingOCR) return `Scanning label${animDots}`;
    if (loadingRecords) return `Checking substances${animDots}`;
    if (ocrText && matchedRecords.length) return "Scan complete · matches found";
    if (ocrText && !matchedRecords.length) return "Scan complete · no matches found";
    return "Ready to scan this label";
  })();

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
          <span className="hidden sm:inline text-slate-400 truncate max-w-[140px] text-right">
            {ocrText.slice(0, 40)}
            {ocrText.length > 40 ? "…" : ""}
          </span>
        )}
      </div>

      {/* Tabs (detected vs raw, etc.) */}
      <ModalTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Actions + results */}
      <div className="flex flex-col gap-3">
        <motion.button
          type="button"
          onClick={runOCR}
          disabled={loadingOCR || !imageUrl}
          whileTap={{ scale: loadingOCR || !imageUrl ? 1 : 0.97 }}
          className={`px-4 py-2.5 rounded-2xl font-semibold text-xs sm:text-sm transition flex items-center justify-center ${
            loadingOCR || !imageUrl
              ? "bg-slate-600 text-slate-200 cursor-not-allowed"
              : "bg-[#46769B] hover:brightness-110 text-white shadow-sm"
          }`}
        >
          {loadingOCR
            ? `Scanning${animDots}`
            : !imageUrl
            ? "No label to scan"
            : "Rescan this label"}
        </motion.button>

        {activeTab === "detected" ? (
          <OCRScanResults
            ocrText={ocrText}
            matchedSubstances={matchedRecords}
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
