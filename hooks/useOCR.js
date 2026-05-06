// hooks/useOCR.js
//
// Drop-in replacement for the Tesseract-based useOCR hook.
// Uses AWS Textract via /api/ocr/textract instead of running
// Tesseract in the browser. All exports, return shapes, and
// onScan callback signatures are identical - nothing upstream changes.

"use client";

import { useState, useCallback } from "react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 5 * 1024 * 1024; // Textract hard limit
const MAX_RESIZE_DIM = 2000;            // slightly higher than Tesseract - Textract handles it
const RESIZE_QUALITY = 0.92;

// ---------------------------------------------------------------------------
// Image resize
// Keeps the same resize logic as before so large photos don't breach
// Textract's 5 MB limit and upload times stay reasonable.
// ---------------------------------------------------------------------------

async function decodeBitmap(file) {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { bitmap: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close?.() };
    } catch { /* fall through */ }
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = (e) => resolve(e.target.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const im = new Image();
    im.onload  = () => resolve(im);
    im.onerror = reject;
    im.src     = dataUrl;
  });

  return {
    bitmap: img,
    width:  img.naturalWidth  || img.width,
    height: img.naturalHeight || img.height,
    close:  () => {},
  };
}

async function resizeForTextract(file) {
  if (file.size <= MAX_FILE_SIZE) {
    // Already within limit - still decode to normalise orientation
    const { bitmap, width: srcW, height: srcH, close } = await decodeBitmap(file);

    let w = srcW, h = srcH;
    if (w > MAX_RESIZE_DIM || h > MAX_RESIZE_DIM) {
      const scale = Math.min(MAX_RESIZE_DIM / w, MAX_RESIZE_DIM / h);
      w = Math.max(1, Math.round(w * scale));
      h = Math.max(1, Math.round(h * scale));
    }

    const canvas = document.createElement("canvas");
    canvas.width  = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);

    const blob = await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Resize failed"))),
        "image/jpeg",
        RESIZE_QUALITY
      )
    );

    close();
    return new File([blob], file.name.replace(/(\.\w+)?$/, ".jpg"), { type: "image/jpeg" });
  }

  // File too large - scale down until it fits
  const { bitmap, width: srcW, height: srcH, close } = await decodeBitmap(file);
  const scale = Math.sqrt(MAX_FILE_SIZE / file.size) * 0.9; // 10% headroom
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement("canvas");
  canvas.width  = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);

  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Resize failed"))),
      "image/jpeg",
      0.85
    )
  );

  close();
  return new File([blob], file.name.replace(/(\.\w+)?$/, ".jpg"), { type: "image/jpeg" });
}

// ---------------------------------------------------------------------------
// Quality scoring - kept identical to original so computeOCRQuality works
// ---------------------------------------------------------------------------

function scoreText(text) {
  const s = String(text ?? "").trim();
  if (!s) return 0;

  const letters = (s.match(/[A-Za-z]/g) || []).length;
  const digits  = (s.match(/[0-9]/g)    || []).length;
  const lines   = s.split("\n").filter((x) => x.trim()).length;
  const ratio   = letters / (s.length || 1);

  return (
    Math.min(1, s.length / 700) * 40 +
    Math.min(1, ratio   / 0.45) * 40 +
    Math.min(1, lines   / 18)   * 15 +
    Math.min(1, digits  / 80)   *  5
  );
}

/**
 * Compute a human-readable quality label from OCR text.
 * Identical export to the original - OCRUpload uses this directly.
 * Returns: { label, tone: "good"|"warn"|"bad", score, action }
 */
export function computeOCRQuality(text) {
  const s       = String(text ?? "").trim();
  const score   = scoreText(s);
  const letters = (s.match(/[A-Za-z]/g) || []).length;
  const ratio   = letters / (s.length || 1);

  if (!s) return { label: "No text detected", tone: "bad",  score: 0,     action: "retake" };
  if (s.length > 250 && ratio > 0.35) return { label: "Good scan",    tone: "good", score, action: null     };
  if (s.length > 120 && ratio > 0.22) return { label: "Okay scan",    tone: "warn", score, action: "recrop" };
  return                                      { label: "Low clarity",  tone: "bad",  score, action: "retake" };
}

// ---------------------------------------------------------------------------
// Send a single file to Textract via the API route
// ---------------------------------------------------------------------------

async function scanWithTextract(file) {
  const resized = await resizeForTextract(file);

  const res = await fetch("/api/ocr/textract", {
    method:  "POST",
    headers: { "Content-Type": resized.type || "image/jpeg" },
    body:    resized,
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.error || `Textract request failed (${res.status})`);
  }

  const json = await res.json();
  if (!json?.ok) throw new Error(json?.error || "Textract returned no result");

  return String(json.text ?? "").trim();
}

// ---------------------------------------------------------------------------
// Scan state - identical shape to original
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
//
// Identical interface to the Tesseract version:
//   { scanState, startScan, clearError }
//
// onScan(text, meta) meta shape is identical - psmUsed and preprocess are
// set to null since Textract doesn't expose those concepts, but the fields
// are still present so nothing downstream breaks.
// ---------------------------------------------------------------------------

export function useOCR({ onScan, croppedFlags = [], athleteNames = [] } = {}) {
  const [scanState, setScanState] = useState(INITIAL_SCAN_STATE);

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

      try {
        for (let i = 0; i < files.length; i++) {
          setScanState((prev) => ({ ...prev, currentIndex: i }));

          let text = "";
          try {
            text = await scanWithTextract(files[i]);
          } catch (fileErr) {
            console.error(`Textract failed for ${files[i]?.name}:`, fileErr);
            throw new Error(
              `Could not scan "${files[i]?.name || "label"}". ` +
              `${fileErr?.message || "Try re-cropping closer to the ingredients panel."}`
            );
          }

          const quality = computeOCRQuality(text);

          setScanState((prev) => {
            const texts = [...prev.texts];
            texts[i]    = text;
            return { ...prev, texts, completedCount: i + 1 };
          });

          if (typeof onScan === "function") {
            try {
              await onScan(text, {
                index:       i,
                total:       files.length,
                fileName:    files[i]?.name    ?? "",
                cropped:     !!croppedFlags[i],
                athleteName: athleteNames[i]   ?? "",
                psmUsed:     null,   // N/A for Textract
                preprocess:  null,   // N/A for Textract
                quality,
              });
            } catch (cbErr) {
              console.error("onScan callback error:", cbErr);
            }
          }
        }
      } catch (err) {
        console.error("Textract pipeline error:", err);
        setScanState((prev) => ({
          ...prev,
          error: err?.message || "Scan failed. Try re-cropping closer to the ingredients panel.",
        }));
      } finally {
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