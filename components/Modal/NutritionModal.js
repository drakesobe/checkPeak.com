// components/NutritionModal.jsx
"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ModalHeader from "./ModalHeader";
import ModalTabs from "./ModalTabs";
import ModalContent from "./ModalContent";
import ModalFooter from "./ModalFooter";
import {
  ocrCache,
  recordsCache,
  loadingCache,
  touchCache,
  deleteCacheKey,
  getTesseract,
} from "@/lib/ocrCache";

/**
 * NutritionModal — Scan Terminal UI
 *
 * Redesigned as a high-performance scan dashboard:
 *  - Full-bleed label image as the visual anchor with scan overlay
 *  - Animated sweep line while OCR is running
 *  - Risk result banner animates in when scan completes
 *  - Dark athletic aesthetic consistent with the rest of the product
 *  - All structural fixes from the previous refactor are preserved
 *
 * Props:
 *   stack     — SmartStack record
 *   allStacks — optional array (passed through to ModalHeader)
 *   onClose   — close callback
 */

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function parseNumber(value) {
  if (value == null) return 0;
  if (typeof value === "number") return isFinite(value) ? value : 0;
  const n = parseFloat(String(value).replace(/[^0-9.\-]/g, ""));
  return isFinite(n) ? n : 0;
}

function isPlaceholderText(text) {
  const lower = String(text || "").trim().toLowerCase();
  return (
    lower === ""                        ||
    lower === "no ocr text detected."   ||
    lower === "no ocr text detected"    ||
    lower === "no text detected."       ||
    lower === "no text detected"
  );
}

function getRiskLevel(flaggedCount) {
  if (flaggedCount === 0) return {
    label:  "Clear",
    color:  "#22c55e",
    bg:     "rgba(34,197,94,0.08)",
    border: "rgba(34,197,94,0.25)",
    glow:   "rgba(34,197,94,0.15)",
  };
  if (flaggedCount === 1) return {
    label:  "Caution",
    color:  "#f77f00",
    bg:     "rgba(247,127,0,0.08)",
    border: "rgba(247,127,0,0.25)",
    glow:   "rgba(247,127,0,0.15)",
  };
  return {
    label:  "High Risk",
    color:  "#E83A2F",
    bg:     "rgba(232,58,47,0.08)",
    border: "rgba(232,58,47,0.25)",
    glow:   "rgba(232,58,47,0.2)",
  };
}

