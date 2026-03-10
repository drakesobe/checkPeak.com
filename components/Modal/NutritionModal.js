// components/NutritionModal.jsx
"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ModalTabs    from "./ModalTabs";
import ModalContent from "./ModalContent";
import ModalFooter  from "./ModalFooter";
import { useOCR }   from "@/hooks/useOCR";
import { ocrCache, recordsCache, touchCache, deleteCacheKey } from "@/lib/ocrCache";

/**
 * NutritionModal — Scan Terminal UI
 *
 * OCR is now powered by AWS Textract via useOCR hook.
 * The label URL is fetched server-side (via /api/ocr/proxy-image or directly),
 * converted to a File, and passed to startScan — identical interface to the
 * athlete-side OCRUpload flow.
 *
 * All UI (scan overlay, risk banner, tabs, footer) is unchanged.
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
    lower === ""                      ||
    lower === "no ocr text detected." ||
    lower === "no ocr text detected"  ||
    lower === "no text detected."     ||
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

// ---------------------------------------------------------------------------
// Fetch the label image URL and return a File object for Textract
// ---------------------------------------------------------------------------

async function fetchLabelAsFile(url) {
  if (!url) throw new Error("No image URL provided");

  // Try direct fetch first — works when CORS allows it
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob     = await res.blob();
    const ext      = blob.type.includes("png") ? "png" : "jpg";
    const mimeType = blob.type || "image/jpeg";
    return new File([blob], `nutrition-label.${ext}`, { type: mimeType });
  } catch {
    // CORS blocked — fall through to proxy
  }

  // Proxy route — add pages/api/ocr/proxy-image.js if not present (see below)
  const proxyUrl = `/api/ocr/proxy-image?url=${encodeURIComponent(url)}`;
  const res      = await fetch(proxyUrl);
  if (!res.ok) throw new Error(`Could not fetch label image (${res.status})`);
  const blob     = await res.blob();
  const ext      = blob.type.includes("png") ? "png" : "jpg";
  return new File([blob], `nutrition-label.${ext}`, { type: blob.type || "image/jpeg" });
}

/* -------------------------------------------------------------------------- */
/* ScanOverlay                                                                 */
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

          <div className="flex-1 min-w-0">
            <p
              className="text-xl font-black leading-none tracking-tight"
              style={{ color: risk.color, fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              {risk.label.toUpperCase()}
            </p>
            <p className="text-[10px] text-white/35 uppercase tracking-widest mt-0.5">
              Scan complete
            </p>
          </div>

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
              <p className="text-[9px] text-white/30 uppercase tracking-widest mt-0.5">Flagged</p>
            </div>

            <div aria-hidden="true" className="w-px h-7 bg-white/10" />

            <div className="text-center">
              <p
                className="text-2xl font-black text-white/65 leading-none"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                {totalCount}
              </p>
              <p className="text-[9px] text-white/30 uppercase tracking-widest mt-0.5">Ingredients</p>
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
  const [loadingRecords,     setLoadingRecords]     = useState(false);
  const [matchedRecords,     setMatchedRecords]     = useState([]);
  const [matchedIngredients, setMatchedIngredients] = useState([]);
  const [animDots,           setAnimDots]           = useState("");
  const [error,              setError]              = useState("");
  const [imageLoaded,        setImageLoaded]        = useState(false);
  const [scanComplete,       setScanComplete]       = useState(false);

  const imageRef      = useRef(null);
  const startedRef    = useRef({ url: "", started: false });
  const hasScannedRef = useRef(false);

  /* ── useOCR ───────────────────────────────────────────────────────────── */

  const handleScanResult = useCallback(async (text) => {
    const cleaned = String(text || "").trim();
    setOcrText(cleaned);

    if (isPlaceholderText(cleaned)) return;

    // Cache hit
    if (recordsCache[cleaned]) {
      const c = recordsCache[cleaned];
      setMatchedRecords(c.banned       || []);
      setMatchedIngredients(c.ingredients || []);
      setScanComplete(true);
      return;
    }

    setLoadingRecords(true);
    setError("");

    try {
      const res  = await fetch("/api/check", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ingredientsText: cleaned }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to match ingredients");

      const rawBanned      = Array.isArray(data?.matchedBanned)      ? data.matchedBanned      : [];
      const rawIngredients = Array.isArray(data?.matchedIngredients) ? data.matchedIngredients : [];

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

      touchCache(recordsCache, cleaned, { banned, ingredients });
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
  }, []);

  const { scanState, startScan, clearError: clearOCRError } = useOCR({
    onScan: handleScanResult,
  });

  const isScanning  = scanState.isLoading || loadingRecords;
  const loadingOCR  = scanState.isLoading;

  /* ── Animated dots ────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!isScanning) { setAnimDots(""); return; }
    const id = setInterval(
      () => setAnimDots((p) => (p.length >= 3 ? "" : p + ".")),
      450
    );
    return () => clearInterval(id);
  }, [isScanning]);

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

  const loadingLabel = useMemo(() => {
    if (loadingOCR && loadingRecords) return "Reading label and matching ingredients";
    if (loadingOCR)                   return "Reading label";
    if (loadingRecords)               return "Matching ingredients";
    return "Preparing scan";
  }, [loadingOCR, loadingRecords]);

  /* ── Core scan function ───────────────────────────────────────────────── */

  const runOCR = useCallback(async (force = false) => {
    if (!imageUrl) return;
    if (isScanning)  return;

    if (force) {
      deleteCacheKey(imageUrl);
      setScanComplete(false);
      setOcrText("");
      setMatchedRecords([]);
      setMatchedIngredients([]);
    }

    // Cache hit — skip Textract
    if (!force && ocrCache[imageUrl]) {
      const cached = String(ocrCache[imageUrl] || "").trim();
      setOcrText(cached);
      if (recordsCache[cached]) {
        const c = recordsCache[cached];
        setMatchedRecords(c.banned       || []);
        setMatchedIngredients(c.ingredients || []);
        setScanComplete(true);
        return;
      }
      await handleScanResult(cached);
      return;
    }

    setError("");
    clearOCRError();

    try {
      const file = await fetchLabelAsFile(imageUrl);
      // Cache the text result after onScan fires via useOCR
      await startScan([file]);
      // Store in ocrCache keyed by URL after scan completes
      // (onScan fires handleScanResult which sets ocrText)
    } catch (err) {
      console.error("[NutritionModal] runOCR error:", err);
      setError(err?.message || "Could not load label image for scanning.");
    }
  }, [imageUrl, isScanning, startScan, clearOCRError, handleScanResult]);

  /* ── Cache ocrText by URL after scan ─────────────────────────────────── */

  useEffect(() => {
    if (ocrText && imageUrl && !isPlaceholderText(ocrText)) {
      touchCache(ocrCache, imageUrl, ocrText);
    }
  }, [ocrText, imageUrl]);

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

  /* ── Reset on new stack ───────────────────────────────────────────────── */

  useEffect(() => {
    setOcrText("");
    setMatchedRecords([]);
    setMatchedIngredients([]);
    setError("");
    setLoadingRecords(false);
    setImageLoaded(false);
    setScanComplete(false);
    hasScannedRef.current = false;
    startedRef.current    = { url: imageUrl, started: false };

    if (!imageUrl) return;

    // Restore from cache immediately if available
    if (ocrCache[imageUrl]) {
      const cached = String(ocrCache[imageUrl] || "").trim();
      setOcrText(cached);
      if (recordsCache[cached]) {
        const c = recordsCache[cached];
        setMatchedRecords(c.banned       || []);
        setMatchedIngredients(c.ingredients || []);
        setScanComplete(true);
      } else {
        handleScanResult(cached).catch(() => {});
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stack?.id]);

  /* ── Auto-scan when image loads ───────────────────────────────────────── */

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    if (!imageUrl || hasScannedRef.current) return;
    if (ocrCache[imageUrl]) return; // already cached — reset effect handled it
    hasScannedRef.current = true;
    setTimeout(() => runOCR(false), 350);
  }, [imageUrl, runOCR]);

  /* ── Named handlers ───────────────────────────────────────────────────── */

  const handleRescan = useCallback(() => {
    hasScannedRef.current = false;
    runOCR(true);
  }, [runOCR]);

  const handleAffiliateLinkClick = useCallback((e) => {
    e.stopPropagation();
    if (!affiliateLink) e.preventDefault();
  }, [affiliateLink]);

  /* ── Surface OCR hook error ───────────────────────────────────────────── */

  useEffect(() => {
    if (scanState.error) setError(scanState.error);
  }, [scanState.error]);

  /* ── Early return ─────────────────────────────────────────────────────── */

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
                style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.02em" }}
              >
                {stack?.name || "Untitled Stack"}
              </h2>
            </div>

            <div className="flex items-center gap-4 shrink-0 ml-4">
              {servingsNumber > 0 && (
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-bold text-white/75" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    {servingsNumber}
                  </p>
                  <p className="text-[10px] text-white/28 uppercase tracking-wider">servings</p>
                </div>
              )}
              {priceNumber > 0 && (
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-bold text-white/75" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    ${priceNumber.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-white/28 uppercase tracking-wider">price</p>
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)";  e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* ── Scrollable body ────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto">

            {/* Label image */}
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

                <div
                  aria-hidden="true"
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: "linear-gradient(to bottom, rgba(13,17,23,0.15) 0%, rgba(13,17,23,0) 35%, rgba(13,17,23,0.9) 100%)",
                  }}
                />

                <AnimatePresence>
                  {isScanning && <ScanOverlay label={loadingLabel} dots={animDots} />}
                </AnimatePresence>

                <AnimatePresence>
                  {scanComplete && !isScanning && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1    }}
                      exit={{    opacity: 0              }}
                      transition={{ duration: 0.2 }}
                      className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full px-2.5 py-1"
                      style={{ background: "rgba(13,17,23,0.78)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(8px)" }}
                      aria-hidden="true"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.45)" }}>
                        Scanned
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="absolute bottom-3 right-3 flex items-center gap-2">
                  {affiliateLink && (
                    <a
                      href={affiliateLink}
                      target="_blank"
                      rel="noreferrer"
                      onClick={handleAffiliateLinkClick}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white transition-all"
                      style={{ background: "rgba(70,118,155,0.82)", border: "1px solid rgba(91,158,201,0.35)", backdropFilter: "blur(8px)" }}
                    >
                      View product
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={handleRescan}
                    disabled={isScanning}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: "rgba(13,17,23,0.72)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.65)", backdropFilter: "blur(8px)" }}
                    aria-label={isScanning ? "Scan in progress" : "Re-scan nutrition label"}
                  >
                    <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9V6a2 2 0 012-2h3M15 4h3a2 2 0 012 2v3M21 15v3a2 2 0 01-2 2h-3M9 20H6a2 2 0 01-2-2v-3" />
                    </svg>
                    {isScanning ? "Scanning…" : "Re-scan"}
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="w-full flex items-center justify-center text-sm shrink-0"
                style={{ height: 160, background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.2)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
              >
                No nutrition label available
              </div>
            )}

            {/* ── Content area ─────────────────────────────────────────── */}
            <div className="px-4 sm:px-5 pt-4 pb-2 space-y-4">

              <RiskBanner
                flaggedCount={matchedRecords.length}
                totalCount={matchedIngredients.length}
                isVisible={scanComplete && !isScanning}
              />

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0  }}
                    exit={{    opacity: 0         }}
                    className="rounded-xl px-4 py-3 text-sm"
                    style={{ background: "rgba(232,58,47,0.08)", border: "1px solid rgba(232,58,47,0.25)", color: "#E83A2F" }}
                    role="alert"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

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
                    scanPrimed={isScanning}
                    stackId={stackId}
                  />
                </>
              )}

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
                    style={{ background: "rgba(70,118,155,0.18)", border: "1px solid rgba(70,118,155,0.35)" }}
                  >
                    Start scan manually
                  </button>
                </div>
              )}

              <div aria-hidden="true" style={{ height: "calc(8px + env(safe-area-inset-bottom, 0px))" }} />
            </div>
          </div>

          {/* ── Sticky footer ───────────────────────────────────────────── */}
          <div
            className="shrink-0 px-4 sm:px-5 py-3 border-t"
            style={{ borderColor: "rgba(255,255,255,0.06)", background: "#0D1117" }}
          >
            <ModalFooter affiliateLink={affiliateLink} runOCR={runOCR} />
            <div aria-hidden="true" style={{ height: "calc(4px + env(safe-area-inset-bottom, 0px))" }} />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}