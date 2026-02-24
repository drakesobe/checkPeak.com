"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaChevronDown, FaChevronUp, FaTimes } from "react-icons/fa";

/**
 * ModalContainerSmartstack.jsx
 *
 * Self-contained modal that:
 *  - Shows nutrition label image (if available)
 *  - Runs OCR (tesseract) on the image and caches results per image URL
 *  - Calls /api/check-smartstack with OCR text and caches responses
 *  - Displays matched banned substances and matched ingredients (from API)
 *  - Re-runs OCR & API whenever a different `stack` (card) is opened
 *  - Provides debug output and highlighted "All" text view
 *
 * Props:
 *  - stack: the selected product/stack object (may contain fields: id, name, nutritionLabel, rawFields, servings, price, affiliateLink)
 *  - allStacks: (optional) array of stacks (for header nav if desired)
 *  - onClose: function to close modal
 */

/* -------------------------
   Module-scoped simple caches
   keyed by imageUrl so repeated opens are fast
   ------------------------- */
const OCR_CACHE = {};
const RECORDS_CACHE = {};
const LOADING_CACHE = {}; // prevent duplicate concurrent OCRs

/* -------------------------
   Small helpers
   ------------------------- */
const parseNumber = (v) => {
  if (v == null) return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const cleaned = String(v || "").replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return isFinite(n) ? n : 0;
};

