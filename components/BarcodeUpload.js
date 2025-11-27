// components/BarcodeUpload.jsx
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  BrowserMultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
} from "@zxing/library";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { X, Check, ScanLine } from "lucide-react";
import Cropper from "react-easy-crop";
import ProgressBar from "./ProgressBar";

// Lazy load live scanner (Beta)
const LiveBarcodeScanner = dynamic(() => import("./LiveBarcodeScanner"), {
  ssr: false,
});

// Tiny beep placeholder (you can swap this for a real sound if you want)
const BEEP_SRC =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

/**
 * Crop a File based on pixel cropRect and return a new File + dataUrl.
 * `cropRect`: { x, y, width, height } in image pixels.
 */
async function cropFileToRegion(file, cropRect) {
  return new Promise((resolve, reject) => {
    if (!cropRect || cropRect.width <= 0 || cropRect.height <= 0) {
      return reject(new Error("Invalid crop region"));
    }

    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target.result;
    };
    reader.onerror = (err) => reject(err);

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = cropRect.width;
        canvas.height = cropRect.height;
        const ctx = canvas.getContext("2d");

        ctx.drawImage(
          img,
          cropRect.x,
          cropRect.y,
          cropRect.width,
          cropRect.height,
          0,
          0,
          cropRect.width,
          cropRect.height
        );

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error("Crop failed: empty blob"));
            }
            const croppedFile = new File(
              [blob],
              file.name.replace(/(\.\w+)?$/, "_barcode_crop.jpg"),
              { type: "image/jpeg" }
            );
            const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
            resolve({ file: croppedFile, dataUrl });
          },
          "image/jpeg",
          0.95
        );
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (err) =>
      reject(err || new Error("Failed to load image for cropping"));

    reader.readAsDataURL(file);
  });
}

