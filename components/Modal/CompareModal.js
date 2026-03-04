// components/Modal/CompareModal.jsx
"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import DetectedSubstancesTab from "./DetectedSubstancesTab";
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
 * CompareModal
 *
 * Side-by-side comparison of 2–3 SmartStack records.
 * Each column runs its own OCR scan and banned-substance check.
 *
 * Code fixes applied:
 *  - Module-level caches replaced with shared lib/ocrCache import
 *  - Stack identity dep fixed (stableKey, not just count)
 *  - img.onload replaced with addEventListener + cleanup
 *  - getStackField moved to module level
 *  - showSwipeHint removed from scroll handler dep array
 *  - checkScrollable no longer defers to handleScroll via setTimeout
 *  - handleRescanAll extracted as named useCallback
 *  - gridColsClass and stackCountLabel derived from one memo
 *
 * UI changes:
 *  - Dark #0D1117 background consistent with NutritionModal
 *  - Animated scan overlay per column while OCR runs
 *  - Risk pill per column showing Clear / Caution / High Risk
 *  - Blurred backdrop + entrance animation matching NutritionModal
 *  - Barlow Condensed headings
 *
 * Props:
 *   stacks   — array of 2–3 SmartStack records
 *   onClose  — close callback
 */

/* -------------------------------------------------------------------------- */
/* Module-level helpers — never recreated on render                           */
/* -------------------------------------------------------------------------- */

function getStackField(stack, field, fallback = "") {
  return (
    stack?.[field]           ??
    stack?.rawFields?.[field] ??
    stack?.fields?.[field]    ??
    fallback
  );
}

function getImageUrl(stack) {
  return (
    getStackField(stack, "nutritionLabel")        ||
    getStackField(stack, "Nutrition Label URL")   ||
    getStackField(stack, "imageUrl")              ||
    getStackField(stack, "image")                 ||
    getStackField(stack, "Image URL")             ||
    ""
  );
}

function getRiskLevel(flaggedCount) {
  if (flaggedCount === 0) return {
    label:  "Clear",
    color:  "#22c55e",
    bg:     "rgba(34,197,94,0.1)",
    border: "rgba(34,197,94,0.25)",
  };
  if (flaggedCount === 1) return {
    label:  "Caution",
    color:  "#f77f00",
    bg:     "rgba(247,127,0,0.1)",
    border: "rgba(247,127,0,0.25)",
  };
  return {
    label:  "High Risk",
    color:  "#E83A2F",
    bg:     "rgba(232,58,47,0.1)",
    border: "rgba(232,58,47,0.25)",
  };
}

/* -------------------------------------------------------------------------- */
/* useScrollShadows — same hook pattern as ResultsTable-smartstack            */
/* -------------------------------------------------------------------------- */
function useScrollShadows(ref, deps = []) {
  const [showLeft,    setShowLeft]    = useState(false);
  const [showRight,   setShowRight]   = useState(false);
  const [showHint,    setShowHint]    = useState(false);
  const [hintVisible, setHintVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const check = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setShowLeft(scrollLeft > 0);
      setShowRight(scrollLeft < scrollWidth - clientWidth - 1);
      if (scrollWidth > clientWidth) {
        setShowHint(true);
        setHintVisible(true);
      } else {
        setShowHint(false);
        setHintVisible(false);
      }
    };

    check();

    const onScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setShowLeft(scrollLeft > 0);
      setShowRight(scrollLeft < scrollWidth - clientWidth - 1);
      if (scrollLeft > 5) {
        setShowHint(false);
        setHintVisible(false);
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);

    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (!showHint) return;
    const t1 = setTimeout(() => setHintVisible(false), 2500);
    const t2 = setTimeout(() => setShowHint(false),    3200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [showHint]);

  return { showLeft, showRight, showHint, hintVisible };
}

