// components/scanner/BarcodeCapture.jsx
// Read a product barcode by live camera, photo, or typing the number, then look the product up.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { canonicalGtin } from "@/lib/gtin";
import { DS } from "@/components/scanResultsTokens";

const F = { cond: "'Barlow Condensed', sans-serif", body: "'Barlow', sans-serif" };
const NATIVE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];
const FRAME_INTERVAL_MS = 150;
const CONFIRM_WINDOW_MS = 1500;   // same code read twice within this window = accepted
const MAX_PHOTO_EDGE = 1600;

// Returns async (canvas) => [rawValues]. Uses the browser's built-in detector when it
// supports retail barcodes (Chrome/Android), otherwise ZXing (works everywhere, incl. iPhone).
async function createDetector() {
  if (typeof window !== "undefined" && "BarcodeDetector" in window) {
    try {
      const supported = await window.BarcodeDetector.getSupportedFormats();
      const formats = NATIVE_FORMATS.filter((f) => supported.includes(f));
      if (formats.length) {
        const detector = new window.BarcodeDetector({ formats });
        return async (canvas) => (await detector.detect(canvas)).map((b) => b.rawValue);
      }
    } catch { /* fall through to ZXing */ }
  }
  const [{ BrowserMultiFormatOneDReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
    import("@zxing/browser"),
    import("@zxing/library"),
  ]);
  const hints = new Map([
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]],
    [DecodeHintType.TRY_HARDER, true],
  ]);
  const reader = new BrowserMultiFormatOneDReader(hints);
  return async (canvas) => {
    try { return [reader.decodeFromCanvas(canvas).getText()]; } catch { return []; }
  };
}

function cameraErrorMessage(err) {
  if (!navigator.mediaDevices?.getUserMedia) return "This browser can't open the camera here. Upload a photo or type the number instead.";
  if (err?.name === "NotAllowedError") return "Camera access is blocked. Allow it in your browser settings, or upload a photo or type the number instead.";
  if (err?.name === "NotFoundError" || err?.name === "OverconstrainedError") return "No camera found on this device. Upload a photo or type the number instead.";
  if (err?.name === "NotReadableError") return "The camera is being used by another app. Close it and try again.";
  return "Couldn't start the camera. Upload a photo or type the number instead.";
}

const formatCode = (c) => (c.length === 12 ? `${c[0]} ${c.slice(1, 6)} ${c.slice(6, 11)} ${c[11]}` : c);

function Tab({ active, onClick, children }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{ flex: 1, minHeight: 40, fontFamily: F.cond, fontSize: 13, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", border: "none", borderBottom: `2px solid ${active ? DS.bodyText : "transparent"}`, background: "none", color: active ? DS.bodyText : DS.labelText, cursor: "pointer" }}
    >
      {children}
    </button>
  );
}

