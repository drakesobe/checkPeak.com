// components/BarcodeUpload.jsx
"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from "@zxing/library";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";
import Cropper from "react-easy-crop";
import ProgressBar from "./ProgressBar";

// ---------------------------------------------------------------------------
// Design tokens - matches OCRUpload / scanResultsTokens exactly
// ---------------------------------------------------------------------------

const DS = {
  brand: "#4FABFF", brandLight: "#4FABFF",
  brandBg: "rgba(79,171,255,0.07)", brandBorder: "rgba(79,171,255,0.18)",
  safe: "#059669", safeBg: "#ECFDF5", safeBorder: "#A7F3D0",
  caution: "#B45309", cautionBg: "#FFFBEB", cautionBorder: "#FDE68A",
  banned: "#DC2626", bannedBg: "#FEF2F2", bannedBorder: "#FECACA",
  cardBg: "#FFFFFF", pageBg: "#F4F7FB", border: "#E2E8F0",
  labelText: "#64748B", bodyText: "#0D1B2A", dimText: "#94A3B8",
};

const BARCODE_FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Barlow:wght@400;500;600;700&display=swap');
  .bc-display { font-family: 'Barlow Condensed', sans-serif; letter-spacing: 0.04em; }
  .bc-body    { font-family: 'Barlow', sans-serif; }
