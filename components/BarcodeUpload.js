// components/BarcodeUpload.jsx
"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  BrowserMultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
} from "@zxing/library";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";
import Cropper from "react-easy-crop";
import ProgressBar from "./ProgressBar";

// Tiny beep placeholder (you can swap this for a real sound if you want)
const BEEP_SRC =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

/* -------------------------------------------------------------------------- */
/* Utilities                                                                  */
/* -------------------------------------------------------------------------- */

const isBlobUrl = (s) => typeof s === "string" && s.startsWith("blob:");
const normalizeBarcodeDigits = (s) => String(s || "").replace(/\D/g, "");

// Compute check digit for EAN/UPC/GTIN (mod 10)
// Works for EAN-8, UPC-A (12), EAN-13, GTIN-14 if you pass the body (without check digit)
function computeGtinCheckDigit(bodyDigits) {
  const digits = String(bodyDigits || "").replace(/\D/g, "");
  if (!digits.length) return null;

  // From rightmost going left: weights alternate 3 and 1, starting with 3
  let sum = 0;
  let weight = 3;
  for (let i = digits.length - 1; i >= 0; i--) {
    const n = digits.charCodeAt(i) - 48;
    if (n < 0 || n > 9) return null;
    sum += n * weight;
    weight = weight === 3 ? 1 : 3;
  }

  const mod = sum % 10;
  return mod === 0 ? 0 : 10 - mod;
}

function isValidGtin(digits) {
  const d = normalizeBarcodeDigits(digits);
  if (![8, 12, 13, 14].includes(d.length)) return false;

  const body = d.slice(0, -1);
  const check = Number(d.slice(-1));
  const expected = computeGtinCheckDigit(body);
  return expected !== null && check === expected;
}