function PrimaryButton({ onClick, children, disabled, type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{ minHeight: 50, padding: "0 22px", fontFamily: F.cond, fontSize: 15, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", border: "none", background: disabled ? DS.hoverBg : DS.brand, color: disabled ? DS.dimText : "#fff", cursor: disabled ? "not-allowed" : "pointer" }}
    >
      {children}
    </button>
  );
}

export default function BarcodeCapture({ onStart, onResult }) {
  const [mode, setMode]       = useState("camera");
  const [cameraOn, setCameraOn] = useState(false);
  const [torch, setTorch]     = useState({ available: false, on: false });
  const [busyCode, setBusyCode] = useState("");   // barcode being looked up
  const [decoding, setDecoding] = useState(false);
  const [typed, setTyped]     = useState("");
  const [error, setError]     = useState("");

  const videoRef    = useRef(null);
  const streamRef   = useRef(null);
  const timerRef    = useRef(null);
  const detectorRef = useRef(null);
  const lastSeenRef = useRef({ code: "", at: 0 });
  const photoRef    = useRef(null);

  const getDetector = useCallback(async () => {
    if (!detectorRef.current) detectorRef.current = createDetector();
    return detectorRef.current;
  }, []);

  const stopCamera = useCallback(() => {
    clearTimeout(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    setTorch({ available: false, on: false });
  }, []);

  useEffect(() => stopCamera, [stopCamera]);
  useEffect(() => { if (mode !== "camera") stopCamera(); }, [mode, stopCamera]);
  useEffect(() => {
    const onHide = () => { if (document.hidden) stopCamera(); };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [stopCamera]);

  const lookup = useCallback(async (code) => {
    setBusyCode(code);
    setError("");
    onStart?.();
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ barcode: code, isBarcodeFlow: true, saveScan: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Lookup failed. Please try again.");
      onResult?.({ ...data, barcode: data.barcode || code });
    } catch (err) {
      setError(err.message || "Lookup failed. Please try again.");
    } finally {
      setBusyCode("");
    }
  }, [onResult, onStart]);

  // Accept a code only after the same valid barcode is read twice in a short window.
  const handleCandidates = useCallback((values) => {
    const now = Date.now();
    for (const v of values) {
      const code = canonicalGtin(v);
      if (!code) continue;
      const last = lastSeenRef.current;
      if (last.code === code && now - last.at < CONFIRM_WINDOW_MS) return code;
      lastSeenRef.current = { code, at: now };
    }
    return null;
  }, []);

  const scanFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;
    if (video.readyState >= 2 && video.videoWidth) {
      // Only read the guide strip in the middle of the frame: faster and fewer misreads
      const sw = Math.round(video.videoWidth * 0.84), sh = Math.round(video.videoHeight * 0.42);
      const sx = Math.round((video.videoWidth - sw) / 2), sy = Math.round((video.videoHeight - sh) / 2);
      const canvas = document.createElement("canvas");
      canvas.width = sw; canvas.height = sh;
      canvas.getContext("2d", { willReadFrequently: true }).drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
      const detect = await getDetector();
      const values = await detect(canvas);
      if (!streamRef.current) return; // camera was stopped while this frame was decoding
      const code = handleCandidates(values);
      if (code) {
        navigator.vibrate?.(60);
        stopCamera();
        lookup(code);
        return;
      }
    }
    timerRef.current = setTimeout(scanFrame, FRAME_INTERVAL_MS);
  }, [getDetector, handleCandidates, lookup, stopCamera]);

  async function startCamera() {
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      const caps = stream.getVideoTracks()[0]?.getCapabilities?.() || {};
      setTorch({ available: !!caps.torch, on: false });
      setCameraOn(true);
      lastSeenRef.current = { code: "", at: 0 };
      getDetector();
      timerRef.current = setTimeout(scanFrame, FRAME_INTERVAL_MS);
    } catch (err) {
      stopCamera();
      setError(cameraErrorMessage(err));
    }
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch.on }] });
      setTorch((t) => ({ ...t, on: !t.on }));
    } catch {
      setTorch({ available: false, on: false });
    }
  }

  async function decodePhoto(file) {
    if (!file) return;
    setError("");
    setDecoding(true);
    try {
      let img;
      try { img = await createImageBitmap(file, { imageOrientation: "from-image" }); }
      catch { throw new Error("That photo is in a format your browser can't open. Take the photo with your camera, or type the number instead."); }
      const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const detect = await getDetector();
      // Barcodes may be sideways in a photo: try upright, then rotated 90 degrees
      for (const rotated of [false, true]) {
        const canvas = document.createElement("canvas");
        canvas.width = rotated ? h : w; canvas.height = rotated ? w : h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (rotated) { ctx.translate(h, 0); ctx.rotate(Math.PI / 2); }
        ctx.drawImage(img, 0, 0, w, h);
        const code = (await detect(canvas)).map(canonicalGtin).find(Boolean);
        if (code) { img.close?.(); await lookup(code); return; }
      }
      img.close?.();
      throw new Error("We couldn't find a barcode in that photo. Get closer so the barcode fills most of the frame, avoid glare, or type the number printed under it.");
    } catch (err) {
      setError(err.message);
    } finally {
      setDecoding(false);
    }
  }

  function submitTyped(e) {
    e.preventDefault();
    const code = canonicalGtin(typed);
    if (!code) { setError("That number doesn't look right. Enter every digit under the barcode (usually 12 or 13)."); return; }
    lookup(code);
  }

  const busy = !!busyCode || decoding;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div role="tablist" aria-label="How to enter the barcode" style={{ display: "flex", borderBottom: `1px solid ${DS.border}` }}>
        <Tab active={mode === "camera"} onClick={() => { setMode("camera"); setError(""); }}>Camera</Tab>
        <Tab active={mode === "photo"}  onClick={() => { setMode("photo");  setError(""); }}>Photo</Tab>
        <Tab active={mode === "type"}   onClick={() => { setMode("type");   setError(""); }}>Type number</Tab>
      </div>

      {mode === "camera" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 3", background: "#0D1B2A", overflow: "hidden", display: cameraOn ? "block" : "none" }}>
            <video ref={videoRef} playsInline muted autoPlay style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            {/* Guide strip matches the region scanFrame reads */}
            <div aria-hidden="true" style={{ position: "absolute", left: "8%", right: "8%", top: "29%", bottom: "29%", border: "2px solid rgba(255,255,255,0.9)", boxShadow: "0 0 0 100vmax rgba(13,27,42,0.45)" }}>
              <div className="bc-scanline" style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 2, background: DS.brand }} />
            </div>
            <p style={{ position: "absolute", left: 0, right: 0, bottom: 10, margin: 0, textAlign: "center", fontFamily: F.body, fontSize: 13, color: "#fff" }}>
              Line the barcode up inside the box
            </p>
            <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 8 }}>
              {torch.available && (
                <button type="button" onClick={toggleTorch} aria-pressed={torch.on} style={{ minHeight: 36, padding: "0 12px", fontFamily: F.cond, fontSize: 12, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", border: "none", background: torch.on ? "#fff" : "rgba(13,27,42,0.7)", color: torch.on ? DS.bodyText : "#fff", cursor: "pointer" }}>
                  {torch.on ? "Light on" : "Light"}
                </button>
              )}
              <button type="button" onClick={stopCamera} style={{ minHeight: 36, padding: "0 12px", fontFamily: F.cond, fontSize: 12, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", border: "none", background: "rgba(13,27,42,0.7)", color: "#fff", cursor: "pointer" }}>
                Stop
              </button>
            </div>
          </div>
          {!cameraOn && (
            <>
              <p style={{ fontFamily: F.body, fontSize: 14, lineHeight: 1.55, color: DS.labelText, margin: 0 }}>
                Point your camera at the barcode and it reads automatically.
              </p>
              <div><PrimaryButton onClick={startCamera} disabled={busy}>Start camera</PrimaryButton></div>
            </>
          )}
        </div>
      )}

      {mode === "photo" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontFamily: F.body, fontSize: 14, lineHeight: 1.55, color: DS.labelText, margin: 0 }}>
            Take or choose a photo where the barcode fills most of the frame. No cropping needed.
          </p>
          <div><PrimaryButton onClick={() => photoRef.current?.click()} disabled={busy}>{decoding ? "Reading photo…" : "Choose photo"}</PrimaryButton></div>
          <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => { decodePhoto(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
      )}

      {mode === "type" && (
        <form onSubmit={submitTyped} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label htmlFor="barcode-digits" style={{ fontFamily: F.body, fontSize: 14, lineHeight: 1.55, color: DS.labelText }}>
            Type the numbers printed under the barcode.
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <input
              id="barcode-digits"
              inputMode="numeric"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value.replace(/[^\d\s]/g, ""))}
              placeholder="0 12345 67890 5"
              style={{ flex: "1 1 220px", minHeight: 50, padding: "0 14px", fontFamily: F.body, fontSize: 18, letterSpacing: "0.08em", fontVariantNumeric: "tabular-nums", border: `1px solid ${DS.border}`, background: "#F8FAFC", color: DS.bodyText }}
            />
            <PrimaryButton type="submit" disabled={busy || !typed.trim()}>Look up</PrimaryButton>
          </div>
        </form>
      )}

      {busyCode && (
        <p role="status" style={{ fontFamily: F.body, fontSize: 14, color: DS.labelText, margin: 0 }}>
          Looking up <strong style={{ color: DS.bodyText, fontVariantNumeric: "tabular-nums" }}>{formatCode(busyCode)}</strong>…
        </p>
      )}

      {error && (
        <p role="alert" style={{ fontFamily: F.body, fontSize: 14, lineHeight: 1.5, padding: "10px 14px", margin: 0, background: DS.bannedBg, border: `1px solid ${DS.bannedBorder}`, color: DS.banned }}>
          {error}
        </p>
      )}

      <style>{`
        @keyframes bc-sweep { 0%, 100% { transform: translateY(-18px); } 50% { transform: translateY(18px); } }
        .bc-scanline { animation: bc-sweep 1.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .bc-scanline { animation: none; } }
      `}</style>
    </div>
  );
}
