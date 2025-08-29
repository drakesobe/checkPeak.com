// components/Modal/NutritionModal.js
"use client";

import { useState, useRef, useEffect } from "react";
import ModalHeader from "./ModalHeader";
import ModalTabs from "./ModalTabs";
import ModalContent from "./ModalContent";
import ModalFooter from "./ModalFooter";

/**
 * NutritionModal
 * - Runs OCR (tesseract) on the nutrition image (if present)
 * - Calls /api/check-smartstack with the OCR text (or raw text)
 * - Displays matched banned/monitored substances (robust mapping)
 *
 * Notes:
 * - This version tolerates both old Airtable-shaped responses (r.fields)
 *   and newer flattened responses ({ name, banType, ... }).
 * - Caches OCR + record results per imageUrl for faster reopen.
 */

/* Simple caches so repeated opens are fast (process-lifetime) */
const ocrCache = {};
const recordsCache = {};
const loadingCache = {};

export default function NutritionModal({ stack, allStacks = [], onClose }) {
  const [activeTab, setActiveTab] = useState("detected"); // 'detected' | 'all'
  const [ocrText, setOcrText] = useState("");
  const [loadingOCR, setLoadingOCR] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [matchedRecords, setMatchedRecords] = useState([]);
  const [animDots, setAnimDots] = useState("");
  const [error, setError] = useState("");

  const imageRef = useRef(null);
  const canvasRef = useRef(null);

  // animate "Analyzing" dots when loading
  useEffect(() => {
    if (!loadingOCR && !loadingRecords) return;
    const interval = setInterval(() => {
      setAnimDots((p) => (p.length >= 3 ? "" : p + "."));
    }, 450);
    return () => clearInterval(interval);
  }, [loadingOCR, loadingRecords]);

  // defensive: if no stack, don't render
  if (!stack) return null;

  // prefer stack.nutritionLabel but fall back to raw fields if needed
  const imageUrl =
    stack.nutritionLabel || stack.rawFields?.["Nutrition Label URL"] || "";
  const affiliateLink =
    stack.affiliateLink || stack.rawFields?.["Lo. Amazon/Stripe Link"] || "";

  // -------------------------
  // Helpers
  // -------------------------
  const parseNumber = (v) => {
    if (v == null) return 0;
    if (typeof v === "number") return isFinite(v) ? v : 0;
    const s = String(v || "");
    const cleaned = s.replace(/[^0-9.\-]/g, "");
    const n = parseFloat(cleaned);
    return isFinite(n) ? n : 0;
  };

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

  // Value score shown in header and on cards
  const valueScore = priceNumber > 0 ? servingsNumber / priceNumber : 0;

  let valueColor = "";
  let valueLabel = "";
  if (valueScore >= 1.5) {
    valueColor = "bg-blue-600 text-white"; // changed to brand-blue (you wanted blue)
    valueLabel = "Best Value";
  } else if (valueScore >= 0.75) {
    valueColor = "bg-gray-600 text-white";
    valueLabel = "Moderate";
  } else {
    valueColor = "bg-red-600 text-white";
    valueLabel = "Premium";
  }

  // attach quick computed values to `stack` for header / card consumption
  // (we mutate a little for convenience — harmless here)
  stack.valueScore = valueScore;
  stack.valueColor = valueColor;
  stack.valueLabel = valueLabel;

  // -------------------------
  // OCR + record fetching
  // -------------------------
  const runOCR = async () => {
    if (!imageUrl) {
      setOcrText("");
      setMatchedRecords([]);
      return;
    }

    // if we've cached OCR text, use that and fetch records if necessary
    if (ocrCache[imageUrl]) {
      setOcrText(ocrCache[imageUrl]);
      if (!recordsCache[imageUrl]) await fetchRecords(ocrCache[imageUrl]);
      return;
    }

    // prevent duplicate runs
    if (loadingCache[imageUrl]) return;
    loadingCache[imageUrl] = true;

    setLoadingOCR(true);
    setError("");
    try {
      const Tesseract = (await import("tesseract.js")).default;
      const preprocessed = await preprocessImage();
      const result = await Tesseract.recognize(preprocessed, "eng", {
        logger: () => {
          /* silent in UI, logs appear in console if tesseract chooses to */
        },
        tessedit_char_whitelist:
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,%()-: ",
        oem: 1,
        psm: 6,
      });

      const text = (result?.data?.text || "").trim() || "No OCR text detected.";
      // cache
      ocrCache[imageUrl] = text;
      setOcrText(text);

      // fetch matched records for detected tab
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

  /**
   * preprocessImage - attempts to:
   *  - draw the image to a hidden canvas
   *  - convert to grayscale & stretch contrast
   *  - detect dark region (likely label) and crop/scale it
   *  - attempt simple deskew using Tesseract orientation
   *
   * returns a canvas element suitable to pass to Tesseract.recognize()
   */
  const preprocessImage = async () => {
    if (!imageRef.current) return null;
    const img = imageRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return img; // fallback

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

      // detect dark region (quick)
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

      // fallback: use full canvas if detection failed
      if (right - left < 20 || bottom - top < 20) {
        return canvas;
      }

      const cropW = right - left;
      const cropH = bottom - top;
      const scaleFactor = 3;
      const croppedCanvas = document.createElement("canvas");
      croppedCanvas.width = cropW * scaleFactor;
      croppedCanvas.height = cropH * scaleFactor;
      const cctx = croppedCanvas.getContext("2d");
      cctx.drawImage(
        canvas,
        left,
        top,
        cropW,
        cropH,
        0,
        0,
        croppedCanvas.width,
        croppedCanvas.height
      );

      // attempt orientation check and deskew (best-effort)
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
          dctx.drawImage(
            croppedCanvas,
            -croppedCanvas.width / 2,
            -croppedCanvas.height / 2
          );
          return deskew;
        }
      } catch (e) {
        // orientation attempt failed — continue with cropped image
        console.warn("Orientation check failed; continuing with cropped image.", e);
      }

      return croppedCanvas;
    } catch (err) {
      console.warn("Preprocess failed; returning base canvas", err);
      return canvas;
    }
  };

  /**
   * fetchRecords
   * - POSTs the OCR text to /api/check-smartstack
   * - Accepts both shapes from the API:
   *    - older shape: records are Airtable rows (rec.fields...)
   *    - newer shape: records are already flattened { name, banType, ... }
   * - Normalizes to objects: { name, banType, synonyms, bannedBy, dosageLimit, notes, source }
   */
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

      // Defensive: if API returned nothing, set empty
      const raw = data?.records || [];

      // Normalize each record to the shape ModalContent expects:
      // { name, banType, synonyms, bannedBy, dosageLimit, notes, source }
      const recs = raw.map((r) => {
        // if backend returned flattened object (new behavior)
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
            // keep original payload for future use if needed
            _raw: r,
          };
        }

        // older Airtable API shape: r.fields.* 
        if (r && typeof r === "object" && r.fields) {
          const f = r.fields || {};
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

        // fallback: try string fields or minimal mapping
        return {
          id: r?.id || null,
          name: (r?.name || r?.["Substance Name"] || "").toString().trim(),
          banType: (r?.banType || r?.["Ban Type"] || "").toString().trim(),
          synonyms: r?.synonyms || "",
          bannedBy: r?.bannedBy || "",
          dosageLimit: r?.dosageLimit || "",
          notes: r?.notes || "",
          source: r?.source || "",
          _raw: r,
        };
      });

      // Save to cache & state
      recordsCache[imageUrl] = recs;
      setMatchedRecords(recs);
      console.log("NutritionModal - matched records:", recs.map((x) => x.name));
    } catch (err) {
      console.error("Failed to fetch matched records", err);
      setMatchedRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  };

  // If the image is already cached/loaded, ensure OCR runs once (helps mobile/cached images)
  useEffect(() => {
    if (!imageUrl) return;
    const img = imageRef.current;
    // If we already have OCR cached, load it and records
    if (ocrCache[imageUrl]) {
      setOcrText(ocrCache[imageUrl]);
      if (!recordsCache[imageUrl]) fetchRecords(ocrCache[imageUrl]);
      return;
    }
    // If the image element exists and is already complete, run OCR after a small delay
    if (img && (img.complete || img.naturalWidth)) {
      setTimeout(() => {
        runOCR();
      }, 120);
    }
    // (Otherwise rely on onLoad handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  // image onLoad handler triggers OCR (for non-cached images)
  const handleImageLoad = () => {
    // small delay helps some browsers finish drawing to canvas
    setTimeout(() => runOCR(), 120);
  };

  // -------------------------
  // Render
  // -------------------------
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl p-6 max-w-4xl w-full relative overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <ModalHeader
          stack={stack}
          servingsNumber={servingsNumber}
          priceNumber={priceNumber}
          matchedRecords={matchedRecords}
          allStacks={allStacks}
          onClose={onClose}
        />

        {/* Main scrollable area */}
        <div className="mt-4 flex-1 overflow-auto pr-2">
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
              {/* Hidden canvas used by preprocessImage */}
              <canvas ref={canvasRef} style={{ display: "none" }} />
            </>
          ) : (
            <div className="w-full h-40 bg-gray-700 flex items-center justify-center rounded-lg mb-4 text-gray-400 text-sm">
              No Nutrition Image Available
            </div>
          )}

          {/* Tabs — keep the simple two-tab UX */}
          <ModalTabs activeTab={activeTab} setActiveTab={setActiveTab} />

          {/* Content (delegated to ModalContent) */}
          <ModalContent
            activeTab={activeTab}
            loadingOCR={loadingOCR}
            loadingRecords={loadingRecords}
            animDots={animDots}
            ocrText={ocrText}
            matchedRecords={matchedRecords}
            error={error}
            runOCR={runOCR}
          />
        </div>

        {/* Sticky footer: pass affiliateLink. If you want the Rescan button removed,
            update ModalFooter to not show it (or accept a prop like showRescan={false}). */}
        <div className="mt-4 sticky bottom-0 bg-gray-800 pt-4">
          <ModalFooter affiliateLink={affiliateLink} runOCR={runOCR} />
        </div>
      </div>
    </div>
  );
}