/* -------------------------------------------------------------------------- */
/* ColumnScanOverlay                                                           */
/* -------------------------------------------------------------------------- */
function ColumnScanOverlay({ dots }) {
  return (
    <motion.div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl overflow-hidden"
      style={{ background: "rgba(10,12,16,0.82)", backdropFilter: "blur(2px)" }}
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
              "0 0 10px rgba(91,158,201,0.65), 0 0 22px rgba(91,158,201,0.25)",
          }}
          initial={{ top: "0%" }}
          animate={{ top: "100%" }}
          transition={{ duration: 2, ease: "linear", repeat: Infinity }}
        />
      </div>

      {/* Corner brackets */}
      {[
        "top-2 left-2 border-t-2 border-l-2",
        "top-2 right-2 border-t-2 border-r-2",
        "bottom-2 left-2 border-b-2 border-l-2",
        "bottom-2 right-2 border-b-2 border-r-2",
      ].map((cls, i) => (
        <div
          key={i}
          aria-hidden="true"
          className={`absolute w-4 h-4 rounded-sm ${cls}`}
          style={{ borderColor: "rgba(91,158,201,0.6)" }}
        />
      ))}

      <p
        className="relative z-10 text-xs font-bold tracking-widest uppercase text-white/80 pointer-events-none"
        style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
      >
        Scanning{dots}
      </p>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* RiskPill — compact result indicator per column                             */
/* -------------------------------------------------------------------------- */
function RiskPill({ flaggedCount, isVisible }) {
  const risk = getRiskLevel(flaggedCount);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1   }}
          exit={{    opacity: 0             }}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-2 rounded-full px-3 py-1.5 border w-fit"
          style={{ background: risk.bg, borderColor: risk.border }}
        >
          <div className="relative shrink-0" aria-hidden="true">
            <span
              className="absolute inset-0 rounded-full animate-ping opacity-25"
              style={{ backgroundColor: risk.color }}
            />
            <span
              className="relative w-2 h-2 rounded-full block"
              style={{ backgroundColor: risk.color }}
            />
          </div>
          <span
            className="text-xs font-bold uppercase tracking-wider"
            style={{
              color:      risk.color,
              fontFamily: "'Barlow Condensed', sans-serif",
            }}
          >
            {risk.label}
          </span>
          <span
            className="text-xs font-bold ml-1"
            style={{ color: "rgba(255,255,255,0.35)" }}
          >
            {flaggedCount > 0 ? `${flaggedCount} flagged` : "No flags"}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* -------------------------------------------------------------------------- */
