// components/OCRUpload.jsx
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import ProgressBar from "./ProgressBar";
import CropModal   from "./CropModal";
import { useOCR, computeOCRQuality } from "@/hooks/useOCR";
import { useCrop }                   from "@/hooks/useCrop";

// ---------------------------------------------------------------------------
// Brand tokens — CheckPeak clinical light
// ---------------------------------------------------------------------------

const DS = {
  accent:    "#4FABFF",
  accentDk:  "#0284C7",
  accentBg:  "rgba(79,171,255,0.07)",
  accentBdr: "rgba(79,171,255,0.18)",

  safe:      "#059669",
  safeBg:    "#ECFDF5",
  safeBdr:   "#A7F3D0",
  caution:   "#B45309",
  cautionBg: "#FFFBEB",
  cautionBdr:"#FDE68A",
  banned:    "#DC2626",
  bannedBg:  "#FEF2F2",
  bannedBdr: "#FECACA",

  ink:       "#0D1B2A",
  body:      "#334155",
  secondary: "#64748B",
  muted:     "#94A3B8",

  surface:   "#FFFFFF",
  raised:    "#F1F5F9",
  pageBg:    "#F4F7FB",
  border:    "#E2E8F0",
};

const F = {
  cond: "'Barlow Condensed', sans-serif",
  body: "'Barlow', sans-serif",
};

const UPLOAD_FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,700;0,900;1,700&family=Barlow:wght@400;500;600;700&display=swap');
  .up-display { font-family: 'Barlow Condensed', sans-serif; letter-spacing: 0.04em; }
  .up-body    { font-family: 'Barlow', sans-serif; }
