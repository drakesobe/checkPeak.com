"use client";
import { useState, useRef, useEffect } from "react";
import ModalHeader from "./ModalHeader";
import ModalTabs from "./ModalTabs";
import ModalContent from "./ModalContent";
import ModalFooter from "./ModalFooter";

// simple caches so repeated opens are fast (module-scoped)
const ocrCache = {};
const recordsCache = {};
const loadingCache = {};

export default function ModalContainer({ stack, allStacks = [], onClose }) {
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

  // prefer stack.nutritionLabel but fall back to raw fields if needed
  const imageUrl = stack.nutritionLabel || stack.rawFields?.["Nutrition Label URL"] || "";
  const affiliateLink = stack.affiliateLink || stack.rawFields?.["Lo. Amazon/Stripe Link"] || "";

  // small helper to robustly parse numbers (Price, Servings)
  const parseNumber = (v) => {
    if (v == null) return 0;
    if (typeof v === "number") return isFinite(v) ? v : 0;
    const s = String(v);
    const cleaned = s.replace(/[^0-9.\-]/g, "");
    const n = parseFloat(cleaned);
    return isFinite(n) ? n : 0;
  };

  // Extract servings & price for header display
  const servingsNumber =
    parseNumber(stack.fields?.Servings) ||
    parseNumber(stack.rawFields?.Servings) ||
    parseNumber(stack.servings) ||
    0;

  const priceNumber =
    parseNumber(stack.fields?.Price) ||
    parseNumber(stack.rawFields?.Price) ||
    parseNumber(stack.price) ||
    0;

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

      // detect dark (likely label) region
      let top = canvas.height,
        bottom = 0,
        left = canvas.width,
        right = 0;
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

      // if detection failed, return the full canvas
      if (right - left < 20 || bottom - top < 20) {
        return canvas;
      }

      // crop and scale up a bit for OCR
      const cropW = right - left;
      const cropH = bottom - top;
      const scaleFactor = 3;
      const croppedCanvas = document.createElement("canvas");
      croppedCanvas.width = cropW * scaleFactor;
      croppedCanvas.height = cropH * scaleFactor;
      const cctx = croppedCanvas.getContext("2d");
      cctx.drawImage(canvas, left, top, cropW, cropH, 0, 0, croppedCanvas.width, croppedCanvas.height);

      // quick deskew attempt (ask tesseract for orientation then rotate)
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
        // orientation attempt failed; that's OK — we'll use croppedCanvas
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
    if (!imageUrl) return;
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
        logger: (m) => {
          // optional
        },
        tessedit_char_whitelist:
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,%()-: ",
        oem: 1,
        psm: 6,
      });

      const text = result?.data?.text?.trim() || "No OCR text detected.";
      ocrCache[imageUrl] = text;
      setOcrText(text);
      // immediately fetch matched records for Detected tab
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

  // If the image is already cached/complete, ensure OCR runs once (helps mobile/cached images)
  useEffect(() => {
    if (!imageUrl) return;
    const img = imageRef.current;
    if (img && (img.complete || img.naturalWidth)) {
      // small delay to allow canvas drawing in some browsers
      setTimeout(() => runOCR(), 120);
    }
    // we still rely on onLoad handler for normal cases
  }, [imageUrl]);

  // auto-run OCR when image finishes loading
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
        <ModalHeader
          stack={stack}
          allStacks={allStacks}
          servingsNumber={servingsNumber}
          priceNumber={priceNumber}
          onClose={onClose}
        />

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

        <ModalTabs activeTab={activeTab} setActiveTab={setActiveTab} />

        <ModalContent
          activeTab={activeTab}
          loadingOCR={loadingOCR}
          loadingRecords={loadingRecords}
          animDots={animDots}
          error={error}
          matchedRecords={matchedRecords}
          ocrText={ocrText}
          highlightMatches={highlightMatches}
        />

        <ModalFooter affiliateLink={affiliateLink} runOCR={runOCR} />
      </div>
    </div>
  );
}
