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
  const [matchedRecordsArr, setMatchedRecordsArr] = useState(stacks.map(() => []));
  const animDots = useRef(stacks.map(() => 0));
  const imageRefs = useRef(stacks.map(() => null));

  // Animate OCR dots while scanning
  useEffect(() => {
    if (!loadingOCR.some(Boolean)) return;
    const interval = setInterval(() => {
      animDots.current = animDots.current.map((v) => (v + 1) % 4);
      setOcrTexts((prev) => [...prev]);
    }, 500);
    return () => clearInterval(interval);
  }, [loadingOCR]);

  const getStackField = (stack, field, fallback = "") =>
    stack?.[field] ?? stack?.rawFields?.[field] ?? fallback;

  const runOCR = async (idx) => {
    const stack = stacks[idx];
    if (!stack) return;
    const img = imageRefs.current[idx];
    if (!img) return;

    const imageUrl = getStackField(stack, "nutritionLabel") || getStackField(stack, "image");
    if (!imageUrl) return;

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
    const imageUrl = getStackField(stack, "nutritionLabel") || getStackField(stack, "image");
    if (!text) return;

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

      // <-- Use matchedBanned from API
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

  // Initial OCR on mount
  useEffect(() => {
    stacks.forEach((_, idx) => {
      const img = imageRefs.current[idx];
      if (img?.complete) runOCR(idx);
      else if (img) img.onload = () => runOCR(idx);
    });
  }, [stacks]);

  // Dynamic grid based on stacks
  const gridColsClass =
    stacks.length === 2
      ? "grid-cols-1 md:grid-cols-2"
      : stacks.length === 3
      ? "grid-cols-1 md:grid-cols-3"
      : "grid-cols-1";

  return (
    <AnimatePresence>
      {stacks.length >= 2 && stacks.length <= 3 && (
        <motion.div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-start pt-20 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div className="bg-gray-900 rounded-2xl shadow-xl w-full max-w-6xl mx-4 p-6 overflow-y-auto max-h-[90vh] space-y-6">
            
            {/* Top Actions */}
            <div className="flex justify-end gap-4 mb-4">
              <button
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-2xl text-white font-medium"
                onClick={onClose}
              >
                Close
              </button>
              <button
                className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-2xl text-white font-medium"
                onClick={() => stacks.forEach((_, idx) => runOCR(idx))}
              >
                {loadingOCR.some(Boolean) ? "Scanning..." : "Rescan Labels"}
              </button>
            </div>

            {/* Stacks Grid */}
            <div className={`grid ${gridColsClass} gap-6`}>
              {stacks.map((stack, idx) => {
                const productImage =
                  getStackField(stack, "nutritionLabel") || getStackField(stack, "image") || "/fallback-image.svg";

                return (
                  <motion.div
                    key={stack.id || idx}
                    className="flex flex-col bg-gray-800 rounded-xl p-4 shadow-md"
                    whileHover={{ boxShadow: "0 0 20px 4px #00ffcc", scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  >
                    <ModalHeader
                      stack={stack}
                      servingsNumber={getStackField(stack, "servings")}
                      priceNumber={getStackField(stack, "price")}
                      matchedRecords={matchedRecordsArr[idx]}
                      onClose={onClose}
                    />

                    <img
                      ref={(el) => (imageRefs.current[idx] = el)}
                      src={productImage}
                      alt={stack.name}
                      className="w-full h-48 object-cover rounded-lg my-3"
                      onError={(e) => (e.currentTarget.src = "/fallback-image.svg")}
                    />

                    <div className="mt-2">
                      {loadingOCR[idx] ? (
                        <p className="text-gray-400 text-sm animate-pulse">
                          Scanning{".".repeat(animDots.current[idx])}
                        </p>
                      ) : (
                        <DetectedSubstancesTab matchedRecords={matchedRecordsArr[idx]} hideCounts />
                      )}
                    </div>

                    <ModalFooter affiliateLink={getStackField(stack, "affiliateLink")} />
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
