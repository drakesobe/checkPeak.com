// hooks/useOCR.js
"use client";

import { useState, useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RESIZE_DIM = 1800;
const RESIZE_QUALITY = 0.9;
const EARLY_EXIT_SCORE = 65;

// Reduced from 6 attempts to 3 — PSM 6 and 4 cover ~90% of nutrition label
// layouts. Threshold fallback only runs if both gray attempts score poorly.
const OCR_ATTEMPTS = [
  { psm: 6, mode: "gray"   },
  { psm: 4, mode: "gray"   },
  { psm: 6, mode: "thresh" }, // threshold fallback — only reached if score < EARLY_EXIT_SCORE
];

// ---------------------------------------------------------------------------
// Image decode
// Prefer createImageBitmap (handles EXIF orientation better).
// Falls back to Image() + FileReader if unavailable (older Safari).
// ---------------------------------------------------------------------------

async function decodeBitmapFromFile(file) {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { bitmap: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close?.() };
    } catch {
      // fall through to Image() path
    }
  }

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
    bitmap: img,
    width:  img.naturalWidth  || img.width,
    height: img.naturalHeight || img.height,
    close:  () => {},
  };
}

// ---------------------------------------------------------------------------
// Resize — caps dimensions for OCR speed/clarity balance
// ---------------------------------------------------------------------------

async function resizeFile(file, maxDim = MAX_RESIZE_DIM, quality = RESIZE_QUALITY) {
  const { bitmap, width: srcW, height: srcH, close } = await decodeBitmapFromFile(file);

  let w = srcW;
  let h = srcH;

  if (w > maxDim || h > maxDim) {
    const scale = Math.min(maxDim / w, maxDim / h);
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
  }

  const canvas = document.createElement("canvas");
  canvas.width  = w;
  canvas.height = h;
  canvas.getContext("2d", { willReadFrequently: true }).drawImage(bitmap, 0, 0, w, h);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Resize: empty blob"))),
      "image/jpeg",
      quality
    );
  });

  close();

  return new File([blob], file.name.replace(/(\.\w+)?$/, ".jpg"), { type: "image/jpeg" });
}

// ---------------------------------------------------------------------------
// Preprocessing
// Both functions operate in-place on the canvas context.
// ---------------------------------------------------------------------------

function applyGrayscaleContrast(canvas) {
  const ctx  = canvas.getContext("2d", { willReadFrequently: true });
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px   = data.data;

  let min = 255, max = 0;
  for (let i = 0; i < px.length; i += 4) {
    const g = 0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2];
    if (g < min) min = g;
    if (g > max) max = g;
  }

  const scale = 255 / (max - min || 1);
  for (let i = 0; i < px.length; i += 4) {
    const g = Math.max(0, Math.min(255, (0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2] - min) * scale));
    px[i] = px[i + 1] = px[i + 2] = g;
  }

  ctx.putImageData(data, 0, 0);
}

function applyThreshold(canvas, threshold = 165) {
  const ctx  = canvas.getContext("2d", { willReadFrequently: true });
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px   = data.data;

  for (let i = 0; i < px.length; i += 4) {
    const v = px[i] > threshold ? 255 : 0;
    px[i] = px[i + 1] = px[i + 2] = v;
  }

  ctx.putImageData(data, 0, 0);
}

// ---------------------------------------------------------------------------
// OCR worker lifecycle
// Single worker, reused across the scan loop, terminated in finally.
// ---------------------------------------------------------------------------

async function initOCRWorker() {
  const mod          = await import("tesseract.js");
  const createWorker = mod.createWorker || mod.default?.createWorker;

  if (!createWorker) {
    throw new Error("Tesseract createWorker not found. Check your tesseract.js version.");
  }

  const worker = await createWorker();

  if (typeof worker.load         === "function") await worker.load();
  if (typeof worker.reinitialize === "function") await worker.reinitialize("eng");
  else if (typeof worker.initialize === "function") await worker.initialize("eng");

  if (typeof worker.setParameters === "function") {
    await worker.setParameters({
      preserve_interword_spaces: "1",
      tessedit_pageseg_mode:     "6",
    });
  }

  return worker;
}

async function runOCR(worker, canvas, psm) {
  if (typeof worker.setParameters === "function") {
    await worker.setParameters({ tessedit_pageseg_mode: String(psm) });
  }
  const result = await worker.recognize(canvas);
  return String(result?.data?.text ?? "").trim();
}

// ---------------------------------------------------------------------------
// Quality scoring
// Returns a numeric score 0–100 used to pick the best OCR attempt.
// ---------------------------------------------------------------------------

function scoreText(text) {
  const s = String(text ?? "").trim();
  if (!s) return 0;

  const letters = (s.match(/[A-Za-z]/g) || []).length;
  const digits  = (s.match(/[0-9]/g)    || []).length;
  const lines   = s.split("\n").filter((x) => x.trim()).length;
  const ratio   = letters / (s.length || 1);

  return (
    Math.min(1, s.length / 700)  * 40 +
    Math.min(1, ratio   / 0.45)  * 40 +
    Math.min(1, lines   / 18)    * 15 +
    Math.min(1, digits  / 80)    *  5
  );
}

/**
 * Compute a human-readable quality label from OCR text.
 * Returns: { label: string, tone: "good"|"warn"|"bad", score: number, action: string|null }
 */