`;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg","image/jpg","image/png","image/webp"];

function detectHeic(file) {
  const t = String(file?.type ?? "").toLowerCase();
  const n = String(file?.name ?? "").toLowerCase();
  return t.includes("heic") || t.includes("heif") || n.endsWith(".heic") || n.endsWith(".heif");
}

function validateFile(file) {
  if (!file) return { ok:false, error:"No file provided." };
  if (file.size > MAX_FILE_SIZE) return { ok:false, error:"File too large (max 5 MB). Try zooming in on just the label." };
  if (detectHeic(file)) return { ok:false, error:"This photo is in HEIC format.\n\nOn iPhone:\n• Take a screenshot of the label and upload that, or\n• Go to Settings → Camera → Formats → Most Compatible, then retake." };
  if (!ALLOWED_TYPES.includes(String(file.type ?? "").toLowerCase())) return { ok:false, error:"Please upload a JPG, PNG, or WEBP photo." };
  return { ok:true, error:"" };
}

// ---------------------------------------------------------------------------
// Quality banner
// ---------------------------------------------------------------------------

const QUALITY_CONFIG = {
  good: { icon:"✓", iconBg:DS.safe,    bg:DS.safeBg,    border:DS.safeBdr,   text:DS.safe,    message:"Scan quality looks good.", action:null },
  warn: { icon:"!",  iconBg:DS.caution, bg:DS.cautionBg, border:DS.cautionBdr,text:DS.caution, message:"Some text may have been missed. Try re-cropping tighter to the ingredients panel.", action:"recrop" },
  bad:  { icon:"✕", iconBg:DS.banned,  bg:DS.bannedBg,  border:DS.bannedBdr, text:DS.banned,  message:"Very little text detected. Retake the photo closer to the label, or re-crop.", action:"retake" },
};

function QualityBanner({ quality, onRecrop, onRetake }) {
  if (!quality) return null;
  const cfg = QUALITY_CONFIG[quality.tone] ?? QUALITY_CONFIG.bad;
  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"11px 14px", background:cfg.bg, border:`1px solid ${cfg.border}` }}>
      <div style={{ width:22, height:22, borderRadius:"50%", background:cfg.iconBg, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontFamily:F.cond, fontSize:11, fontWeight:900, marginTop:1 }}>
        {cfg.icon}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontFamily:F.body, fontSize:12, lineHeight:1.55, color:cfg.text, margin:0 }}>
          <strong>{quality.label}. </strong>{cfg.message}
        </p>
        {cfg.action === "recrop" && onRecrop && (
          <button type="button" onClick={onRecrop} style={{ fontFamily:F.body, fontSize:11, fontWeight:700, color:cfg.text, background:"none", border:"none", cursor:"pointer", padding:0, marginTop:4, textDecoration:"underline" }}>
            Re-Crop Now
          </button>
        )}
        {cfg.action === "retake" && (
          <div style={{ display:"flex", gap:12, marginTop:4 }}>
            {onRecrop && <button type="button" onClick={onRecrop} style={{ fontFamily:F.body, fontSize:11, fontWeight:700, color:cfg.text, background:"none", border:"none", cursor:"pointer", padding:0, textDecoration:"underline" }}>Re-Crop</button>}
            {onRetake && <button type="button" onClick={onRetake} style={{ fontFamily:F.body, fontSize:11, fontWeight:700, color:cfg.text, background:"none", border:"none", cursor:"pointer", padding:0, textDecoration:"underline" }}>Retake Photo</button>}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// UploadZone
// ---------------------------------------------------------------------------

function UploadZone({ hasFiles, fileCount, onCamera, onLibrary, isDragging, onDragOver, onDragLeave, onDrop }) {
  return (
    <div
      style={{
        background: isDragging ? DS.accentBg : DS.surface,
        border: `2px dashed ${isDragging ? DS.accent : DS.border}`,
        transition: "background 0.12s, border-color 0.12s",
        padding: "clamp(1.25rem, 4vw, 2rem)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem",
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Scan icon */}
      <div style={{
        width: 52, height: 52,
        background: DS.accentBg, border: `1px solid ${DS.accentBdr}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={DS.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/>
          <rect x="7" y="7" width="10" height="10" rx="1"/>
        </svg>
      </div>

      <div style={{ textAlign:"center" }}>
        <p style={{ fontFamily:F.cond, fontWeight:900, fontStyle:"italic", fontSize:"clamp(1rem,3vw,1.2rem)", letterSpacing:"-0.01em", textTransform:"uppercase", color:DS.ink, margin:"0 0 4px" }}>
          {hasFiles ? `${fileCount} label photo${fileCount>1?"s":""} selected` : "Add a nutrition label photo"}
        </p>
        <p style={{ fontFamily:F.body, fontSize:12, color:DS.secondary, lineHeight:1.6, maxWidth:"40ch", margin:"0 auto" }}>
          {hasFiles
            ? "You can add more or change the photo below."
            : "Hold your phone 6–8 inches from the label. Crop to just the Nutrition Label for best results."}
        </p>
      </div>

      {/* Primary CTA */}
      <button
        type="button"
        onClick={onCamera}
        style={{
          height: 50, padding: "0 28px",
          background: DS.accent, color: "#fff",
          fontFamily: F.cond, fontSize: 14, fontWeight: 900,
          letterSpacing: "0.1em", textTransform: "uppercase",
          border: "none", cursor: "pointer",
          boxShadow: "0 4px 16px rgba(79,171,255,0.35)",
          display: "flex", alignItems: "center", gap: 8,
          transition: "filter 0.12s",
        }}
        onMouseEnter={e => { e.currentTarget.style.filter="brightness(1.1)"; }}
        onMouseLeave={e => { e.currentTarget.style.filter="none"; }}
      >
        <span style={{ fontSize:18 }}>📷</span>
        {hasFiles ? "Retake Photo" : "Take Photo"}
      </button>

      {/* Secondary */}
      <button
        type="button"
        onClick={onLibrary}
        style={{ fontFamily:F.body, fontSize:12, fontWeight:600, color:DS.secondary, background:"none", border:"none", cursor:"pointer", textDecoration:"underline", textUnderlineOffset:3 }}
        onMouseEnter={e => { e.currentTarget.style.color=DS.accent; }}
        onMouseLeave={e => { e.currentTarget.style.color=DS.secondary; }}
      >
        or upload from photos / files
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FilePreviewCard
// ---------------------------------------------------------------------------

function FilePreviewCard({ file, index, total, previewURL, athleteName, isCropped, text, onNameChange, onRecrop }) {
  const quality = text?.trim() ? computeOCRQuality(text) : null;

  const toneStyle = {
    good: { color:DS.safe,    label:"Scanned ✓" },
    warn: { color:DS.caution, label:"Okay scan"  },
    bad:  { color:DS.banned,  label:"Low clarity" },
  };
  const ts = quality ? toneStyle[quality.tone] : null;

  return (
    <div style={{
      background: DS.surface,
      border: `1px solid ${DS.border}`,
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      padding: "clamp(0.875rem, 2vw, 1.25rem)",
    }}>
      {/* Top row */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginBottom:12 }}>
        <div style={{ minWidth:0 }}>
          <p style={{ fontFamily:F.body, fontSize:12, fontWeight:600, color:DS.ink, margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {file.name}
          </p>
          {total > 1 && <p style={{ fontFamily:F.body, fontSize:10, color:DS.muted, margin:"2px 0 0" }}>Label {index+1} of {total}</p>}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
          {isCropped && (
            <span style={{ fontFamily:F.cond, fontSize:9, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", padding:"2px 8px", background:DS.safeBg, color:DS.safe, border:`1px solid ${DS.safeBdr}` }}>
              Cropped
            </span>
          )}
          {ts && (
            <span style={{ fontFamily:F.cond, fontSize:9, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", padding:"2px 8px", color:ts.color, background:`${ts.color}14`, border:`1px solid ${ts.color}30` }}>
              {ts.label}
            </span>
          )}
        </div>
      </div>

      {/* Athlete name */}
      <div style={{ marginBottom:12 }}>
        <label style={{ display:"block", fontFamily:F.cond, fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:DS.secondary, marginBottom:4 }}>
          Athlete / Team <span style={{ color:DS.muted, fontWeight:400, textTransform:"none" }}>(optional)</span>
        </label>
        <input
          type="text"
          value={athleteName ?? ""}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. Jordan #22"
          style={{
            width:"100%", padding:"9px 12px",
            fontFamily:F.body, fontSize:13, color:DS.ink,
            background:DS.pageBg, border:`1px solid ${DS.border}`,
            outline:"none", transition:"border-color 0.12s",
          }}
          onFocus={e => { e.currentTarget.style.borderColor=DS.accent; }}
          onBlur={e  => { e.currentTarget.style.borderColor=DS.border; }}
        />
      </div>

      {/* Preview */}
      <img
        src={previewURL}
        alt={`Label ${index+1} preview`}
        style={{ width:"100%", maxHeight:200, objectFit:"contain", background:DS.pageBg, border:`1px solid ${DS.border}`, display:"block", marginBottom:12 }}
        loading="lazy"
      />

      {/* Footer */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
        <button
          type="button"
          onClick={onRecrop}
          style={{
            display:"inline-flex", alignItems:"center", gap:6,
            padding:"7px 14px",
            fontFamily:F.body, fontSize:12, fontWeight:600, color:DS.accent,
            background:DS.accentBg, border:`1px solid ${DS.accentBdr}`,
            cursor:"pointer", transition:"filter 0.12s",
          }}
          onMouseEnter={e => { e.currentTarget.style.filter="brightness(0.95)"; }}
          onMouseLeave={e => { e.currentTarget.style.filter="none"; }}
        >
          ✂ Re-Crop
        </button>
        {!isCropped && <p style={{ fontFamily:F.body, fontSize:11, color:DS.muted }}>Tip: Crop to just the ingredients panel first</p>}
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
  const previewURLsRef = useRef([]);

  useEffect(() => { return () => previewURLsRef.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  const { cropState, aspectValue, openCropFor, closeCrop, setCrop, setZoom, setAspectMode, onCropComplete, confirmCrop, initFlags } = useCrop({ multiple });
  const { scanState, startScan } = useOCR({ onScan, croppedFlags:cropState.croppedFlags, athleteNames });
  const { isLoading, currentIndex, completedCount, texts, error:scanError } = scanState;

  useEffect(() => {
    if (!isLoading) { setDots(""); return; }
    const id = setInterval(() => setDots((d) => (d.length >= 3 ? "" : d + ".")), 480);
    return () => clearInterval(id);
  }, [isLoading]);

  const progressPercent = useMemo(() => {
    if (!isLoading) return 0;
    return Math.round((Math.min(completedCount, files.length) / Math.max(1, files.length)) * 100);
  }, [isLoading, completedCount, files.length]);

  const latestQuality = useMemo(() => {
    const idx = [...texts].reverse().findIndex((t) => t?.trim());
    if (idx === -1) return null;
    return computeOCRQuality(texts[texts.length - 1 - idx]);
  }, [texts]);

  const handleFiles = useCallback((selected) => {
    const arr = Array.from(selected ?? []);
    if (!arr.length) return;
    const { ok, error } = validateFile(arr[0]);
    if (!ok) { setFileError(error); return; }
    setFileError("");
    previewURLsRef.current.forEach((u) => URL.revokeObjectURL(u));
    const urls = arr.map((f) => URL.createObjectURL(f));
    previewURLsRef.current = urls;
    setFiles(arr); setPreviewURLs(urls); setAthleteNames(arr.map(() => ""));
    initFlags(arr.length); openCropFor(0);
  }, [initFlags, openCropFor]);

  const handleAthleteNameChange = (idx, value) => {
    setAthleteNames((prev) => { const next = [...prev]; next[idx] = value; return next; });
  };

  const onDragOver  = (e) => { e.preventDefault(); setIsDragging(true);  };
  const onDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const onDrop      = (e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: UPLOAD_FONTS }} />

      <div className="up-body" style={{ maxWidth:"100%" }}>

        {/* ── Step header ── */}
        <div style={{ marginBottom:"clamp(1rem, 2.5vw, 1.25rem)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:"0.5rem" }}>
            <span style={{ fontFamily:F.cond, fontSize:10, fontWeight:900, letterSpacing:"0.16em", textTransform:"uppercase", color:DS.secondary, background:DS.raised, padding:"3px 10px", border:`1px solid ${DS.border}` }}>
              Step 1 · Label Scan
            </span>
          </div>
          <h2 style={{ fontFamily:F.cond, fontWeight:900, fontStyle:"italic", fontSize:"clamp(1.1rem,3vw,1.4rem)", letterSpacing:"-0.01em", textTransform:"uppercase", color:DS.ink, margin:"0 0 4px" }}>
            Scan a supplement nutrition label
          </h2>
          <p style={{ fontFamily:F.body, fontSize:13, color:DS.secondary, lineHeight:1.6, margin:0, maxWidth:"52ch" }}>
            Take a photo, crop to just the ingredients panel, then scan for banned substances and ingredient details.
          </p>

          {latestQuality && (
            <div style={{ marginTop:"0.75rem" }}>
              <QualityBanner
                quality={latestQuality}
                onRecrop={files.length > 0 ? () => openCropFor(0) : null}
                onRetake={() => cameraInputRef.current?.click()}
              />
            </div>
          )}
        </div>

        {/* ── Upload zone ── */}
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
        <input ref={cameraInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple={multiple} className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        <input ref={fileInputRef}   type="file" accept="image/jpeg,image/png,image/webp" multiple={multiple}  className="hidden" onChange={(e) => handleFiles(e.target.files)} />

        {/* Crop modal */}
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

        {/* Preview cards */}
        {files.map((file, idx) => (
          <div key={idx} style={{ marginTop:"0.75rem" }}>
            <FilePreviewCard
              file={file} index={idx} total={files.length}
              previewURL={previewURLs[idx]}
              athleteName={athleteNames[idx]}
              isCropped={cropState.croppedFlags[idx]}
              text={texts[idx]}
              onNameChange={(val) => handleAthleteNameChange(idx, val)}
              onRecrop={() => openCropFor(idx)}
            />
          </div>
        ))}

        {/* Error */}
        {(fileError || scanError) && (
          <div style={{ marginTop:"0.75rem", padding:"11px 14px", background:DS.bannedBg, border:`1px solid ${DS.bannedBdr}` }}>
            <p style={{ fontFamily:F.body, fontSize:13, color:DS.banned, margin:0, whiteSpace:"pre-line" }}>{fileError || scanError}</p>
          </div>
        )}

        {/* Scan progress */}
        {isLoading && (
          <div style={{ marginTop:"0.75rem" }}>
            <ProgressBar progress={progressPercent} scanning={true} />
            {currentIndex != null && (
              <p style={{ fontFamily:F.body, fontSize:11, color:DS.muted, textAlign:"right", marginTop:4 }}>
                Scanning label {currentIndex+1} of {files.length}{dots}
              </p>
            )}
          </div>
        )}

        {/* Scan button */}
        <div style={{ display:"flex", justifyContent:"flex-end", marginTop:"1rem" }}>
          <button
            type="button"
            onClick={() => startScan(files)}
            disabled={isLoading || !files.length}
            style={{
              height: 50,
              padding: "0 clamp(1.5rem, 4vw, 2.5rem)",
              fontFamily: F.cond, fontSize: 14, fontWeight: 900,
              letterSpacing: "0.1em", textTransform: "uppercase",
              background: isLoading || !files.length ? DS.raised : DS.accent,
              color:      isLoading || !files.length ? DS.muted  : "#fff",
              border: "none",
              cursor: isLoading || !files.length ? "not-allowed" : "pointer",
              boxShadow: isLoading || !files.length ? "none" : "0 4px 16px rgba(79,171,255,0.35)",
              display: "flex", alignItems: "center", gap: 8,
              transition: "filter 0.12s",
              width: "100%",
            }}
            onMouseEnter={e => { if(!isLoading && files.length) e.currentTarget.style.filter="brightness(1.1)"; }}
            onMouseLeave={e => { e.currentTarget.style.filter="none"; }}
          >
            {isLoading ? (
              <>
                <span style={{ width:16, height:16, border:`2px solid rgba(148,163,184,0.4)`, borderTopColor:DS.accent, borderRadius:"50%", display:"inline-block", animation:"pb-shimmer 0.8s linear infinite" }} />
                {currentIndex != null ? `Scanning ${currentIndex+1} of ${files.length}${dots}` : `Scanning${dots}`}
              </>
            ) : !files.length
              ? "Add a photo to scan"
              : multiple ? "Scan All Labels →" : "Scan Label →"}
          </button>
        </div>

        {/* Bottom tip */}
        <p style={{ fontFamily:F.body, fontSize:11, color:DS.muted, textAlign:"center", marginTop:12, paddingBottom:8 }}>
          Avoid shadows, glare, and extreme angles. If a scan fails, retake slightly farther back, then re-crop to just the ingredients list.
        </p>
      </div>
    </>
  );
}