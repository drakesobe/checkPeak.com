// components/OCRUpload.jsx
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import ProgressBar from "./ProgressBar";
import CropModal   from "./CropModal";
import { useOCR, computeOCRQuality } from "@/hooks/useOCR";
import { useCrop }                   from "@/hooks/useCrop";

// ---------------------------------------------------------------------------
// Design tokens — keep in sync with OCRSearchResults and SearchPage
// ---------------------------------------------------------------------------

const DS = {
  brand:        "#1E3A5F",
  brandLight:   "#5B9EC9",
  brandBg:      "#EEF3F9",
  brandBorder:  "#C0D0E0",
  safe:         "#00873E",
  safeBg:       "#F0FBF4",
  safeBorder:   "#A8E6BC",
  caution:      "#E87722",
  cautionBg:    "#FFFBF0",
  cautionBorder:"#FFE0A8",
  banned:       "#C8102E",
  bannedBg:     "#FFF0F0",
  bannedBorder: "#FFC8C8",
  cardBg:       "#FFFFFF",
  pageBg:       "#F7F9FC",
  border:       "#E8ECF0",
  labelText:    "#6B7A8D",
  bodyText:     "#2D3748",
  dimText:      "#9BA8B4",
};

const UPLOAD_FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Barlow:wght@400;500;600;700&display=swap');
  .up-display { font-family: 'Barlow Condensed', sans-serif; letter-spacing: 0.04em; }
  .up-body    { font-family: 'Barlow', sans-serif; }