export default function BarcodeUpload({
  multiple = false,
  onResult,
  showScanButton = true,
  preferredFormats,
}) {
  // Core state
  const [files, setFiles] = useState([]);
  const [previewURLs, setPreviewURLs] = useState([]);
  const [athleteNames, setAthleteNames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [animDots, setAnimDots] = useState("");
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  // UI overlays
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [showLiveScanner, setShowLiveScanner] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [enableChime, setEnableChime] = useState(true);

  // Cropping state (in-component, matches OCRUpload style)
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropIndex, setCropIndex] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [aspectMode, setAspectMode] = useState("barcode"); // "barcode" | "free"
  const [croppedFlags, setCroppedFlags] = useState([]);

  // Scan progress (which file is currently being processed)
  const [currentScanIndex, setCurrentScanIndex] = useState(null);

  const fileInputRef = useRef(null);
  const audioRef = useRef(null);

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  // ZXing reader reuse
  const codeReaderRef = useRef(null);

  // OCR worker reuse
  const ocrWorkerRef = useRef(null);
  const ocrInitializingRef = useRef(false);

  // ---- EFFECTS ----

  useEffect(() => {
    audioRef.current =
      typeof Audio !== "undefined" ? new Audio(BEEP_SRC) : null;
  }, []);

  // animate dots while loading
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(
      () => setAnimDots((d) => (d.length >= 3 ? "" : d + ".")),
      450
    );
    return () => clearInterval(interval);
  }, [loading]);

  // cleanup object URLs
  useEffect(() => {
    return () => previewURLs.forEach((url) => URL.revokeObjectURL(url));
  }, [previewURLs]);

  // instantiate ZXing once
  useEffect(() => {
    try {
      codeReaderRef.current = new BrowserMultiFormatReader();
    } catch (err) {
      console.warn("Failed to create ZXing reader:", err);
      codeReaderRef.current = null;
    }
    return () => {
      try {
        codeReaderRef.current?.reset?.();
      } catch (e) {}
      codeReaderRef.current = null;
    };
  }, []);

  // ---- HELPERS ----

  // mapping for readable preferredFormats -> BarcodeFormat
  const NAME_TO_FORMAT = {
    AZTEC: BarcodeFormat.AZTEC,
    CODABAR: BarcodeFormat.CODABAR,
    CODE_39: BarcodeFormat.CODE_39,
    CODE_93: BarcodeFormat.CODE_93,
    CODE_128: BarcodeFormat.CODE_128,
    DATA_MATRIX: BarcodeFormat.DATA_MATRIX,
    EAN_8: BarcodeFormat.EAN_8,
    EAN_13: BarcodeFormat.EAN_13,
    ITF: BarcodeFormat.ITF,
    MAXICODE: BarcodeFormat.MAXICODE,
    PDF_417: BarcodeFormat.PDF_417,
    QR_CODE: BarcodeFormat.QR_CODE,
    RSS_14: BarcodeFormat.RSS_14,
    RSS_EXPANDED: BarcodeFormat.RSS_EXPANDED,
    UPC_A: BarcodeFormat.UPC_A,
    UPC_E: BarcodeFormat.UPC_E,
    UPC_EAN_EXTENSION: BarcodeFormat.UPC_EAN_EXTENSION,
  };

  const mapFormats = (arr = []) => {
    const out = [];
    for (const name of arr) {
      const n = ("" + name).toUpperCase();
      if (NAME_TO_FORMAT[n]) out.push(NAME_TO_FORMAT[n]);
    }
    return out;
  };

  const validateFile = (file) => {
    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed.");
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("File too large. Max 5 MB.");
      return false;
    }
    setError("");
    return true;
  };

  const resetCropState = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setAspectMode("barcode");
  };

  const handleFiles = (fileList) => {
    const valid = Array.from(fileList || []).filter(validateFile);
    if (!valid.length) return;

    // Revoke existing preview URLs
    previewURLs.forEach((url) => URL.revokeObjectURL(url));

    const urls = valid.map((f) => URL.createObjectURL(f));

    setFiles(valid);
    setPreviewURLs(urls);
    setAthleteNames(valid.map(() => ""));
    setCroppedFlags(valid.map(() => false));

    // Auto-open crop modal for the first file to encourage tight barcode capture
    resetCropState();
    setCropIndex(0);
    setShowCropModal(true);
  };

  const handleFileInputChange = (e) => handleFiles(e.target.files);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleNameChange = (idx, value) => {
    const names = [...athleteNames];
    names[idx] = value;
    setAthleteNames(names);
  };

  // Success beep + flash checkmark
  const playBeep = () => {
    if (!enableChime || !audioRef.current) return;
    try {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch (e) {
      // ignore
    }
  };

  // ---- OCR worker for numeric fallback ----

  const initOCRWorker = useCallback(async () => {
    if (ocrWorkerRef.current) return ocrWorkerRef.current;
    if (ocrInitializingRef.current) {
      // wait for existing init
      while (ocrInitializingRef.current && !ocrWorkerRef.current) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 100));
      }
      return ocrWorkerRef.current;
    }
    try {
      ocrInitializingRef.current = true;
      const tesseract = await import("tesseract.js");
      const worker = await tesseract.createWorker();
      await worker.load();
      await worker.loadLanguage("eng");
      await worker.initialize("eng");
      await worker.setParameters({
        tessedit_char_whitelist: "0123456789",
      });
      ocrWorkerRef.current = worker;
      ocrInitializingRef.current = false;
      return worker;
    } catch (err) {
      console.warn("OCR worker init failed:", err);
      ocrInitializingRef.current = false;
      return null;
    }
  }, []);

  async function performOCROnCanvas(canvas) {
    try {
      const worker = await initOCRWorker();
      if (!worker) return null;
      const { data } = await worker.recognize(canvas);
      if (!data || !data.text) return null;
      const digits = (data.text || "").replace(/\s+/g, "");
      const match = digits.match(/\d{8,14}/);
      return match ? match[0] : null;
    } catch (err) {
      console.warn("Tesseract OCR failed:", err);
      return null;
    }
  }

  // ---- Barcode decoding from File with resize / rotations / OCR ----

  async function decodeBarcodeFromFile(file) {
    try {
      // Use createImageBitmap where available
      let bitmap;
      try {
        bitmap = await createImageBitmap(file);
      } catch (err) {
        const dataUrl = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
        bitmap = await new Promise((res, rej) => {
          const img = new Image();
          img.onload = () => {
            const c = document.createElement("canvas");
            c.width = img.width;
            c.height = img.height;
            const ctx = c.getContext("2d");
            ctx.drawImage(img, 0, 0);
            createImageBitmap(c).then(res).catch(rej);
          };
          img.onerror = rej;
          img.src = dataUrl;
        });
      }

      const reader = codeReaderRef.current || new BrowserMultiFormatReader();

      // Preferred formats mapping (future: pass hints where supported)
      if (preferredFormats && Array.isArray(preferredFormats)) {
        try {
          const formats = mapFormats(preferredFormats);
          if (formats.length) {
            const hints = new Map();
            hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
            // Some ZXing builds use hints, kept here for forward compatibility.
          }
        } catch (e) {
          // ignore
        }
      }

      const MAX_SIDE = 1600;
      const rotations = [0, 90, 180, 270];
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));

      const preprocessCanvas = () => {
        try {
          const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const d = id.data;
          const contrast = 1.25;
          for (let i = 0; i < d.length; i += 4) {
            const r = d[i],
              g = d[i + 1],
              b = d[i + 2];
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            let v = (gray - 128) * contrast + 128;
            v = Math.max(0, Math.min(255, v));
            d[i] = d[i + 1] = d[i + 2] = v;
          }
          ctx.putImageData(id, 0, 0);
        } catch (err) {
          // ignore
        }
      };

      let lastErr = null;

      for (const rot of rotations) {
        try {
          if (rot % 180 === 0) {
            canvas.width = Math.round(bitmap.width * scale);
            canvas.height = Math.round(bitmap.height * scale);
          } else {
            canvas.width = Math.round(bitmap.height * scale);
            canvas.height = Math.round(bitmap.width * scale);
          }

          ctx.save();
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate((rot * Math.PI) / 180);
          ctx.drawImage(
            bitmap,
            -(bitmap.width * scale) / 2,
            -(bitmap.height * scale) / 2,
            bitmap.width * scale,
            bitmap.height * scale
          );
          ctx.restore();

          preprocessCanvas();

          const dataUrl = canvas.toDataURL("image/png");
          const tmpImg = new Image();
          // eslint-disable-next-line no-await-in-loop
          await new Promise((res, rej) => {
            tmpImg.onload = res;
            tmpImg.onerror = rej;
            tmpImg.src = dataUrl;
          });

          // eslint-disable-next-line no-await-in-loop
          const result = await reader.decodeFromImageElement(tmpImg);
          const barcodeText = result?.getText?.() || result?.text || "";
          try {
            reader.reset?.();
          } catch (e) {}

          if (barcodeText) {
            return barcodeText;
          }
        } catch (err) {
          lastErr = err;
          // continue to next rotation
        }
      }

      // ZXing failed → try numeric OCR fallback
      try {
        const ocrResult = await performOCROnCanvas(canvas);
        if (ocrResult) return ocrResult;
      } catch (e) {
        // ignore
      }

      throw lastErr || new Error("No barcode decoded from image.");
    } catch (err) {
      throw err;
    }
  }

  // ---- Server call: /api/check (barcode only, no image) ----

  async function fetchMatches(barcode) {
    const resp = await fetch("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Only send the numeric barcode here to avoid body size issues
      body: JSON.stringify({ barcode, isBarcodeFlow: true }),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => null);
      throw new Error(txt || `Barcode check failed with status ${resp.status}`);
    }
    return resp.json();
  }

  async function handleDecodedBarcodePipeline(barcodeText, idx = null) {
    setError("");
    if (!barcodeText || !/\d/.test(String(barcodeText))) {
      setError("Decoded value doesn't look like a barcode (no digits).");
      return;
    }

    setLoading(true);
    setProgress(5);
    try {
      setProgress(25);

      const data = await fetchMatches(barcodeText);

      console.log("[BarcodeUpload] API check response:", data);
      console.log("[BarcodeUpload] API debug:", data?.debug || null);

      setProgress(90);

      const result = {
        barcode: barcodeText,
        productName: data?.productName || "Unknown product",
        rawIngredients: data?.ocrText || "",
        matchedBanned: data?.matchedBanned || [],
        matchedIngredients: data?.matchedIngredients || [],
        source: data?.debug?.fetchedFrom || "providers",
        idx,
      };

      setShowSuccess(true);
      playBeep();
      setTimeout(() => setShowSuccess(false), 900);

      if (typeof onResult === "function") {
        await onResult(result);
      }

      setProgress(100);
      return result;
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to process barcode.");
      throw err;
    } finally {
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 350);
    }
  }

  const handleScanAllBarcodes = async () => {
    if (!files.length) return;
    setError("");
    setLoading(true);
    setProgress(10);

    for (let i = 0; i < files.length; i++) {
      try {
        setCurrentScanIndex(i);
        const code = await decodeBarcodeFromFile(files[i]);
        if (!code) throw new Error("No barcode decoded");
        await handleDecodedBarcodePipeline(code, i);
      } catch (err) {
        console.warn("Scan failed for index", i, err);
      }
    }

    setLoading(false);
    setProgress(0);
    setCurrentScanIndex(null);
  };

  // ---- Crop handlers (react-easy-crop) ----

  const onCropComplete = (_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  };

  const handleConfirmCrop = async () => {
    if (cropIndex == null || !croppedAreaPixels) {
      setShowCropModal(false);
      return;
    }
    try {
      const originalFile = files[cropIndex];
      if (!originalFile) {
        setShowCropModal(false);
        return;
      }

      const { file, dataUrl } = await cropFileToRegion(
        originalFile,
        croppedAreaPixels
      );

      setFiles((prev) => {
        const updated = [...prev];
        updated[cropIndex] = file;
        return updated;
      });

      setPreviewURLs((prev) => {
        const updated = [...prev];
        // revoke old URL
        if (updated[cropIndex]) {
          URL.revokeObjectURL(updated[cropIndex]);
        }
        updated[cropIndex] = dataUrl;
        return updated;
      });

      setCroppedFlags((prev) => {
        const updated = [...prev];
        updated[cropIndex] = true;
        return updated;
      });

      setShowCropModal(false);
    } catch (err) {
      console.error("Crop apply error:", err);
      setError("Could not crop image. Please try again or retake the photo.");
      setShowCropModal(false);
    }
  };

  const openCropForIndex = (idx) => {
    if (!previewURLs[idx]) return;
    resetCropState();
    setCropIndex(idx);
    setShowCropModal(true);
  };

  // Derived aspect value from mode
  let aspectValue;
  if (aspectMode === "barcode") {
    aspectValue = 5 / 2; // wide strip for barcodes
  } else {
    aspectValue = undefined; // free-form
  }

  // ---- RENDER ----

  return (
    <div className="mt-6 font-sans space-y-5">
      {/* Header / Steps */}
      <div className="max-w-3xl mx-auto flex flex-col gap-1">
        <div className="inline-flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-[#46769B]/30 bg-[#46769B]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#46769B]">
            Step 1 · Barcode Scan
          </span>
        </div>
        <h2 className="text-base sm:text-lg font-semibold text-gray-900">
          Scan a product barcode
        </h2>
        <p className="text-xs sm:text-sm text-gray-500">
          Use the live scanner for quick reads, or upload a photo and crop tightly
          around the barcode for maximum accuracy.
        </p>
      </div>

      {/* Upload card */}
      <div
        onClick={() => setShowChoiceModal(true)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center w-full max-w-3xl mx-auto px-6 py-6 border-2 border-dashed rounded-2xl cursor-pointer transition ${
          isDragging
            ? "border-[#46769B] bg-[#f0f5fa]"
            : "border-gray-300 bg-[#f7f9fc] hover:bg-[#edf3fb]"
        }`}
      >
        <span className="text-gray-900 text-center font-semibold text-sm sm:text-base">
          {files.length
            ? `${files.length} barcode photo${
                files.length > 1 ? "s" : ""
              } selected`
            : "Tap to scan a barcode (live camera or photo)"}
        </span>
        <span className="text-[11px] sm:text-xs text-gray-500 mt-1 text-center max-w-md">
          For best results, fill most of the frame with the barcode and its numbers. You
          can crop to just the barcode stripe before scanning.
        </span>
      </div>

      {/* Hidden File Input */}
      <input
        type="file"
        accept="image/*"
        multiple={multiple}
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Choice Modal */}
      <AnimatePresence>
        {showChoiceModal && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4 hover:shadow-2xl transition-shadow"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-semibold text-gray-800">
                  Scan Barcode
                </h2>
                <button
                  onClick={() => setShowChoiceModal(false)}
                  className="text-gray-400 hover:text-gray-700 transition"
                  aria-label="Close barcode scan options"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-gray-600 text-sm">
                Choose how you want to scan. Live scanning is fastest. Photo + crop
                gives the cleanest read if lighting is tricky.
              </p>
              <div className="flex flex-col gap-3 mt-2">
                <button
                  className="w-full bg-[#46769B] hover:bg-[#365b7a] text-white rounded-xl py-3 font-medium transition flex items-center justify-center gap-2 text-sm"
                  onClick={() => {
                    setShowChoiceModal(false);
                    setShowLiveScanner(true);
                  }}
                >
                  <ScanLine className="w-4 h-4" />
                  <span>Live Barcode Scanner</span>
                  <span className="ml-1 text-[10px] uppercase tracking-wide bg-white/10 px-1.5 py-0.5 rounded-full border border-white/30">
                    Beta
                  </span>
                </button>
                <button
                  className="w-full border border-gray-300 rounded-xl py-3 font-medium text-gray-700 hover:bg-gray-50 transition text-sm"
                  onClick={() => {
                    setShowChoiceModal(false);
                    fileInputRef.current?.click();
                  }}
                >
                  Take Photo / Upload
                </button>
              </div>
              <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                Tip: If the live scanner struggles (glare, tiny barcode), take a photo,
                crop tightly around the barcode, and scan from that.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Scanner (Beta) */}
      <AnimatePresence>
        {showLiveScanner && (
          <motion.div
            className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-4 relative">
              <button
                className="absolute top-3 right-3 text-gray-600 hover:text-black"
                onClick={() => setShowLiveScanner(false)}
                aria-label="Close live barcode scanner"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="mb-3">
                <p className="text-xs font-medium text-orange-500 uppercase tracking-wide">
                  Live Scanner · Beta
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Hold the barcode in the frame. The scanner will continuously refocus
                  and read. We will notify you as soon as we get a clean scan.
                </p>
              </div>
              <LiveBarcodeScanner
                onDetected={(code) => {
                  setShowLiveScanner(false);
                  handleDecodedBarcodePipeline(code);
                }}
                preferredFormats={preferredFormats}
                enableBeep
                enableFlash
                enableOCRFallback
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Crop modal (matches OCRUpload style, but tuned for barcodes) */}
      {showCropModal && cropIndex != null && previewURLs[cropIndex] && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md bg-neutral-900 rounded-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
              <div className="flex flex-col">
                <h2 className="text-sm font-semibold text-white">
                  Crop Barcode Area
                </h2>
                <p className="text-[11px] text-neutral-400">
                  Drag the box along the barcode stripe and its numbers. Use the zoom
                  slider if needed.
                </p>
              </div>
              <button
                onClick={() => setShowCropModal(false)}
                className="text-neutral-400 hover:text-white text-lg leading-none"
                aria-label="Close crop"
              >
                ×
              </button>
            </div>

            {/* Cropper */}
            <div className="relative w-full h-[58vh] bg-black">
              <Cropper
                image={previewURLs[cropIndex]}
                crop={crop}
                zoom={zoom}
                aspect={aspectValue}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                showGrid={false}
              />
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-3 px-4 py-3 bg-neutral-900 border-t border-neutral-800">
              {/* Presets */}
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setAspectMode("barcode")}
                  className={`flex-1 px-3 py-1.5 rounded-xl text-[11px] font-medium border ${
                    aspectMode === "barcode"
                      ? "border-sky-400 bg-sky-500/10 text-sky-200"
                      : "border-neutral-700 text-neutral-200 hover:bg-neutral-800"
                  }`}
                >
                  Barcode Stripe
                </button>
                <button
                  type="button"
                  onClick={() => setAspectMode("free")}
                  className={`flex-1 px-3 py-1.5 rounded-xl text-[11px] font-medium border ${
                    aspectMode === "free"
                      ? "border-amber-400 bg-amber-500/10 text-amber-200"
                      : "border-neutral-700 text-neutral-200 hover:bg-neutral-800"
                  }`}
                >
                  Free Crop
                </button>
              </div>

              {/* Zoom slider */}
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-neutral-300 w-12">
                  Zoom
                </span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 accent-[#46769B]"
                  aria-label="Crop zoom"
                />
                <span className="text-[11px] text-neutral-400 w-10 text-right">
                  {zoom.toFixed(1)}x
                </span>
              </div>

              <button
                onClick={handleConfirmCrop}
                className="mt-1 w-full px-4 py-2.5 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:bg-[#365b7a] transition shadow-sm"
              >
                Use Crop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview + per-file controls */}
      {files.map((file, idx) => (
        <div
          key={idx}
          className="flex flex-col items-start space-y-2 max-w-3xl mx-auto bg-white rounded-2xl border border-gray-200 p-3 shadow-sm"
        >
          <div className="flex items-center justify-between w-full gap-3">
            <div className="flex flex-col">
              <span className="font-medium text-gray-800 truncate text-xs sm:text-sm">
                {file.name || `Barcode photo ${idx + 1}`}
              </span>
              <span className="text-[10px] text-gray-400">
                Barcode {idx + 1} of {files.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => openCropForIndex(idx)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Crop Barcode
            </button>
          </div>

          <label className="w-full text-[11px] text-gray-600">
            Athlete or Team Name (optional)
            <input
              type="text"
              placeholder=""
              value={athleteNames[idx]}
              onChange={(e) => handleNameChange(idx, e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#46769B] focus:border-transparent"
            />
          </label>

          <img
            src={previewURLs[idx]}
            alt="Barcode preview"
            className="max-h-48 w-full rounded-xl border border-gray-200 shadow-md object-contain mt-1 bg-white"
            loading="lazy"
          />

          <div className="flex items-center justify-between w-full mt-1">
            <p className="text-xs text-gray-500 max-w-xs">
              Make sure only the barcode and its numbers are visible. Use the crop tool
              to remove extra packaging or labels.
            </p>
            {croppedFlags[idx] && (
              <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                Cropped
              </span>
            )}
          </div>
        </div>
      ))}

      {/* Info / legal text */}
      <div className="flex items-center justify-between max-w-3xl mx-auto">
        <div className="text-[11px] sm:text-xs text-gray-500">
          Photos stay on your device for decoding. Only the barcode digits are sent to
          our servers to look up products and ingredients.
        </div>
      </div>

      {error && (
        <p className="text-red-500 text-center text-sm mt-1 max-w-3xl mx-auto bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {loading && (
        <div className="max-w-3xl mx-auto space-y-2">
          <ProgressBar progress={progress} scanning={loading} />
          {currentScanIndex != null && (
            <p className="text-[11px] text-gray-500 text-right">
              Scanning barcode {currentScanIndex + 1} of {files.length}
              {animDots}
            </p>
          )}
        </div>
      )}

      {showScanButton && (
        <div className="max-w-3xl mx-auto flex justify-end">
          <button
            onClick={handleScanAllBarcodes}
            disabled={!files.length || loading}
            className={`w-full md:w-auto px-6 py-3 rounded-2xl font-medium text-white shadow-md transition text-sm sm:text-base ${
              !files.length || loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-[#46769B] hover:bg-[#365b7a]"
            }`}
          >
            {loading
              ? currentScanIndex != null
                ? `Scanning ${currentScanIndex + 1} of ${files.length}${animDots}`
                : `Scanning${animDots}`
              : multiple
              ? "Scan All Barcodes"
              : "Scan Barcode"}
          </button>
        </div>
      )}

      {/* Success checkmark */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.22 }}
            className="fixed bottom-8 right-8 z-50"
          >
            <div className="bg-white/90 backdrop-blur-md p-3 rounded-full shadow-lg border border-gray-200">
              <Check className="w-6 h-6 text-green-600" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
