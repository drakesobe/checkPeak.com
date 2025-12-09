// components/Modal/CompareModal.jsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DetectedSubstancesTab from "./DetectedSubstancesTab";
import ModalHeader from "./ModalHeader";
import ModalFooter from "./ModalFooter";

const ocrCache = {};
const recordsCache = {};

export default function CompareModal({ stacks = [], onClose }) {
  const [loadingOCR, setLoadingOCR] = useState(stacks.map(() => false));
  const [ocrTexts, setOcrTexts] = useState(stacks.map(() => ""));
  const [matchedRecordsArr, setMatchedRecordsArr] = useState(
    stacks.map(() => [])
  );
  const animDots = useRef(stacks.map(() => 0));
  const imageRefs = useRef(stacks.map(() => null));

  // Scroll / swipe hint state
  const scrollRef = useRef(null);
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const [fadeHint, setFadeHint] = useState(false);

  const getStackField = (stack, field, fallback = "") =>
    stack?.[field] ?? stack?.rawFields?.[field] ?? fallback;

  // Animate OCR dots while scanning
  useEffect(() => {
    if (!loadingOCR.some(Boolean)) return;
    const interval = setInterval(() => {
      animDots.current = animDots.current.map((v) => (v + 1) % 4);
      // trigger re-render
      setOcrTexts((prev) => [...prev]);
    }, 500);
    return () => clearInterval(interval);
  }, [loadingOCR]);

  const runOCR = async (idx) => {
    const stack = stacks[idx];
    if (!stack) return;

    const img = imageRefs.current[idx];
    if (!img) return;

    const imageUrl =
      getStackField(stack, "nutritionLabel") || getStackField(stack, "image");
    if (!imageUrl) return;

    // If we already have OCR cached for this image, reuse it + fetch records
    if (ocrCache[imageUrl]) {
      const cachedText = ocrCache[imageUrl];
      setOcrTexts((prev) => {
        const updated = [...prev];
        updated[idx] = cachedText;
        return updated;
      });
      await fetchRecords(idx, cachedText);
      return;
    }

    setLoadingOCR((prev) => {
      const updated = [...prev];
      updated[idx] = true;
      return updated;
    });

    try {
      const Tesseract = (await import("tesseract.js")).default;
      const result = await Tesseract.recognize(img, "eng", { logger: () => {} });
      const text = (result?.data?.text || "").trim() || "No OCR text detected.";
      ocrCache[imageUrl] = text;

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
    }
  };

  const fetchRecords = async (idx, text) => {
    const stack = stacks[idx];
    const imageUrl =
      getStackField(stack, "nutritionLabel") || getStackField(stack, "image");

    if (!text) return;

    // Use cache if available
    if (recordsCache[imageUrl]) {
      setMatchedRecordsArr((prev) => {
        const updated = [...prev];
        updated[idx] = recordsCache[imageUrl];
        return updated;
      });
      return;
    }

    try {
      const res = await fetch("/api/check-smartstack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ocrText: text }),
      });
      const data = await res.json();

      const recs = data?.matchedBanned || [];
      recordsCache[imageUrl] = recs;

      setMatchedRecordsArr((prev) => {
        const updated = [...prev];
        updated[idx] = recs;
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
  };

  // Run OCR for all stacks on mount (image onload-aware)
  useEffect(() => {
    stacks.forEach((_, idx) => {
      const img = imageRefs.current[idx];
      if (!img) return;
      if (img.complete) runOCR(idx);
      else {
        img.onload = () => runOCR(idx);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stacks]);

  // Dynamic grid based on stacks
  const gridColsClass =
    stacks.length === 2
      ? "grid-cols-1 md:grid-cols-2"
      : stacks.length === 3
      ? "grid-cols-1 md:grid-cols-3"
      : "grid-cols-1";

  // ---- Scroll logic for swipe hint + gradients ----
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;

    setShowLeftShadow(el.scrollLeft > 0);
    setShowRightShadow(
      el.scrollLeft < el.scrollWidth - el.clientWidth - 1
    );

    if (showSwipeHint && el.scrollLeft > 5) {
      setShowSwipeHint(false);
    }
  };

  const checkScrollable = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollWidth > el.clientWidth) {
      setShowSwipeHint(true);
      setFadeHint(true);
    } else {
      setShowSwipeHint(false);
      setFadeHint(false);
    }
    handleScroll();
  };

  useEffect(() => {
    checkScrollable();
    const onResize = () => checkScrollable();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stacks]);

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
        >
          {/* Modal container */}
          <motion.div
            className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-6xl mx-3 sm:mx-4 p-3 sm:p-5 flex flex-col max-h-[90vh] overflow-hidden text-slate-50"
            style={{ touchAction: "pan-y" }}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header / actions */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 sm:mb-4 flex-shrink-0">
              <div className="space-y-1">
                <h2 className="text-lg sm:text-xl font-semibold">
                  Compare stacks
                </h2>
                {stackCountLabel && (
                  <p className="text-xs sm:text-sm text-slate-300">
                    {stackCountLabel}. Scroll horizontally on mobile to view all
                    cards.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-auto">
                <button
                  className="px-3 sm:px-4 py-2 rounded-xl border border-slate-600 bg-slate-800 text-slate-100 text-xs sm:text-sm font-medium hover:bg-slate-700 transition"
                  onClick={onClose}
                >
                  Close
                </button>
                <button
                  className="px-3 sm:px-4 py-2 rounded-xl bg-[#46769B] text-white text-xs sm:text-sm font-semibold shadow-sm hover:brightness-110 transition"
                  onClick={() => stacks.forEach((_, idx) => runOCR(idx))}
                >
                  {loadingOCR.some(Boolean)
                    ? "Scanning labels..."
                    : "Rescan labels"}
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
                    getStackField(stack, "nutritionLabel") ||
                    getStackField(stack, "image") ||
                    "/fallback-image.svg";

                  const isScanning = loadingOCR[idx];

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
                            alt={stack.name}
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
                          {matchedRecordsArr[idx]?.length
                            ? `${matchedRecordsArr[idx].length} banned matches`
                            : "No banned matches yet"}
                        </span>
                        <span className="text-slate-400">
                          {isScanning
                            ? `Scanning${".".repeat(
                                animDots.current[idx] || 0
                              )}`
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