const escapeRegex = (s = "") => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function safeGet(obj, ...keys) {
  for (const k of keys) {
    if (!obj) continue;
    const v = obj?.fields?.[k] ?? obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
}

function splitSynonyms(s = "") {
  return String(s)
    .split(/[;,\/\|\(\)\[\]\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/* -------------------------
   Internal small components
   ------------------------- */

function ModalHeader({ stack, servingsNumber, priceNumber }) {
  return (
    <div className="pb-3 border-b border-gray-700">
      <div className="flex items-start gap-4 justify-between">
        {/* Right padding so header text never collides with the fixed close button on mobile */}
        <div className="pr-14">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">{stack?.name || "Product"}</h2>
            <div className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded">{stack?.category || ""}</div>
          </div>

          <div className="text-sm text-gray-300 mt-1">
            <span className="mr-3">
              Servings: <strong className="text-white">{servingsNumber || "N/A"}</strong>
            </span>
            <span>
              Price: <strong className="text-white">{priceNumber ? priceNumber.toFixed(2) : "N/A"}</strong>
            </span>
          </div>
        </div>

        {/* Empty right side; close is fixed */}
        <div className="w-0" />
      </div>
    </div>
  );
}

function ModalTabs({ activeTab, setActiveTab }) {
  return (
    <div className="mt-4">
      <nav className="flex gap-2">
        {[
          { key: "detected", label: "Detected" },
          { key: "all", label: "All Text" },
          { key: "debug", label: "Debug" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              activeTab === t.key
                ? "bg-gray-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

/* -------------------------
   Main component
   ------------------------- */

export default function ModalContainerSmartstack({ stack, allStacks = [], onClose }) {
  // tabs + UI state
  const [activeTab, setActiveTab] = useState("detected");
  const [ocrText, setOcrText] = useState("");
  const [loadingOCR, setLoadingOCR] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [matchedBanned, setMatchedBanned] = useState([]); // normalized banned
  const [matchedIngredients, setMatchedIngredients] = useState([]); // normalized ingredients
  const [error, setError] = useState("");
  const [animDots, setAnimDots] = useState("");
  const [imageCollapsed, setImageCollapsed] = useState(true);
  const imageRef = useRef(null);
  const canvasRef = useRef(null);

  // derive imageUrl, affiliate link, servings, price (defensive)
  const imageUrl =
    stack?.nutritionLabel ||
    safeGet(stack, "Nutrition Label URL") ||
    stack?.image ||
    (stack?.rawFields && (stack.rawFields["Nutrition Label URL"] || stack.rawFields.Image)) ||
    "";

  const affiliateLink = stack?.affiliateLink || safeGet(stack, "Lo. Amazon/Stripe Link", "AffiliateLink") || "";

  const servingsNumber = parseNumber(safeGet(stack, "Servings")) || parseNumber(stack?.servings) || 0;
  const priceNumber = parseNumber(safeGet(stack, "Price")) || parseNumber(stack?.price) || 0;

  // animate dots when loading
  useEffect(() => {
    if (!loadingOCR && !loadingRecords) {
      setAnimDots("");
      return;
    }
    const id = setInterval(() => {
      setAnimDots((p) => (p.length >= 3 ? "" : p + "."));
    }, 450);
    return () => clearInterval(id);
  }, [loadingOCR, loadingRecords]);

  /* -------------------------
     OCR helpers: preprocess & run
     ------------------------- */

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

      // quick contrast stretch
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

      // detect dark region (likely label)
      let top = canvas.height,
        bottom = 0,
        left = canvas.width,
        right = 0;
      for (let y = 0; y < canvas.height; y += 2) {
        for (let x = 0; x < canvas.width; x += 2) {
          const idx = (y * canvas.width + x) * 4;
          const gray = imageData.data[idx];
          if (gray < 120) {
            if (x < left) left = x;
            if (x > right) right = x;
            if (y < top) top = y;
            if (y > bottom) bottom = y;
          }
        }
      }

      // fallback to full canvas if detection failed
      if (right - left < 20 || bottom - top < 20) return canvas;

      // crop and scale
      const cropW = right - left;
      const cropH = bottom - top;
      const scaleFactor = 2;
      const croppedCanvas = document.createElement("canvas");
      croppedCanvas.width = cropW * scaleFactor;
      croppedCanvas.height = cropH * scaleFactor;
      const cctx = croppedCanvas.getContext("2d");
      cctx.drawImage(canvas, left, top, cropW, cropH, 0, 0, croppedCanvas.width, croppedCanvas.height);

      // optional: attempt orientation detection & deskew via tesseract quickly
      try {
        const Tesseract = (await import("tesseract.js")).default;
        const orientation = await Tesseract.recognize(croppedCanvas, "eng", {
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
      } catch {
        // ignore orientation failures
      }

      return croppedCanvas;
    } catch (err) {
      console.warn("Preprocess failed:", err);
      return canvas;
    }
  };

  const fetchRecords = async (text) => {
    if (!text) return;
    if (!imageUrl) return;

    if (RECORDS_CACHE[imageUrl]) {
      const cached = RECORDS_CACHE[imageUrl];
      setMatchedBanned(cached.banned || []);
      setMatchedIngredients(cached.ingredients || []);
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
      if (!res.ok) throw new Error(data?.error || "API error");

      const rawBanned =
        data?.matchedBanned || data?.matched_banned || data?.matchedBannedRecords || data?.records || [];
      const rawIngredients =
        data?.matchedIngredients || data?.matched_ingredients || data?.ingredients || [];

      // normalize banned
      const normalizedBanned = (Array.isArray(rawBanned) ? rawBanned : [])
        .map((r) => {
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
        })
        .filter(Boolean);

      // normalize ingredients
      const normalizedIngredients = (Array.isArray(rawIngredients) ? rawIngredients : [])
        .map((r) => {
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
            benefits: r.Benefits || "",
            weaknesses: r.Weaknesses || "",
            nutrientAntagonism: r["Nutrient Antagonism"] || "",
            source: r.source || r.Source || "",
            _raw: r,
          };
        })
        .filter(Boolean);

      RECORDS_CACHE[imageUrl] = { banned: normalizedBanned, ingredients: normalizedIngredients };
      setMatchedBanned(normalizedBanned);
      setMatchedIngredients(normalizedIngredients);

      // If API returned an ocrText cleaned/normalized, use that for highlighting and caching
      if (data?.ocrText) {
        OCR_CACHE[imageUrl] = data.ocrText;
        setOcrText(data.ocrText);
      }
    } catch (err) {
      console.error("Failed to fetch records:", err);
      setError(String(err?.message || err));
      setMatchedBanned([]);
      setMatchedIngredients([]);
    } finally {
      setLoadingRecords(false);
    }
  };

  const runOCR = async (force = false) => {
    if (!imageUrl) {
      setOcrText("");
      setMatchedBanned([]);
      setMatchedIngredients([]);
      return;
    }

    const cachedText = OCR_CACHE[imageUrl];

    // if we already processed and not forced, and the cached text is not the bad placeholder, use cache
    if (!force && cachedText && cachedText !== "No OCR text detected.") {
      setOcrText(cachedText);
      if (RECORDS_CACHE[imageUrl]) {
        const cached = RECORDS_CACHE[imageUrl];
        setMatchedBanned(cached.banned || []);
        setMatchedIngredients(cached.ingredients || []);
      } else {
        await fetchRecords(cachedText);
      }
      return;
    }

    // prevent concurrent runs for same image
    if (LOADING_CACHE[imageUrl]) return;
    LOADING_CACHE[imageUrl] = true;
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
      OCR_CACHE[imageUrl] = text;
      setOcrText(text);
      await fetchRecords(text);
    } catch (err) {
      console.error("OCR Error:", err);
      setError("OCR failed — try a clearer image or re-open this modal.");
      const fallback = "No OCR text detected.";
      OCR_CACHE[imageUrl] = fallback;
      setOcrText(fallback);
      setMatchedBanned([]);
      setMatchedIngredients([]);
    } finally {
      setLoadingOCR(false);
      LOADING_CACHE[imageUrl] = false;
    }
  };

  /* -------------------------
     Run OCR when new stack image opens (or when imageUrl changes)
     We MUST rerun when user opens a different card/stack
     ------------------------- */
  useEffect(() => {
    // reset UI state for new stack
    setOcrText("");
    setMatchedBanned([]);
    setMatchedIngredients([]);
    setError("");
    setLoadingOCR(false);
    setLoadingRecords(false);
    setImageCollapsed(true);

    // clear any stale loading flag for this image
    if (imageUrl) {
      LOADING_CACHE[imageUrl] = false;
    }

    const cachedText = imageUrl ? OCR_CACHE[imageUrl] : null;

    // If we have GOOD cached text, hydrate UI from it and fetch records if needed
    if (imageUrl && cachedText && cachedText !== "No OCR text detected.") {
      setOcrText(cachedText);
      if (RECORDS_CACHE[imageUrl]) {
        const c = RECORDS_CACHE[imageUrl];
        setMatchedBanned(c.banned || []);
        setMatchedIngredients(c.ingredients || []);
      } else {
        fetchRecords(cachedText).catch(() => {});
      }
      return;
    }

    // If image is already loaded and cache is empty/bad, force OCR (same as Re-scan)
    const img = imageRef.current;
    if (imageUrl && img && (img.complete || img.naturalWidth)) {
      setTimeout(() => {
        runOCR(true).catch((e) => console.warn("Auto OCR (effect) failed:", e));
      }, 150);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stack?.id, imageUrl]);

  // handle image load event
  const handleImageLoad = () => {
    const cachedText = imageUrl ? OCR_CACHE[imageUrl] : null;

    setTimeout(() => {
      // If no cache or bad cache, behave like "Re-scan"
      if (!cachedText || cachedText === "No OCR text detected.") {
        runOCR(true).catch((e) => console.warn("Auto OCR (onLoad) failed:", e));
      } else if (!RECORDS_CACHE[imageUrl]) {
        // Good text cached but no records yet → just fetch records
        fetchRecords(cachedText).catch(() => {});
      }
    }, 150);
  };

  /* -------------------------
     Highlight helper for "All" tab
     returns React nodes (not dangerouslySetInnerHTML)
     ------------------------- */
  const highlightTextNodes = (text = "", banned = [], ingredients = []) => {
    if (!text) return null;

    // build list of {term, className, key}
    const terms = [];
    banned.forEach((b) => {
      if (b.name)
        terms.push({
          term: b.name,
          cls:
            b.banType === "Prohibited"
              ? "bg-red-600 text-white"
              : b.banType === "Limited to Out of Competition"
              ? "bg-orange-500 text-white"
              : "bg-blue-600 text-white",
          key: `b-${b.id}`,
        });
      if (b.synonyms)
        splitSynonyms(b.synonyms).forEach((s) =>
          terms.push({
            term: s,
            cls: "bg-red-600 text-white",
            key: `b-${b.id}-${s}`,
          })
        );
    });

    ingredients.forEach((i) => {
      if (i.name)
        terms.push({
          term: i.name,
          cls: "bg-purple-600 text-white",
          key: `i-${i.id}`,
        });
      if (i.synonyms)
        splitSynonyms(i.synonyms).forEach((s) =>
          terms.push({
            term: s,
            cls: "bg-purple-600 text-white",
            key: `i-${i.id}-${s}`,
          })
        );
    });

    // sort by length desc to avoid partial matches
    terms.sort((a, b) => b.term.length - a.term.length);

    let segments = [text];

    for (const { term, cls, key } of terms) {
      if (!term) continue;
      const esc = escapeRegex(term);
      const rx = new RegExp(`(${esc})`, "gi");

      segments = segments.flatMap((seg, segIdx) => {
        if (typeof seg !== "string") return [seg];
        const parts = seg.split(rx);
        if (parts.length === 1) return [seg];
        return parts.map((p, i) =>
          rx.test(p) ? (
            <span key={`${key}-${segIdx}-${i}`} className={`${cls} px-1 rounded`}>
              {p}
            </span>
          ) : (
            p
          )
        );
      });
    }

    return segments;
  };

  /* -------------------------
     Filtered and counts for banned
     ------------------------- */
  const [filter, setFilter] = useState("All");
  const severityMap = {
    Prohibited: 0,
    "Limited to Out of Competition": 1,
    Other: 2,
  };
  const filterColors = {
    All: "bg-gray-600 text-white",
    Prohibited: "bg-red-600 text-white",
    Limited: "bg-orange-500 text-white",
    Other: "bg-blue-600 text-white",
  };
  const counts = {
    Prohibited: matchedBanned.filter((r) => r.banType === "Prohibited").length,
    Limited: matchedBanned.filter((r) => r.banType === "Limited to Out of Competition").length,
    Other: matchedBanned.filter(
      (r) => !["Prohibited", "Limited to Out of Competition"].includes(r.banType)
    ).length,
    All: matchedBanned.length,
  };

  const filteredBanned = useMemo(() => {
    const arr = matchedBanned.slice();
    const filtered = arr.filter((rec) => {
      if (filter === "All") return true;
      if (filter === "Prohibited") return rec.banType === "Prohibited";
      if (filter === "Limited") return rec.banType === "Limited to Out of Competition";
      if (filter === "Other")
        return !["Prohibited", "Limited to Out of Competition"].includes(rec.banType);
      return true;
    });
    filtered.sort((a, b) => (severityMap[a.banType] ?? 2) - (severityMap[b.banType] ?? 2));
    return filtered;
  }, [matchedBanned, filter]);

  /* -------------------------
     Render
     ------------------------- */
  return (
    <AnimatePresence>
      {stack ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* ✅ Fixed close button (mobile-safe, always top-right) */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={[
              "fixed z-[60]",
              "top-[calc(env(safe-area-inset-top,0px)+12px)] right-4",
              "h-11 w-11 rounded-full",
              "grid place-items-center",
              "bg-gray-900/70 text-white",
              "border border-white/10",
              "shadow-lg shadow-black/30",
              "backdrop-blur",
              "active:scale-95 transition",
            ].join(" ")}
          >
            <FaTimes />
          </button>

          <motion.div
            className="bg-gray-800 rounded-xl p-6 max-w-5xl w-full relative overflow-hidden flex flex-col max-h-[92vh]"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {/* Mobile spacer so the fixed X doesn't overlap header */}
            <div className="h-10 sm:hidden" />

            <ModalHeader stack={stack} servingsNumber={servingsNumber} priceNumber={priceNumber} />

            <div className="mt-4 flex-1 overflow-auto pr-2">
              {/* top area: image + controls */}
              <div className="flex items-start gap-4 mb-4">
                {imageUrl ? (
                  <div className={`transition-all duration-200 ${imageCollapsed ? "w-44" : "w-1/3 md:w-1/2"}`}>
                    <div className={`overflow-hidden rounded-lg border border-gray-700 ${imageCollapsed ? "h-28" : "h-auto"}`}>
                      <img
                        ref={imageRef}
                        src={imageUrl}
                        alt={`${stack?.name || "Nutrition Label"}`}
                        className="object-contain w-full h-full"
                        crossOrigin="anonymous"
                        onLoad={handleImageLoad}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-28 bg-gray-700 rounded-lg flex items-center justify-center text-gray-400">
                    No Nutrition Image
                  </div>
                )}

                <div className="flex-1 flex items-center justify-end gap-3">
                  <button
                    className="px-3 py-1 bg-gray-700 rounded text-sm text-white hover:bg-gray-600"
                    onClick={() => setImageCollapsed((s) => !s)}
                  >
                    {imageCollapsed ? "Expand Image" : "Collapse Image"}
                  </button>

                  <a
                    className={`text-sm px-3 py-1 rounded ${
                      affiliateLink
                        ? "bg-green-600 text-white hover:bg-green-700"
                        : "bg-gray-700 text-gray-300 cursor-not-allowed"
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
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-500"
                    onClick={() => runOCR(true)}
                    title="Re-run OCR"
                  >
                    Re-scan
                  </button>
                </div>

                <canvas ref={canvasRef} style={{ display: "none" }} />
              </div>

              <ModalTabs activeTab={activeTab} setActiveTab={setActiveTab} />

              {/* Content */}
              <div className="mt-4">
                <AnimatePresence mode="wait">
                  {activeTab === "detected" && (
                    <motion.div
                      key={`detected-${stack?.id || "default"}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                    >
                      {/* Filter buttons */}
                      <div className="sticky top-0 z-10 bg-gray-800/60 py-2 px-1 rounded mb-3">
                        <div className="flex gap-2 items-center overflow-x-auto">
                          {["All", "Prohibited", "Limited", "Other"].map((f) => {
                            const isActive = filter === f;
                            const activeClass = filterColors[f];
                            const inactiveClass =
                              f === "All"
                                ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                : f === "Prohibited"
                                ? "bg-red-700 text-gray-200 hover:bg-red-600"
                                : f === "Limited"
                                ? "bg-orange-600 text-gray-200 hover:bg-orange-500"
                                : "bg-blue-700 text-gray-200 hover:bg-blue-600";

                            return (
                              <button
                                key={f}
                                className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 transition ${
                                  isActive ? activeClass : inactiveClass
                                }`}
                                onClick={() => setFilter(f)}
                              >
                                {f}
                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-white/10">
                                  {counts[f]}
                                </span>
                              </button>
                            );
                          })}

                          <div className="ml-auto text-sm text-gray-400 px-2">
                            Ingredients detected: <strong className="text-white">{matchedIngredients.length}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Banned list as cards */}
                      <div className="space-y-3">
                        {loadingOCR || loadingRecords ? (
                          <div className="text-center text-gray-300 py-6">
                            {loadingOCR && <p className="mb-2">Scanning label{animDots}</p>}
                            {loadingRecords && <p>Checking substances{animDots}</p>}
                          </div>
                        ) : filteredBanned.length > 0 ? (
                          filteredBanned.map((rec) => <BannedCard key={rec.id || rec.name} rec={rec} />)
                        ) : (
                          <p className="text-gray-400 text-sm italic text-center">
                            No banned or monitored substances detected for this filter.
                          </p>
                        )}
                      </div>

                      {/* Ingredients Detected section */}
                      <div className="pt-3 border-t border-white/6 mt-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-gray-200">Ingredients Detected</h3>
                          <div className="text-xs text-gray-400">{matchedIngredients.length} found</div>
                        </div>

                        {matchedIngredients.length > 0 ? (
                          <div className="grid gap-2">
                            {matchedIngredients.map((ing) => (
                              <IngredientCard key={ing.id || ing.name} ing={ing} />
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-400 text-sm italic">
                            No ingredients matched in the ingredients database.
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {activeTab === "all" && (
                    <motion.div
                      key={`all-${stack?.id || "default"}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="bg-gray-700 p-3 rounded-lg text-gray-200 text-sm whitespace-pre-wrap max-h-[50vh] overflow-auto"
                    >
                      {highlightTextNodes(ocrText || "No OCR text detected.", matchedBanned, matchedIngredients) ||
                        "No OCR text detected."}
                    </motion.div>
                  )}

                  {activeTab === "debug" && (
                    <motion.div
                      key={`debug-${stack?.id || "default"}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="bg-gray-900 p-3 rounded-lg text-xs text-gray-300 max-h-[50vh] overflow-auto"
                    >
                      <h4 className="font-semibold text-white mb-2">API Debug</h4>
                      <pre className="whitespace-pre-wrap">
                        {JSON.stringify(
                          {
                            ocrText,
                            matchedBannedCount: matchedBanned.length,
                            matchedIngredientsCount: matchedIngredients.length,
                          },
                          null,
                          2
                        )}
                      </pre>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {error ? (
                <div className="mt-4 rounded-lg border border-red-700/40 bg-red-900/20 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="mt-4 sticky bottom-0 bg-gray-800 pt-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-400">Results powered by your Airtable</div>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1 bg-gray-700 rounded text-sm text-white hover:bg-gray-600" onClick={() => runOCR(true)}>
                    Re-scan
                  </button>
                  <button
                    className="px-3 py-1 bg-green-600 rounded text-white text-sm hover:bg-green-500"
                    onClick={() => window.open(affiliateLink || "#", "_blank")}
                  >
                    Open product
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/* -------------------------
   Sub-components for cards
   ------------------------- */

function BannedCard({ rec }) {
  const [expanded, setExpanded] = useState(false);
  const cls =
    rec.banType === "Prohibited"
      ? "bg-red-600 text-white"
      : rec.banType === "Limited to Out of Competition"
      ? "bg-orange-500 text-white"
      : "bg-blue-600 text-white";

  return (
    <motion.div
      layout
      className="bg-gray-700 p-3 rounded-lg text-sm text-white flex flex-col shadow-sm cursor-pointer"
      onClick={() => setExpanded((s) => !s)}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{rec.name || "Unnamed Substance"}</span>
            {rec.banType && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{rec.banType}</span>
            )}
          </div>
          {rec.synonyms && <div className="text-xs text-gray-300 mt-1 truncate">Synonyms: {rec.synonyms}</div>}
        </div>
        <div className="flex-shrink-0 text-gray-300 pl-2">
          {expanded ? <FaChevronUp className="text-gray-400" /> : <FaChevronDown className="text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.14 }}
          className="mt-2 text-gray-300 text-xs space-y-1"
        >
          {rec.synonyms && (
            <p>
              <span className="font-semibold">Synonyms:</span> {rec.synonyms}
            </p>
          )}
          {rec.bannedBy && (
            <p>
              <span className="font-semibold">Banned By:</span> {rec.bannedBy}
            </p>
          )}
          {rec.dosageLimit && (
            <p>
              <span className="font-semibold">Dosage Limit:</span> {rec.dosageLimit}
            </p>
          )}
          {rec.notes && (
            <p>
              <span className="font-semibold">Notes:</span> {rec.notes}
            </p>
          )}
          {rec.Benefits && (
            <p>
              <span className="font-semibold">Benefits:</span> {rec.Benefits}
            </p>
          )}
          {rec.Weaknesses && (
            <p>
              <span className="font-semibold">Weaknesses:</span> {rec.Weaknesses}
            </p>
          )}
          {rec.NutrientAntagonism && (
            <p>
              <span className="font-semibold">Nutrient Antagonism:</span> {rec.NutrientAntagonism}
            </p>
          )}
          {rec.source && (
            <p>
              <span className="font-semibold">Source:</span> {rec.source}
            </p>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

function IngredientCard({ ing }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      layout
      className="bg-gray-800 p-3 rounded-lg text-sm text-gray-100 flex flex-col cursor-pointer"
      onClick={() => setExpanded((s) => !s)}
    >
      <div className="flex justify-between items-center">
        <div className="min-w-0">
          <div className="font-medium truncate">{ing.name || "Unnamed Ingredient"}</div>
          {ing.synonyms && <div className="text-xs text-gray-300 truncate mt-1">Synonyms: {ing.synonyms}</div>}
        </div>
        <div className="flex-shrink-0 pl-2">
          {expanded ? <FaChevronUp className="text-gray-400" /> : <FaChevronDown className="text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.12 }}
          className="mt-2 text-gray-300 text-xs space-y-1"
        >
          {ing.notes && (
            <p>
              <span className="font-semibold">Notes:</span> {ing.notes}
            </p>
          )}
          {ing.benefits && (
            <p>
              <span className="font-semibold">Benefits:</span> {ing.benefits}
            </p>
          )}
          {ing.weaknesses && (
            <p>
              <span className="font-semibold">Weaknesses:</span> {ing.weaknesses}
            </p>
          )}
          {ing.nutrientAntagonism && (
            <p>
              <span className="font-semibold">Nutrient Antagonism:</span> {ing.nutrientAntagonism}
            </p>
          )}
          {ing.source && (
            <p>
              <span className="font-semibold">Source:</span> {ing.source}
            </p>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}