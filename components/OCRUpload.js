// components/OCRUpload.jsx
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import ProgressBar from "./ProgressBar";
import Cropper from "react-easy-crop";

/* -----------------------------------------------------------------------------
  Helpers: file/type checks
----------------------------------------------------------------------------- */

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

function detectHeic(file) {
  const type = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "").toLowerCase();
  return (
    type.includes("heic") ||
    type.includes("heif") ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
}

function safeStr(v) {
  return String(v ?? "").trim();
}

/* -----------------------------------------------------------------------------
  Image decode: prefer createImageBitmap (handles EXIF orientation better)
----------------------------------------------------------------------------- */

async function decodeBitmapFromFile(file) {
  // Best path: createImageBitmap can apply EXIF orientation in some browsers.
  // Safari support is improving; we try and fallback gracefully.
  if (typeof createImageBitmap === "function") {
    try {
      // imageOrientation is supported in many modern browsers
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { bitmap: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close?.() };
    } catch {
      // fallback below
    }
  }

  // Fallback: Image() + FileReader (EXIF orientation may be imperfect in canvas)
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = (e) => resolve(e.target.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = dataUrl;
  });

  return {
    bitmap: img, // not a real bitmap, but drawable
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
    close: () => {},
  };
}

/* -----------------------------------------------------------------------------
  Crop → returns a NEW JPG File cropped to cropRect (pixels in source coordinates)
----------------------------------------------------------------------------- */

async function cropFileToRegion(file, cropRect) {
  if (!cropRect || cropRect.width <= 0 || cropRect.height <= 0) {
    throw new Error("Invalid crop region");
  }

  const { bitmap, width, height, close } = await decodeBitmapFromFile(file);

  // Clamp crop rect to source bounds (defensive)
  const sx = Math.max(0, Math.min(width - 1, Math.round(cropRect.x)));
  const sy = Math.max(0, Math.min(height - 1, Math.round(cropRect.y)));
  const sw = Math.max(1, Math.min(width - sx, Math.round(cropRect.width)));
  const sh = Math.max(1, Math.min(height - sy, Math.round(cropRect.height)));

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Crop failed: empty blob"))),
      "image/jpeg",
      0.95
    );
  });

  close?.();

  return new File([blob], file.name.replace(/(\.\w+)?$/, "_crop.jpg"), {
    type: "image/jpeg",
  });
}

/* -----------------------------------------------------------------------------
  Resize (after crop): keeps text clarity but caps dimensions
----------------------------------------------------------------------------- */

async function resizeFileToMaxDim(file, maxDim = 1800, quality = 0.9) {
  const { bitmap, width: srcW, height: srcH, close } = await decodeBitmapFromFile(file);

  let w = srcW;
  let h = srcH;

  if (w > maxDim || h > maxDim) {
    const scale = Math.min(maxDim / w, maxDim / h);
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  ctx.drawImage(bitmap, 0, 0, w, h);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Resize failed: empty blob"))),
      "image/jpeg",
      quality
    );
  });

  close?.();

  return new File([blob], file.name.replace(/(\.\w+)?$/, ".jpg"), { type: "image/jpeg" });
}

/* -----------------------------------------------------------------------------
  OCR preprocess: grayscale + contrast stretch, optional threshold fallback
----------------------------------------------------------------------------- */

function preprocessToGrayscaleContrast(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { width, height } = canvas;

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Compute min/max grayscale
  let min = 255;
  let max = 0;
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
  return canvas;
}

function preprocessToThreshold(canvas, threshold = 160) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { width, height } = canvas;

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i]; // already grayscale if called after grayscale step
    const v = gray > threshold ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = v;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/* -----------------------------------------------------------------------------
  OCR worker init: single-worker, no logger to avoid DataCloneError
----------------------------------------------------------------------------- */

