// components/NutritionModal.jsx
"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ModalContent from "./ModalContent";
import ModalFooter  from "./ModalFooter";
import { useOCR }   from "@/hooks/useOCR";
import { ocrCache, recordsCache, touchCache, deleteCacheKey } from "@/lib/ocrCache";

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

async function fetchLabelAsFile(url) {
  if (!url) throw new Error("No image URL provided");
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const ext  = blob.type.includes("png") ? "png" : "jpg";
    return new File([blob], `nutrition-label.${ext}`, { type: blob.type || "image/jpeg" });
  } catch { /* CORS blocked — fall through to proxy */ }
  const proxyUrl = `/api/ocr/proxy-image?url=${encodeURIComponent(url)}`;
  const res      = await fetch(proxyUrl);
  if (!res.ok) throw new Error(`Could not fetch label image (${res.status})`);
  const blob = await res.blob();
  const ext  = blob.type.includes("png") ? "png" : "jpg";
  return new File([blob], `nutrition-label.${ext}`, { type: blob.type || "image/jpeg" });
}

/* -------------------------------------------------------------------------- */
/* NutritionModal                                                              */
/* -------------------------------------------------------------------------- */

export default function NutritionModal({ stack, allStacks = [], onClose }) {

  const [ocrText,            setOcrText]            = useState("");
  const [loadingRecords,     setLoadingRecords]     = useState(false);
  const [matchedRecords,     setMatchedRecords]     = useState([]);
  const [matchedIngredients, setMatchedIngredients] = useState([]);
  const [animDots,           setAnimDots]           = useState("");
  const [error,              setError]              = useState("");
  const [scanComplete,       setScanComplete]       = useState(false);

  const hasScannedRef = useRef(false);

  /* ── useOCR ─────────────────────────────────────────────────────────── */

  const handleScanResult = useCallback(async (text) => {
    const cleaned = String(text || "").trim();
    setOcrText(cleaned);
    if (isPlaceholderText(cleaned)) return;

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
            name:         f["Substance Name"] || f["Ingredient Name"] || f["Name"] || "",
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

  const { scanState, startScan, clearError: clearOCRError } = useOCR({ onScan: handleScanResult });

  const isScanning = scanState.isLoading || loadingRecords;
  const loadingOCR = scanState.isLoading;

  /* ── Animated dots ──────────────────────────────────────────────────── */

  useEffect(() => {
    if (!isScanning) { setAnimDots(""); return; }
    const id = setInterval(() => setAnimDots(p => p.length >= 3 ? "" : p + "."), 450);
    return () => clearInterval(id);
  }, [isScanning]);

  /* ── Derived fields ─────────────────────────────────────────────────── */

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
      stack.affiliateLink                         ||
      stack.rawFields?.["Lo. Amazon/Stripe Link"] ||
      stack.rawFields?.AffiliateLink              ||
      stack.fields?.["Lo. Amazon/Stripe Link"]    ||
      stack.fields?.AffiliateLink                 ||
      ""
    );
  }, [stack]);

  const servingsNumber = useMemo(() => {
    if (!stack) return 0;
    return parseNumber(stack.servings) || parseNumber(stack.rawFields?.Servings) || parseNumber(stack.fields?.Servings) || 0;
  }, [stack]);

  const priceNumber = useMemo(() => {
    if (!stack) return 0;
    return parseNumber(stack.price) || parseNumber(stack.rawFields?.Price) || parseNumber(stack.fields?.Price) || 0;
  }, [stack]);

  const stackId = useMemo(() => stack?.id || imageUrl || "unknown", [stack?.id, imageUrl]);

  /* ── Core scan ──────────────────────────────────────────────────────── */

  const runOCR = useCallback(async (force = false) => {
    if (!imageUrl || isScanning) return;

    if (force) {
      deleteCacheKey(imageUrl);
      setScanComplete(false);
      setOcrText("");
      setMatchedRecords([]);
      setMatchedIngredients([]);
      hasScannedRef.current = false;
    }

    // Cache hit — skip Textract entirely
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
      await startScan([file]);
    } catch (err) {
      console.error("[NutritionModal] runOCR error:", err);
      setError(err?.message || "Could not load label image for scanning.");
    }
  }, [imageUrl, isScanning, startScan, clearOCRError, handleScanResult]);

  /* ── Cache ocrText by URL ───────────────────────────────────────────── */

  useEffect(() => {
    if (ocrText && imageUrl && !isPlaceholderText(ocrText)) {
      touchCache(ocrCache, imageUrl, ocrText);
    }
  }, [ocrText, imageUrl]);

  /* ── Auto-scan when imageUrl is available ───────────────────────────── */
  /* No longer tied to DOM image onLoad — we fetch the label directly.    */

  useEffect(() => {
    if (!imageUrl || hasScannedRef.current) return;

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
      hasScannedRef.current = true;
      return;
    }

    // Fresh scan — short delay so modal animation completes first
    hasScannedRef.current = true;
    const timer = setTimeout(() => runOCR(false), 400);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  /* ── Reset on new stack ─────────────────────────────────────────────── */

  useEffect(() => {
    setOcrText("");
    setMatchedRecords([]);
    setMatchedIngredients([]);
    setError("");
    setLoadingRecords(false);
    setScanComplete(false);
    hasScannedRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stack?.id]);

  /* ── Re-scan handler ────────────────────────────────────────────────── */

  const handleRescan = useCallback(() => runOCR(true), [runOCR]);

  /* ── Affiliate click ────────────────────────────────────────────────── */

  const handleAffiliateLinkClick = useCallback(e => {
    e.stopPropagation();
    if (!affiliateLink) e.preventDefault();
  }, [affiliateLink]);

  /* ── Surface OCR hook error ─────────────────────────────────────────── */

  useEffect(() => {
    if (scanState.error) setError(scanState.error);
  }, [scanState.error]);

  /* ── Keyboard close ─────────────────────────────────────────────────── */

  useEffect(() => {
    if (!stack) return;
    const handler = e => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [stack, onClose]);

  /* ── Scroll lock ────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!stack) return;
    const ph = document.documentElement.style.overflow;
    const pb = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow             = "hidden";
    return () => {
      document.documentElement.style.overflow = ph;
      document.body.style.overflow             = pb;
    };
  }, [stack]);

  if (!stack) return null;

  /* ------------------------------------------------------------------------ */
  /* Render                                                                    */
  /* ------------------------------------------------------------------------ */
  return (
    <motion.div
      className="fixed inset-0 z-50"
      style={{ background: "rgba(5,7,10,0.88)", backdropFilter: "blur(6px)" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      role="dialog" aria-modal="true"
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
          onClick={e => e.stopPropagation()}
        >

          {/* ── Header ─────────────────────────────────────────────────── */}
          <div
            className="shrink-0 flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: "rgba(255,255,255,0.07)" }}
          >
            <div className="min-w-0 flex-1">
              <p
                className="text-xs font-semibold uppercase tracking-widest mb-0.5"
                style={{ color: "rgba(255,255,255,0.55)", fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                {stack?.category || "Supplement"}
              </p>
              <h2
                className="text-xl font-bold text-white leading-tight truncate mb-2"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.02em" }}
              >
                {stack?.name || "Untitled Stack"}
              </h2>

              {/* Servings + price — always visible, not hidden on mobile */}
              {(servingsNumber > 0 || priceNumber > 0) && (
                <div className="flex items-center gap-3">
                  {servingsNumber > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-sm font-bold text-white/85"
                        style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                      >
                        {servingsNumber}
                      </span>
                      <span className="text-xs text-white/50 uppercase tracking-wide">servings</span>
                    </div>
                  )}
                  {servingsNumber > 0 && priceNumber > 0 && (
                    <div aria-hidden="true" className="w-px h-3.5 bg-white/15" />
                  )}
                  {priceNumber > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-sm font-bold text-white/85"
                        style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                      >
                        ${priceNumber.toFixed(2)}
                      </span>
                      <span className="text-xs text-white/50 uppercase tracking-wide">price</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="button" onClick={onClose} aria-label="Close modal"
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 ml-4"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.55)"; }}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* ── Scrollable body ──────────────────────────────────────────
              Clean — no hero image eating half the screen.
              ModalContent owns all result rendering including thumbnail.
          ─────────────────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 sm:px-5 pt-4 pb-2">
              <ModalContent
                loadingOCR={loadingOCR}
                loadingRecords={loadingRecords}
                animDots={animDots}
                ocrText={ocrText}
                matchedRecords={matchedRecords}
                matchedIngredients={matchedIngredients}
                error={error}
                runOCR={runOCR}
                stackId={stackId}
                scanComplete={scanComplete}
                isScanning={isScanning}
                imageUrl={imageUrl}
              />
              <div aria-hidden="true" style={{ height: "calc(8px + env(safe-area-inset-bottom, 0px))" }} />
            </div>
          </div>

          {/* ── Sticky footer ────────────────────────────────────────────
              Re-scan lives here and only here. One place, no confusion.
          ─────────────────────────────────────────────────────────────── */}
          <div
            className="shrink-0 px-4 sm:px-5 py-3 border-t"
            style={{ borderColor: "rgba(255,255,255,0.06)", background: "#0D1117" }}
          >
            <ModalFooter affiliateLink={affiliateLink} runOCR={handleRescan} />
            <div aria-hidden="true" style={{ height: "calc(4px + env(safe-area-inset-bottom, 0px))" }} />
          </div>

        </motion.div>
      </div>
    </motion.div>
  );
}