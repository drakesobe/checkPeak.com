// components/NutritionModal.jsx
"use client";

import { useState, useRef, useEffect } from "react";
import ModalHeader from "./ModalHeader";
import ModalTabs from "./ModalTabs";
import ModalContent from "./ModalContent";
import ModalFooter from "./ModalFooter";

/**
 * NutritionModal
 *
 * - Displays a nutrition label image (if present) and runs OCR + Airtable matching.
 * - Integrates with /api/check-smartstack which returns matchedBanned and matchedIngredients.
 * - Keeps simple caches so repeated opens of the same image are fast.
 *
 * Notes / changes applied:
 * - Uses actual servings/price values from `stack` (fallbacks from rawFields and other common keys).
 * - Keeps OCR / records caches to avoid repeated work.
 * - Ensures OCR runs for each newly opened stack (resets when stack.id changes).
 * - Exposes runOCR to ModalContent so it can trigger scanning when the "detected" tab is active.
 */

const ocrCache = {}; // imageUrl -> ocr text
const recordsCache = {}; // imageUrl -> { banned: [...], ingredients: [...] }
const loadingCache = {}; // imageUrl -> boolean

function parseNumber(v) {
  if (v == null) return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const cleaned = String(v || "").replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return isFinite(n) ? n : 0;
}