`;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

// ---------------------------------------------------------------------------
// File validation
// ---------------------------------------------------------------------------

function detectHeic(file) {
  const t = String(file?.type ?? "").toLowerCase();
  const n = String(file?.name ?? "").toLowerCase();
  return t.includes("heic") || t.includes("heif") || n.endsWith(".heic") || n.endsWith(".heif");
}

function validateFile(file) {
  if (!file) return { ok: false, error: "No file provided." };
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, error: "File too large (max 5 MB). Try zooming in on just the label." };
  }
  if (detectHeic(file)) {
    return {
      ok: false,
      error:
        "This photo is in HEIC format.\n\n" +
        "On iPhone:\n" +
        "• Take a screenshot of the label and upload that, or\n" +
        "• Go to Settings → Camera → Formats → Most Compatible, then retake.",
    };
  }
  if (!ALLOWED_TYPES.includes(String(file.type ?? "").toLowerCase())) {
    return { ok: false, error: "Please upload a JPG, PNG, or WEBP photo." };
  }
  return { ok: true, error: "" };
}

// ---------------------------------------------------------------------------
// Quality banner
// Actionable — not just a label, but a specific next step
// ---------------------------------------------------------------------------

const QUALITY_CONFIG = {
  good: {
    icon:    "✓",
    iconBg:  DS.safe,
    bg:      DS.safeBg,
    border:  DS.safeBorder,
    text:    DS.safe,
    message: "Scan quality looks good.",
    action:  null,
  },
  warn: {
    icon:    "!",
    iconBg:  DS.caution,
    bg:      DS.cautionBg,
    border:  DS.cautionBorder,
    text:    DS.caution,
    message: "Some text may have been missed. Try re-cropping tighter to the ingredients panel.",
    action:  "recrop",
  },
  bad: {
    icon:    "✕",
    iconBg:  DS.banned,
    bg:      DS.bannedBg,
    border:  DS.bannedBorder,
    text:    DS.banned,
    message: "Very little text detected. Retake the photo closer to the label, or re-crop.",
    action:  "retake",
  },
};

function QualityBanner({ quality, onRecrop, onRetake }) {
  if (!quality) return null;
  const cfg = QUALITY_CONFIG[quality.tone] ?? QUALITY_CONFIG.bad;

  return (
    <div
      className="up-body flex items-start gap-3 rounded-2xl px-4 py-3"
      style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      {/* Icon */}
      <div
        className="flex items-center justify-center rounded-full shrink-0 font-black text-white"
        style={{ width: 24, height: 24, fontSize: 11, backgroundColor: cfg.iconBg, marginTop: 1 }}
      >
        {cfg.icon}
      </div>

      {/* Message + CTA */}
      <div className="flex-1 min-w-0">
        <p className="text-xs leading-relaxed font-medium" style={{ color: cfg.text }}>
          <span className="font-bold">{quality.label}. </span>
          {cfg.message}
        </p>
        {cfg.action === "recrop" && onRecrop && (
          <button
            type="button"
            onClick={onRecrop}
            className="mt-1.5 text-xs font-bold underline underline-offset-2"
            style={{ color: cfg.text }}
          >
            Re-Crop Now
          </button>
        )}
        {cfg.action === "retake" && (
          <div className="flex gap-3 mt-1.5">
            {onRecrop && (
              <button
                type="button"
                onClick={onRecrop}
                className="text-xs font-bold underline underline-offset-2"
                style={{ color: cfg.text }}
              >
                Re-Crop
              </button>
            )}
            {onRetake && (
              <button
                type="button"
                onClick={onRetake}
                className="text-xs font-bold underline underline-offset-2"
                style={{ color: cfg.text }}
              >
                Retake Photo
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// UploadZone
//
// Camera-first for athletes on mobile:
// - "Take Photo" is the primary CTA (large, full-width on mobile)
// - "Upload from Library" is secondary (smaller, below)
// - Drag-and-drop still works for desktop users
// No intermediate choice modal needed.
// ---------------------------------------------------------------------------

function UploadZone({ hasFiles, fileCount, onCamera, onLibrary, isDragging, onDragOver, onDragLeave, onDrop }) {
  return (
    <div
      className="w-full max-w-3xl mx-auto rounded-2xl overflow-hidden transition"
      style={{
        backgroundColor: isDragging ? DS.brandBg : DS.cardBg,
        border: `2px dashed ${isDragging ? DS.brandLight : DS.border}`,
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="flex flex-col items-center px-6 py-6 gap-4">
        {/* Status text */}
        <div className="text-center">
          <p
            className="up-display font-bold text-base"
            style={{ color: DS.bodyText, letterSpacing: "0.03em" }}
          >
            {hasFiles
              ? `${fileCount} label photo${fileCount > 1 ? "s" : ""} selected`
              : "Add a nutrition label photo"}
          </p>
          <p className="up-body text-xs mt-1" style={{ color: DS.labelText }}>
            {hasFiles
              ? "You can add more or change the photo below."
              : "Hold your phone 6–8 inches from the label until the text is sharp, then crop down to the exact Nutrition Label for best results."}
          </p>
        </div>

        {/* Primary CTA — camera, full-width on mobile */}
        <button
          type="button"
          onClick={onCamera}
          className="up-display w-full sm:w-auto flex items-center justify-center gap-2.5 rounded-2xl font-bold transition"
          style={{
            height: 52,
            paddingLeft: 28,
            paddingRight: 28,
            backgroundColor: DS.brand,
            color: "#fff",
            fontSize: 15,
            letterSpacing: "0.05em",
            minWidth: 200,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#254d80")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = DS.brand)}
        >
          <span style={{ fontSize: 18 }}>📷</span>
          {hasFiles ? "Retake Photo" : "Take Photo"}
        </button>

        {/* Secondary CTA — library */}
        <button
          type="button"
          onClick={onLibrary}
          className="up-body text-xs font-semibold underline underline-offset-2 transition"
          style={{ color: DS.labelText }}
          onMouseEnter={(e) => (e.currentTarget.style.color = DS.brand)}
          onMouseLeave={(e) => (e.currentTarget.style.color = DS.labelText)}
        >
          or upload from photos / files
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FilePreviewCard
// ---------------------------------------------------------------------------

function FilePreviewCard({ file, index, total, previewURL, athleteName, isCropped, text, onNameChange, onRecrop }) {
  const quality = text?.trim() ? computeOCRQuality(text) : null;

  const toneStyle = {
    good: { color: DS.safe,    label: "Scanned ✓" },
    warn: { color: DS.caution, label: "Okay scan" },
    bad:  { color: DS.banned,  label: "Low clarity" },
  };
  const ts = quality ? toneStyle[quality.tone] : null;

  return (
    <div
      className="up-body flex flex-col gap-3 max-w-3xl mx-auto rounded-2xl px-4 py-4"
      style={{
        backgroundColor: DS.cardBg,
        border: `1.5px solid ${DS.border}`,
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      }}
    >
      {/* Top row: filename + status chips */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col min-w-0">
          <p className="text-xs font-semibold truncate" style={{ color: DS.bodyText }}>
            {file.name}
          </p>
          {total > 1 && (
            <p className="text-[10px]" style={{ color: DS.dimText }}>
              Label {index + 1} of {total}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isCropped && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: DS.safeBg, color: DS.safe, border: `1px solid ${DS.safeBorder}` }}
            >
              Cropped
            </span>
          )}
          {ts && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ color: ts.color, backgroundColor: ts.color + "14", border: `1px solid ${ts.color}30` }}
            >
              {ts.label}
            </span>
          )}
        </div>
      </div>

      {/* Athlete name input */}
      <div>
        <label
          className="block text-[11px] font-semibold mb-1"
          style={{ color: DS.labelText }}
        >
          Athlete or Team Name{" "}
          <span style={{ color: DS.dimText, fontWeight: 400 }}>(optional)</span>
        </label>
        <input
          type="text"
          value={athleteName ?? ""}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. Jordan #22"
          className="up-body w-full px-3 py-2.5 rounded-xl text-sm transition"
          style={{
            border: `1.5px solid ${DS.border}`,
            color: DS.bodyText,
            backgroundColor: DS.pageBg,
            outline: "none",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = DS.brandLight)}
          onBlur={(e)  => (e.currentTarget.style.borderColor = DS.border)}
        />
      </div>

      {/* Preview image */}
      <img
        src={previewURL}
        alt={`Label ${index + 1} preview`}
        className="w-full rounded-xl object-contain"
        style={{
          maxHeight: 220,
          backgroundColor: DS.pageBg,
          border: `1px solid ${DS.border}`,
        }}
        loading="lazy"
      />

      {/* Footer: re-crop button + quality label */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onRecrop}
          className="up-body inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition"
          style={{
            color: DS.brand,
            backgroundColor: DS.brandBg,
            border: `1px solid ${DS.brandBorder}`,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#dce8f5")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = DS.brandBg)}
        >
          ✂ Re-Crop
        </button>

        {!isCropped && (
          <p className="up-body text-[11px]" style={{ color: DS.dimText }}>
            Tip: Crop to just the ingredients panel first
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OCRUpload
// ---------------------------------------------------------------------------

export default function OCRUpload({ multiple = false, onScan }) {
  const [files,        setFiles]        = useState([]);
  const [previewURLs,  setPreviewURLs]  = useState([]);
  const [athleteNames, setAthleteNames] = useState([]);
  const [fileError,    setFileError]    = useState("");
  const [isDragging,   setIsDragging]   = useState(false);
  const [dots,         setDots]         = useState("");

  const cameraInputRef = useRef(null);
  const fileInputRef   = useRef(null);
  const previewURLsRef = useRef([]); // ref for cleanup — avoids stale closure bug

  // Revoke all preview URLs on unmount
  useEffect(() => {
    return () => previewURLsRef.current.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  // ── Hooks ──
  const {
    cropState, aspectValue,
    openCropFor, closeCrop,
    setCrop, setZoom, setAspectMode, onCropComplete,
    confirmCrop, initFlags,
  } = useCrop({ multiple });

  const { scanState, startScan } = useOCR({
    onScan,
    croppedFlags: cropState.croppedFlags,
    athleteNames,
  });

  const { isLoading, currentIndex, completedCount, texts, error: scanError } = scanState;

  // ── Animated dots ──
  useEffect(() => {
    if (!isLoading) { setDots(""); return; }
    const id = setInterval(() => setDots((d) => (d.length >= 3 ? "" : d + ".")), 480);
    return () => clearInterval(id);
  }, [isLoading]);

  // ── Progress ──
  const progressPercent = useMemo(() => {
    if (!isLoading) return 0;
    return Math.round((Math.min(completedCount, files.length) / Math.max(1, files.length)) * 100);
  }, [isLoading, completedCount, files.length]);

  // ── Latest quality (for the header banner after scan) ──
  const latestQuality = useMemo(() => {
    const idx = [...texts].reverse().findIndex((t) => t?.trim());
    if (idx === -1) return null;
    return computeOCRQuality(texts[texts.length - 1 - idx]);
  }, [texts]);

  // ── File handling ──
  const handleFiles = useCallback((selected) => {
    const arr = Array.from(selected ?? []);
    if (!arr.length) return;

    const { ok, error } = validateFile(arr[0]);
    if (!ok) { setFileError(error); return; }

    setFileError("");

    // Revoke previous URLs via ref (avoids stale closure)
    previewURLsRef.current.forEach((u) => URL.revokeObjectURL(u));
    const urls = arr.map((f) => URL.createObjectURL(f));
    previewURLsRef.current = urls;

    setFiles(arr);
    setPreviewURLs(urls);
    setAthleteNames(arr.map(() => ""));
    initFlags(arr.length);
    openCropFor(0);
  }, [initFlags, openCropFor]);

  const handleAthleteNameChange = (idx, value) => {
    setAthleteNames((prev) => {
      const next = [...prev];
      next[idx]  = value;
      return next;
    });
  };

  // ── Drag and drop ──
  const onDragOver  = (e) => { e.preventDefault(); setIsDragging(true);  };
  const onDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const onDrop      = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: UPLOAD_FONTS }} />

      <div className="up-body space-y-5 mt-4" style={{ maxWidth: "100%" }}>

        {/* ── Step header ─────────────────────────────────────────── */}
        <div className="max-w-3xl mx-auto space-y-2">
          <div className="flex items-center gap-2">
            <span
              className="up-body inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest"
              style={{
                backgroundColor: DS.brandBg,
                color: DS.brand,
                border: `1px solid ${DS.brandBorder}`,
              }}
            >
              Step 1 · Label Scan
            </span>
          </div>

          <h2
            className="up-display font-bold"
            style={{ fontSize: "clamp(1.1rem, 3vw, 1.4rem)", color: DS.bodyText }}
          >
            Scan a supplement nutrition label
          </h2>
          <p className="up-body text-sm" style={{ color: DS.labelText, lineHeight: 1.6 }}>
            Take a photo, crop to just the ingredients panel, then scan for banned
            substances and ingredient details.
          </p>

          {/* Quality banner — only after a scan */}
          {latestQuality && (
            <QualityBanner
              quality={latestQuality}
              onRecrop={files.length > 0 ? () => openCropFor(0) : null}
              onRetake={() => cameraInputRef.current?.click()}
            />
          )}
        </div>

        {/* ── Upload zone ─────────────────────────────────────────── */}
        <UploadZone
          hasFiles={files.length > 0}
          fileCount={files.length}
          onCamera={() => cameraInputRef.current?.click()}
          onLibrary={() => fileInputRef.current?.click()}
          isDragging={isDragging}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        />

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
          accept="image/jpeg,image/png,image/webp"
          multiple={multiple}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {/* ── Crop modal ──────────────────────────────────────────── */}
        <CropModal
          isOpen={cropState.isOpen}
          previewURL={previewURLs[cropState.cropIndex]}
          cropIndex={cropState.cropIndex ?? 0}
          totalFiles={files.length}
          multiple={multiple}
          crop={cropState.crop}
          zoom={cropState.zoom}
          aspectMode={cropState.aspectMode}
          aspectValue={aspectValue}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          onAspectChange={setAspectMode}
          onConfirm={() => confirmCrop(files, previewURLs, setFiles, setPreviewURLs)}
          onClose={closeCrop}
        />

        {/* ── File preview cards ──────────────────────────────────── */}
        {files.map((file, idx) => (
          <FilePreviewCard
            key={idx}
            file={file}
            index={idx}
            total={files.length}
            previewURL={previewURLs[idx]}
            athleteName={athleteNames[idx]}
            isCropped={cropState.croppedFlags[idx]}
            text={texts[idx]}
            onNameChange={(val) => handleAthleteNameChange(idx, val)}
            onRecrop={() => openCropFor(idx)}
          />
        ))}

        {/* ── Error display ───────────────────────────────────────── */}
        {(fileError || scanError) && (
          <div
            className="up-body max-w-3xl mx-auto rounded-2xl px-4 py-3"
            style={{
              backgroundColor: DS.bannedBg,
              border: `1px solid ${DS.bannedBorder}`,
            }}
          >
            <p className="text-sm whitespace-pre-line" style={{ color: DS.banned }}>
              {fileError || scanError}
            </p>
          </div>
        )}

        {/* ── Scan progress ───────────────────────────────────────── */}
        {isLoading && (
          <div className="max-w-3xl mx-auto space-y-2">
            <ProgressBar progress={progressPercent} />
            {currentIndex != null && (
              <p className="up-body text-[11px] text-right" style={{ color: DS.dimText }}>
                Scanning label {currentIndex + 1} of {files.length}{dots}
              </p>
            )}
          </div>
        )}

        {/* ── Scan button ─────────────────────────────────────────── */}
        <div className="max-w-3xl mx-auto flex justify-end">
          <button
            type="button"
            onClick={() => startScan(files)}
            disabled={isLoading || !files.length}
            className="up-display w-full md:w-auto flex items-center justify-center gap-2.5 rounded-2xl font-bold transition"
            style={{
              height: 52,
              paddingLeft: 32,
              paddingRight: 32,
              fontSize: 15,
              letterSpacing: "0.05em",
              backgroundColor: isLoading || !files.length ? DS.border : DS.brand,
              color: isLoading || !files.length ? DS.dimText : "#fff",
              cursor: isLoading || !files.length ? "not-allowed" : "pointer",
              boxShadow: isLoading || !files.length ? "none" : "0 2px 12px rgba(30,58,95,0.25)",
            }}
            onMouseEnter={(e) => {
              if (!isLoading && files.length) e.currentTarget.style.backgroundColor = "#254d80";
            }}
            onMouseLeave={(e) => {
              if (!isLoading && files.length) e.currentTarget.style.backgroundColor = DS.brand;
            }}
          >
            {isLoading ? (
              <>
                <span
                  className="inline-block rounded-full border-2 border-t-transparent animate-spin"
                  style={{ width: 16, height: 16, borderColor: `${DS.dimText}60`, borderTopColor: DS.dimText }}
                />
                {currentIndex != null
                  ? `Scanning ${currentIndex + 1} of ${files.length}${dots}`
                  : `Scanning${dots}`}
              </>
            ) : !files.length ? (
              "Add a photo to scan"
            ) : multiple ? (
              "Scan All Labels →"
            ) : (
              "Scan Label →"
            )}
          </button>
        </div>

        {/* ── Bottom tip ──────────────────────────────────────────── */}
        <p
          className="up-body text-[11px] text-center max-w-3xl mx-auto pb-2"
          style={{ color: DS.dimText }}
        >
          Avoid shadows, glare, and extreme angles. If a scan fails, retake slightly
          farther back, then re-crop to just the ingredients list.
        </p>

      </div>
    </>
  );
}