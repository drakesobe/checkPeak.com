// components/Modal/CompareModal.jsx
"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DetectedSubstancesTab from "./DetectedSubstancesTab";
import ModalHeader from "./ModalHeader";
import ModalFooter from "./ModalFooter";

/* -----------------------------------------------------------------------------
  ✅ Capped caches (prevents unbounded memory growth in long sessions)
----------------------------------------------------------------------------- */
const MAX_CACHE_ITEMS = 50;

const ocrCache = Object.create(null); // imageUrl -> ocrText
const recordsCache = Object.create(null); // imageUrl -> bannedRecords[]
const loadingCache = Object.create(null); // imageUrl -> boolean
const cacheOrder = []; // FIFO eviction

function touchCache(map, key, value) {
  if (!key) return;
  if (!(key in map)) {
    cacheOrder.push(key);
    while (cacheOrder.length > MAX_CACHE_ITEMS) {
      const oldest = cacheOrder.shift();
      if (!oldest) continue;
      delete ocrCache[oldest];
      delete recordsCache[oldest];
      delete loadingCache[oldest];
    }
  }
  map[key] = value;
}

function deleteCacheKey(key) {
  if (!key) return;
  delete ocrCache[key];
  delete recordsCache[key];
  delete loadingCache[key];
  const idx = cacheOrder.indexOf(key);
  if (idx >= 0) cacheOrder.splice(idx, 1);
}

/* -----------------------------------------------------------------------------
  ✅ Cache the tesseract import (so you don’t re-import per stack)
----------------------------------------------------------------------------- */
let tesseractPromise = null;
async function getTesseract() {
  if (!tesseractPromise) {
    tesseractPromise = import("tesseract.js").then((m) => m.default);
  }
  return tesseractPromise;
}