async function initWorker() {
  const mod = await import("tesseract.js");
  const createWorker = mod.createWorker || mod.default?.createWorker;
  if (!createWorker) {
    throw new Error("Tesseract createWorker not found. Check your tesseract.js version.");
  }

  const worker = await createWorker();

  if (typeof worker.load === "function") {
    await worker.load();
  }

  if (typeof worker.reinitialize === "function") {
    await worker.reinitialize("eng");
  } else if (typeof worker.initialize === "function") {
    await worker.initialize("eng");
  }

  if (typeof worker.setParameters === "function") {
    await worker.setParameters({
      preserve_interword_spaces: "1",
      tessedit_pageseg_mode: "6",
    });
  }

  return worker;
}

async function runRecognize(worker, imageLike, psm) {
  if (typeof worker.setParameters === "function" && psm) {
    await worker.setParameters({ tessedit_pageseg_mode: String(psm) });
  }
  const result = await worker.recognize(imageLike);
  return result?.data?.text || "";
}

/* -----------------------------------------------------------------------------
  Text quality scoring
----------------------------------------------------------------------------- */

function textLooksWeak(t) {
  const s = safeStr(t);
  if (s.length < 30) return true;
  const letters = (s.match(/[A-Za-z]/g) || []).length;
  const total = s.length || 1;
  return letters / total < 0.15;
}

function scoreText(t) {
  const s = safeStr(t);
  if (!s) return 0;

  const letters = (s.match(/[A-Za-z]/g) || []).length;
  const digits = (s.match(/[0-9]/g) || []).length;
  const lines = s.split("\n").filter((x) => x.trim()).length;

  const ratio = letters / (s.length || 1);
  // Prefer more letters, enough length, and some line structure
  return (
    Math.min(1, s.length / 700) * 40 +
    Math.min(1, ratio / 0.45) * 40 +
    Math.min(1, lines / 18) * 15 +
    Math.min(1, digits / 80) * 5
  );
}

function computeOcrQualityLabel(text) {
  const s = safeStr(text);
  if (!s) return { label: "No text", tone: "bad", score: 0 };

  const letters = (s.match(/[A-Za-z]/g) || []).length;
  const ratio = letters / (s.length || 1);

  // Simple heuristic buckets
  if (s.length > 250 && ratio > 0.35) return { label: "Good scan", tone: "good", score: scoreText(s) };
  if (s.length > 120 && ratio > 0.22) return { label: "Okay scan", tone: "warn", score: scoreText(s) };
  return { label: "Low clarity", tone: "bad", score: scoreText(s) };
}

/* -----------------------------------------------------------------------------
  Component
----------------------------------------------------------------------------- */