// Some scanners return UPC-A as 13 digits with leading 0, or UPC-E expansions vary.
// We keep it simple: normalize, allow known lengths, and checksum validate when possible.
function normalizeAndValidateBarcode(raw) {
  const digits = normalizeBarcodeDigits(raw);

  if (!digits) return { ok: false, digits: "", reason: "empty" };

  // Common fallback: if length 13 and starts with 0, it might really be UPC-A (12)
  if (digits.length === 13 && digits.startsWith("0")) {
    const maybeUpc = digits.slice(1);
    if (isValidGtin(maybeUpc)) return { ok: true, digits: maybeUpc, type: "UPC-A" };
  }

  // Standard GTIN validation
  if ([8, 12, 13, 14].includes(digits.length)) {
    // Checksum validation is very useful; if it fails, we treat as invalid
    if (isValidGtin(digits)) return { ok: true, digits, type: "GTIN" };
    return { ok: false, digits, reason: "checksum" };
  }

  return { ok: false, digits, reason: "length" };
}

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
        const sx = Math.max(0, Math.floor(cropRect.x));
        const sy = Math.max(0, Math.floor(cropRect.y));
        const sw = Math.max(1, Math.floor(cropRect.width));
        const sh = Math.max(1, Math.floor(cropRect.height));

        const canvas = document.createElement("canvas");
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Crop failed: empty blob"));

            const croppedFile = new File(
              [blob],
              file.name.replace(/(\.\w+)?$/, "_barcode_crop.jpg"),
              { type: "image/jpeg" }
            );

            // dataURL for preview (fast)
            const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
            resolve({ file: croppedFile, dataUrl });
          },
          "image/jpeg",
          0.92
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
  preferredFormats, // optional: ["UPC_A","EAN_13",...]
}) {
  /* ------------------------------------------------------------------------ */
  /* State                                                                    */
  /* ------------------------------------------------------------------------ */

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

  // Slightly higher to tolerate iPhone photos; decode step downscales anyway
  const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB

  // ZXing reader reuse
  const codeReaderRef = useRef(null);

  // OCR worker reuse (numeric fallback)
  const ocrWorkerRef = useRef(null);
  const ocrInitializingRef = useRef(false);

  /* ------------------------------------------------------------------------ */
  /* Format mapping + reader hints                                             */
  /* ------------------------------------------------------------------------ */

  const NAME_TO_FORMAT = useMemo(
    () => ({
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
    }),
    []
  );

  const mapFormats = useCallback(
    (arr = []) => {
      const out = [];
      for (const name of arr) {
        const n = ("" + name).toUpperCase();
        if (NAME_TO_FORMAT[n]) out.push(NAME_TO_FORMAT[n]);
      }
      return out;
    },
    [NAME_TO_FORMAT]
  );

  // For CheckPeak, retail barcodes are overwhelmingly UPC/EAN.
  const effectiveFormats = useMemo(() => {
    if (Array.isArray(preferredFormats) && preferredFormats.length) {
      return mapFormats(preferredFormats);
    }
    return [
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
    ];
  }, [preferredFormats, mapFormats]);

  const makeReader = useCallback(() => {
    try {
      const hints = new Map();
      if (effectiveFormats?.length) {
        hints.set(DecodeHintType.POSSIBLE_FORMATS, effectiveFormats);
      }
      hints.set(DecodeHintType.TRY_HARDER, true);
      // second param is timeBetweenScans for continuous decode in some builds (safe here)
      return new BrowserMultiFormatReader(hints, 300);
    } catch (err) {
      console.warn("Failed to create ZXing reader:", err);
      return null;
    }
  }, [effectiveFormats]);

  /* ------------------------------------------------------------------------ */
  /* Effects                                                                   */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    audioRef.current = typeof Audio !== "undefined" ? new Audio(BEEP_SRC) : null;
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
    return () => {
      previewURLs.forEach((url) => {
        if (isBlobUrl(url)) URL.revokeObjectURL(url);
      });
    };
  }, [previewURLs]);

  // instantiate / refresh ZXing reader when formats change
  useEffect(() => {
    try {
      codeReaderRef.current?.reset?.();
    } catch {}
    codeReaderRef.current = makeReader();
    return () => {
      try {
        codeReaderRef.current?.reset?.();
      } catch {}
      codeReaderRef.current = null;
    };
  }, [makeReader]);

  // terminate OCR worker on unmount
  useEffect(() => {
    return () => {
      try {
        ocrWorkerRef.current?.terminate?.();
      } catch {}
      ocrWorkerRef.current = null;
      ocrInitializingRef.current = false;
    };
  }, []);

  /* ------------------------------------------------------------------------ */
  /* Helpers                                                                   */
  /* ------------------------------------------------------------------------ */

  const validateFile = (file) => {
    if (!file?.type?.startsWith("image/")) {
      setError("Only image files are allowed.");
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("File too large. Max 8 MB.");
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

    // Revoke existing blob preview URLs only
    previewURLs.forEach((url) => {
      if (isBlobUrl(url)) URL.revokeObjectURL(url);
    });

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
    } catch {
      // ignore
    }
  };

  /* ------------------------------------------------------------------------ */
  /* OCR worker (numeric fallback)                                             */
  /* ------------------------------------------------------------------------ */

  const initOCRWorker = useCallback(async () => {
    if (ocrWorkerRef.current) return ocrWorkerRef.current;

    if (ocrInitializingRef.current) {
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
      if (!data?.text) return null;

      const digits = normalizeBarcodeDigits(data.text);

      // Prefer known GTIN lengths
      const candidates = [
        ...digits.matchAll(/\d{14}/g),
        ...digits.matchAll(/\d{13}/g),
        ...digits.matchAll(/\d{12}/g),
        ...digits.matchAll(/\d{8}/g),
      ].map((m) => m[0]);

      for (const c of candidates) {
        const v = normalizeAndValidateBarcode(c);
        if (v.ok) return v.digits;
      }
      return null;
    } catch (err) {
      console.warn("Tesseract OCR failed:", err);
      return null;
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Decode barcode from File                                                  */
  /* ------------------------------------------------------------------------ */

  async function decodeBarcodeFromFile(file) {
    // Use createImageBitmap where available
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
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

    const reader = codeReaderRef.current || makeReader();
    if (!reader) throw new Error("Barcode scanner not available.");

    const MAX_SIDE = 1600;
    const rotations = [0, 90, 180, 270];

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));

    const preprocessCanvas = () => {
      // light grayscale + contrast bump helps some barcodes
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
      } catch {
        // ignore
      }
    };

    let lastErr = null;

    try {
      for (const rot of rotations) {
        try {
          // rotate into canvas
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

          // Use a JPEG dataURL to reduce memory
          const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
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

          if (barcodeText) return barcodeText;
        } catch (err) {
          lastErr = err;
          // continue to next rotation
        }
      }

      // ZXing failed → try numeric OCR fallback (last resort)
      const ocrResult = await performOCROnCanvas(canvas);
      if (ocrResult) return ocrResult;

      throw lastErr || new Error("No barcode decoded from image.");
    } finally {
      // reset once per decode attempt
      try {
        reader.reset?.();
      } catch {}
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Server call: /api/check (barcode only, no image)                           */
  /* ------------------------------------------------------------------------ */

  async function fetchMatches(barcodeDigits) {
    const resp = await fetch("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Only send the numeric barcode here to avoid body size issues
      body: JSON.stringify({ barcode: barcodeDigits, isBarcodeFlow: true }),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => null);
      throw new Error(txt || `Barcode check failed with status ${resp.status}`);
    }
    return resp.json();
  }

  async function handleDecodedBarcodePipeline(barcodeText, idx = null) {
    setError("");

    const parsed = normalizeAndValidateBarcode(barcodeText);

    if (!parsed.ok) {
      if (parsed.reason === "empty") {
        setError("No barcode detected. Try cropping tighter around the barcode.");
      } else if (parsed.reason === "length") {
        setError("That scan doesn't look like a standard UPC/EAN barcode.");
      } else if (parsed.reason === "checksum") {
        setError(
          "Barcode digits were read, but the checksum is invalid. Try cropping tighter or reducing glare."
        );
      } else {
        setError("Could not validate barcode. Try again.");
      }
      return;
    }

    const digits = parsed.digits;

    setLoading(true);
    setProgress(5);

    try {
      setProgress(25);

      const data = await fetchMatches(digits);

      console.log("[BarcodeUpload] API check response:", data);
      console.log("[BarcodeUpload] API debug:", data?.debug || null);

      setProgress(90);

      const result = {
        barcode: digits,
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
        const raw = await decodeBarcodeFromFile(files[i]);
        if (!raw) throw new Error("No barcode decoded");
        await handleDecodedBarcodePipeline(raw, i);
      } catch (err) {
        console.warn("Scan failed for index", i, err);
      }
    }

    setLoading(false);
    setProgress(0);
    setCurrentScanIndex(null);
  };

  /* ------------------------------------------------------------------------ */
  /* Crop handlers (react-easy-crop)                                           */
  /* ------------------------------------------------------------------------ */

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

      const { file, dataUrl } = await cropFileToRegion(originalFile, croppedAreaPixels);

      setFiles((prev) => {
        const updated = [...prev];
        updated[cropIndex] = file;
        return updated;
      });

      setPreviewURLs((prev) => {
        const updated = [...prev];
        // revoke only if old is blob url
        if (isBlobUrl(updated[cropIndex])) {
          URL.revokeObjectURL(updated[cropIndex]);
        }
        updated[cropIndex] = dataUrl; // dataURL preview
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

  /* ------------------------------------------------------------------------ */
  /* Render                                                                    */
  /* ------------------------------------------------------------------------ */

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
          Upload a photo and crop tightly around the barcode for maximum accuracy.
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
            ? `${files.length} barcode photo${files.length > 1 ? "s" : ""} selected`
            : "Tap to upload a barcode photo"}
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

      {/* Choice Modal (now ONLY upload) */}
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
                <h2 className="text-lg font-semibold text-gray-800">Upload Barcode Photo</h2>
                <button
                  onClick={() => setShowChoiceModal(false)}
                  className="text-gray-400 hover:text-gray-700 transition"
                  aria-label="Close barcode scan options"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-gray-600 text-sm">
                Select a barcode photo (or take one). After upload, crop tightly around the
                barcode stripe and its numbers for best accuracy.
              </p>

              <div className="flex flex-col gap-3 mt-2">
                <button
                  className="w-full bg-[#46769B] hover:bg-[#365b7a] text-white rounded-xl py-3 font-medium transition text-sm"
                  onClick={() => {
                    setShowChoiceModal(false);
                    fileInputRef.current?.click();
                  }}
                >
                  Take Photo / Upload
                </button>
              </div>

              <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                Tip: Avoid glare, keep the barcode flat, and include the full barcode + the
                numbers underneath. If ZXing struggles, the system will try a numeric OCR
                fallback on the cropped image.
              </p>
            </motion.div>
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
                <h2 className="text-sm font-semibold text-white">Crop Barcode Area</h2>
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
                <span className="text-[11px] text-neutral-300 w-12">Zoom</span>
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
          Photos stay on your device for decoding. Only the barcode digits are sent to our
          servers to look up products and ingredients.
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
