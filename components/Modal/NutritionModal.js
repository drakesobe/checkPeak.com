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
 * - Parent modal that runs OCR on nutrition label images and queries /api/check-smartstack
 * - Caches OCR + API results by imageUrl to avoid repeated heavy work
 * - Ensures OCR is run **only after** the image element has loaded for the currently opened stack
 * - Exposes runOCR to child ModalContent and ModalFooter so user can re-scan
 *
 * UX improvements in this version:
 *  - Mobile-first layout (image + controls stack on small screens)
 *  - Backdrop click + ESC key to close
 *  - Clearer loading status text near image/actions
 *  - Slightly more compact spacing and scroll behavior for small screens
 */

const ocrCache = {}; // imageUrl -> ocr text
const recordsCache = {}; // imageUrl -> { banned: [], ingredients: [] }
const loadingCache = {}; // imageUrl -> boolean (prevent concurrent OCR)

function parseNumber(value) {
  if (value == null) return 0;
  if (typeof value === "number") return isFinite(value) ? value : 0;
  const n = parseFloat(String(value).replace(/[^0-9.\-]/g, ""));
  return isFinite(n) ? n : 0;
}

export default function NutritionModal({ stack, allStacks = [], onClose }) {
  const [activeTab, setActiveTab] = useState("detected"); // 'detected' | 'all' | other
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

  // Animate "..." while loading OCR or records
  useEffect(() => {
    if (!loadingOCR && !loadingRecords) {
      setAnimDots("");
      return;
    }
    const id = setInterval(
      () => setAnimDots((p) => (p.length >= 3 ? "" : p + ".")),
      450
    );
    return () => clearInterval(id);
  }, [loadingOCR, loadingRecords]);

  // Close on ESC
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (!stack) return null;

  // -------------------------
  // Defensive field accessors
  // -------------------------
  // Prefer Nutrition Label URL, fallback to Image URL / general image fields
  const imageUrl =
    stack.fields?.["Nutrition Label URL"] ||
    stack.rawFields?.["Nutrition Label URL"] ||
    stack.nutritionLabel ||
    stack.fields?.["Image URL"] ||
    stack.rawFields?.["Image URL"] ||
    stack.image ||
    "";

  const affiliateLink =
    stack.affiliateLink ||
    stack.rawFields?.["Lo. Amazon/Stripe Link"] ||
    stack.rawFields?.AffiliateLink ||
    stack.fields?.["Lo. Amazon/Stripe Link"] ||
    stack.fields?.AffiliateLink ||
    "";

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

  // Helpful debug
  useEffect(() => {
    if (imageUrl) console.log("[NutritionModal] OCR image source →", imageUrl);
  }, [imageUrl]);

  // -------------------------
  // Image preprocessing
  // -------------------------
  const preprocessImage = async () => {
    if (!imageRef.current) return null;
    const img = imageRef.current;

    // If image not loaded yet, wait briefly
    if (!img.complete || (img.naturalWidth ?? 0) === 0) {
      await new Promise((r) => setTimeout(r, 150));
    }

    const canvas = canvasRef.current || document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = img.naturalWidth || img.width || 1200;
    canvas.height = img.naturalHeight || img.height || 800;
    ctx.drawImage(img, 0, 0);

    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Simple grayscale + contrast stretch
      let min = 255,
        max = 0;
      for (let i = 0; i < data.length; i += 4) {
        const g = 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
        if (g < min) min = g;
        if (g > max) max = g;
      }
      const scale = 255 / (max - min || 1);
      for (let i = 0; i < data.length; i += 4) {
        let g = 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
        g = Math.max(0, Math.min(255, (g - min) * scale));
        data[i] = data[i + 1] = data[i + 2] = g;
      }
      ctx.putImageData(imageData, 0, 0);

      return canvas;
    } catch (err) {
      console.warn("Preprocess failed, returning base canvas:", err);
      return canvas;
    }
  };

  // -------------------------
  // Fetch matched records
  // -------------------------
  const fetchRecords = async (text) => {
    if (!text || !imageUrl) return;
    if (recordsCache[imageUrl]) {
      const c = recordsCache[imageUrl];
      setMatchedRecords(c.banned || []);
      setMatchedIngredients(c.ingredients || []);
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
      if (!res.ok) throw new Error(data?.error || "Failed to fetch records");

      const rawBanned = data?.matchedBanned || [];
      const rawIngredients = data?.matchedIngredients || [];

      const normalize = (arr, type) =>
        (Array.isArray(arr) ? arr : [])
          .map((r) => {
            const f = r?.fields || r || {};
            return {
              id: r?.id || null,
              name:
                f["Substance Name"] ||
                f["Ingredient Name"] ||
                f["Name"] ||
                "",
              type,
              notes: f["Notes"] || "",
              benefits: f["Benefits"] || "",
              weaknesses: f["Weaknesses"] || "",
              antagonism: f["Nutrient Antagonism"] || "",
              source:
                f["Source"] ||
                f["Sources / References"] ||
                f["Source / Citation"] ||
                "",
              synonyms: f["Synonyms"] || f["Synonyms (Extended)"] || "",
              _raw: f,
            };
          })
          .filter(Boolean);

      const banned = normalize(rawBanned, "banned");
      const ingredients = normalize(rawIngredients, "ingredient");

      recordsCache[imageUrl] = { banned, ingredients };
      setMatchedRecords(banned);
      setMatchedIngredients(ingredients);

      if (data?.ocrText && !ocrCache[imageUrl]) {
        ocrCache[imageUrl] = data.ocrText;
        setOcrText(data.ocrText);
      }
    } catch (err) {
      console.error("Failed to fetch matched records:", err);
      setError(String(err?.message || err));
      setMatchedRecords([]);
      setMatchedIngredients([]);
    } finally {
      setLoadingRecords(false);
    }
  };

  // -------------------------
  // OCR runner
  // -------------------------
  const runOCR = async (force = false) => {
    if (!imageUrl) {
      setOcrText("");
      setMatchedRecords([]);
      setMatchedIngredients([]);
      return;
    }

    // If forcing, clear caches so this is a true re-scan
    if (force) {
      delete ocrCache[imageUrl];
      delete recordsCache[imageUrl];
    }

    // if OCR cached and not forcing, use cache and ensure records are present
    if (ocrCache[imageUrl] && !force) {
      setOcrText(ocrCache[imageUrl]);
      if (recordsCache[imageUrl]) {
        const c = recordsCache[imageUrl];
        setMatchedRecords(c.banned || []);
        setMatchedIngredients(c.ingredients || []);
      } else {
        await fetchRecords(ocrCache[imageUrl]);
      }
      return;
    }

    if (loadingCache[imageUrl]) return;
    loadingCache[imageUrl] = true;
    setLoadingOCR(true);
    setError("");

    try {
      const Tesseract = (await import("tesseract.js")).default;
      const pre = await preprocessImage();
      const result = await Tesseract.recognize(pre, "eng", {
        logger: () => {},
        tessedit_char_whitelist:
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,%()-: ",
        oem: 1,
        psm: 6,
      });

      const text = (result?.data?.text || "").trim();
      const finalText = text || "No OCR text detected.";
      ocrCache[imageUrl] = finalText;
      setOcrText(finalText);

      // always fetch records after OCR
      await fetchRecords(finalText);
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

  // -------------------------
  // Reset modal when a new stack is selected
  // -------------------------
  useEffect(() => {
    setOcrText("");
    setMatchedRecords([]);
    setMatchedIngredients([]);
    setError("");
    setLoadingOCR(false);
    setLoadingRecords(false);
    setImageCollapsed(true);

    if (!imageUrl) return;

    // If we have cached OCR, hydrate from cache; otherwise records will be fetched after OCR
    if (ocrCache[imageUrl]) {
      setOcrText(ocrCache[imageUrl]);
      if (recordsCache[imageUrl]) {
        const c = recordsCache[imageUrl];
        setMatchedRecords(c.banned || []);
        setMatchedIngredients(c.ingredients || []);
      } else {
        fetchRecords(ocrCache[imageUrl]).catch(() => {});
      }
    }
  }, [stack?.id, imageUrl]);

  // -------------------------
  // Run OCR after image loads
  // -------------------------
  const handleImageLoad = () => {
    // Brief delay gives layout a moment to stabilize
    setTimeout(() => {
      if (!imageUrl) return;
      if (!ocrCache[imageUrl]) {
        runOCR().catch(() => {});
      } else if (!recordsCache[imageUrl]) {
        fetchRecords(ocrCache[imageUrl]).catch(() => {});
      }
    }, 400);
  };

  const loadingLabel =
    loadingOCR && loadingRecords
      ? "Reading label and finding matches"
      : loadingOCR
      ? "Reading label"
      : loadingRecords
      ? "Finding ingredient matches"
      : "";

  // -------------------------
  // Render
  // -------------------------
  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-3 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-gray-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 max-w-4xl w-full relative overflow-hidden flex flex-col max-h-[90vh] border border-gray-700 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHeader
          stack={stack}
          servingsNumber={servingsNumber}
          priceNumber={priceNumber}
          matchedRecords={matchedRecords}
          allStacks={allStacks}
          onClose={onClose}
        />

        <div className="mt-4 flex-1 overflow-auto pr-1 sm:pr-2 space-y-3">
          {/* Image + controls row */}
          {imageUrl ? (
            <div className="flex flex-col md:flex-row md:items-start gap-3 sm:gap-4 mb-2">
              <div
                className={`transition-all duration-200 ${
                  imageCollapsed
                    ? "w-32 sm:w-40 md:w-44"
                    : "w-full md:w-1/3 lg:w-1/2"
                }`}
              >
                <div
                  className={`overflow-hidden rounded-lg border border-gray-700 bg-black/20 ${
                    imageCollapsed ? "h-28 sm:h-32" : "h-auto max-h-[260px]"
                  }`}
                >
                  <img
                    ref={imageRef}
                    src={imageUrl}
                    alt="Nutrition Label"
                    className="object-contain w-full h-full"
                    crossOrigin="anonymous"
                    onLoad={handleImageLoad}
                  />
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-start md:justify-end gap-2">
                  <button
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-xs sm:text-sm rounded text-white transition"
                    onClick={() => setImageCollapsed((s) => !s)}
                  >
                    {imageCollapsed ? "Expand image" : "Collapse image"}
                  </button>

                  <a
                    className={`text-xs sm:text-sm px-3 py-1.5 rounded transition ${
                      affiliateLink
                        ? "bg-gray-500 hover:bg-green-600 text-white"
                        : "bg-gray-700 text-gray-400 cursor-not-allowed"
                    }`}
                    href={affiliateLink || "#"}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => {
                      if (!affiliateLink) e.preventDefault();
                    }}
                  >
                    {affiliateLink ? "Open product link" : "No product link"}
                  </a>

                  <button
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-xs sm:text-sm text-white rounded transition disabled:opacity-60 disabled:cursor-not-allowed"
                    onClick={() => runOCR(true)}
                    title="Force re-run OCR & fetch matched records"
                    disabled={loadingOCR}
                  >
                    {loadingOCR ? "Re-scanning..." : "Re-scan"}
                  </button>
                </div>

                {loadingLabel && (
                  <p className="text-[11px] sm:text-xs text-gray-400 mt-1">
                    {loadingLabel}
                    {animDots}
                  </p>
                )}

                {error && (
                  <p className="text-[11px] sm:text-xs text-red-400 mt-1">
                    {error}
                  </p>
                )}
              </div>

              <canvas ref={canvasRef} style={{ display: "none" }} />
            </div>
          ) : (
            <div className="w-full h-32 sm:h-40 bg-gray-700 flex items-center justify-center rounded-lg mb-2 text-gray-400 text-xs sm:text-sm">
              No nutrition label image available for this stack.
            </div>
          )}

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
            stackId={stack?.id || imageUrl || Math.random().toString(36).slice(2)}
          />
        </div>

        <div className="mt-3 pt-3 border-t border-gray-700 bg-gray-800 sticky bottom-0">
          <ModalFooter affiliateLink={affiliateLink} runOCR={runOCR} />
        </div>
      </div>
    </div>
  );
}
