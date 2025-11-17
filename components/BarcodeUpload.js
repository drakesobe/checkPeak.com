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
import { X, Check } from "lucide-react";
import ProgressBar from "./ProgressBar";

// Lazy load live scanner
const LiveBarcodeScanner = dynamic(() => import("./LiveBarcodeScanner"), {
  ssr: false,
});

// Tiny beep (short 8-bit-ish click) — replace if you want a different sound
const BEEP_SRC =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA="; // extremely short silent-ish placeholder

export default function BarcodeUpload({
  multiple = false,
  onResult,
  showScanButton = true,
  preferredFormats,
}) {
  // UI state
  const [files, setFiles] = useState([]);
  const [previewURLs, setPreviewURLs] = useState([]);
  const [athleteNames, setAthleteNames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [animDots, setAnimDots] = useState("");
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [showLiveScanner, setShowLiveScanner] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [enableChime, setEnableChime] = useState(true);

  const fileInputRef = useRef(null);
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  // ZXing reader reuse
  const codeReaderRef = useRef(null);

  // OCR worker reuse
  const ocrWorkerRef = useRef(null);
  const ocrInitializingRef = useRef(false);

  // audio ref
  const audioRef = useRef(null);

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
    setFiles(valid);
    setPreviewURLs(valid.map((f) => URL.createObjectURL(f)));
    setAthleteNames(valid.map(() => ""));
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

  // --- OCR worker init (reused) ---
  const initOCRWorker = useCallback(async () => {
    if (ocrWorkerRef.current) return ocrWorkerRef.current;
    if (ocrInitializingRef.current) {
      // another init in progress -> wait
      while (ocrInitializingRef.current && !ocrWorkerRef.current) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 100));
      }
      return ocrWorkerRef.current;
    }
    try {
      ocrInitializingRef.current = true;
      const tesseract = await import("tesseract.js");
      const worker = tesseract.createWorker();
      await worker.load();
      await worker.loadLanguage("eng");
      await worker.initialize("eng");
      await worker.setParameters({ tessedit_char_whitelist: "0123456789" });
      ocrWorkerRef.current = worker;
      ocrInitializingRef.current = false;
      return worker;
    } catch (err) {
      console.warn("OCR worker init failed:", err);
      ocrInitializingRef.current = false;
      return null;
    }
  }, []);

  // OCR recognition on a canvas — returns first numeric 8-14 digit sequence or null
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

  // ---- Image -> ZXing decode (fixed & iOS-safe) ----
  async function decodeBarcodeFromFile(file) {
    // 1) File -> data URL
    const reader = new FileReader();
    const dataUrl = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    // 2) Data URL -> Image
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });

    // 3) Draw to canvas (for scaling + contrast + rotation)
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const MAX_SIDE = 1400;
    const longestSide = Math.max(img.width, img.height);
    const scale = longestSide > MAX_SIDE ? MAX_SIDE / longestSide : 1;

    const rotations = [0, 90, 180, 270];
    let lastErr = null;

    const readerZX = codeReaderRef.current || new BrowserMultiFormatReader();

    // If preferred formats provided, we prepare hints (future-friendly)
    if (preferredFormats && Array.isArray(preferredFormats)) {
      try {
        const formats = mapFormats(preferredFormats);
        if (formats.length) {
          const hints = new Map();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
          // Some builds allow passing hints via constructor — we're leaving this
          // here as a hook if you want to re-instantiate with hints later.
        }
      } catch (e) {
        // non-fatal
      }
    }

    for (const rot of rotations) {
      try {
        // set canvas size for this rotation
        if (rot % 180 === 0) {
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
        } else {
          canvas.width = Math.round(img.height * scale);
          canvas.height = Math.round(img.width * scale);
        }

        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rot * Math.PI) / 180);
        ctx.drawImage(
          img,
          -(img.width * scale) / 2,
          -(img.height * scale) / 2,
          img.width * scale,
          img.height * scale
        );
        ctx.restore();

        // light grayscale + contrast boost
        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const d = imageData.data;
          const contrast = 1.25;
          for (let i = 0; i < d.length; i += 4) {
            const r = d[i];
            const g = d[i + 1];
            const b = d[i + 2];
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            let v = (gray - 128) * contrast + 128;
            v = Math.max(0, Math.min(255, v));
            d[i] = d[i + 1] = d[i + 2] = v;
          }
          ctx.putImageData(imageData, 0, 0);
        } catch (e) {
          // not fatal
        }

        // 4) Canvas -> temp Image -> ZXing decode
        const rotatedDataUrl = canvas.toDataURL("image/png");
        const tmpImg = await new Promise((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = reject;
          el.src = rotatedDataUrl;
        });

        // eslint-disable-next-line no-await-in-loop
        const result = await readerZX.decodeFromImageElement(tmpImg);

        const text =
          (result && result.getText && result.getText()) ||
          result?.text ||
          "";

        try {
          readerZX.reset?.();
        } catch (e) {}

        if (text && /\d/.test(text)) {
          return text;
        }
      } catch (err) {
        lastErr = err;
        // try next rotation
      }
    }

    // 5) If ZXing failed for all rotations, last-resort OCR
    const ocrGuess = await performOCROnCanvas(canvas);
    if (ocrGuess) return ocrGuess;

    throw lastErr || new Error("No barcode decoded from image.");
  }

  // Convert File/Blob -> data:<mime>;base64,... string for server OCR
  async function convertFileToDataUrl(fileOrBlob) {
    if (!fileOrBlob) return null;
    return await new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(fileOrBlob);
      } catch (e) {
        reject(e);
      }
    });
  }

  // --- server fetch matches ---
  async function fetchMatches(barcode, labelImage) {
    let labelImageData = null;
    try {
      if (labelImage) {
        if (typeof labelImage === "string") {
          if (labelImage.startsWith("data:")) {
            labelImageData = labelImage;
          } else if (labelImage.startsWith("blob:")) {
            console.warn(
              "labelImage is a blob: URL; server cannot fetch it. Consider passing File instead."
            );
            labelImageData = null;
          } else {
            // http(s) URL — pass as-is
            labelImageData = labelImage;
          }
        } else {
          // assume File/Blob
          labelImageData = await convertFileToDataUrl(labelImage);
        }
      }
    } catch (e) {
      console.warn("Failed to convert labelImage to data URL", e);
      labelImageData = null;
    }

    const resp = await fetch("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barcode,
        labelImage: labelImageData,
        isBarcodeFlow: true,
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => null);
      throw new Error(
        txt || `Barcode check failed with status ${resp.status}`
      );
    }
    return resp.json();
  }

  async function handleDecodedBarcodePipeline(
    barcodeText,
    labelImage = null,
    idx = null
  ) {
    setError("");
    if (!barcodeText || !/\d/.test(String(barcodeText))) {
      setError("Decoded value doesn't look like a barcode (no digits).");
      return;
    }

    setLoading(true);
    setProgress(5);
    try {
      setProgress(20);
      const data = await fetchMatches(barcodeText, labelImage);

      console.log("[BarcodeUpload] API check response:", data);
      console.log("[BarcodeUpload] API debug:", data?.debug || null);

      setProgress(90);
      const result = {
        barcode: barcodeText,
        productName: data?.productName || "Unknown product",
        rawIngredients: data?.ocrText || "",
        matchedBanned: data?.matchedBanned || [],
        matchedIngredients: data?.matchedIngredients || [],
        source: data?.debug?.fetchedFrom || "OCR",
        idx,
      };

      setShowSuccess(true);
      if (enableChime && audioRef.current) {
        try {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        } catch (e) {}
      }
      setTimeout(() => setShowSuccess(false), 900);

      if (typeof onResult === "function") await onResult(result);

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
    setLoading(true);
    for (let i = 0; i < files.length; i++) {
      try {
        const code = await decodeBarcodeFromFile(files[i]);
        if (!code) throw new Error("No barcode decoded");
        const labelFile = files[i] || null;
        await handleDecodedBarcodePipeline(code, labelFile, i);
      } catch (err) {
        console.warn("Scan failed for index", i, err);
      }
    }
    setLoading(false);
  };

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
            : "Tap to choose an image or take a photo"}
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

      {/* Modal Choice */}
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
                  Choose Action
                </h2>
                <button
                  onClick={() => setShowChoiceModal(false)}
                  className="text-gray-400 hover:text-gray-700 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-gray-600 text-sm">
                Select how you want to add a barcode: live scanning or from an
                image.
              </p>
              <div className="flex flex-col gap-3 mt-2">
                <button
                  className="w-full bg-[#46769B] hover:bg-[#365b7a] text-white rounded-xl py-3 font-medium transition"
                  onClick={() => {
                    setShowChoiceModal(false);
                    setShowLiveScanner(true);
                  }}
                >
                  Start Live Scanner
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

      {/* Live Scanner */}
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

      {/* Preview / Input */}
      {files.map((file, idx) => (
        <div
          key={idx}
          className="flex flex-col items-start space-y-1 max-w-3xl mx-auto"
        >
          <span className="font-medium">{file.name}</span>
          <input
            type="text"
            placeholder="Athlete or Team Name (optional)"
            value={athleteNames[idx]}
            onChange={(e) => handleNameChange(idx, e.target.value)}
            className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <img
            src={previewURLs[idx]}
            alt="Preview"
            className="max-h-48 rounded-xl border border-gray-200 shadow-md object-contain mt-1"
            loading="lazy"
          />
        </div>
      ))}

      {/* small controls row */}
      <div className="flex items-center justify-between max-w-3xl mx-auto">
        <div className="text-sm text-gray-500">
          Tip: crop your photo to the barcode and label area for faster,
          cleaner scans.
        </div>
      </div>

      {error && <p className="text-red-500 text-center">{error}</p>}

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

      {/* success checkmark */}
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