export default function CompareModal({ stacks = [], onClose }) {
  // Normalize stacks length to 0-3 (you already guard 2-3 in render)
  const count = stacks.length;

  // Refs
  const imageRefs = useRef([]);
  const scrollRef = useRef(null);

  // OCR / records state per index
  const [loadingOCR, setLoadingOCR] = useState(() => stacks.map(() => false));
  const [ocrTexts, setOcrTexts] = useState(() => stacks.map(() => ""));
  const [matchedRecordsArr, setMatchedRecordsArr] = useState(() =>
    stacks.map(() => [])
  );

  // Animated dots
  const [dotsTick, setDotsTick] = useState(0);

  // Scroll / swipe hint state
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const [fadeHint, setFadeHint] = useState(false);

  const getStackField = (stack, field, fallback = "") =>
    stack?.[field] ?? stack?.rawFields?.[field] ?? stack?.fields?.[field] ?? fallback;

  const getImageUrlForStack = useCallback(
    (stack) => {
      // Match patterns across your codebase
      return (
        getStackField(stack, "nutritionLabel") ||
        getStackField(stack, "Nutrition Label URL") ||
        getStackField(stack, "imageUrl") ||
        getStackField(stack, "image") ||
        getStackField(stack, "Image URL") ||
        ""
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Reset arrays whenever stacks list changes
  useEffect(() => {
    setLoadingOCR(stacks.map(() => false));
    setOcrTexts(stacks.map(() => ""));
    setMatchedRecordsArr(stacks.map(() => []));
    imageRefs.current = stacks.map((_, i) => imageRefs.current[i] || null);
  }, [count]); // count change is enough for compare use

  // Dots ticker while any OCR is running
  useEffect(() => {
    if (!loadingOCR.some(Boolean)) return;
    const id = setInterval(() => setDotsTick((t) => (t + 1) % 4), 450);
    return () => clearInterval(id);
  }, [loadingOCR]);

  const dots = useMemo(() => ".".repeat(dotsTick), [dotsTick]);

  // API fetch for banned matches (uses the SAME contract as NutritionModal)
  const fetchRecords = useCallback(
    async (idx, text) => {
      const stack = stacks[idx];
      if (!stack) return;

      const imageUrl = getImageUrlForStack(stack);
      const cleaned = String(text || "").trim();

      // hard gate to avoid needless calls / placeholders
      if (!imageUrl) return;
      if (!cleaned || cleaned.length < 2) return;

      const lower = cleaned.toLowerCase();
      if (
        lower === "no ocr text detected." ||
        lower === "no ocr text detected" ||
        lower === "no text detected." ||
        lower === "no text detected"
      ) {
        return;
      }

      // cache hit
      if (recordsCache[imageUrl]) {
        setMatchedRecordsArr((prev) => {
          const updated = [...prev];
          updated[idx] = recordsCache[imageUrl] || [];
          return updated;
        });
        return;
      }

      try {
        const res = await fetch("/api/check-smartstack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // ✅ new contract
          body: JSON.stringify({ ingredientsText: cleaned }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Failed to fetch records");

        // ✅ new contract
        const banned = Array.isArray(data?.bannedSubstances)
          ? data.bannedSubstances
          : [];

        touchCache(recordsCache, imageUrl, banned);

        setMatchedRecordsArr((prev) => {
          const updated = [...prev];
          updated[idx] = banned;
          return updated;
        });
      } catch (err) {
        console.error("Fetch records failed:", err);
        setMatchedRecordsArr((prev) => {
          const updated = [...prev];
          updated[idx] = [];
          return updated;
        });
      }
    },
    [stacks, getImageUrlForStack]
  );

  const runOCR = useCallback(
    async (idx, force = false) => {
      const stack = stacks[idx];
      if (!stack) return;

      const imgEl = imageRefs.current[idx];
      if (!imgEl) return;

      const imageUrl = getImageUrlForStack(stack);
      if (!imageUrl) return;

      // Force clears caches for this image
      if (force) {
        deleteCacheKey(imageUrl);
      }

      // Cache hit
      if (ocrCache[imageUrl] && !force) {
        const cachedText = ocrCache[imageUrl];
        setOcrTexts((prev) => {
          const updated = [...prev];
          updated[idx] = cachedText;
          return updated;
        });
        await fetchRecords(idx, cachedText);
        return;
      }

      // Prevent concurrent OCR per imageUrl
      if (loadingCache[imageUrl]) return;
      loadingCache[imageUrl] = true;

      setLoadingOCR((prev) => {
        const updated = [...prev];
        updated[idx] = true;
        return updated;
      });

      try {
        const Tesseract = await getTesseract();

        // OCR directly from image element (fine); if you want preprocessing,
        // we can port the canvas grayscale trick from NutritionModal.
        const result = await Tesseract.recognize(imgEl, "eng", { logger: () => {} });

        const text =
          (result?.data?.text || "").trim() || "No OCR text detected.";

        touchCache(ocrCache, imageUrl, text);

        setOcrTexts((prev) => {
          const updated = [...prev];
          updated[idx] = text;
          return updated;
        });

        await fetchRecords(idx, text);
      } catch (err) {
        console.error("OCR error:", err);
        setOcrTexts((prev) => {
          const updated = [...prev];
          updated[idx] = "OCR failed.";
          return updated;
        });
        setMatchedRecordsArr((prev) => {
          const updated = [...prev];
          updated[idx] = [];
          return updated;
        });
      } finally {
        setLoadingOCR((prev) => {
          const updated = [...prev];
          updated[idx] = false;
          return updated;
        });
        loadingCache[imageUrl] = false;
      }
    },
    [stacks, getImageUrlForStack, fetchRecords]
  );

  // Auto-run OCR for all stacks when images load (no double-work)
  useEffect(() => {
    stacks.forEach((stack, idx) => {
      const img = imageRefs.current[idx];
      if (!img) return;

      const start = () => runOCR(idx, false).catch(() => {});
      if (img.complete) start();
      else img.onload = start;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  // Dynamic grid based on stacks
  const gridColsClass =
    stacks.length === 2
      ? "grid-cols-1 md:grid-cols-2"
      : stacks.length === 3
      ? "grid-cols-1 md:grid-cols-3"
      : "grid-cols-1";

  // ---- Scroll logic for swipe hint + gradients ----
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    setShowLeftShadow(el.scrollLeft > 0);
    setShowRightShadow(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);

    if (showSwipeHint && el.scrollLeft > 5) {
      setShowSwipeHint(false);
    }
  }, [showSwipeHint]);

  const checkScrollable = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (el.scrollWidth > el.clientWidth) {
      setShowSwipeHint(true);
      setFadeHint(true);
    } else {
      setShowSwipeHint(false);
      setFadeHint(false);
    }
    // ensure gradients correct
    setTimeout(() => handleScroll(), 0);
  }, [handleScroll]);

  useEffect(() => {
    checkScrollable();
    const onResize = () => checkScrollable();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [checkScrollable, count]);

  useEffect(() => {
    if (!showSwipeHint) return;
    const timer = setTimeout(() => setFadeHint(false), 2500);
    const timerHide = setTimeout(() => setShowSwipeHint(false), 3200);
    return () => {
      clearTimeout(timer);
      clearTimeout(timerHide);
    };
  }, [showSwipeHint]);

  const stackCountLabel =
    stacks.length === 2
      ? "Comparing 2 stacks side by side"
      : stacks.length === 3
      ? "Comparing 3 stacks side by side"
      : "";

  return (
    <AnimatePresence>
      {stacks.length >= 2 && stacks.length <= 3 && (
        <motion.div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-16 sm:pt-20 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          // If you WANT outside click to close, uncomment this:
          // onClick={onClose}
        >
          {/* Modal container */}
          <motion.div
            className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-6xl mx-3 sm:mx-4 p-3 sm:p-5 flex flex-col max-h-[90vh] overflow-hidden text-slate-50"
            style={{ touchAction: "pan-y" }}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header / actions */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 sm:mb-4 flex-shrink-0">
              <div className="space-y-1">
                <h2 className="text-lg sm:text-xl font-semibold">Compare stacks</h2>
                {stackCountLabel && (
                  <p className="text-xs sm:text-sm text-slate-300">
                    {stackCountLabel}. Scroll horizontally on mobile to view all cards.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-auto">
                <button
                  type="button"
                  className="px-3 sm:px-4 py-2 rounded-xl border border-slate-600 bg-slate-800 text-slate-100 text-xs sm:text-sm font-medium hover:bg-slate-700 transition"
                  onClick={onClose}
                >
                  Close
                </button>

                <button
                  type="button"
                  className="px-3 sm:px-4 py-2 rounded-xl bg-[#46769B] text-white text-xs sm:text-sm font-semibold shadow-sm hover:brightness-110 transition"
                  onClick={() => stacks.forEach((_, idx) => runOCR(idx, true))}
                >
                  {loadingOCR.some(Boolean) ? `Scanning labels${dots}` : "Rescan labels"}
                </button>
              </div>
            </div>

            {/* Scrollable content area */}
            <div
              className="relative flex-1 overflow-auto"
              ref={scrollRef}
              onScroll={handleScroll}
            >
              {/* Left gradient */}
              {showLeftShadow && (
                <div
                  className="pointer-events-none absolute top-0 left-0 h-full w-6 z-10"
                  style={{
                    background:
                      "linear-gradient(to right, rgba(15,23,42,0.95), transparent)",
                  }}
                />
              )}
              {/* Right gradient */}
              {showRightShadow && (
                <div
                  className="pointer-events-none absolute top-0 right-0 h-full w-6 z-10"
                  style={{
                    background:
                      "linear-gradient(to left, rgba(15,23,42,0.95), transparent)",
                  }}
                />
              )}

              {/* Swipe hint */}
              {showSwipeHint && (
                <div
                  className={`pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-slate-200/70 text-[11px] sm:text-xs select-none z-20 rounded-full px-3 py-1 bg-slate-900/80 border border-slate-700/70 backdrop-blur-sm transition-opacity duration-500 ${
                    fadeHint ? "opacity-100" : "opacity-0"
                  }`}
                >
                  Swipe to view all stacks
                </div>
              )}

              {/* Cards grid */}
              <div className={`grid ${gridColsClass} gap-4 sm:gap-5 pr-4 sm:pr-6`}>
                {stacks.map((stack, idx) => {
                  const productImage =
                    getImageUrlForStack(stack) || "/fallback-image.svg";

                  const isScanning = Boolean(loadingOCR[idx]);
                  const bannedCount = Array.isArray(matchedRecordsArr[idx])
                    ? matchedRecordsArr[idx].length
                    : 0;

                  return (
                    <motion.div
                      key={stack.id || idx}
                      className="flex flex-col bg-slate-800 rounded-xl p-4 sm:p-5 shadow-md border border-slate-700/80 relative min-w-0"
                      whileHover={{ scale: 1.01 }}
                      transition={{ type: "spring", stiffness: 200, damping: 22 }}
                    >
                      {/* Header */}
                      <div className="min-w-0 mb-2">
                        <ModalHeader
                          stack={stack}
                          servingsNumber={getStackField(stack, "Servings")}
                          priceNumber={getStackField(stack, "Price")}
                          matchedRecords={matchedRecordsArr[idx]}
                          onClose={onClose}
                        />
                      </div>

                      {/* Image */}
                      <div className="mt-1 mb-3">
                        <div className="w-full rounded-lg bg-slate-900/60 border border-slate-700/70 flex items-center justify-center overflow-hidden">
                          <img
                            ref={(el) => (imageRefs.current[idx] = el)}
                            src={productImage}
                            alt={stack.name || `Stack ${idx + 1}`}
                            className="w-full h-44 sm:h-52 object-contain"
                            onError={(e) => {
                              e.currentTarget.src = "/fallback-image.svg";
                            }}
                          />
                        </div>
                      </div>

                      {/* Status line */}
                      <div className="flex items-center justify-between text-[11px] sm:text-xs mb-2 text-slate-300">
                        <span>
                          {bannedCount ? `${bannedCount} banned matches` : "No banned matches yet"}
                        </span>
                        <span className="text-slate-400">
                          {isScanning
                            ? `Scanning${dots}`
                            : ocrTexts[idx]
                            ? "Scan complete"
                            : "Waiting for scan"}
                        </span>
                      </div>

                      {/* Detected substances */}
                      <div className="mt-1 pointer-events-auto min-w-0">
                        {isScanning ? (
                          <p className="text-slate-300 text-xs sm:text-sm italic">
                            Reading label… this can take a few seconds.
                          </p>
                        ) : (
                          <DetectedSubstancesTab
                            matchedRecords={matchedRecordsArr[idx]}
                            hideCounts
                          />
                        )}
                      </div>

                      {/* Footer */}
                      <div className="mt-3">
                        <ModalFooter
                          affiliateLink={getStackField(stack, "affiliateLink")}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