`;

const BEEP_SRC =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

// ---------------------------------------------------------------------------
// Utilities - unchanged from original
// ---------------------------------------------------------------------------

const isBlobUrl             = (s) => typeof s === "string" && s.startsWith("blob:");
const normalizeBarcodeDigits = (s) => String(s || "").replace(/\D/g, "");

const detectHeic = (file) => {
  const type = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "").toLowerCase();
  return type.includes("heic") || type.includes("heif") || name.endsWith(".heic") || name.endsWith(".heif");
};

function computeGtinCheckDigit(bodyDigits) {
  const digits = String(bodyDigits || "").replace(/\D/g, "");
  if (!digits.length) return null;
  let sum = 0, weight = 3;
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

function normalizeAndValidateBarcode(raw) {
  const digits = normalizeBarcodeDigits(raw);
  if (!digits) return { ok: false, digits: "", reason: "empty" };
  if (digits.length === 13 && digits.startsWith("0")) {
    const maybeUpc = digits.slice(1);
    if (isValidGtin(maybeUpc)) return { ok: true, digits: maybeUpc, type: "UPC-A" };
  }
  if ([8, 12, 13, 14].includes(digits.length)) {
    if (isValidGtin(digits)) return { ok: true, digits, type: "GTIN" };
    return { ok: false, digits, reason: "checksum" };
  }
  return { ok: false, digits, reason: "length" };
}

// ---------------------------------------------------------------------------
// Image decode - unchanged
// ---------------------------------------------------------------------------

async function decodeBitmapFromFile(file) {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { bitmap: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close?.() };
    } catch {}
  }
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = dataUrl;
  });
  return { bitmap: img, width: img.naturalWidth || img.width, height: img.naturalHeight || img.height, close: () => {} };
}

async function cropFileToRegion(file, cropRect) {
  if (!cropRect || cropRect.width <= 0 || cropRect.height <= 0) throw new Error("Invalid crop region");
  const { bitmap, width, height, close } = await decodeBitmapFromFile(file);
  const sx = Math.max(0, Math.min(width - 1,  Math.round(cropRect.x)));
  const sy = Math.max(0, Math.min(height - 1, Math.round(cropRect.y)));
  const sw = Math.max(1, Math.min(width - sx,  Math.round(cropRect.width)));
  const sh = Math.max(1, Math.min(height - sy, Math.round(cropRect.height)));
  const canvas = document.createElement("canvas");
  canvas.width = sw; canvas.height = sh;
  canvas.getContext("2d", { willReadFrequently: true }).drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Crop failed"))), "image/jpeg", 0.92)
  );
  close?.();
  const croppedFile = new File([blob], file.name.replace(/(\.\w+)?$/, "_barcode_crop.jpg"), { type: "image/jpeg" });
  return { file: croppedFile, blobUrl: URL.createObjectURL(croppedFile) };
}

// ---------------------------------------------------------------------------
// Preprocessing - unchanged
// ---------------------------------------------------------------------------

function applyGrayscaleContrast(ctx, w, h, contrast = 1.25) {
  try {
    const id = ctx.getImageData(0, 0, w, h); const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
      let v = Math.max(0, Math.min(255, (gray - 128) * contrast + 128));
      d[i] = d[i+1] = d[i+2] = v;
    }
    ctx.putImageData(id, 0, 0);
  } catch {}
}

function applyInvert(ctx, w, h) {
  try {
    const id = ctx.getImageData(0, 0, w, h); const d = id.data;
    for (let i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i+1] = 255 - d[i+1]; d[i+2] = 255 - d[i+2]; }
    ctx.putImageData(id, 0, 0);
  } catch {}
}

function applyThreshold(ctx, w, h, thresh = 170) {
  try {
    const id = ctx.getImageData(0, 0, w, h); const d = id.data;
    for (let i = 0; i < d.length; i += 4) { const v = d[i] > thresh ? 255 : 0; d[i] = d[i+1] = d[i+2] = v; }
    ctx.putImageData(id, 0, 0);
  } catch {}
}

// ---------------------------------------------------------------------------
// OCR numeric fallback - unchanged
// ---------------------------------------------------------------------------

function coerceDigitsFromOCR(text) {
  return String(text || "").replace(/[Oo]/g,"0").replace(/[Il|]/g,"1").replace(/[Ss]/g,"5").replace(/[Bb]/g,"8");
}

// ---------------------------------------------------------------------------
// BarcodeUpload
// ---------------------------------------------------------------------------

export default function BarcodeUpload({
  multiple = false,
  onResult,
  showScanButton = true,
  preferredFormats,
}) {
  const [files,          setFiles]          = useState([]);
  const [previewURLs,    setPreviewURLs]    = useState([]);
  const [athleteNames,   setAthleteNames]   = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [progress,       setProgress]       = useState(0);
  const [animDots,       setAnimDots]       = useState("");
  const [error,          setError]          = useState("");
  const [isDragging,     setIsDragging]     = useState(false);
  const [showSuccess,    setShowSuccess]    = useState(false);
  const [enableChime,    setEnableChime]    = useState(true);

  const [showCropModal,      setShowCropModal]      = useState(false);
  const [cropIndex,          setCropIndex]          = useState(null);
  const [crop,               setCrop]               = useState({ x: 0, y: 0 });
  const [zoom,               setZoom]               = useState(1);
  const [croppedAreaPixels,  setCroppedAreaPixels]  = useState(null);
  const [aspectMode,         setAspectMode]         = useState("barcode");
  const [croppedFlags,       setCroppedFlags]       = useState([]);
  const [currentScanIndex,   setCurrentScanIndex]   = useState(null);

  const fileInputRef       = useRef(null);
  const cameraInputRef     = useRef(null);
  const audioRef           = useRef(null);
  const codeReaderRef      = useRef(null);
  const ocrWorkerRef       = useRef(null);
  const ocrInitializingRef = useRef(false);
  const previewURLsRef     = useRef([]);

  const MAX_FILE_SIZE = 8 * 1024 * 1024;

  const NAME_TO_FORMAT = useMemo(() => ({
    AZTEC: BarcodeFormat.AZTEC, CODABAR: BarcodeFormat.CODABAR,
    CODE_39: BarcodeFormat.CODE_39, CODE_93: BarcodeFormat.CODE_93,
    CODE_128: BarcodeFormat.CODE_128, DATA_MATRIX: BarcodeFormat.DATA_MATRIX,
    EAN_8: BarcodeFormat.EAN_8, EAN_13: BarcodeFormat.EAN_13,
    ITF: BarcodeFormat.ITF, MAXICODE: BarcodeFormat.MAXICODE,
    PDF_417: BarcodeFormat.PDF_417, QR_CODE: BarcodeFormat.QR_CODE,
    RSS_14: BarcodeFormat.RSS_14, RSS_EXPANDED: BarcodeFormat.RSS_EXPANDED,
    UPC_A: BarcodeFormat.UPC_A, UPC_E: BarcodeFormat.UPC_E,
    UPC_EAN_EXTENSION: BarcodeFormat.UPC_EAN_EXTENSION,
  }), []);

  const mapFormats = useCallback((arr = []) => {
    const out = [];
    for (const name of arr) {
      const n = ("" + name).toUpperCase();
      if (NAME_TO_FORMAT[n]) out.push(NAME_TO_FORMAT[n]);
    }
    return out;
  }, [NAME_TO_FORMAT]);

  const effectiveFormats = useMemo(() => {
    if (Array.isArray(preferredFormats) && preferredFormats.length) return mapFormats(preferredFormats);
    return [BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8];
  }, [preferredFormats, mapFormats]);

  const makeReader = useCallback(() => {
    try {
      const hints = new Map();
      if (effectiveFormats?.length) hints.set(DecodeHintType.POSSIBLE_FORMATS, effectiveFormats);
      hints.set(DecodeHintType.TRY_HARDER, true);
      return new BrowserMultiFormatReader(hints, 300);
    } catch (err) {
      console.warn("Failed to create ZXing reader:", err);
      return null;
    }
  }, [effectiveFormats]);

  useEffect(() => { audioRef.current = typeof Audio !== "undefined" ? new Audio(BEEP_SRC) : null; }, []);
  useEffect(() => { return () => previewURLsRef.current.forEach((u) => URL.revokeObjectURL(u)); }, []);
  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setAnimDots((d) => (d.length >= 3 ? "" : d + ".")), 450);
    return () => clearInterval(id);
  }, [loading]);
  useEffect(() => {
    try { codeReaderRef.current?.reset?.(); } catch {}
    codeReaderRef.current = makeReader();
    return () => { try { codeReaderRef.current?.reset?.(); } catch {} codeReaderRef.current = null; };
  }, [makeReader]);
  useEffect(() => {
    return () => {
      try { ocrWorkerRef.current?.terminate?.(); } catch {}
      ocrWorkerRef.current = null;
      ocrInitializingRef.current = false;
    };
  }, []);

  const validateFile = (file) => {
    if (!file) return false;
    if (detectHeic(file)) {
      setError(
        "This photo is in HEIC format.\n\nOn iPhone:\n• Take a screenshot of the barcode and upload that, or\n• Go to Settings → Camera → Formats → Most Compatible, then retake."
      );
      return false;
    }
    if (!String(file?.type || "").startsWith("image/")) { setError("Only image files are allowed."); return false; }
    if (file.size > MAX_FILE_SIZE) { setError("File too large. Max 8 MB."); return false; }
    setError("");
    return true;
  };

  const resetCropState = () => { setCrop({ x: 0, y: 0 }); setZoom(1); setCroppedAreaPixels(null); setAspectMode("barcode"); };

  const handleFiles = (fileList) => {
    const valid = Array.from(fileList || []).filter(validateFile);
    if (!valid.length) return;
    previewURLsRef.current.forEach((u) => URL.revokeObjectURL(u));
    const urls = valid.map((f) => URL.createObjectURL(f));
    previewURLsRef.current = urls;
    setFiles(valid);
    setPreviewURLs(urls);
    setAthleteNames(valid.map(() => ""));
    setCroppedFlags(valid.map(() => false));
    resetCropState();
    setCropIndex(0);
    setShowCropModal(true);
  };

  const handleDragOver  = (e) => { e.preventDefault(); setIsDragging(true);  };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop      = (e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); };

  const handleNameChange = (idx, value) => {
    const names = [...athleteNames]; names[idx] = value; setAthleteNames(names);
  };

  const playBeep = () => {
    if (!enableChime || !audioRef.current) return;
    try { audioRef.current.currentTime = 0; audioRef.current.play().catch(() => {}); } catch {}
  };

  // OCR worker - unchanged
  const initOCRWorker = useCallback(async () => {
    if (ocrWorkerRef.current) return ocrWorkerRef.current;
    if (ocrInitializingRef.current) {
      while (ocrInitializingRef.current && !ocrWorkerRef.current) {
        await new Promise((r) => setTimeout(r, 100));
      }
      return ocrWorkerRef.current;
    }
    try {
      ocrInitializingRef.current = true;
      const mod = await import("tesseract.js");
      const createWorker = mod.createWorker || mod.default?.createWorker;
      if (!createWorker) throw new Error("Tesseract createWorker not found.");
      const worker = await createWorker();
      if (typeof worker.load === "function") await worker.load();
      if (typeof worker.reinitialize === "function") await worker.reinitialize("eng");
      else if (typeof worker.initialize === "function") await worker.initialize("eng");
      if (typeof worker.setParameters === "function") {
        await worker.setParameters({ tessedit_char_whitelist: "0123456789", preserve_interword_spaces: "1", tessedit_pageseg_mode: "11" });
      }
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
      const result = await worker.recognize(canvas);
      const text = coerceDigitsFromOCR(result?.data?.text || "");
      if (!text) return null;
      const digits = normalizeBarcodeDigits(text);
      if (!digits) return null;
      const candidates = [
        ...digits.matchAll(/\d{14}/g), ...digits.matchAll(/\d{13}/g),
        ...digits.matchAll(/\d{12}/g), ...digits.matchAll(/\d{8}/g),
      ].map((m) => m[0]);
      for (const c of candidates) { const v = normalizeAndValidateBarcode(c); if (v.ok) return v.digits; }
      return null;
    } catch (err) { console.warn("Tesseract OCR failed:", err); return null; }
  }

  async function decodeBarcodeFromFile(file) {
    const reader = codeReaderRef.current || makeReader();
    if (!reader) throw new Error("Barcode scanner not available.");
    const { bitmap, close } = await decodeBitmapFromFile(file);
    const MAX_SIDE = 1600;
    const rotations = [0, 90, 180, 270];
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const preprocessPasses = [
      { name: "none",        fn: () => {} },
      { name: "gray",        fn: () => applyGrayscaleContrast(ctx, canvas.width, canvas.height, 1.25) },
      { name: "gray+thresh", fn: () => { applyGrayscaleContrast(ctx, canvas.width, canvas.height, 1.35); applyThreshold(ctx, canvas.width, canvas.height, 175); } },
      { name: "invert+gray", fn: () => { applyGrayscaleContrast(ctx, canvas.width, canvas.height, 1.25); applyInvert(ctx, canvas.width, canvas.height); } },
    ];
    let lastErr = null;
    try {
      for (const rot of rotations) {
        if (rot % 180 === 0) { canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale); }
        else { canvas.width = Math.round(bitmap.height * scale); canvas.height = Math.round(bitmap.width * scale); }
        ctx.save(); ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate((rot * Math.PI) / 180);
        ctx.drawImage(bitmap, -(bitmap.width * scale) / 2, -(bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
        ctx.restore();
        for (const pass of preprocessPasses) {
          try {
            ctx.save();
            if (pass.name !== "none") {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate((rot * Math.PI) / 180);
              ctx.drawImage(bitmap, -(bitmap.width * scale) / 2, -(bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
              ctx.restore();
            } else { ctx.restore(); }
            pass.fn();
            const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
            const tmpImg = new Image();
            await new Promise((res, rej) => { tmpImg.onload = res; tmpImg.onerror = rej; tmpImg.src = dataUrl; });
            const result = await reader.decodeFromImageElement(tmpImg);
            const barcodeText = result?.getText?.() || result?.text || "";
            if (barcodeText) return barcodeText;
          } catch (err) { lastErr = err; }
        }
      }
      const ocrResult = await performOCROnCanvas(canvas);
      if (ocrResult) return ocrResult;
      throw lastErr || new Error("No barcode decoded from image.");
    } finally {
      close?.();
      try { reader.reset?.(); } catch {}
    }
  }

  async function fetchMatches(barcodeDigits, meta = {}) {
    const resp = await fetch("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcode: barcodeDigits, isBarcodeFlow: true, ...meta }),
    });
    if (!resp.ok) { const txt = await resp.text().catch(() => null); throw new Error(txt || `Barcode check failed (${resp.status})`); }
    return resp.json();
  }

  async function handleDecodedBarcodePipeline(barcodeText, idx = null) {
    setError("");
    const parsed = normalizeAndValidateBarcode(barcodeText);
    if (!parsed.ok) {
      setError(
        parsed.reason === "empty"    ? "No barcode detected. Try cropping tighter around the barcode." :
        parsed.reason === "length"   ? "That scan doesn't look like a standard UPC/EAN barcode." :
        parsed.reason === "checksum" ? "Barcode digits read but checksum is invalid. Try cropping tighter or reducing glare." :
        "Could not validate barcode. Try again."
      );
      return null;
    }
    try {
      const data = await fetchMatches(parsed.digits, { barcodeType: parsed.type || "GTIN" });
      const result = {
        barcode: parsed.digits, barcodeType: parsed.type || "GTIN",
        productName: data?.productName || "Unknown product",
        rawIngredients: data?.ocrText || "",
        matchedBanned: data?.matchedBanned || [],
        matchedIngredients: data?.matchedIngredients || [],
        source: data?.debug?.fetchedFrom || "providers",
        idx,
        athleteName: idx != null ? athleteNames[idx] || "" : "",
        cropped: idx != null ? !!croppedFlags[idx] : false,
      };
      setShowSuccess(true);
      playBeep();
      setTimeout(() => setShowSuccess(false), 900);
      if (typeof onResult === "function") await onResult(result);
      return result;
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to process barcode.");
      throw err;
    }
  }

  const handleScanAllBarcodes = async () => {
    if (!files.length) return;
    setError(""); setLoading(true); setProgress(0);
    const total = Math.max(1, files.length);
    for (let i = 0; i < files.length; i++) {
      setCurrentScanIndex(i);
      setProgress(Math.round((i / total) * 100));
      try {
        const raw = await decodeBarcodeFromFile(files[i]);
        if (!raw) throw new Error("No barcode decoded");
        await handleDecodedBarcodePipeline(raw, i);
      } catch (err) { console.warn("Scan failed for index", i, err); }
      setProgress(Math.round(((i + 1) / total) * 100));
    }
    setLoading(false); setProgress(0); setCurrentScanIndex(null);
  };

  const onCropComplete = (_, croppedPixels) => setCroppedAreaPixels(croppedPixels);

  const handleConfirmCrop = async () => {
    if (cropIndex == null || !croppedAreaPixels) { setShowCropModal(false); return; }
    try {
      const originalFile = files[cropIndex];
      if (!originalFile) { setShowCropModal(false); return; }
      const { file, blobUrl } = await cropFileToRegion(originalFile, croppedAreaPixels);
      setFiles((prev) => { const u = [...prev]; u[cropIndex] = file; return u; });
      setPreviewURLs((prev) => {
        const u = [...prev];
        if (isBlobUrl(u[cropIndex])) URL.revokeObjectURL(u[cropIndex]);
        u[cropIndex] = blobUrl;
        return u;
      });
      setCroppedFlags((prev) => { const u = [...prev]; u[cropIndex] = true; return u; });
      const nextIdx = cropIndex + 1;
      if (multiple && nextIdx < files.length) { resetCropState(); setCropIndex(nextIdx); setShowCropModal(true); return; }
      setShowCropModal(false);
    } catch (err) {
      console.error("Crop apply error:", err);
      setError("Could not crop image. Please try again.");
      setShowCropModal(false);
    }
  };

  const openCropForIndex = (idx) => {
    if (!previewURLs[idx]) return;
    resetCropState(); setCropIndex(idx); setShowCropModal(true);
  };

  const aspectValue = aspectMode === "barcode" ? 5 / 2 : undefined;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: BARCODE_FONTS }} />

      <div className="bc-body space-y-5 mt-4" style={{ maxWidth: "100%" }}>

        {/* ── Step header - matches OCRUpload exactly ─────────────── */}
        <div className="max-w-3xl mx-auto space-y-2">
          <div className="flex items-center gap-2">
            <span
              className="bc-body inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest"
              style={{ backgroundColor: DS.brandBg, color: DS.brand, border: `1px solid ${DS.brandBorder}` }}
            >
              Step 1 · Barcode Scan
            </span>
          </div>
          <h2
            className="bc-display font-bold"
            style={{ fontSize: "clamp(1.1rem, 3vw, 1.4rem)", color: DS.bodyText }}
          >
            Scan a product barcode
          </h2>
          <p className="bc-body text-sm" style={{ color: DS.labelText, lineHeight: 1.6 }}>
            Upload a photo of the barcode, crop tight to just the stripe and numbers, then scan to check for banned substances.
          </p>
        </div>

        {/* ── Upload zone - mirrors OCRUpload UploadZone ───────────── */}
        <div
          className="w-full max-w-3xl mx-auto rounded-2xl overflow-hidden transition"
          style={{
            backgroundColor: isDragging ? DS.brandBg : DS.cardBg,
            border: `2px dashed ${isDragging ? DS.brandLight : DS.border}`,
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center px-6 py-6 gap-4">
            <div className="text-center">
              <p
                className="bc-display font-bold text-base"
                style={{ color: DS.bodyText, letterSpacing: "0.03em" }}
              >
                {files.length
                  ? `${files.length} barcode photo${files.length > 1 ? "s" : ""} selected`
                  : "Add a barcode photo"}
              </p>
              <p className="bc-body text-xs mt-1" style={{ color: DS.labelText }}>
                {files.length
                  ? "You can add more or re-crop below."
                  : "Fill the frame with the barcode. After upload, crop tight to the stripe and numbers for best accuracy."}
              </p>
            </div>

            {/* Primary CTA - camera */}
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="bc-display w-full sm:w-auto flex items-center justify-center gap-2.5 rounded-2xl font-bold transition"
              style={{
                height: 52, paddingLeft: 28, paddingRight: 28,
                backgroundColor: DS.brand, color: "#fff",
                fontSize: 15, letterSpacing: "0.05em", minWidth: 200,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#254d80")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = DS.brand)}
            >
              <span style={{ fontSize: 18 }}>📷</span>
              {files.length ? "Retake Photo" : "Take Photo"}
            </button>

            {/* Secondary CTA - library */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bc-body text-xs font-semibold underline underline-offset-2 transition"
              style={{ color: DS.labelText }}
              onMouseEnter={(e) => (e.currentTarget.style.color = DS.brand)}
              onMouseLeave={(e) => (e.currentTarget.style.color = DS.labelText)}
            >
              or upload from photos / files
            </button>
          </div>
        </div>

        {/* Hidden inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          multiple={multiple}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {/* ── Crop modal - dark sheet, same as original ────────────── */}
        {showCropModal && cropIndex != null && previewURLs[cropIndex] && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-md bg-neutral-900 rounded-2xl overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
                <div className="flex flex-col">
                  <h2 className="bc-display text-sm font-bold text-white" style={{ letterSpacing: "0.04em" }}>
                    Crop Barcode Area {multiple ? `(${cropIndex + 1}/${files.length})` : ""}
                  </h2>
                  <p className="bc-body text-[11px] text-neutral-400">
                    Drag the box along the barcode stripe and numbers.
                  </p>
                </div>
                <button onClick={() => setShowCropModal(false)} className="text-neutral-400 hover:text-white text-lg leading-none" aria-label="Close crop">×</button>
              </div>

              <div className="relative w-full h-[58vh] bg-black">
                <Cropper
                  image={previewURLs[cropIndex]}
                  crop={crop} zoom={zoom} aspect={aspectValue}
                  onCropChange={setCrop} onZoomChange={setZoom}
                  onCropComplete={onCropComplete} showGrid={false}
                />
              </div>

              <div className="flex flex-col gap-3 px-4 py-3 bg-neutral-900 border-t border-neutral-800">
                <div className="flex items-center justify-between gap-2">
                  {[["barcode","Barcode Stripe","sky"], ["free","Free Crop","amber"]].map(([mode, label, color]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setAspectMode(mode)}
                      className={`flex-1 px-3 py-1.5 rounded-xl bc-body text-[11px] font-medium border ${
                        aspectMode === mode
                          ? `border-${color}-400 bg-${color}-500/10 text-${color}-200`
                          : "border-neutral-700 text-neutral-200 hover:bg-neutral-800"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <span className="bc-body text-[11px] text-neutral-300 w-12">Zoom</span>
                  <input type="range" min={1} max={3} step={0.1} value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="flex-1 accent-[#5B9EC9]" aria-label="Crop zoom" />
                  <span className="bc-body text-[11px] text-neutral-400 w-10 text-right">{zoom.toFixed(1)}x</span>
                </div>
                <button
                  onClick={handleConfirmCrop}
                  className="bc-display mt-1 w-full px-4 py-2.5 rounded-xl text-white text-sm font-bold transition shadow-sm"
                  style={{ backgroundColor: DS.brand, letterSpacing: "0.04em" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#254d80")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = DS.brand)}
                >
                  {multiple && cropIndex + 1 < files.length ? "Use Crop + Next →" : "Use Crop →"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Preview cards - matches FilePreviewCard style ────────── */}
        {files.map((file, idx) => (
          <div
            key={idx}
            className="bc-body flex flex-col gap-3 max-w-3xl mx-auto rounded-2xl px-4 py-4"
            style={{
              backgroundColor: DS.cardBg,
              border: `1.5px solid ${DS.border}`,
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            }}
          >
            {/* Top row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: DS.bodyText }}>{file.name}</p>
                {files.length > 1 && (
                  <p className="text-[10px]" style={{ color: DS.dimText }}>Barcode {idx + 1} of {files.length}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {croppedFlags[idx] && (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: DS.safeBg, color: DS.safe, border: `1px solid ${DS.safeBorder}` }}
                  >
                    Cropped
                  </span>
                )}
              </div>
            </div>

            {/* Athlete name */}
            <div>
              <label className="block text-[11px] font-semibold mb-1" style={{ color: DS.labelText }}>
                Athlete or Team Name{" "}
                <span style={{ color: DS.dimText, fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                type="text"
                value={athleteNames[idx] ?? ""}
                onChange={(e) => handleNameChange(idx, e.target.value)}
                placeholder="e.g. Jordan #22"
                className="bc-body w-full px-3 py-2.5 rounded-xl text-sm transition"
                style={{ border: `1.5px solid ${DS.border}`, color: DS.bodyText, backgroundColor: DS.pageBg, outline: "none" }}
                onFocus={(e) => (e.currentTarget.style.borderColor = DS.brandLight)}
                onBlur={(e)  => (e.currentTarget.style.borderColor = DS.border)}
              />
            </div>

            {/* Preview image */}
            <img
              src={previewURLs[idx]}
              alt={`Barcode ${idx + 1} preview`}
              className="w-full rounded-xl object-contain"
              style={{ maxHeight: 220, backgroundColor: DS.pageBg, border: `1px solid ${DS.border}` }}
              loading="lazy"
            />

            {/* Re-crop button */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => openCropForIndex(idx)}
                className="bc-body inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition"
                style={{ color: DS.brand, backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}` }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#dce8f5")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = DS.brandBg)}
              >
                ✂ Re-Crop
              </button>
              {!croppedFlags[idx] && (
                <p className="bc-body text-[11px]" style={{ color: DS.dimText }}>
                  Tip: Crop tight to the barcode stripe and numbers
                </p>
              )}
            </div>
          </div>
        ))}

        {/* ── Privacy note ─────────────────────────────────────────── */}
        <p
          className="bc-body text-[11px] text-center max-w-3xl mx-auto"
          style={{ color: DS.dimText }}
        >
          Photos stay on your device for decoding. Only the barcode digits are sent to our servers.
        </p>

        {/* ── Error ────────────────────────────────────────────────── */}
        {error && (
          <div
            className="bc-body max-w-3xl mx-auto rounded-2xl px-4 py-3"
            style={{ backgroundColor: DS.bannedBg, border: `1px solid ${DS.bannedBorder}` }}
          >
            <p className="text-sm whitespace-pre-line" style={{ color: DS.banned }}>{error}</p>
          </div>
        )}

        {/* ── Scan progress ────────────────────────────────────────── */}
        {loading && (
          <div className="max-w-3xl mx-auto space-y-2">
            <ProgressBar progress={progress} />
            {currentScanIndex != null && (
              <p className="bc-body text-[11px] text-right" style={{ color: DS.dimText }}>
                Scanning barcode {currentScanIndex + 1} of {files.length}{animDots}
              </p>
            )}
          </div>
        )}

        {/* ── Scan button - matches OCRUpload scan button ──────────── */}
        {showScanButton && (
          <div className="max-w-3xl mx-auto flex justify-end">
            <button
              type="button"
              onClick={handleScanAllBarcodes}
              disabled={loading || !files.length}
              className="bc-display w-full md:w-auto flex items-center justify-center gap-2.5 rounded-2xl font-bold transition"
              style={{
                height: 52, paddingLeft: 32, paddingRight: 32,
                fontSize: 15, letterSpacing: "0.05em",
                backgroundColor: loading || !files.length ? DS.border : DS.brand,
                color: loading || !files.length ? DS.dimText : "#fff",
                cursor: loading || !files.length ? "not-allowed" : "pointer",
                boxShadow: loading || !files.length ? "none" : "0 2px 12px rgba(30,58,95,0.25)",
              }}
              onMouseEnter={(e) => { if (!loading && files.length) e.currentTarget.style.backgroundColor = "#254d80"; }}
              onMouseLeave={(e) => { if (!loading && files.length) e.currentTarget.style.backgroundColor = DS.brand; }}
            >
              {loading ? (
                <>
                  <span
                    className="inline-block rounded-full border-2 border-t-transparent animate-spin"
                    style={{ width: 16, height: 16, borderColor: `${DS.dimText}60`, borderTopColor: DS.dimText }}
                  />
                  {currentScanIndex != null
                    ? `Scanning ${currentScanIndex + 1} of ${files.length}${animDots}`
                    : `Scanning${animDots}`}
                </>
              ) : !files.length ? (
                "Add a photo to scan"
              ) : multiple ? (
                "Scan All Barcodes →"
              ) : (
                "Scan Barcode →"
              )}
            </button>
          </div>
        )}

        {/* ── Bottom tip ───────────────────────────────────────────── */}
        <p
          className="bc-body text-[11px] text-center max-w-3xl mx-auto pb-2"
          style={{ color: DS.dimText }}
        >
          Avoid glare, keep the barcode flat, and include the full stripe and numbers. If a scan fails, re-crop tighter.
        </p>
      </div>

      {/* ── Success checkmark ────────────────────────────────────── */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.22 }}
            className="fixed bottom-8 right-8 z-50"
          >
            <div style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }}
              className="backdrop-blur-md p-3 rounded-full shadow-lg">
              <Check className="w-6 h-6" style={{ color: DS.safe }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}