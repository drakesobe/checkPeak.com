"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import ModalTabs from "./ModalTabs";
import OCRScanResults from "../OCRUpload/OCRScanResults";

/* Caches for OCR and records */
const ocrCache = {};
const recordsCache = {};
const loadingCache = {};

export default function CompareModalContent({ stack, allStacks = [], onClose }) {
  const [activeTab, setActiveTab] = useState("detected"); // 'detected' | 'all'
  const [ocrText, setOcrText] = useState("");
  const [matchedRecords, setMatchedRecords] = useState([]);
  const [loadingOCR, setLoadingOCR] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [animDots, setAnimDots] = useState("");
  const [error, setError] = useState("");

  const imageRef = useRef(null);
  const canvasRef = useRef(null);

  const imageUrl = stack.nutritionLabel || stack.imageUrl || "";

  // Animate dots during OCR
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

    if (ocrCache[imageUrl]) {
      setOcrText(ocrCache[imageUrl]);
      if (!recordsCache[imageUrl]) await fetchRecords(ocrCache[imageUrl]);
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
      setError("OCR failed. Try a clearer photo or re-open this modal.");
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

      let min = 255,
        max = 0;
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

      // Detect dark region
      let top = canvas.height,
        bottom = 0,
        left = canvas.width,
        right = 0;
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
        return { id: r?.id || null, name: r?.name || "", banType: r?.banType || "", _raw: r };
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

  // Run OCR automatically if image is already loaded
  useEffect(() => {
    if (!imageUrl) return;
    const img = imageRef.current;
    if (ocrCache[imageUrl]) {
      setOcrText(ocrCache[imageUrl]);
      if (!recordsCache[imageUrl]) fetchRecords(ocrCache[imageUrl]);
      return;
    }
    if (img && (img.complete || img.naturalWidth)) {
      setTimeout(() => runOCR(), 120);
    }
  }, [imageUrl]);

  const handleImageLoad = () => setTimeout(() => runOCR(), 120);

  return (
    <div className="flex flex-col space-y-4 w-full">
      {imageUrl ? (
        <>
          <img
            ref={imageRef}
            src={imageUrl}
            alt={`${stack.name} Nutrition Label`}
            className="w-full object-contain rounded-lg border border-gray-700"
            crossOrigin="anonymous"
            onLoad={handleImageLoad}
          />
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </>
      ) : (
        <div className="w-full h-40 bg-gray-700 flex items-center justify-center rounded-lg text-gray-400 text-sm">
          No Nutrition Label Available
        </div>
      )}

      <ModalTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="flex flex-col space-y-2">
        <button
          onClick={runOCR}
          disabled={loadingOCR || !imageUrl}
          className={`px-4 py-2 rounded-2xl font-medium text-white transition ${
            loadingOCR || !imageUrl ? "bg-gray-400 cursor-not-allowed" : "bg-[#46769B] hover:bg-blue-700"
          }`}
        >
          {loadingOCR ? `Scanning${animDots}` : "Scan Label"}
        </button>

        <OCRScanResults ocrText={ocrText} matchedSubstances={matchedRecords} />
        {error && <p className="text-red-500">{error}</p>}
      </div>
    </div>
  );
}
