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
import { X, Check, Crop as CropIcon, ScanLine } from "lucide-react";
import ProgressBar from "./ProgressBar";
import BarcodeCropModal from "./BarcodeCropModal";

// Lazy load live scanner (Beta)
const LiveBarcodeScanner = dynamic(() => import("./LiveBarcodeScanner"), {
  ssr: false,
});

// Tiny beep placeholder (you can swap this for a real sound if you want)
const BEEP_SRC =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

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

  // Cropping state
  const [cropSourceUrl, setCropSourceUrl] = useState(null); // URL to crop
  const [pendingFileIndex, setPendingFileIndex] = useState(null); // which file is being cropped

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

  const handleFiles = (fileList) => {
    const valid = Array.from(fileList || []).filter(validateFile);
    if (!valid.length) return;

    const urls = valid.map((f) => URL.createObjectURL(f));

    setFiles(valid);
    setPreviewURLs(urls);
    setAthleteNames(valid.map(() => ""));

    // Immediately open cropper on the first file to encourage tight barcode capture
    setPendingFileIndex(0);
    setCropSourceUrl(urls[0]);
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

      // We still map formats (future: could feed hints into ZXing if supported)
      if (preferredFormats && Array.isArray(preferredFormats)) {
        try {
          const formats = mapFormats(preferredFormats);
          if (formats.length) {
            const hints = new Map();
            hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
            // Some ZXing builds allow hints in ctor; keeping this for future use.
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
      // We only send the numeric barcode here to avoid 1MB body issues
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
        const code = await decodeBarcodeFromFile(files[i]);
        if (!code) throw new Error("No barcode decoded");
        await handleDecodedBarcodePipeline(code, i);
      } catch (err) {
        console.warn("Scan failed for index", i, err);
      }
    }

    setLoading(false);
    setProgress(0);
  };

  // ---- Crop handlers ----

  const handleCropCancel = () => {
    setCropSourceUrl(null);
    setPendingFileIndex(null);
  };

  const handleCropDone = (result) => {
    // result: { file, blob, dataUrl }
    if (pendingFileIndex == null) return;

    setFiles((prev) => {
      const updated = [...prev];
      updated[pendingFileIndex] = result.file;
      return updated;
    });

    setPreviewURLs((prev) => {
      const updated = [...prev];
      updated[pendingFileIndex] = result.dataUrl;
      return updated;
    });

    setCropSourceUrl(null);
    setPendingFileIndex(null);
  };

  // ---- RENDER ----

  return (
    <div className="mt-6 font-sans space-y-4">
      {/* Upload Box */}
      <div
        onClick={() => setShowChoiceModal(true)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center w-full max-w-3xl mx-auto px-6 py-6 border-2 border-dashed rounded-2xl cursor-pointer transition ${
          isDragging
            ? "border-blue-400 bg-blue-50"
            : "border-gray-300 bg-gray-50 hover:bg-gray-100"
        }`}
      >
        <span className="text-gray-600 text-center font-medium">
          {files.length
            ? `${files.length} file${files.length > 1 ? "s" : ""} selected`
            : "Tap to scan a barcode (camera or gallery)"}
        </span>
        <span className="text-xs text-gray-400 mt-1">
          Best results: fill the frame with the barcode, then crop tightly.
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
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-xl w-80 p-6 space-y-4 hover:shadow-2xl transition-shadow"
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
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-gray-600 text-sm">
                Choose how you want to scan. Live is great for quick hits.
                Photo + crop is best for precision.
              </p>
              <div className="flex flex-col gap-3 mt-2">
                <button
                  className="w-full bg-[#46769B] hover:bg-[#365b7a] text-white rounded-xl py-3 font-medium transition flex items-center justify-center gap-2"
                  onClick={() => {
                    setShowChoiceModal(false);
                    setShowLiveScanner(true);
                  }}
                >
                  <ScanLine className="w-4 h-4" />
                  Live Barcode Scanner
                  <span className="ml-1 text-[11px] uppercase tracking-wide bg-white/10 px-1.5 py-0.5 rounded-full border border-white/30">
                    Beta
                  </span>
                </button>
                <button
                  className="w-full border border-gray-300 rounded-xl py-3 font-medium text-gray-700 hover:bg-gray-50 transition"
                  onClick={() => {
                    setShowChoiceModal(false);
                    fileInputRef.current?.click();
                  }}
                >
                  Take Photo / Upload
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Scanner (Beta) */}
      <AnimatePresence>
        {showLiveScanner && (
          <motion.div
            className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="bg-white rounded-2xl shadow-xl w-[90%] max-w-md p-4 relative">
              <button
                className="absolute top-3 right-3 text-gray-600 hover:text-black"
                onClick={() => setShowLiveScanner(false)}
              >
                <X className="w-6 h-6" />
              </button>
              <div className="mb-3">
                <p className="text-xs font-medium text-orange-500 uppercase tracking-wide">
                  Live Scanner · Beta
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Hold the barcode in the frame. We&apos;ll auto-detect and
                  vibrate when we get a clean read.
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

      {/* Preview + per-file controls */}
      {files.map((file, idx) => (
        <div
          key={idx}
          className="flex flex-col items-start space-y-2 max-w-3xl mx-auto bg-white/70 rounded-2xl border border-gray-200 p-3 shadow-sm"
        >
          <div className="flex items-center justify-between w-full gap-3">
            <span className="font-medium text-gray-800 truncate">
              {file.name || `Barcode photo ${idx + 1}`}
            </span>
            <button
              type="button"
              onClick={() => {
                setPendingFileIndex(idx);
                setCropSourceUrl(previewURLs[idx]);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold border border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              <CropIcon className="w-3.5 h-3.5" />
              Crop Barcode
            </button>
          </div>

          <input
            type="text"
            placeholder="Athlete or Team Name (optional)"
            value={athleteNames[idx]}
            onChange={(e) => handleNameChange(idx, e.target.value)}
            className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

          <img
            src={previewURLs[idx]}
            alt="Preview"
            className="max-h-48 w-full rounded-xl border border-gray-200 shadow-md object-contain mt-1 bg-white"
            loading="lazy"
          />

          <p className="text-xs text-gray-500">
            Tip: make sure only the barcode &amp; its numbers are visible. Use
            the Crop button above for best accuracy.
          </p>
        </div>
      ))}

      {/* Small tip / controls row */}
      <div className="flex items-center justify-between max-w-3xl mx-auto">
        <div className="text-xs text-gray-500">
          Photos are kept on-device for decoding. We only send the barcode
          digits to our servers.
        </div>
      </div>

      {error && <p className="text-red-500 text-center text-sm">{error}</p>}

      {showScanButton && (
        <button
          onClick={handleScanAllBarcodes}
          disabled={!files.length || loading}
          className={`w-full md:w-auto px-6 py-3 rounded-2xl font-medium text-white shadow-md transition ${
            !files.length || loading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-[#46769B] hover:bg-blue-700"
          }`}
        >
          {loading
            ? `Scanning${animDots}`
            : multiple
            ? "Scan All Barcodes"
            : "Scan Barcode"}
        </button>
      )}

      {loading && <ProgressBar progress={progress} scanning={loading} />}

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

      {/* Crop modal overlay */}
      {cropSourceUrl && (
        <BarcodeCropModal
          src={cropSourceUrl}
          onCancel={handleCropCancel}
          onCropped={handleCropDone}
        />
      )}
    </div>
  );
}
