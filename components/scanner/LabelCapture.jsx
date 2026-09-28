// components/scanner/LabelCapture.jsx
// Pick or take up to 4 label photos, compress them in the browser, and check them in one request.
"use client";

import { useEffect, useRef, useState } from "react";
import Viewfinder from "@/components/scanner/Viewfinder";
import { DS } from "@/components/scanResultsTokens";

const MAX_PHOTOS  = 4;
const MAX_EDGE    = 1568;             // Claude's recommended max image edge
const MAX_PAYLOAD = 4 * 1024 * 1024;  // stays under Vercel's 4.5 MB request limit

const F = { cond: "'Barlow Condensed', sans-serif", body: "'Barlow', sans-serif" };

// Shown while a scan runs; timings roughly track the real pipeline
const STAGES = [
  { at: 0,     text: "Uploading your photos" },
  { at: 2000,  text: "Reading every ingredient on the label" },
  { at: 9000,  text: "Checking each one against the banned lists" },
  { at: 18000, text: "Almost done" },
];

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

const prefersMouse = () => typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;

function ActionButton({ onClick, children, primary = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: primary ? "2 1 220px" : "1 1 140px",
        minHeight: 52,
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        padding: "0 18px",
        fontFamily: F.cond, fontSize: 15, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase",
        background: primary ? (disabled ? DS.hoverBg : DS.brand) : DS.cardBg,
        color: primary ? (disabled ? DS.dimText : "#fff") : DS.bodyText,
        border: primary ? "none" : `1px solid ${DS.border}`,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function TextLink({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ minHeight: 44, padding: "0 4px", fontFamily: F.body, fontSize: 15, fontWeight: 600, color: DS.bodyText, background: "none", border: "none", textDecoration: "underline", textUnderlineOffset: 4, textDecorationColor: DS.border, cursor: "pointer" }}
    >
      {children}
    </button>
  );
}

function Progress({ startedAt }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const elapsed = now - startedAt;
  const current = STAGES.reduce((idx, s, i) => (elapsed >= s.at ? i : idx), 0);
  return (
    <div role="status" aria-live="polite" style={{ padding: "14px 16px", background: DS.brandBg, border: `1px solid ${DS.brandBorder}` }}>
      <div style={{ height: 3, background: "rgba(79,171,255,0.18)", overflow: "hidden", marginBottom: 12 }}>
        <div className="lc-bar" style={{ height: "100%", width: "35%", background: DS.brand }} />
      </div>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        {STAGES.slice(0, 3).map((s, i) => {
          const active = Math.min(current, 2); // the last step stays active until the result arrives
          const state = i < active ? "done" : i === active ? "active" : "todo";
          return (
            <li key={s.text} style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: F.body, fontSize: 14, color: state === "todo" ? DS.dimText : DS.bodyText, fontWeight: state === "active" ? 700 : 500 }}>
              <span aria-hidden="true" style={{ width: 18, height: 18, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: "50%", fontSize: 11, fontWeight: 900, background: state === "done" ? DS.brand : "transparent", color: "#fff", border: state === "done" ? "none" : `2px solid ${state === "active" ? DS.brand : DS.border}` }}>
                {state === "done" ? "✓" : ""}
              </span>
              {current === 3 && i === 2 ? STAGES[3].text : s.text}
            </li>
          );
        })}
      </ol>
      <style>{`
        @keyframes lc-slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }
        .lc-bar { animation: lc-slide 1.3s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .lc-bar { animation: none; width: 100% !important; opacity: 0.5; } }
      `}</style>
    </div>
  );
}

// barcode: a barcode the lookup couldn't find; sent along so the label result is saved for it
export default function LabelCapture({ onResult, onStart, barcode = null, children = null }) {
  const [files, setFiles]         = useState([]);
  const [previews, setPreviews]   = useState([]);
  const [startedAt, setStartedAt] = useState(0);   // non-zero while a scan runs
  const [error, setError]         = useState("");
  const cameraRef  = useRef(null);
  const libraryRef = useRef(null);
  const busy = startedAt > 0;

  const previewsRef = useRef(previews);
  previewsRef.current = previews;
  useEffect(() => () => previewsRef.current.forEach((p) => URL.revokeObjectURL(p)), []);

  function addFiles(list) {
    setError("");
    const incoming = Array.from(list || []).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (!incoming.length && list?.length) { setError("Those files aren't photos. Add a JPEG or PNG of the label."); return; }
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

  // Phones go straight to the camera; desktops open the file picker
  const openCapture = () => (prefersMouse() ? libraryRef : cameraRef).current?.click();

  async function check() {
    if (!files.length || busy) return;
    setStartedAt(Date.now());
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
      setStartedAt(0);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {children}

      {files.length === 0 ? (
        <>
          <Viewfinder variant="label" onActivate={openCapture} onFiles={addFiles} />
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: "4px 18px" }}>
            <TextLink onClick={() => libraryRef.current?.click()}>Choose from your photos</TextLink>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))", gap: 10 }}>
            {previews.map((src, i) => (
              <div key={src} style={{ position: "relative", aspectRatio: "3 / 4", border: `1px solid ${DS.border}`, background: DS.hoverBg, overflow: "hidden" }}>
                <img src={src} alt={`Label photo ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: busy ? 0.55 : 1 }} />
                {!busy && (
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    aria-label={`Remove photo ${i + 1}`}
                    style={{ position: "absolute", top: 4, right: 4, width: 32, height: 32, border: "none", background: "rgba(13,27,42,0.78)", color: "#fff", fontSize: 18, lineHeight: 1, cursor: "pointer" }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {files.length < MAX_PHOTOS && !busy && (
              <button
                type="button"
                onClick={openCapture}
                style={{ aspectRatio: "3 / 4", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, border: `2px dashed ${DS.border}`, background: DS.cardBg, color: DS.labelText, fontFamily: F.cond, fontSize: 13, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}
              >
                <span aria-hidden="true" style={{ fontSize: 26, fontWeight: 400, lineHeight: 1 }}>+</span>
                Add side
              </button>
            )}
          </div>

          {busy ? (
            <Progress startedAt={startedAt} />
          ) : (
            <>
              <p style={{ fontFamily: F.body, fontSize: 14, lineHeight: 1.5, color: DS.labelText, margin: 0 }}>
                {files.length === 1
                  ? "If the ingredient list continues on another side of the container, add that photo too."
                  : `${files.length} photos of the same product. They're read together.`}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <ActionButton primary onClick={check}>Check this product →</ActionButton>
              </div>
            </>
          )}
        </>
      )}

      {error && (
        <p role="alert" style={{ fontFamily: F.body, fontSize: 14, lineHeight: 1.5, padding: "10px 14px", margin: 0, background: DS.bannedBg, border: `1px solid ${DS.bannedBorder}`, color: DS.banned }}>
          {error}
        </p>
      )}

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      <input ref={libraryRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
    </div>
  );
}