/* CompareModal                                                                */
/* -------------------------------------------------------------------------- */
export default function CompareModal({ stacks = [], onClose }) {
  const count = stacks.length;

  // A stable string key that changes when the actual stacks change,
  // not just the count — fixes the bug where swapping one stack
  // with another of the same count didn't trigger a re-scan.
  const stableKey = useMemo(
    () => stacks.map((s) => s?.id ?? "").join(","),
    [stacks]
  );

  const imageRefs = useRef([]);
  const scrollRef = useRef(null);

  /* ── Per-column OCR + results state ──────────────────────────────────── */

  const [loadingOCR,       setLoadingOCR]       = useState(() => stacks.map(() => false));
  const [ocrTexts,         setOcrTexts]         = useState(() => stacks.map(() => ""));
  const [matchedArr,       setMatchedArr]        = useState(() => stacks.map(() => []));
  const [scanCompleteArr,  setScanCompleteArr]   = useState(() => stacks.map(() => false));

  /* ── Dots ticker ──────────────────────────────────────────────────────── */

  const [dotsTick, setDotsTick] = useState(0);

  useEffect(() => {
    if (!loadingOCR.some(Boolean)) return;
    const id = setInterval(() => setDotsTick((t) => (t + 1) % 4), 450);
    return () => clearInterval(id);
  }, [loadingOCR]);

  const dots = useMemo(() => ".".repeat(dotsTick), [dotsTick]);

  /* ── Scroll shadows ───────────────────────────────────────────────────── */

  const { showLeft, showRight, showHint, hintVisible } = useScrollShadows(
    scrollRef,
    [count]
  );

  /* ── Scroll lock ──────────────────────────────────────────────────────── */

  useEffect(() => {
    if (count < 2 || count > 3) return;
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow             = "hidden";
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow             = prevBody;
    };
  }, [count]);

  /* ── Escape to close ──────────────────────────────────────────────────── */

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  /* ── Reset state when stacks identity changes ─────────────────────────── */

  useEffect(() => {
    setLoadingOCR(stacks.map(() => false));
    setOcrTexts(stacks.map(() => ""));
    setMatchedArr(stacks.map(() => []));
    setScanCompleteArr(stacks.map(() => false));
    // Preserve existing imageRefs slots, fill new ones with null
    imageRefs.current = stacks.map((_, i) => imageRefs.current[i] ?? null);
  // stableKey changes when any stack id changes — correct dep
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableKey]);

  /* ── Grid layout derived from count — single source of truth ─────────── */

  const { gridColsClass, stackCountLabel } = useMemo(() => ({
    gridColsClass:   count === 3 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2",
    stackCountLabel: count >= 2  ? `Comparing ${count} stacks` : "",
  }), [count]);

  /* ── fetchRecords (per column) ────────────────────────────────────────── */

  const fetchRecords = useCallback(
    async (idx, text) => {
      const stack    = stacks[idx];
      if (!stack) return;

      const imageUrl = getImageUrl(stack);
      const cleaned  = String(text || "").trim();

      if (!imageUrl || !cleaned || cleaned.length < 2) return;

      const lower = cleaned.toLowerCase();
      if (
        lower === "no ocr text detected." ||
        lower === "no ocr text detected"  ||
        lower === "no text detected."     ||
        lower === "no text detected"
      ) return;

      // Cache hit
      if (recordsCache[imageUrl]) {
        const cached = recordsCache[imageUrl];
        setMatchedArr((prev) => {
          const next = [...prev];
          next[idx]  = cached.banned || cached || [];
          return next;
        });
        setScanCompleteArr((prev) => {
          const next = [...prev];
          next[idx]  = true;
          return next;
        });
        return;
      }

      try {
        const res = await fetch("/api/check-smartstack", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ ingredientsText: cleaned }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Failed to fetch records");

        const banned = Array.isArray(data?.bannedSubstances)
          ? data.bannedSubstances
          : [];

        // Store under both keys so NutritionModal can hit this cache too
        touchCache(recordsCache, imageUrl, { banned, ingredients: data?.ingredients || [] });

        setMatchedArr((prev) => {
          const next = [...prev];
          next[idx]  = banned;
          return next;
        });
        setScanCompleteArr((prev) => {
          const next = [...prev];
          next[idx]  = true;
          return next;
        });
      } catch (err) {
        console.error(`[CompareModal] fetchRecords[${idx}] error:`, err);
        setMatchedArr((prev) => {
          const next = [...prev];
          next[idx]  = [];
          return next;
        });
      }
    },
    // stacks ref is stable across renders within a session
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stableKey]
  );

  /* ── runOCR (per column) ──────────────────────────────────────────────── */

  const runOCR = useCallback(
    async (idx, force = false) => {
      const stack = stacks[idx];
      if (!stack) return;

      const imgEl    = imageRefs.current[idx];
      if (!imgEl) return;

      const imageUrl = getImageUrl(stack);
      if (!imageUrl) return;

      if (force) {
        deleteCacheKey(imageUrl);
        setScanCompleteArr((prev) => {
          const next = [...prev];
          next[idx]  = false;
          return next;
        });
      }

      // Cache hit
      if (ocrCache[imageUrl] && !force) {
        const cachedText = ocrCache[imageUrl];
        setOcrTexts((prev) => {
          const next = [...prev];
          next[idx]  = cachedText;
          return next;
        });
        await fetchRecords(idx, cachedText);
        return;
      }

      if (loadingCache[imageUrl]) return;
      loadingCache[imageUrl] = true;

      setLoadingOCR((prev) => {
        const next = [...prev];
        next[idx]  = true;
        return next;
      });

      try {
        const Tesseract = await getTesseract();
        const result    = await Tesseract.recognize(imgEl, "eng", {
          logger: () => {},
          tessedit_char_whitelist:
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,%()-: ",
          oem: 1,
          psm: 6,
        });

        const text     = (result?.data?.text || "").trim();
        const finalText = text || "No OCR text detected.";

        touchCache(ocrCache, imageUrl, finalText);

        setOcrTexts((prev) => {
          const next = [...prev];
          next[idx]  = finalText;
          return next;
        });

        await fetchRecords(idx, finalText);
      } catch (err) {
        console.error(`[CompareModal] OCR[${idx}] error:`, err);
        setOcrTexts((prev) => {
          const next = [...prev];
          next[idx]  = "OCR failed.";
          return next;
        });
        setMatchedArr((prev) => {
          const next = [...prev];
          next[idx]  = [];
          return next;
        });
      } finally {
        setLoadingOCR((prev) => {
          const next = [...prev];
          next[idx]  = false;
          return next;
        });
        loadingCache[imageUrl] = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stableKey, fetchRecords]
  );

  /* ── Auto-run OCR when images load ───────────────────────────────────── */
  // FIX: uses addEventListener instead of overwriting img.onload

  useEffect(() => {
    const cleanups = stacks.map((stack, idx) => {
      const img = imageRefs.current[idx];
      if (!img) return null;

      const start = () => runOCR(idx, false).catch(() => {});

      if (img.complete && img.naturalWidth > 0) {
        // Already loaded — start immediately
        start();
        return null;
      }

      img.addEventListener("load", start, { once: true });
      return () => img.removeEventListener("load", start);
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup?.());
    };
  // stableKey changes when stacks identity changes — re-attach listeners
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableKey]);

  /* ── Rescan all columns ───────────────────────────────────────────────── */

  const handleRescanAll = useCallback(() => {
    stacks.forEach((_, idx) => runOCR(idx, true).catch(() => {}));
  }, [stacks, runOCR]);

  /* ── Any column still scanning? ──────────────────────────────────────── */

  const anyScanning = loadingOCR.some(Boolean);

  /* ------------------------------------------------------------------------ */
  /* Render                                                                    */
  /* ------------------------------------------------------------------------ */
  if (count < 2 || count > 3) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50"
        style={{ background: "rgba(5,7,10,0.88)", backdropFilter: "blur(6px)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        role="dialog"
        aria-modal="true"
        aria-label={`Comparing ${count} stacks`}
        onClick={onClose}
      >
        <div
          className="h-full w-full flex items-center justify-center"
          style={{
            paddingTop:    "calc(12px + env(safe-area-inset-top, 0px))",
            paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
            paddingLeft:   "12px",
            paddingRight:  "12px",
          }}
        >
          <motion.div
            className="w-full max-w-6xl flex flex-col overflow-hidden"
            style={{
              background:   "#0D1117",
              border:       "1px solid rgba(255,255,255,0.07)",
              borderRadius: "20px",
              boxShadow:    "0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04) inset",
              maxHeight:    "calc(100dvh - 24px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px))",
              fontFamily:   "'Barlow', sans-serif",
            }}
            initial={{ y: 20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0,  opacity: 1, scale: 1    }}
            exit={{    y: 10, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >

            {/* ── Header ─────────────────────────────────────────────── */}
            <div
              className="shrink-0 flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor: "rgba(255,255,255,0.06)" }}
            >
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-widest mb-0.5"
                  style={{ color: "rgba(255,255,255,0.28)" }}
                >
                  SmartStack
                </p>
                <h2
                  className="text-lg font-bold text-white"
                  style={{
                    fontFamily:    "'Barlow Condensed', sans-serif",
                    letterSpacing: "0.02em",
                  }}
                >
                  {stackCountLabel}
                </h2>
                <p className="text-xs text-white/30 mt-0.5">
                  Scroll horizontally on mobile if needed.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-4">
                {/* Rescan all */}
                <button
                  type="button"
                  onClick={handleRescanAll}
                  disabled={anyScanning}
                  className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: "rgba(70,118,155,0.2)",
                    border:     "1px solid rgba(70,118,155,0.35)",
                  }}
                  aria-label={anyScanning ? "Scan in progress" : "Re-scan all labels"}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-3.5 h-3.5"
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
                  {anyScanning ? `Scanning${dots}` : "Rescan all"}
                </button>

                {/* Close */}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close compare modal"
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

            {/* ── Scrollable columns area ─────────────────────────────── */}
            <div
              ref={scrollRef}
              className="relative flex-1 overflow-auto"
              style={{ touchAction: "pan-y" }}
            >
              {/* Left scroll shadow */}
              {showLeft && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute top-0 left-0 h-full w-8 z-10"
                  style={{
                    background:
                      "linear-gradient(to right, rgba(13,17,23,0.95), transparent)",
                  }}
                />
              )}

              {/* Right scroll shadow */}
              {showRight && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute top-0 right-0 h-full w-8 z-10"
                  style={{
                    background:
                      "linear-gradient(to left, rgba(13,17,23,0.95), transparent)",
                  }}
                />
              )}

              {/* Swipe hint */}
              <AnimatePresence>
                {showHint && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: hintVisible ? 1 : 0, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    aria-hidden="true"
                    className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-20 rounded-full px-3 py-1.5 text-[11px] font-medium select-none"
                    style={{
                      background:     "rgba(13,17,23,0.85)",
                      border:         "1px solid rgba(255,255,255,0.1)",
                      backdropFilter: "blur(8px)",
                      color:          "rgba(255,255,255,0.5)",
                    }}
                  >
                    Swipe to view all stacks →
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Column grid */}
              <div className={`p-4 sm:p-5 grid ${gridColsClass} gap-4`}>
                {stacks.map((stack, idx) => {
                  const imageUrl    = getImageUrl(stack) || "/fallback-image.svg";
                  const isScanning  = Boolean(loadingOCR[idx]);
                  const isDone      = Boolean(scanCompleteArr[idx]);
                  const bannedCount = Array.isArray(matchedArr[idx])
                    ? matchedArr[idx].length
                    : 0;
                  const affiliateLink =
                    getStackField(stack, "affiliateLink") ||
                    getStackField(stack, "Lo. Amazon/Stripe Link") ||
                    "";

                  return (
                    <motion.div
                      key={stack?.id ?? idx}
                      className="flex flex-col rounded-2xl overflow-hidden"
                      style={{
                        background:  "rgba(255,255,255,0.03)",
                        border:      "1px solid rgba(255,255,255,0.07)",
                        minWidth:    0,
                      }}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1,  y: 0  }}
                      transition={{ duration: 0.3, delay: idx * 0.06 }}
                    >
                      {/* Column image with scan overlay */}
                      <div className="relative w-full" style={{ aspectRatio: "4/3" }}>
                        <img
                          ref={(el) => { imageRefs.current[idx] = el; }}
                          src={imageUrl}
                          alt={stack?.name || `Stack ${idx + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = "/fallback-image.svg";
                          }}
                        />

                        {/* Bottom vignette */}
                        <div
                          aria-hidden="true"
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            background:
                              "linear-gradient(to bottom, transparent 40%, rgba(13,17,23,0.85) 100%)",
                          }}
                        />

                        {/* Scan overlay */}
                        <AnimatePresence>
                          {isScanning && <ColumnScanOverlay dots={dots} />}
                        </AnimatePresence>

                        {/* Scanned badge */}
                        <AnimatePresence>
                          {isDone && !isScanning && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.85 }}
                              animate={{ opacity: 1, scale: 1    }}
                              exit={{    opacity: 0              }}
                              className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full px-2 py-0.5"
                              style={{
                                background:     "rgba(13,17,23,0.78)",
                                border:         "1px solid rgba(255,255,255,0.1)",
                                backdropFilter: "blur(6px)",
                              }}
                              aria-hidden="true"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                              <span
                                className="text-[9px] font-bold uppercase tracking-widest"
                                style={{ color: "rgba(255,255,255,0.4)" }}
                              >
                                Scanned
                              </span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Column content */}
                      <div className="flex flex-col flex-1 p-3 sm:p-4 space-y-3">
                        {/* Product name */}
                        <div>
                          <p
                            className="text-[10px] font-semibold uppercase tracking-widest mb-0.5"
                            style={{ color: "rgba(255,255,255,0.28)" }}
                          >
                            {stack?.category || "Supplement"}
                          </p>
                          <h3
                            className="text-base font-bold text-white leading-snug line-clamp-2"
                            style={{
                              fontFamily:    "'Barlow Condensed', sans-serif",
                              letterSpacing: "0.02em",
                            }}
                          >
                            {stack?.name || `Stack ${idx + 1}`}
                          </h3>
                        </div>

                        {/* Risk pill — animates in when scan is done */}
                        <RiskPill
                          flaggedCount={bannedCount}
                          isVisible={isDone && !isScanning}
                        />

                        {/* Detected substances list */}
                        <div className="flex-1 min-w-0">
                          {isScanning ? (
                            <p
                              className="text-xs italic"
                              style={{ color: "rgba(255,255,255,0.35)" }}
                            >
                              Reading label…
                            </p>
                          ) : (
                            <DetectedSubstancesTab
                              matchedRecords={matchedArr[idx]}
                              hideCounts
                            />
                          )}
                        </div>

                        {/* Footer */}
                        <div
                          className="pt-3 border-t"
                          style={{ borderColor: "rgba(255,255,255,0.05)" }}
                        >
                          <ModalFooter affiliateLink={affiliateLink} />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* iOS safe-area bottom breathing room */}
              <div
                aria-hidden="true"
                style={{ height: "calc(10px + env(safe-area-inset-bottom, 0px))" }}
              />
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}