export default function NutritionModal({ stack, allStacks = [], onClose }) {
  const [activeTab, setActiveTab] = useState("detected");
  const [ocrText, setOcrText] = useState("");
  const [loadingOCR, setLoadingOCR] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [matchedRecords, setMatchedRecords] = useState([]); // banned
  const [matchedIngredients, setMatchedIngredients] = useState([]); // ingredients
  const [animDots, setAnimDots] = useState("");
  const [error, setError] = useState("");
  const [imageCollapsed, setImageCollapsed] = useState(true);

  const imageRef = useRef(null);
  const canvasRef = useRef(null);

  // Animate dots when loading
  useEffect(() => {
    if (!loadingOCR && !loadingRecords) return;
    const interval = setInterval(() => {
      setAnimDots((p) => (p.length >= 3 ? "" : p + "."));
    }, 450);
    return () => clearInterval(interval);
  }, [loadingOCR, loadingRecords]);

  if (!stack) return null;

  // Image URL - robust lookup across likely fields
  const imageUrl =
    stack.nutritionLabel ||
    stack.rawFields?.["Nutrition Label URL"] ||
    stack.fields?.["Nutrition Label URL"] ||
    stack.image ||
    "";

  const affiliateLink =
    stack.affiliateLink ||
    stack.rawFields?.["Lo. Amazon/Stripe Link"] ||
    stack.rawFields?.AffiliateLink ||
    stack.fields?.["Lo. Amazon/Stripe Link"] ||
    stack.fields?.AffiliateLink ||
    "";

  // derive servings & price from stack in a defensive way
  const servingsNumber =
    parseNumber(stack.servings) ||
    parseNumber(stack.rawFields?.Servings) ||
    parseNumber(stack.fields?.Servings) ||
    0;

  const priceNumber =
    parseNumber(stack.price) ||
    parseNumber(stack.rawFields?.Price) ||
    parseNumber(stack.fields?.Price) ||
    0;

  // -------------------------
  // OCR + Record fetching
  // -------------------------
  const runOCR = async () => {
    if (!imageUrl) {
      setOcrText("");
      setMatchedRecords([]);
      setMatchedIngredients([]);
      return;
    }

    // Use cached OCR if available and ensure records are fetched/populated
    if (ocrCache[imageUrl]) {
      setOcrText(ocrCache[imageUrl]);
      if (recordsCache[imageUrl]) {
        const c = recordsCache[imageUrl];
        setMatchedRecords(c?.banned || []);
        setMatchedIngredients(c?.ingredients || []);
      } else {
        await fetchRecords(ocrCache[imageUrl]);
      }
      return;
    }

    // prevent duplicate OCR runs for same image concurrently
    if (loadingCache[imageUrl]) return;
    loadingCache[imageUrl] = true;

    setLoadingOCR(true);
    setError("");
    try {
      const Tesseract = (await import("tesseract.js")).default;

      const preprocessed = await preprocessImage();
      const result = await Tesseract.recognize(preprocessed, "eng", {
        logger: () => {},
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,%()-: ",
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
      setMatchedIngredients([]);
    } finally {
      setLoadingOCR(false);
      loadingCache[imageUrl] = false;
    }
  };

  // Basic preprocess to improve OCR: draw, contrast stretch, autocrop, deskew attempt
  const preprocessImage = async () => {
    if (!imageRef.current) return null;
    const img = imageRef.current;
    const canvas = canvasRef.current || document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = img.naturalWidth || img.width || 1200;
    canvas.height = img.naturalHeight || img.height || 800;
    ctx.drawImage(img, 0, 0);

    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // contrast stretch
      let min = 255,
        max = 0;
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
        min = Math.min(min, gray);
        max = Math.max(max, gray);
      }
      const scale = 255 / (max - min || 1);
      for (let i = 0; i < data.length; i += 4) {
        let gray = 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
        gray = Math.max(0, Math.min(255, (gray - min) * scale));
        data[i] = data[i + 1] = data[i + 2] = gray;
      }
      ctx.putImageData(imageData, 0, 0);

      // quick crop detection for darker text region
      let top = canvas.height,
        bottom = 0,
        left = canvas.width,
        right = 0;
      for (let y = 0; y < canvas.height; y += 2) {
        for (let x = 0; x < canvas.width; x += 2) {
          const idx = (y * canvas.width + x) * 4;
          const gray = imageData.data[idx];
          if (gray < 120) {
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
            left = Math.min(left, x);
            right = Math.max(right, x);
          }
        }
      }

      if (right - left < 20 || bottom - top < 20) return canvas;

      const cropW = right - left;
      const cropH = bottom - top;
      const scaleFactor = 2;
      const croppedCanvas = document.createElement("canvas");
      croppedCanvas.width = cropW * scaleFactor;
      croppedCanvas.height = cropH * scaleFactor;
      const cctx = croppedCanvas.getContext("2d");
      cctx.drawImage(canvas, left, top, cropW, cropH, 0, 0, croppedCanvas.width, croppedCanvas.height);

      // attempt orientation detection (best-effort)
      try {
        const TesseractLocal = (await import("tesseract.js")).default;
        const orientation = await TesseractLocal.recognize(croppedCanvas, "eng", {
          tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,%()-: ",
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
        // silent fallback
      }

      return croppedCanvas;
    } catch (err) {
      console.warn("Preprocess failed; returning base canvas", err);
      return canvas;
    }
  };

  // Fetch matched records from /api/check-smartstack
  const fetchRecords = async (text) => {
    if (!text) return;
    if (recordsCache[imageUrl]) {
      const c = recordsCache[imageUrl];
      setMatchedRecords(c?.banned || []);
      setMatchedIngredients(c?.ingredients || []);
      return;
    }

    setLoadingRecords(true);
    setError("");
    try {
      const res = await fetch("/api/check-smartstack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ocrText: text }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to fetch records");
      }

      const rawBanned = data?.matchedBanned || data?.matched_banned || data?.matchedBannedRecords || data?.records || [];
      const rawIngredients = data?.matchedIngredients || data?.matched_ingredients || data?.matchedIngredientsRecords || data?.ingredients || [];

      const normalizedBanned = (Array.isArray(rawBanned) ? rawBanned : []).map((r) => {
        if (!r) return null;
        if (r.fields) {
          const f = r.fields;
          return {
            id: r.id || null,
            name: (f["Substance Name"] || f["Name"] || "").toString().trim(),
            banType: (f["Ban Type"] || "").toString().trim(),
            synonyms: f["Synonyms"] || "",
            bannedBy: f["Banned By"] || "",
            dosageLimit: f["Dosage Limit"] || "",
            notes: f["Notes"] || "",
            source: f["Source / Citation"] || f["Source"] || "",
            Benefits: f["Benefits"] || "",
            Weaknesses: f["Weaknesses"] || "",
            NutrientAntagonism: f["Nutrient Antagonism"] || "",
            _raw: r,
          };
        }
        return {
          id: r.id || r.recordId || null,
          name: r.name || r["Substance Name"] || "",
          banType: r.banType || r["Ban Type"] || "",
          synonyms: r.synonyms || r.Synonyms || "",
          bannedBy: r.bannedBy || r["Banned By"] || "",
          dosageLimit: r.dosageLimit || r["Dosage Limit"] || "",
          notes: r.notes || r.Notes || "",
          source: r.source || r["Source / Citation"] || "",
          Benefits: r.Benefits || "",
          Weaknesses: r.Weaknesses || "",
          NutrientAntagonism: r["Nutrient Antagonism"] || "",
          _raw: r,
        };
      }).filter(Boolean);

      const normalizedIngredients = (Array.isArray(rawIngredients) ? rawIngredients : []).map((r) => {
        if (!r) return null;
        if (r.fields) {
          const f = r.fields;
          return {
            id: r.id || null,
            name: (f["Name"] || f["Ingredient Name"] || "").toString().trim(),
            synonyms: f["Synonyms (Extended)"] || f["Synonyms"] || "",
            notes: f["Pharmacology Notes"] || f["Notes"] || f["Benefits"] || "",
            benefits: f["Benefits"] || "",
            weaknesses: f["Weaknesses"] || "",
            nutrientAntagonism: f["Nutrient Antagonism"] || "",
            source: f["Sources / References"] || f["Source"] || "",
            _raw: r,
          };
        }
        return {
          id: r.id || r.recordId || null,
          name: r.name || r.Name || r["Ingredient Name"] || "",
          synonyms: r.synonyms || r.Synonyms || "",
          notes: r.notes || r.Notes || "",
          source: r.source || r.Source || "",
          _raw: r,
        };
      }).filter(Boolean);

      recordsCache[imageUrl] = { banned: normalizedBanned, ingredients: normalizedIngredients };
      setMatchedRecords(normalizedBanned);
      setMatchedIngredients(normalizedIngredients);

      if (data?.ocrText) {
        ocrCache[imageUrl] = data.ocrText;
        setOcrText(data.ocrText);
      }

      console.log("NutritionModal - matched banned:", normalizedBanned.map((x) => x.name));
      console.log("NutritionModal - matched ingredients:", normalizedIngredients.map((x) => x.name));
    } catch (err) {
      console.error("Failed to fetch matched records", err);
      setError(String(err?.message || err));
      setMatchedRecords([]);
      setMatchedIngredients([]);
    } finally {
      setLoadingRecords(false);
    }
  };

  // Reset state when a different stack is opened (keyed by stack.id and imageUrl)
  useEffect(() => {
    setOcrText("");
    setMatchedRecords([]);
    setMatchedIngredients([]);
    setError("");
    setLoadingOCR(false);
    setLoadingRecords(false);
    setImageCollapsed(true);

    if (imageUrl && ocrCache[imageUrl]) {
      setOcrText(ocrCache[imageUrl]);
      if (recordsCache[imageUrl]) {
        const c = recordsCache[imageUrl];
        setMatchedRecords(c?.banned || []);
        setMatchedIngredients(c?.ingredients || []);
      } else {
        // fetch records in background (do not block render)
        fetchRecords(ocrCache[imageUrl]).catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stack?.id, imageUrl]);

  // Auto-run OCR when image loads (unless cached)
  const handleImageLoad = () => {
    setTimeout(() => {
      if (!ocrCache[imageUrl]) runOCR();
      else if (!recordsCache[imageUrl]) fetchRecords(ocrCache[imageUrl]).catch(() => {});
    }, 120);
  };

  // -------------------------
  // Render
  // -------------------------
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl p-6 max-w-4xl w-full relative overflow-hidden flex flex-col max-h-[90vh]">
        <ModalHeader
          stack={stack}
          // use real values when available (defensive)
          servingsNumber={servingsNumber}
          priceNumber={priceNumber}
          matchedRecords={matchedRecords}
          allStacks={allStacks}
          onClose={onClose}
        />

        <div className="mt-4 flex-1 overflow-auto pr-2">
          {/* Compact Image area */}
          {imageUrl ? (
            <>
              <div className="flex items-start gap-4 mb-4">
                <div className={`transition-all duration-200 ${imageCollapsed ? "w-44" : "w-1/3 md:w-1/2"}`}>
                  <div className={`overflow-hidden rounded-lg border border-gray-700 ${imageCollapsed ? "h-28" : "h-auto"}`}>
                    <img
                      ref={imageRef}
                      src={imageUrl}
                      alt={`Nutrition Label`}
                      className="object-contain w-full h-full"
                      crossOrigin="anonymous"
                      onLoad={handleImageLoad}
                    />
                  </div>
                </div>

                <div className="flex-1 flex items-center justify-end gap-3">
                  <button
                    className="px-3 py-1 bg-gray-700 rounded text-sm text-white hover:bg-gray-600"
                    onClick={() => setImageCollapsed((s) => !s)}
                  >
                    {imageCollapsed ? "Expand Image" : "Collapse Image"}
                  </button>

                  <a
                    className={`text-sm px-3 py-1 rounded ${affiliateLink ? "bg-gray-500 text-white hover:bg-green-600" : "bg-gray-700 text-gray-300 cursor-not-allowed"}`}
                    href={affiliateLink || "#"}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => { if (!affiliateLink) e.preventDefault(); }}
                  >
                    {affiliateLink ? "Open product link" : "No product link"}
                  </a>
                </div>

                {/* hidden canvas used for preprocessing OCR */}
                <canvas ref={canvasRef} style={{ display: "none" }} />
              </div>
            </>
          ) : (
            <div className="w-full h-40 bg-gray-700 flex items-center justify-center rounded-lg mb-4 text-gray-400 text-sm">
              No Nutrition Image Available
            </div>
          )}

          {/* Tabs + Content */}
          <ModalTabs activeTab={activeTab} setActiveTab={setActiveTab} />

          <ModalContent
            activeTab={activeTab}
            loadingOCR={loadingOCR}
            loadingRecords={loadingRecords}
            animDots={animDots}
            ocrText={ocrText}
            matchedRecords={matchedRecords}
            matchedIngredients={matchedIngredients}
            error={error}
            runOCR={runOCR}
            // pass a stackId so ModalContent can reset runOnce per new stack
            stackId={stack?.id || imageUrl || Math.random().toString(36).slice(2)}
          />
        </div>

        <div className="mt-4 sticky bottom-0 bg-gray-800 pt-4">
          <ModalFooter affiliateLink={affiliateLink} runOCR={runOCR} />
        </div>
      </div>
    </div>
  );
}