/* -------------------------------------------------------------------------- */
/* ScanOverlay                                                                 */
/* Animated sweep shown over the label image while OCR is running             */
/* -------------------------------------------------------------------------- */
function ScanOverlay({ label, dots }) {
  return (
    <motion.div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center"
      style={{ background: "rgba(10,12,16,0.80)", backdropFilter: "blur(2px)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Sweep line */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <motion.div
          className="absolute left-0 right-0 h-[2px]"
          style={{
            background:
              "linear-gradient(to right, transparent, rgba(70,118,155,0.9) 30%, rgba(91,158,201,1) 50%, rgba(70,118,155,0.9) 70%, transparent)",
            boxShadow:
              "0 0 12px rgba(91,158,201,0.7), 0 0 28px rgba(91,158,201,0.3)",
          }}
          initial={{ top: "0%" }}
          animate={{ top: "100%" }}
          transition={{ duration: 2.2, ease: "linear", repeat: Infinity }}
        />
      </div>

      {/* Corner registration brackets */}
      {[
        "top-3 left-3 border-t-2 border-l-2",
        "top-3 right-3 border-t-2 border-r-2",
        "bottom-3 left-3 border-b-2 border-l-2",
        "bottom-3 right-3 border-b-2 border-r-2",
      ].map((cls, i) => (
        <div
          key={i}
          aria-hidden="true"
          className={`absolute w-5 h-5 rounded-sm ${cls}`}
          style={{ borderColor: "rgba(91,158,201,0.65)" }}
        />
      ))}

      {/* Status text */}
      <div className="relative z-10 text-center px-6 pointer-events-none">
        <p
          className="text-sm font-bold tracking-widest uppercase text-white/90"
          style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
        >
          {label}{dots}
        </p>
        <p className="text-[10px] text-white/35 mt-1 tracking-wide">
          Analysing nutrition label
        </p>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* RiskBanner                                                                  */
/* Animates in after scan completes — the primary result surface              */
/* -------------------------------------------------------------------------- */
function RiskBanner({ flaggedCount, totalCount, isVisible }) {
  const risk = getRiskLevel(flaggedCount);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="rounded-xl border px-4 py-3 flex items-center gap-4"
          style={{
            background:  risk.bg,
            borderColor: risk.border,
            boxShadow:   `0 0 24px ${risk.glow}`,
          }}
        >
          {/* Pulse indicator */}
          <div className="relative shrink-0" aria-hidden="true">
            <span
              className="absolute inset-0 rounded-full animate-ping opacity-25"
              style={{ backgroundColor: risk.color }}
            />
            <span
              className="relative w-3 h-3 rounded-full block"
              style={{ backgroundColor: risk.color }}
            />
          </div>

          {/* Risk label */}
          <div className="flex-1 min-w-0">
            <p
              className="text-xl font-black leading-none tracking-tight"
              style={{
                color:      risk.color,
                fontFamily: "'Barlow Condensed', sans-serif",
              }}
            >
              {risk.label.toUpperCase()}
            </p>
            <p className="text-[10px] text-white/35 uppercase tracking-widest mt-0.5">
              Scan complete
            </p>
          </div>

          {/* Stat counters */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-center">
              <p
                className="text-2xl font-black leading-none"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  color:      flaggedCount > 0 ? risk.color : "rgba(255,255,255,0.85)",
                }}
              >
                {flaggedCount}
              </p>
              <p className="text-[9px] text-white/30 uppercase tracking-widest mt-0.5">
                Flagged
              </p>
            </div>

            <div aria-hidden="true" className="w-px h-7 bg-white/10" />

            <div className="text-center">
              <p
                className="text-2xl font-black text-white/65 leading-none"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                {totalCount}
              </p>
              <p className="text-[9px] text-white/30 uppercase tracking-widest mt-0.5">
                Ingredients
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* -------------------------------------------------------------------------- */
/* NutritionModal                                                              */
/* -------------------------------------------------------------------------- */
export default function NutritionModal({ stack, allStacks = [], onClose }) {
  /* ── State ────────────────────────────────────────────────────────────── */

  const [activeTab,          setActiveTab]          = useState("detected");
  const [ocrText,            setOcrText]            = useState("");
  const [loadingOCR,         setLoadingOCR]         = useState(false);
  const [loadingRecords,     setLoadingRecords]     = useState(false);
  const [matchedRecords,     setMatchedRecords]     = useState([]);
  const [matchedIngredients, setMatchedIngredients] = useState([]);
  const [animDots,           setAnimDots]           = useState("");
  const [error,              setError]              = useState("");
  const [scanPrimed,         setScanPrimed]         = useState(false);
  const [imageLoaded,        setImageLoaded]        = useState(false);
  const [scanComplete,       setScanComplete]       = useState(false);

  const imageRef   = useRef(null);
  const canvasRef  = useRef(null);
  const startedRef = useRef({ url: "", started: false });

  /* ── Derived fields ───────────────────────────────────────────────────── */

  const imageUrl = useMemo(() => {
    if (!stack) return "";
    return (
      stack.fields?.["Nutrition Label URL"]    ||
      stack.rawFields?.["Nutrition Label URL"] ||
      stack.nutritionLabel                     ||
      stack.fields?.["Image URL"]              ||
      stack.rawFields?.["Image URL"]           ||
      stack.image                              ||
      ""
    );
  }, [stack]);

  const affiliateLink = useMemo(() => {
    if (!stack) return "";
    return (
      stack.affiliateLink                             ||
      stack.rawFields?.["Lo. Amazon/Stripe Link"]     ||
      stack.rawFields?.AffiliateLink                  ||
      stack.fields?.["Lo. Amazon/Stripe Link"]        ||
      stack.fields?.AffiliateLink                     ||
      ""
    );
  }, [stack]);

  const servingsNumber = useMemo(() => {
    if (!stack) return 0;
    return (
      parseNumber(stack.servings)            ||
      parseNumber(stack.rawFields?.Servings) ||
      parseNumber(stack.fields?.Servings)    ||
      0
    );
  }, [stack]);

  const priceNumber = useMemo(() => {
    if (!stack) return 0;
    return (
      parseNumber(stack.price)            ||
      parseNumber(stack.rawFields?.Price) ||
      parseNumber(stack.fields?.Price)    ||
      0
    );
  }, [stack]);

  const stackId = useMemo(
    () => stack?.id || imageUrl || "unknown",
    [stack?.id, imageUrl]
  );

  // True while any scan-related work is happening
  const isScanning = loadingOCR || loadingRecords || scanPrimed;

  const loadingLabel = useMemo(() => {
    if (loadingOCR && loadingRecords) return "Reading label and matching ingredients";
    if (loadingOCR)                   return "Reading label";
    if (loadingRecords)               return "Matching ingredients";
    if (scanPrimed)                   return "Preparing scan";
    return "";
  }, [loadingOCR, loadingRecords, scanPrimed]);

  /* ── Animated dots ────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!isScanning) { setAnimDots(""); return; }
    const id = setInterval(
      () => setAnimDots((p) => (p.length >= 3 ? "" : p + ".")),
      450
    );
    return () => clearInterval(id);
  }, [isScanning]);

  /* ── Escape to close ──────────────────────────────────────────────────── */

  useEffect(() => {
    if (!stack) return;
    const handler = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [stack, onClose]);

  /* ── Background scroll lock ───────────────────────────────────────────── */

  useEffect(() => {
    if (!stack) return;
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow             = "hidden";
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow             = prevBody;
    };
  }, [stack]);

  /* ── Reset run guard on imageUrl change ───────────────────────────────── */

  useEffect(() => {
    startedRef.current = { url: imageUrl, started: false };
  }, [imageUrl]);

  /* ── fetchRecords ─────────────────────────────────────────────────────── */

  const fetchRecords = useCallback(
    async (text) => {
      if (!imageUrl) return;
      const cleaned = String(text || "").trim();
      if (isPlaceholderText(cleaned)) return;

      // Cache hit
      if (recordsCache[imageUrl]) {
        const c = recordsCache[imageUrl];
        setMatchedRecords(c.banned       || []);
        setMatchedIngredients(c.ingredients || []);
        setScanComplete(true);
        return;
      }

      setLoadingRecords(true);
      setError("");

      try {
        const res = await fetch("/api/check-smartstack", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ ingredientsText: cleaned }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Failed to fetch records");

        const rawBanned      = Array.isArray(data?.bannedSubstances) ? data.bannedSubstances : [];
        const rawIngredients = Array.isArray(data?.ingredients)       ? data.ingredients      : [];

        const normalize = (arr, type) =>
          arr.map((r) => {
            const f = r?.fields || r || {};
            return {
              id:           r?.id || null,
              name:         f["Substance Name"]      || f["Ingredient Name"] || f["Name"] || "",
              type,
              notes:        f["Notes"]               || "",
              benefits:     f["Benefits"]            || "",
              weaknesses:   f["Weaknesses"]          || "",
              antagonism:   f["Nutrient Antagonism"] || "",
              source:       f["Source"] || f["Sources / References"] || f["Source / Citation"] || "",
              synonyms:     f["Synonyms"] || f["Synonyms (Extended)"] || "",
              _raw:         f,
              matchedTerms: Array.isArray(r?.matchedTerms) ? r.matchedTerms : [],
            };
          }).filter(Boolean);

        const banned      = normalize(rawBanned,      "banned");
        const ingredients = normalize(rawIngredients, "ingredient");

        touchCache(recordsCache, imageUrl, { banned, ingredients });
        setMatchedRecords(banned);
        setMatchedIngredients(ingredients);
        setScanComplete(true);
      } catch (err) {
        console.error("[NutritionModal] fetchRecords error:", err);
        setError(String(err?.message || err));
        setMatchedRecords([]);
        setMatchedIngredients([]);
      } finally {
        setLoadingRecords(false);
      }
    },
    [imageUrl]
  );

  /* ── preprocessImage ─────────────────────────────────────────────────── */

  const preprocessImage = useCallback(async () => {
    const img = imageRef.current;
    if (!img) return null;

    if (!img.complete || (img.naturalWidth ?? 0) === 0) {
      await new Promise((r) => setTimeout(r, 150));
    }

    const canvas = canvasRef.current || document.createElement("canvas");
    const ctx    = canvas.getContext("2d");
    canvas.width  = img.naturalWidth  || img.width  || 1200;
    canvas.height = img.naturalHeight || img.height || 800;
    ctx.drawImage(img, 0, 0);

    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data      = imageData.data;
      let min = 255, max = 0;
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
    } catch {
      return canvas;
    }
  }, []);

  /* ── runOCRInternal ───────────────────────────────────────────────────── */

  const runOCRInternal = useCallback(
    async (force = false) => {
      if (!imageUrl) {
        setOcrText("");
        setMatchedRecords([]);
        setMatchedIngredients([]);
        setScanPrimed(false);
        setScanComplete(false);
        return;
      }

      if (force) {
        deleteCacheKey(imageUrl);
        setScanComplete(false);
      }

      // Cache hit
      if (ocrCache[imageUrl] && !force) {
        const cachedText = String(ocrCache[imageUrl] || "").trim();
        setOcrText(cachedText);
        if (recordsCache[imageUrl]) {
          const c = recordsCache[imageUrl];
          setMatchedRecords(c.banned       || []);
          setMatchedIngredients(c.ingredients || []);
          setScanComplete(true);
        } else {
          await fetchRecords(cachedText);
        }
        setScanPrimed(false);
        return;
      }

      if (loadingCache[imageUrl]) return;
      loadingCache[imageUrl] = true;

      setLoadingOCR(true);
      setError("");

      try {
        const Tesseract = await getTesseract();
        const pre       = await preprocessImage();

        const result = await Tesseract.recognize(pre, "eng", {
          logger: () => {},
          tessedit_char_whitelist:
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,%()-: ",
          oem: 1,
          psm: 6,
        });

        const text      = (result?.data?.text || "").trim();
        const finalText = text || "No OCR text detected.";
        touchCache(ocrCache, imageUrl, finalText);
        setOcrText(finalText);
        await fetchRecords(finalText);
      } catch (err) {
        console.error("[NutritionModal] OCR error:", err);
        setError("OCR failed. Try a clearer photo or re-open this modal.");
        const fallback = "No OCR text detected.";
        touchCache(ocrCache, imageUrl, fallback);
        setOcrText(fallback);
        setMatchedRecords([]);
        setMatchedIngredients([]);
      } finally {
        setLoadingOCR(false);
        loadingCache[imageUrl] = false;
        setScanPrimed(false);
      }
    },
    [imageUrl, fetchRecords, preprocessImage]
  );

  /* ── runOCR (public) ──────────────────────────────────────────────────── */

  const runOCR = useCallback(
    async (force = false) => {
      setScanPrimed(true);
      setError("");
      if (!imageUrl || !imageLoaded)    return;
      if (loadingOCR || loadingRecords) return;
      if (
        startedRef.current.url     === imageUrl &&
        startedRef.current.started === true     &&
        !force
      ) return;
      startedRef.current.started = true;
      setTimeout(() => runOCRInternal(force).catch(() => {}), 200);
    },
    [imageUrl, imageLoaded, loadingOCR, loadingRecords, runOCRInternal]
  );

  /* ── Auto-start when primed + ready ───────────────────────────────────── */

  useEffect(() => {
    if (!scanPrimed || !imageUrl || !imageLoaded) return;
    if (loadingOCR || loadingRecords)             return;
    if (startedRef.current.url === imageUrl && startedRef.current.started) return;
    startedRef.current.started = true;
    const id = setTimeout(() => runOCRInternal(false).catch(() => {}), 200);
    return () => clearTimeout(id);
  }, [scanPrimed, imageUrl, imageLoaded, loadingOCR, loadingRecords, runOCRInternal]);

  /* ── Reset on new stack ───────────────────────────────────────────────── */

  useEffect(() => {
    setOcrText("");
    setMatchedRecords([]);
    setMatchedIngredients([]);
    setError("");
    setLoadingOCR(false);
    setLoadingRecords(false);
    setScanPrimed(false);
    setImageLoaded(false);
    setScanComplete(false);

    if (!imageUrl) return;

    if (ocrCache[imageUrl]) {
      const cachedText = String(ocrCache[imageUrl] || "").trim();
      setOcrText(cachedText);
      if (recordsCache[imageUrl]) {
        const c = recordsCache[imageUrl];
        setMatchedRecords(c.banned       || []);
        setMatchedIngredients(c.ingredients || []);
        setScanComplete(true);
      } else {
        fetchRecords(cachedText).catch(() => {});
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stack?.id]);

  /* ── Image load handler ───────────────────────────────────────────────── */

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    setTimeout(() => {
      if (!imageUrl) return;
      if (startedRef.current.url === imageUrl && startedRef.current.started) return;
      if (scanPrimed) {
        startedRef.current.started = true;
        runOCRInternal(false).catch(() => {});
        return;
      }
      if (!ocrCache[imageUrl]) {
        startedRef.current.started = true;
        runOCRInternal(false).catch(() => {});
      } else if (!recordsCache[imageUrl]) {
        fetchRecords(ocrCache[imageUrl]).catch(() => {});
      }
    }, 350);
  }, [imageUrl, scanPrimed, runOCRInternal, fetchRecords]);

  /* ── Named handlers ───────────────────────────────────────────────────── */

  const handleRescan = useCallback(() => runOCR(true), [runOCR]);

  const handleAffiliateLinkClick = useCallback((e) => {
    e.stopPropagation();
    if (!affiliateLink) e.preventDefault();
  }, [affiliateLink]);

  /* ── Early return — after all hooks ───────────────────────────────────── */

  if (!stack) return null;

  /* ------------------------------------------------------------------------ */
  /* Render                                                                    */
  /* ------------------------------------------------------------------------ */
  return (
    <motion.div
      className="fixed inset-0 z-50"
      style={{ background: "rgba(5,7,10,0.88)", backdropFilter: "blur(6px)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      role="dialog"
      aria-modal="true"
      aria-label={`Scan results for ${stack?.name || "stack"}`}
      onClick={onClose}
    >
      <div className="h-full w-full flex items-center justify-center p-3 sm:p-4">
        <motion.div
          className="relative w-full max-w-3xl flex flex-col overflow-hidden"
          style={{
            background:   "#0D1117",
            border:       "1px solid rgba(255,255,255,0.07)",
            borderRadius: "20px",
            boxShadow:    "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset",
            maxHeight:    "calc(100dvh - 24px)",
            fontFamily:   "'Barlow', sans-serif",
          }}
          initial={{ y: 20, opacity: 0, scale: 0.98 }}
          animate={{ y: 0,  opacity: 1, scale: 1    }}
          exit={{    y: 10, opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
        >

          {/* ── Header bar ─────────────────────────────────────────────── */}
          <div
            className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          >
            <div className="min-w-0 flex-1">
              <p
                className="text-[10px] font-semibold uppercase tracking-widest mb-0.5"
                style={{ color: "rgba(255,255,255,0.28)" }}
              >
                {stack?.category || "Supplement"}
              </p>
              <h2
                className="text-lg font-bold text-white leading-tight truncate"
                style={{
                  fontFamily:    "'Barlow Condensed', sans-serif",
                  letterSpacing: "0.02em",
                }}
              >
                {stack?.name || "Untitled Stack"}
              </h2>
            </div>

            <div className="flex items-center gap-4 shrink-0 ml-4">
              {/* Servings + price — compact secondary info */}
              {servingsNumber > 0 && (
                <div className="hidden sm:block text-right">
                  <p
                    className="text-sm font-bold text-white/75"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                  >
                    {servingsNumber}
                  </p>
                  <p className="text-[10px] text-white/28 uppercase tracking-wider">
                    servings
                  </p>
                </div>
              )}
              {priceNumber > 0 && (
                <div className="hidden sm:block text-right">
                  <p
                    className="text-sm font-bold text-white/75"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                  >
                    ${priceNumber.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-white/28 uppercase tracking-wider">
                    price
                  </p>
                </div>
              )}

              {/* Close button */}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border:     "1px solid rgba(255,255,255,0.08)",
                  color:      "rgba(255,255,255,0.45)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                  e.currentTarget.style.color      = "#fff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.color      = "rgba(255,255,255,0.45)";
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* ── Scrollable body ────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto">

            {/* Label image — full bleed, with scan overlay */}
            {imageUrl ? (
              <div
                className="relative w-full shrink-0"
                style={{ aspectRatio: "16/7", minHeight: 160, maxHeight: 260 }}
              >
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt="Nutrition Label"
                  className="w-full h-full object-cover"
                  crossOrigin="anonymous"
                  onLoad={handleImageLoad}
                  onError={(e) => { e.currentTarget.style.opacity = "0.3"; }}
                />

                {/* Bottom vignette so content below doesn't feel disconnected */}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(to bottom, rgba(13,17,23,0.15) 0%, rgba(13,17,23,0) 35%, rgba(13,17,23,0.9) 100%)",
                  }}
                />

                {/* Animated scan overlay */}
                <AnimatePresence>
                  {isScanning && (
                    <ScanOverlay label={loadingLabel} dots={animDots} />
                  )}
                </AnimatePresence>

                {/* "Scanned" badge — appears after scan completes */}
                <AnimatePresence>
                  {scanComplete && !isScanning && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1    }}
                      exit={{    opacity: 0              }}
                      transition={{ duration: 0.2 }}
                      className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full px-2.5 py-1"
                      style={{
                        background:     "rgba(13,17,23,0.78)",
                        border:         "1px solid rgba(255,255,255,0.1)",
                        backdropFilter: "blur(8px)",
                      }}
                      aria-hidden="true"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                      <span
                        className="text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: "rgba(255,255,255,0.45)" }}
                      >
                        Scanned
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Floating action buttons — bottom-right of image */}
                <div className="absolute bottom-3 right-3 flex items-center gap-2">
                  {affiliateLink && (
                    <a
                      href={affiliateLink}
                      target="_blank"
                      rel="noreferrer"
                      onClick={handleAffiliateLinkClick}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white transition-all"
                      style={{
                        background:     "rgba(70,118,155,0.82)",
                        border:         "1px solid rgba(91,158,201,0.35)",
                        backdropFilter: "blur(8px)",
                      }}
                    >
                      View product
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={handleRescan}
                    disabled={isScanning}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background:     "rgba(13,17,23,0.72)",
                      border:         "1px solid rgba(255,255,255,0.1)",
                      color:          "rgba(255,255,255,0.65)",
                      backdropFilter: "blur(8px)",
                    }}
                    aria-label={isScanning ? "Scan in progress" : "Re-scan nutrition label"}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 9V6a2 2 0 012-2h3M15 4h3a2 2 0 012 2v3M21 15v3a2 2 0 01-2 2h-3M9 20H6a2 2 0 01-2-2v-3"
                      />
                    </svg>
                    {isScanning ? "Scanning…" : "Re-scan"}
                  </button>
                </div>
              </div>
            ) : (
              /* No image placeholder */
              <div
                className="w-full flex items-center justify-center text-sm shrink-0"
                style={{
                  height:       160,
                  background:   "rgba(255,255,255,0.02)",
                  color:        "rgba(255,255,255,0.2)",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                No nutrition label available
              </div>
            )}

            {/* ── Content area below image ─────────────────────────── */}
            <div className="px-4 sm:px-5 pt-4 pb-2 space-y-4">

              {/* Risk banner — primary result, animates in after scan */}
              <RiskBanner
                flaggedCount={matchedRecords.length}
                totalCount={matchedIngredients.length}
                isVisible={scanComplete && !isScanning}
              />

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0  }}
                    exit={{    opacity: 0         }}
                    className="rounded-xl px-4 py-3 text-sm"
                    style={{
                      background:  "rgba(232,58,47,0.08)",
                      border:      "1px solid rgba(232,58,47,0.25)",
                      color:       "#E83A2F",
                    }}
                    role="alert"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Tabs + tab content — only shown once there's something to display */}
              {(ocrText || scanComplete || error) && (
                <>
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
                    scanPrimed={scanPrimed}
                    stackId={stackId}
                  />
                </>
              )}

              {/* Idle state — before scan has produced any output */}
              {!ocrText && !scanComplete && !error && !isScanning && imageUrl && (
                <div className="py-8 text-center">
                  <p
                    className="text-sm text-white/30 mb-3"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                  >
                    Scan starts automatically once the label loads.
                  </p>
                  <button
                    type="button"
                    onClick={() => runOCR(false)}
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-white transition-all"
                    style={{
                      background: "rgba(70,118,155,0.18)",
                      border:     "1px solid rgba(70,118,155,0.35)",
                    }}
                  >
                    Start scan manually
                  </button>
                </div>
              )}

              {/* iOS safe-area padding */}
              <div
                aria-hidden="true"
                style={{ height: "calc(8px + env(safe-area-inset-bottom, 0px))" }}
              />
            </div>
          </div>

          {/* ── Sticky footer ───────────────────────────────────────────── */}
          <div
            className="shrink-0 px-4 sm:px-5 py-3 border-t"
            style={{
              borderColor: "rgba(255,255,255,0.06)",
              background:  "#0D1117",
            }}
          >
            <ModalFooter affiliateLink={affiliateLink} runOCR={runOCR} />
            <div
              aria-hidden="true"
              style={{ height: "calc(4px + env(safe-area-inset-bottom, 0px))" }}
            />
          </div>

          {/* Hidden preprocessing canvas */}
          <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
        </motion.div>
      </div>
    </motion.div>
  );
}