export default function OCRUpload({ multiple = false, onScan }) {
  const [files, setFiles] = useState([]);
  const [previewURLs, setPreviewURLs] = useState([]);
  const [ocrTexts, setOcrTexts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [animDots, setAnimDots] = useState("");
  const [error, setError] = useState("");
  const [athleteNames, setAthleteNames] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showChoiceModal, setShowChoiceModal] = useState(false);

  // Crop-related state
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropIndex, setCropIndex] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  // Aspect mode: "label" | "free"
  const [aspectMode, setAspectMode] = useState("label");

  // Track which files have been cropped (for UI tags)
  const [croppedFlags, setCroppedFlags] = useState([]);

  // Scanning progress
  const [currentScanIndex, setCurrentScanIndex] = useState(null);
  const [completedCount, setCompletedCount] = useState(0);

  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Animate dots during loading
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setAnimDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, [loading]);

  // Cleanup blob URLs
  useEffect(() => {
    return () => previewURLs.forEach((url) => URL.revokeObjectURL(url));
  }, [previewURLs]);

  const validateFile = (file) => {
    if (!file) return false;

    if (file.size > MAX_FILE_SIZE) {
      setError("File too large. Max 5 MB. Try zooming in on just the label.");
      return false;
    }

    // Explicitly handle iPhone HEIC
    if (detectHeic(file)) {
      setError(
        "This photo is in HEIC format, which browsers can't reliably scan yet.\n\n" +
          "On iPhone, either:\n" +
          "• Take a screenshot of the label and upload the screenshot, or\n" +
          "• Go to Settings → Camera → Formats → select “Most Compatible”, then retake the photo."
      );
      return false;
    }

    if (!ALLOWED_MIME_TYPES.includes(String(file.type || "").toLowerCase())) {
      setError("Unsupported image type. Please upload a JPG, PNG, or WEBP photo of the label.");
      return false;
    }

    setError("");
    return true;
  };

  const resetCropState = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setAspectMode("label");
  };

  const handleFiles = (selectedFiles) => {
    const validFiles = Array.from(selectedFiles || []).filter(validateFile);
    if (!validFiles.length) return;

    // Revoke any previous preview URLs before replacing them
    previewURLs.forEach((url) => URL.revokeObjectURL(url));

    setFiles(validFiles);
    const urls = validFiles.map((f) => URL.createObjectURL(f));
    setPreviewURLs(urls);

    setOcrTexts(new Array(validFiles.length).fill(""));
    setAthleteNames(validFiles.map(() => ""));
    setCroppedFlags(validFiles.map(() => false));

    // Open crop modal for the first file (best OCR results)
    resetCropState();
    setCropIndex(0);
    setShowCropModal(true);
  };

  const handleCameraInputChange = (e) => handleFiles(e.target.files);
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
    const newNames = [...athleteNames];
    newNames[idx] = value;
    setAthleteNames(newNames);
  };

  const onCropComplete = (_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  };

  const openCropForIndex = (idx) => {
    if (!previewURLs[idx]) return;
    resetCropState();
    setCropIndex(idx);
    setShowCropModal(true);
  };

  // Derived aspect value from mode
  const aspectValue = useMemo(() => {
    if (aspectMode === "label") return 3 / 4; // tall-ish for ingredient panels
    return undefined;
  }, [aspectMode]);

  // Progress: completed labels / total (more accurate than index math)
  const progressPercent = useMemo(() => {
    if (!loading) return 0;
    const total = Math.max(1, files.length);
    const pct = Math.round((Math.min(completedCount, total) / total) * 100);
    return Math.max(0, Math.min(100, pct));
  }, [loading, files.length, completedCount]);

  const handleConfirmCrop = async () => {
    if (cropIndex == null || croppedAreaPixels == null) {
      setShowCropModal(false);
      return;
    }

    try {
      const originalFile = files[cropIndex];
      if (!originalFile) {
        setShowCropModal(false);
        return;
      }

      // Crop (orientation-aware when possible)
      const croppedFile = await cropFileToRegion(originalFile, croppedAreaPixels);

      const newFiles = [...files];
      newFiles[cropIndex] = croppedFile;
      setFiles(newFiles);

      const newPreviews = [...previewURLs];
      if (newPreviews[cropIndex]) URL.revokeObjectURL(newPreviews[cropIndex]);
      newPreviews[cropIndex] = URL.createObjectURL(croppedFile);
      setPreviewURLs(newPreviews);

      const newFlags = [...croppedFlags];
      newFlags[cropIndex] = true;
      setCroppedFlags(newFlags);

      // If multiple, step through crops in sequence (fast, better OCR)
      const nextIdx = cropIndex + 1;
      if (multiple && nextIdx < newFiles.length) {
        resetCropState();
        setCropIndex(nextIdx);
        // keep modal open for next crop
        setShowCropModal(true);
        return;
      }

      setShowCropModal(false);
    } catch (err) {
      console.error("Crop apply error:", err);
      setError("Could not crop image. Please try again or retake the photo.");
      setShowCropModal(false);
    }
  };

  const handleScan = async () => {
    if (!files.length) {
      setError("Please add a label photo first.");
      return;
    }

    setLoading(true);
    setError("");
    setOcrTexts(new Array(files.length).fill(""));
    setCurrentScanIndex(0);
    setCompletedCount(0);

    let worker = null;

    try {
      worker = await initWorker();

      // Use an offscreen canvas we reuse (mobile memory-friendly)
      const workCanvas = document.createElement("canvas");

      for (let i = 0; i < files.length; i++) {
        setCurrentScanIndex(i);

        // Best pipeline: crop already happened in UI; still resize for OCR speed/clarity
        const fileForOcr = await resizeFileToMaxDim(files[i], 1800, 0.9).catch((err) => {
          console.warn("Resize failed for file:", files[i]?.name, err);
          throw new Error(
            `We couldn't process the image "${files[i]?.name || "label"}". Try cropping closer to the ingredients panel or taking a screenshot and uploading that.`
          );
        });

        // Decode bitmap (orientation aware when possible)
        const { bitmap, width, height, close } = await decodeBitmapFromFile(fileForOcr);

        // Draw into canvas
        workCanvas.width = width;
        workCanvas.height = height;
        const ctx = workCanvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(bitmap, 0, 0);

        // Preprocess variant A: grayscale + contrast
        preprocessToGrayscaleContrast(workCanvas);

        // OCR tries: PSMs, plus a threshold fallback when weak
        const attempts = [
          { psm: 6, mode: "gray" },
          { psm: 4, mode: "gray" },
          { psm: 11, mode: "gray" },
          { psm: 3, mode: "gray" },
          // threshold fallback (often helps on nutrition panels)
          { psm: 6, mode: "thresh" },
          { psm: 4, mode: "thresh" },
        ];

        let bestText = "";
        let bestScore = -1;
        let bestPsm = 6;
        let bestMode = "gray";

        for (const a of attempts) {
          // If threshold attempt, apply threshold on top of grayscale
          if (a.mode === "thresh") {
            // We re-run grayscale+contrast first to reset to that state
            // (since threshold is destructive)
            ctx.drawImage(bitmap, 0, 0);
            preprocessToGrayscaleContrast(workCanvas);
            preprocessToThreshold(workCanvas, 165);
          }

          const t = await runRecognize(worker, workCanvas, a.psm);
          const sc = scoreText(t);

          if (sc > bestScore) {
            bestScore = sc;
            bestText = t;
            bestPsm = a.psm;
            bestMode = a.mode;
          }

          // early exit if we got something strong enough
          if (!textLooksWeak(bestText) && bestScore >= 70) break;
        }

        close?.();

        const finalText = safeStr(bestText);

        setOcrTexts((prev) => {
          const updated = [...prev];
          updated[i] = finalText;
          return updated;
        });

        // Provide richer meta to backend while keeping backward compatibility
        const q = computeOcrQualityLabel(finalText);
        const meta = {
          index: i,
          total: files.length,
          fileName: files[i]?.name || "",
          cropped: !!croppedFlags[i],
          athleteName: athleteNames[i] || "",
          psmUsed: bestPsm,
          preprocess: bestMode,
          quality: q, // { label, tone, score }
        };

        if (typeof onScan === "function") {
          try {
            // Existing handlers that expect (text) will still work.
            // New handlers can use (text, meta).
            await onScan(finalText, meta);
          } catch (err) {
            console.error("onScan callback error:", err);
          }
        }

        setCompletedCount((c) => c + 1);
      }
    } catch (err) {
      console.error("OCR failed:", err);
      setError(
        err?.message ||
          "OCR failed on this photo. Try zooming in on the ingredients panel or taking a screenshot and uploading that."
      );
    } finally {
      try {
        if (worker && typeof worker.terminate === "function") {
          await worker.terminate();
        }
      } catch (e) {
        console.warn("Worker terminate failed (non-fatal):", e);
      }

      setLoading(false);
      setCurrentScanIndex(null);
    }
  };

  /* -----------------------------------------------------------------------------
    Small derived UI helpers
  ----------------------------------------------------------------------------- */

  const scanQualitySummary = useMemo(() => {
    // summarize last OCR result if exists
    const latestIdx = [...ocrTexts].reverse().findIndex((t) => safeStr(t));
    if (latestIdx === -1) return null;
    const realIdx = ocrTexts.length - 1 - latestIdx;
    const q = computeOcrQualityLabel(ocrTexts[realIdx]);
    return { index: realIdx, ...q };
  }, [ocrTexts]);

  return (
    <div className="mt-6 font-sans space-y-5">
      {/* Header / Steps */}
      <div className="max-w-3xl mx-auto flex flex-col gap-1">
        <div className="inline-flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-[#46769B]/30 bg-[#46769B]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#46769B]">
            Step 1 · Label Scan
          </span>
        </div>

        <h2 className="text-base sm:text-lg font-semibold text-gray-900">
          Scan a supplement nutrition label
        </h2>

        <p className="text-xs sm:text-sm text-gray-500">
          Upload a clear photo, crop around the ingredients panel, then scan it for banned substances and ingredient
          details.
        </p>

        {scanQualitySummary && (
          <div
            className={`mt-2 rounded-xl border px-3 py-2 text-xs ${
              scanQualitySummary.tone === "good"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : scanQualitySummary.tone === "warn"
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-red-200 bg-red-50 text-red-900"
            }`}
          >
            <span className="font-semibold">Scan quality:</span> {scanQualitySummary.label}
            <span className="opacity-70"> (Label {scanQualitySummary.index + 1})</span>
          </div>
        )}
      </div>

      {/* Upload card */}
      <div
        className={`flex flex-col items-center justify-center w-full max-w-3xl mx-auto px-6 py-6 rounded-2xl cursor-pointer transition border-2 border-dashed ${
          isDragging
            ? "border-[#46769B] bg-[#f0f5fa]"
            : "border-gray-300 bg-[#f7f9fc] hover:bg-[#edf3fb]"
        }`}
        onClick={() => setShowChoiceModal(true)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span className="text-gray-900 text-center font-semibold text-sm sm:text-base">
          {files.length
            ? `${files.length} label photo${files.length > 1 ? "s" : ""} selected`
            : "Tap to add a nutrition label photo"}
        </span>
        <span className="mt-1 text-[11px] sm:text-xs text-gray-500 text-center max-w-md">
          Hold your phone about 6–8 inches away until the text looks sharp. Crop to just the ingredients panel for best
          results.
        </span>
        <span className="mt-3 text-[11px] text-gray-500 text-center">
          Drag and drop a label photo, or tap to use your camera or photo library.
        </span>
      </div>

      {/* Hidden inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        multiple={multiple}
        className="hidden"
        onChange={handleCameraInputChange}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={multiple}
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Choice modal: Camera vs Photo Library */}
      {showChoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Add Label Photo</h2>
              <button
                onClick={() => setShowChoiceModal(false)}
                className="text-gray-400 hover:text-gray-700 text-lg leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <p className="text-sm text-gray-600">
              Choose how you want to add your nutrition label. A single, sharp photo of the ingredients panel works
              best.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowChoiceModal(false);
                  cameraInputRef.current?.click();
                }}
                className="w-full py-3 rounded-xl bg-[#46769B] text-white font-medium hover:bg-[#365b7a] transition shadow-sm text-sm"
              >
                Use Camera
              </button>
              <button
                onClick={() => {
                  setShowChoiceModal(false);
                  fileInputRef.current?.click();
                }}
                className="w-full py-3 rounded-xl border border-gray-300 text-gray-800 font-medium hover:bg-gray-50 transition text-sm"
              >
                Choose from Photos / Files
              </button>
            </div>

            <p className="text-[11px] text-gray-500 mt-1 leading-snug">
              iPhone tip: If photos fail to scan, take a screenshot of the label and upload the screenshot instead.
            </p>
          </div>
        </div>
      )}

      {/* Crop modal */}
      {showCropModal && cropIndex != null && previewURLs[cropIndex] && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md bg-neutral-900 rounded-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
              <div className="flex flex-col">
                <h2 className="text-sm font-semibold text-white">
                  Crop Label Area {multiple ? `(${cropIndex + 1}/${files.length})` : ""}
                </h2>
                <p className="text-[11px] text-neutral-400">
                  Drag the box over just the ingredients panel. Use the zoom slider if needed.
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
                  onClick={() => setAspectMode("label")}
                  className={`flex-1 px-3 py-1.5 rounded-xl text-[11px] font-medium border ${
                    aspectMode === "label"
                      ? "border-emerald-400 bg-emerald-500/10 text-emerald-200"
                      : "border-neutral-700 text-neutral-200 hover:bg-neutral-800"
                  }`}
                >
                  Label Text
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
                {multiple && cropIndex + 1 < files.length ? "Use Crop + Next" : "Use Crop"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Previews */}
      {files.map((file, idx) => {
        const hasText = !!safeStr(ocrTexts[idx]);
        const q = hasText ? computeOcrQualityLabel(ocrTexts[idx]) : null;

        return (
          <div
            key={idx}
            className="flex flex-col items-start space-y-2 max-w-3xl mx-auto rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
          >
            <div className="flex items-center justify-between w-full gap-2">
              <div className="flex flex-col min-w-0">
                <span className="font-medium text-xs sm:text-sm text-gray-900 truncate">{file.name}</span>
                <span className="text-[10px] text-gray-400">
                  Label {idx + 1} of {files.length}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {croppedFlags[idx] && (
                  <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                    Cropped
                  </span>
                )}
                {hasText && (
                  <span className="inline-flex items-center rounded-full border border-[#46769B]/30 bg-[#46769B]/10 px-2 py-0.5 text-[10px] font-medium text-[#46769B]">
                    OCR ready
                  </span>
                )}
              </div>
            </div>

            <label className="w-full text-[11px] text-gray-600">
              Athlete or Team Name (optional)
              <input
                type="text"
                value={athleteNames[idx] || ""}
                onChange={(e) => handleNameChange(idx, e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#46769B] focus:border-transparent text-xs sm:text-sm"
              />
            </label>

            <img
              src={previewURLs[idx]}
              alt={`Label preview ${idx + 1}`}
              className="max-h-48 rounded-xl border border-gray-200 shadow-sm object-contain mt-1 w-full sm:w-auto bg-white"
              loading="lazy"
            />

            <div className="flex items-center justify-between w-full mt-1 gap-2">
              <button
                type="button"
                onClick={() => openCropForIndex(idx)}
                className="inline-flex items-center px-3 py-1.5 rounded-xl text-[11px] font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Re-Crop Label Area
              </button>

              {q && (
                <span
                  className={`text-[11px] font-medium ${
                    q.tone === "good" ? "text-emerald-700" : q.tone === "warn" ? "text-amber-700" : "text-red-700"
                  }`}
                >
                  {q.label}
                </span>
              )}
            </div>

            {!croppedFlags[idx] && (
              <p className="text-[11px] text-gray-500">
                Tip: Cropping to just the ingredients panel usually improves OCR accuracy a lot.
              </p>
            )}
          </div>
        );
      })}

      <div className="flex items-center justify-between max-w-3xl mx-auto">
        <p className="text-[11px] sm:text-xs text-gray-500">
          Tip: Avoid shadows, glare, and extreme angles on the nutrition panel. If a scan fails, retake slightly farther
          back, then re-crop.
        </p>
      </div>

      {error && (
        <p className="whitespace-pre-line text-red-500 text-center text-sm mt-1 max-w-3xl mx-auto bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {loading && (
        <div className="max-w-3xl mx-auto space-y-2">
          <ProgressBar progress={progressPercent} />
          {currentScanIndex != null && (
            <p className="text-[11px] text-gray-500 text-right">
              Scanning label {currentScanIndex + 1} of {files.length}
              {animDots}
            </p>
          )}
        </div>
      )}

      <div className="max-w-3xl mx-auto flex justify-end">
        <button
          onClick={handleScan}
          disabled={loading || !files.length}
          className={`w-full md:w-auto px-6 py-3 rounded-2xl font-medium text-white shadow-md transition text-sm sm:text-base flex items-center justify-center ${
            loading || !files.length ? "bg-gray-400 cursor-not-allowed" : "bg-[#46769B] hover:bg-[#365b7a]"
          }`}
        >
          {loading
            ? currentScanIndex != null
              ? `Scanning ${currentScanIndex + 1} of ${files.length}${animDots}`
              : `Scanning${animDots}`
            : multiple
            ? "Scan All Labels"
            : "Scan Label"}
        </button>
      </div>
    </div>
  );
}