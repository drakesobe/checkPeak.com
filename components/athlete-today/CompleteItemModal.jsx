// components/athlete-today/CompleteItemModal.jsx
"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { Camera, X, Upload, Check, AlertCircle, ChevronDown, ChevronUp, ClipboardEdit, Image as ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Design tokens (matches WorkoutSheet exactly) ─────────────────────────────
const C = {
  bg:        "#0F0F0F",
  surface:   "#161616",
  surface2:  "#1C1C1C",
  line:      "#1E1E1E",
  line2:     "#2A2A2A",
  white:     "#FFFFFF",
  dim:       "rgba(255,255,255,0.35)",
  muted:     "rgba(255,255,255,0.18)",
  faint:     "rgba(255,255,255,0.07)",
  accent:    "#0057FF",
  accentBg:  "rgba(0,87,255,0.14)",
  accentBdr: "rgba(0,87,255,0.3)",
  green:     "#00C851",
  greenBg:   "rgba(0,200,81,0.12)",
  greenBdr:  "rgba(0,200,81,0.3)",
  greenDim:  "rgba(0,200,81,0.15)",
  orange:    "rgba(255,165,0,0.85)",
  orangeBg:  "rgba(255,165,0,0.08)",
  orangeBdr: "rgba(255,165,0,0.22)",
  handle:    "#2A2A2A",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normBool(v) {
  return String(v ?? "").trim().toLowerCase() === "true";
}
function safeText(v) {
  return String(v ?? "").trim();
}
function fileLabel(file) {
  if (!file) return "";
  const name = safeText(file?.name);
  const size = Number(file?.size || 0);
  if (!name) return "Selected file";
  if (!size)  return name;
  const kb = Math.round(size / 1024);
  if (kb < 1024) return `${name} · ${kb} KB`;
  return `${name} · ${(kb / 1024).toFixed(1)} MB`;
}

// ─── NOTES SECTION ────────────────────────────────────────────────────────────
function NotesSection({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const text = String(value || "");
  const hasNote = text.trim().length > 0;

  return (
    <div style={{ border:`1px solid ${hasNote ? C.accentBdr : C.line2}`, borderRadius:14, overflow:"hidden", background:C.surface, transition:"border-color 0.2s" }}>
      {/* Toggle row */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        disabled={disabled}
        style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, padding:"14px 16px", background:"transparent", border:"none", cursor:"pointer", fontFamily:"inherit" }}
      >
        <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:C.faint, border:`1px solid ${C.line2}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <ClipboardEdit size={14} color={C.dim} />
          </div>
          <div style={{ minWidth:0, textAlign:"left" }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.white }}>Notes</div>
            <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>
              {hasNote ? "Note added" : "Optional — add if you changed anything"}
            </div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          {hasNote && <span style={{ fontSize:10, fontWeight:700, color:C.accent }}>✓</span>}
          {open ? <ChevronUp size={16} color={C.muted} /> : <ChevronDown size={16} color={C.muted} />}
        </div>
      </button>

      {/* Textarea */}
      {open && (
        <div style={{ borderTop:`1px solid ${C.line2}`, padding:"12px 16px 16px" }}>
          <textarea
            value={text}
            onChange={e => onChange?.(e.target.value)}
            disabled={disabled}
            maxLength={500}
            placeholder="e.g. used 10 lbs less, swapped machine, felt easy, short on time…"
            style={{
              width:"100%", minHeight:96, padding:"12px 14px",
              background:C.surface2, border:`1px solid ${C.line2}`,
              borderRadius:10, resize:"vertical",
              fontSize:13, color:C.white, lineHeight:1.55,
              fontFamily:"inherit", outline:"none",
              transition:"border-color 0.2s",
            }}
            onFocus={e => { e.target.style.borderColor = C.accentBdr; }}
            onBlur={e  => { e.target.style.borderColor = C.line2; }}
          />
          <div style={{ fontSize:10, color:C.muted, textAlign:"right", marginTop:5 }}>{text.length}/500</div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN MODAL ───────────────────────────────────────────────────────────────
export default function CompleteItemModal({
  open,
  item,
  selectedFile,
  coachNote,
  submitting = false,
  onClose,
  onPickFile,
  onChangeNote,
  onSubmit,
  evidenceRequiredOverride,
}) {
  const [previewUrl, setPreviewUrl] = useState("");
  const inputRef = useRef(null);

  const evidenceRequired = useMemo(() => {
    if (evidenceRequiredOverride !== undefined) return Boolean(evidenceRequiredOverride);
    return normBool(item?.EvidenceRequired);
  }, [item, evidenceRequiredOverride]);

  const title = safeText(item?.ExerciseName || item?.Title || "") || "Exercise";

  // Preview URL lifecycle
  useEffect(() => {
    if (!open || !selectedFile) { setPreviewUrl(""); return; }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [open, selectedFile]);

  useEffect(() => { if (!open) setPreviewUrl(""); }, [open, item?.id]);

  const canSubmit = Boolean(item?.id) && !submitting && (!evidenceRequired || !!selectedFile);
  const fileReady = !!selectedFile;

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="cim-backdrop"
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            transition={{ duration:0.22 }}
            onClick={onClose}
            style={{ position:"fixed", inset:0, zIndex:60, background:"rgba(0,0,0,0.78)", backdropFilter:"blur(4px)" }}
          />
        )}
      </AnimatePresence>

      {/* Sheet */}
      <AnimatePresence>
        {open && item && (
          <motion.div
            key="cim-sheet"
            initial={{ y:"100%" }} animate={{ y:0 }} exit={{ y:"100%" }}
            transition={{ type:"spring", stiffness:380, damping:42, mass:1 }}
            style={{
              position:"fixed", bottom:0, left:0, right:0, zIndex:70,
              background:C.bg,
              borderTopLeftRadius:22, borderTopRightRadius:22,
              maxHeight:"90dvh", display:"flex", flexDirection:"column",
              overflow:"hidden",
              fontFamily:"-apple-system,'SF Pro Display','Helvetica Neue',sans-serif",
              paddingBottom:"env(safe-area-inset-bottom,0)",
            }}
          >
            {/* Top accent */}
            <div style={{ height:3, background: evidenceRequired ? C.orange : C.accent, flexShrink:0 }} />

            {/* Handle */}
            <div style={{ display:"flex", justifyContent:"center", padding:"10px 0 0", flexShrink:0, cursor:"pointer" }} onClick={onClose}>
              <div style={{ width:32, height:3.5, background:C.handle, borderRadius:2 }} />
            </div>

            {/* Header */}
            <div style={{ padding:"14px 20px 0", flexShrink:0 }}>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:9, fontWeight:900, letterSpacing:"0.18em", textTransform:"uppercase", color: evidenceRequired ? C.orange : C.accent, marginBottom:5 }}>
                    {evidenceRequired ? "⚠ Proof required" : "Completing"}
                  </div>
                  <div style={{ fontSize:24, fontWeight:800, color:C.white, letterSpacing:"-0.03em", lineHeight:1.1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {title}
                  </div>
                </div>
                <button
                  type="button" onClick={onClose}
                  style={{ background:"#1A1A1A", border:"none", width:32, height:32, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, marginTop:2 }}
                >
                  <X size={14} color={C.dim} />
                </button>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height:1, background:C.line, margin:"16px 0 0", flexShrink:0 }} />

            {/* Scrollable content */}
            <div style={{ overflowY:"auto", flex:1, WebkitOverflowScrolling:"touch", padding:"20px 20px 0" }}>

              {/* ── Photo section ── */}
              <div style={{ border:`1px solid ${fileReady ? C.greenBdr : evidenceRequired ? C.orangeBdr : C.line2}`, borderRadius:14, overflow:"hidden", background:C.surface, marginBottom:12, transition:"border-color 0.3s" }}>

                {/* Section header */}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px", borderBottom:`1px solid ${C.line2}` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{
                      width:32, height:32, borderRadius:8, flexShrink:0,
                      background: fileReady ? C.greenBg : evidenceRequired ? C.orangeBg : C.faint,
                      border:`1px solid ${fileReady ? C.greenBdr : evidenceRequired ? C.orangeBdr : C.line2}`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      transition:"all 0.2s",
                    }}>
                      {fileReady
                        ? <Check size={14} color={C.green} strokeWidth={3} />
                        : <Camera size={14} color={evidenceRequired ? C.orange : C.dim} />
                      }
                    </div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:C.white }}>Photo</div>
                      <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>
                        {evidenceRequired ? "Required to submit" : "Optional"}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    fontSize:9, fontWeight:900, letterSpacing:"0.08em", textTransform:"uppercase",
                    padding:"3px 9px", borderRadius:5,
                    background: fileReady ? C.greenBg : evidenceRequired ? C.orangeBg : C.faint,
                    border:`1px solid ${fileReady ? C.greenBdr : evidenceRequired ? C.orangeBdr : C.line2}`,
                    color: fileReady ? C.green : evidenceRequired ? C.orange : C.dim,
                    transition:"all 0.3s",
                  }}>
                    {fileReady ? "✓ Ready" : evidenceRequired ? "Required" : "Optional"}
                  </span>
                </div>

                {/* Buttons */}
                <div style={{ padding:"14px 16px", display:"flex", gap:10 }}>
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={submitting}
                    style={{
                      flex:1, padding:"13px 16px",
                      background: fileReady ? C.greenBg : C.accentBg,
                      border:`1px solid ${fileReady ? C.greenBdr : C.accentBdr}`,
                      borderRadius:11, cursor:"pointer",
                      display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                      fontSize:13, fontWeight:800,
                      color: fileReady ? C.green : C.accent,
                      fontFamily:"inherit", transition:"all 0.2s",
                      opacity: submitting ? 0.5 : 1,
                    }}
                  >
                    <Camera size={15} />
                    {fileReady ? "Retake" : "Take Photo"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (inputRef.current) { inputRef.current.removeAttribute("capture"); inputRef.current.click(); setTimeout(() => inputRef.current?.setAttribute("capture","environment"), 500); } }}
                    disabled={submitting}
                    style={{
                      padding:"13px 16px",
                      background:C.faint, border:`1px solid ${C.line2}`,
                      borderRadius:11, cursor:"pointer",
                      display:"flex", alignItems:"center", justifyContent:"center", gap:7,
                      fontSize:13, fontWeight:700, color:C.dim,
                      fontFamily:"inherit", opacity: submitting ? 0.5 : 1,
                    }}
                  >
                    <Upload size={14} />
                    Library
                  </button>
                </div>

                {/* Hidden input */}
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={e => onPickFile?.(e.target.files?.[0] || null)}
                  style={{ display:"none" }}
                />

                {/* File status */}
                {!previewUrl && (
                  <div style={{ margin:"0 16px 14px", padding:"11px 14px", background:C.surface2, border:`1px solid ${C.line2}`, borderRadius:10, display:"flex", alignItems:"center", gap:10 }}>
                    <ImageIcon size={14} color={C.muted} />
                    <div>
                      <div style={{ fontSize:12, fontWeight:600, color: selectedFile ? C.white : C.dim }}>
                        {selectedFile ? "Photo selected" : "No photo selected"}
                      </div>
                      <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>
                        {selectedFile ? fileLabel(selectedFile) : evidenceRequired ? "Take a photo to submit" : "You can submit without one"}
                      </div>
                    </div>
                  </div>
                )}

                {/* Preview */}
                {previewUrl && (
                  <div style={{ margin:"0 16px 14px", borderRadius:10, overflow:"hidden", border:`1px solid ${C.greenBdr}` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="Preview" style={{ width:"100%", height:200, objectFit:"cover", display:"block" }} />
                    <div style={{ padding:"9px 12px", background:C.greenBg, display:"flex", alignItems:"center", gap:7 }}>
                      <Check size={12} color={C.green} strokeWidth={3} />
                      <span style={{ fontSize:11, fontWeight:700, color:C.green }}>
                        {evidenceRequired ? "Looking good — ready to submit" : "Photo attached — optional but nice"}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Notes ── */}
              <div style={{ marginBottom:20 }}>
                <NotesSection value={coachNote} onChange={onChangeNote} disabled={submitting} />
              </div>

            </div>

            {/* ── Actions (fixed at bottom) ── */}
            <div style={{ padding:"12px 20px 28px", flexShrink:0, borderTop:`1px solid ${C.line}`, background:C.bg }}>
              {/* Validation warning */}
              {evidenceRequired && !selectedFile && (
                <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px", background:C.orangeBg, border:`1px solid ${C.orangeBdr}`, borderRadius:10, marginBottom:12 }}>
                  <AlertCircle size={13} color={C.orange} />
                  <span style={{ fontSize:12, fontWeight:700, color:C.orange }}>Take a photo before submitting</span>
                </div>
              )}

              <div style={{ display:"flex", gap:10 }}>
                <button
                  type="button" onClick={onClose} disabled={submitting}
                  style={{ padding:"14px 20px", background:"transparent", border:`1px solid ${C.line2}`, borderRadius:12, fontSize:13, fontWeight:700, color:C.dim, cursor:"pointer", fontFamily:"inherit", opacity: submitting ? 0.5 : 1 }}
                >
                  Cancel
                </button>
                <button
                  type="button" onClick={onSubmit} disabled={!canSubmit}
                  style={{
                    flex:1, padding:"16px",
                    background: canSubmit ? C.green : C.faint,
                    border:`1px solid ${canSubmit ? "transparent" : C.line2}`,
                    borderRadius:12, cursor: canSubmit ? "pointer" : "not-allowed",
                    display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                    fontSize:14, fontWeight:900,
                    color: canSubmit ? "#040A05" : C.muted,
                    fontFamily:"inherit", letterSpacing:"-0.01em",
                    transition:"all 0.25s ease",
                  }}
                >
                  {submitting ? (
                    <>
                      <div style={{ width:14, height:14, borderRadius:"50%", border:`2px solid currentColor`, borderTopColor:"transparent", animation:"spin 0.7s linear infinite" }} />
                      Submitting…
                    </>
                  ) : (
                    <>
                      {evidenceRequired ? <Camera size={15} /> : <Check size={15} strokeWidth={3} />}
                      {evidenceRequired ? "Submit Proof" : "Mark Complete"}
                    </>
                  )}
                </button>
              </div>
            </div>

            <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}