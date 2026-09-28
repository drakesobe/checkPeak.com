// components/scanner/LabelCapture.jsx
// Pick or take up to 4 label photos, compress them in the browser, and check them in one request.
"use client";

import { useEffect, useRef, useState } from "react";
import { DS } from "@/components/scanResultsTokens";

const MAX_PHOTOS  = 4;
const MAX_EDGE    = 1568;             // Claude's recommended max image edge
const MAX_PAYLOAD = 4 * 1024 * 1024;  // stays under Vercel's 4.5 MB request limit

const F = { cond: "'Barlow Condensed', sans-serif", body: "'Barlow', sans-serif" };

async function decode(file) {
  if (typeof createImageBitmap === "function") {
    try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { /* fall back */ }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("unreadable"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Returns base64 JPEG (no data: prefix)
async function compress(file, quality) {
  const img = await decode(file);
  const w = img.width, h = img.height;
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  img.close?.();
  return canvas.toDataURL("image/jpeg", quality).split(",")[1];
}

async function preparePayload(files) {
  for (const quality of [0.85, 0.72, 0.6]) {
    const images = [];
    for (const f of files) images.push({ data: await compress(f, quality), mediaType: "image/jpeg" });
    if (images.reduce((n, i) => n + i.data.length, 0) <= MAX_PAYLOAD) return images;
  }
  throw new Error("These photos are too large to send together. Try fewer photos.");
}

function ActionButton({ onClick, children, primary = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: "1 1 160px",
        minHeight: 50,
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        padding: "0 18px",
        fontFamily: F.cond, fontSize: 15, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase",
        background: primary ? (disabled ? DS.hoverBg : DS.brand) : DS.cardBg,
        color: primary ? (disabled ? DS.dimText : "#fff") : DS.bodyText,
        border: primary ? "none" : `1px solid ${DS.border}`,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "filter 0.12s",
      }}
    >
      {children}
    </button>
  );
}

// barcode: a barcode the lookup couldn't find; sent along so the label result is saved for it
export default function LabelCapture({ onResult, onStart, barcode = null, children = null }) {
  const [files, setFiles]       = useState([]);
  const [previews, setPreviews] = useState([]);
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState("");
  const cameraRef = useRef(null);
  const libraryRef = useRef(null);

  const previewsRef = useRef(previews);
  previewsRef.current = previews;
  useEffect(() => () => previewsRef.current.forEach((p) => URL.revokeObjectURL(p)), []);

  function addFiles(list) {
    setError("");
    const incoming = Array.from(list || []).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    const room = MAX_PHOTOS - files.length;
    if (incoming.length > room) setError(`Up to ${MAX_PHOTOS} photos per product. Extra photos were skipped.`);
    const next = incoming.slice(0, Math.max(0, room));
    setFiles((f) => [...f, ...next]);
    setPreviews((p) => [...p, ...next.map((f) => URL.createObjectURL(f))]);
  }

  function removeAt(i) {
    URL.revokeObjectURL(previews[i]);
    setFiles((f) => f.filter((_, j) => j !== i));
    setPreviews((p) => p.filter((_, j) => j !== i));
  }

  async function check() {
    if (!files.length || busy) return;
    setBusy(true);
    setError("");
    onStart?.();
    try {
      let images;
      try {
        images = await preparePayload(files);
      } catch (err) {
        throw new Error(err.message === "unreadable"
          ? "One of these photos is in a format your browser can't open. Take the photo with your camera, or save it as a JPEG."
          : err.message);
      }
      const res = await fetch("/api/scan/label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(barcode ? { images, barcode } : { images }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Something went wrong. Please try again.");
      onResult?.(data);
      if (data.found) {
        previews.forEach((p) => URL.revokeObjectURL(p));
        setFiles([]);
        setPreviews([]);
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {children}
      <div>
        <p style={{ fontFamily: F.cond, fontWeight: 900, fontSize: 17, letterSpacing: "0.04em", textTransform: "uppercase", color: DS.bodyText, margin: 0 }}>
          Photograph the label
        </p>
        <p style={{ fontFamily: F.body, fontSize: 14, lineHeight: 1.55, color: DS.labelText, margin: "4px 0 0", maxWidth: "58ch" }}>
          Get the Supplement Facts panel and the ingredient list in frame. Add up to {MAX_PHOTOS} photos if the label wraps around the container.
        </p>
      </div>

      {previews.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 10 }}>
          {previews.map((src, i) => (
            <div key={src} style={{ position: "relative", aspectRatio: "3 / 4", border: `1px solid ${DS.border}`, background: DS.hoverBg, overflow: "hidden" }}>
              <img src={src} alt={`Label photo ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              {!busy && (
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  aria-label={`Remove photo ${i + 1}`}
                  style={{ position: "absolute", top: 4, right: 4, width: 28, height: 28, border: "none", background: "rgba(13,27,42,0.75)", color: "#fff", fontSize: 16, lineHeight: 1, cursor: "pointer" }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {files.length < MAX_PHOTOS && !busy && (
          <>
            <ActionButton onClick={() => cameraRef.current?.click()}>
              {files.length ? "Add photo" : "Take photo"}
            </ActionButton>
            <ActionButton onClick={() => libraryRef.current?.click()}>
              Upload
            </ActionButton>
          </>
        )}
        {files.length > 0 && (
          <ActionButton primary onClick={check} disabled={busy}>
            {busy ? (
              <>
                <span aria-hidden="true" style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "cp-spin 0.8s linear infinite" }} />
                Reading label…
              </>
            ) : `Check ${files.length > 1 ? `${files.length} photos` : "product"} →`}
          </ActionButton>
        )}
      </div>

      {busy && (
        <p role="status" style={{ fontFamily: F.body, fontSize: 13, color: DS.labelText, margin: 0 }}>
          Reading every ingredient and checking it against the banned list. This takes about 10–20 seconds.
        </p>
      )}

      {error && (
        <p role="alert" style={{ fontFamily: F.body, fontSize: 14, padding: "10px 14px", margin: 0, background: DS.bannedBg, border: `1px solid ${DS.bannedBorder}`, color: DS.banned }}>
          {error}
        </p>
      )}

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      <input ref={libraryRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />

      <style>{`@keyframes cp-spin { to { transform: rotate(360deg); } } @media (prefers-reduced-motion: reduce) { [style*="cp-spin"] { animation: none !important; } }`}</style>
    </div>
  );
}