export function computeOCRQuality(text) {
  const s      = String(text ?? "").trim();
  const score  = scoreText(s);
  const letters = (s.match(/[A-Za-z]/g) || []).length;
  const ratio   = letters / (s.length || 1);

  if (!s) {
    return { label: "No text detected", tone: "bad", score: 0, action: "retake" };
  }

  if (s.length > 250 && ratio > 0.35) {
    return { label: "Good scan",    tone: "good", score, action: null };
  }
  if (s.length > 120 && ratio > 0.22) {
    return { label: "Okay scan",    tone: "warn", score, action: "recrop" };
  }
  return   { label: "Low clarity", tone: "bad",  score, action: "retake" };
}

// ---------------------------------------------------------------------------
// Scan a single file — runs OCR_ATTEMPTS in order with early exit
// Returns { text, psm, mode, quality }
// ---------------------------------------------------------------------------

async function scanSingleFile(worker, file, workCanvas) {
  const resized                                 = await resizeFile(file);
  const { bitmap, width, height, close }        = await decodeBitmapFromFile(resized);

  workCanvas.width  = width;
  workCanvas.height = height;

  const ctx = workCanvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);

  // Apply grayscale+contrast once — threshold mode re-applies on top
  applyGrayscaleContrast(workCanvas);

  let bestText  = "";
  let bestScore = -1;
  let bestPsm   = OCR_ATTEMPTS[0].psm;
  let bestMode  = OCR_ATTEMPTS[0].mode;

  for (const attempt of OCR_ATTEMPTS) {
    if (attempt.mode === "thresh") {
      // Reset to bitmap then re-apply grayscale before thresholding
      ctx.drawImage(bitmap, 0, 0);
      applyGrayscaleContrast(workCanvas);
      applyThreshold(workCanvas);
    }

    const text  = await runOCR(worker, workCanvas, attempt.psm);
    const score = scoreText(text);

    if (score > bestScore) {
      bestScore = score;
      bestText  = text;
      bestPsm   = attempt.psm;
      bestMode  = attempt.mode;
    }

    // Early exit — no need to run more expensive attempts
    if (bestScore >= EARLY_EXIT_SCORE) break;
  }

  close();

  return {
    text:    bestText,
    psm:     bestPsm,
    mode:    bestMode,
    quality: computeOCRQuality(bestText),
  };
}

// ---------------------------------------------------------------------------
// Scan state shape
// Single object prevents multiple re-renders per loop iteration.
// ---------------------------------------------------------------------------

const INITIAL_SCAN_STATE = {
  isLoading:      false,
  currentIndex:   null,
  completedCount: 0,
  texts:          [],
  error:          "",
};

// ---------------------------------------------------------------------------
// useOCR hook
// ---------------------------------------------------------------------------

/**
 * @param {object}   options
 * @param {function} options.onScan       — called with (text, meta) after each file
 * @param {string[]} options.croppedFlags — tracks which files have been cropped
 * @param {string[]} options.athleteNames — optional per-file labels
 *
 * Returns:
 *   scanState   — { isLoading, currentIndex, completedCount, texts, error }
 *   startScan   — (files: File[]) => Promise<void>
 *   clearError  — () => void
 */
export function useOCR({ onScan, croppedFlags = [], athleteNames = [] } = {}) {
  const [scanState, setScanState] = useState(INITIAL_SCAN_STATE);

  // Keep a ref to the active worker so we can terminate on unmount
  const workerRef = useRef(null);

  const clearError = useCallback(() => {
    setScanState((prev) => ({ ...prev, error: "" }));
  }, []);

  const startScan = useCallback(
    async (files) => {
      if (!files?.length) {
        setScanState((prev) => ({ ...prev, error: "Please add a label photo first." }));
        return;
      }

      setScanState({
        isLoading:      true,
        currentIndex:   0,
        completedCount: 0,
        texts:          new Array(files.length).fill(""),
        error:          "",
      });

      let worker = null;

      try {
        worker         = await initOCRWorker();
        workerRef.current = worker;

        // Reuse one offscreen canvas across all files (mobile memory-friendly)
        const workCanvas = document.createElement("canvas");

        for (let i = 0; i < files.length; i++) {
          // Update current index
          setScanState((prev) => ({ ...prev, currentIndex: i }));

          let result;
          try {
            result = await scanSingleFile(worker, files[i], workCanvas);
          } catch (fileErr) {
            console.error(`OCR failed for file ${files[i]?.name}:`, fileErr);
            throw new Error(
              `Could not process "${files[i]?.name || "label"}". ` +
              `Try cropping closer to the ingredients panel or taking a screenshot.`
            );
          }

          // Batch update: text + progress in one setState call
          setScanState((prev) => {
            const texts = [...prev.texts];
            texts[i]    = result.text;
            return { ...prev, texts, completedCount: i + 1 };
          });

          if (typeof onScan === "function") {
            try {
              await onScan(result.text, {
                index:       i,
                total:       files.length,
                fileName:    files[i]?.name    ?? "",
                cropped:     !!croppedFlags[i],
                athleteName: athleteNames[i]   ?? "",
                psmUsed:     result.psm,
                preprocess:  result.mode,
                quality:     result.quality,
              });
            } catch (cbErr) {
              console.error("onScan callback error:", cbErr);
            }
          }
        }
      } catch (err) {
        console.error("OCR pipeline error:", err);
        setScanState((prev) => ({
          ...prev,
          error: err?.message ||
            "OCR failed. Try zooming in on the ingredients panel or uploading a screenshot.",
        }));
      } finally {
        try {
          if (worker && typeof worker.terminate === "function") {
            await worker.terminate();
          }
        } catch (e) {
          console.warn("Worker terminate failed (non-fatal):", e);
        }

        workerRef.current = null;
        setScanState((prev) => ({
          ...prev,
          isLoading:    false,
          currentIndex: null,
        }));
      }
    },
    [onScan, croppedFlags, athleteNames]
  );

  return { scanState, startScan, clearError };
}