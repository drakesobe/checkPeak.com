// components/LiveBarcodeScanner.jsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  BrowserMultiFormatReader,
  listVideoInputDevices,
} from "@zxing/library";

/**
 * LiveBarcodeScanner
 *
 * - Props:
 *    onDetected(text: string) => void
 *    enableBeep / enableFlash / enableOCRFallback / ocrIntervalMs / maxOcrAttempts
 *
 * Notes:
 * - Uses getUserMedia + decodeFromVideoElementContinuously for live scanning.
 * - Has an Upload / Choose File flow that preprocesses and attempts ZXing then Tesseract fallback.
 * - Looser camera constraints (facingMode: 'environment') to avoid silent failures.
 */
export default function LiveBarcodeScanner({
  onDetected,
  enableBeep = true,
  enableFlash = true,
  enableOCRFallback = true,
  ocrIntervalMs = 3500,
  maxOcrAttempts = 3,
}) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const activeTrackRef = useRef(null);
  const detectedRef = useRef(false);
  const ocrTimerRef = useRef(null);
  const ocrAttemptsRef = useRef(0);
  const streamRef = useRef(null);

  const [mode, setMode] = useState("live"); // 'live' or 'file'
  const [statusMsg, setStatusMsg] = useState("Idle");
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [flashPulse, setFlashPulse] = useState(false);

  // --- audio beep ---
  const playBeep = (freq = 900, duration = 140) => {
    if (!enableBeep) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.value = 0.0001;
      o.connect(g);
      g.connect(ctx.destination);
      const now = ctx.currentTime;
      g.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
      o.start(now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + duration / 1000);
      setTimeout(() => {
        try { o.stop(); ctx.close(); } catch (e) {}
      }, duration + 20);
    } catch (e) {
      // ignore audio errors
    }
  };

  const successFeedback = () => {
    playBeep();
    if (navigator.vibrate) navigator.vibrate(120);
    if (enableFlash) {
      setFlashPulse(true);
      setTimeout(() => setFlashPulse(false), 600);
    }
  };

  // --- helper: crop & preprocess central scan box from video or image canvas ---
  const preprocessCanvas = (canvas) => {
    try {
      const ctx = canvas.getContext("2d");
      const w = canvas.width;
      const h = canvas.height;
      // simple grayscale + threshold
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      const THRESH = 140; // tweakable
      for (let i = 0; i < d.length; i += 4) {
        const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
        const bw = avg > THRESH ? 255 : 0;
        d[i] = d[i + 1] = d[i + 2] = bw;
      }
      ctx.putImageData(img, 0, 0);
    } catch (e) {
      // ignore readback/preprocessing errors
      console.warn("preprocessCanvas error", e);
    }
  };

  // Build a cropped canvas from current video element (center box)
  const getCroppedCanvasFromVideo = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return null;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const cropW = Math.round(vw * 0.75);
    const cropH = Math.round(vh * 0.18); // slightly larger than before
    const sx = Math.round((vw - cropW) / 2);
    const sy = Math.round((vh - cropH) / 2);

    const canvas = document.createElement("canvas");
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, cropW, cropH);
    preprocessCanvas(canvas);
    return canvas;
  };

  // Build a canvas from an Image object, scaled down if very large
  const getCanvasFromImage = (img) => {
    const maxSide = 1600;
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    w = Math.round(w * scale);
    h = Math.round(h * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    // center crop region similar to video crop to focus on barcode area
    const cropW = Math.round(w * 0.9);
    const cropH = Math.round(h * 0.25);
    const sx = Math.round((w - cropW) / 2);
    const sy = Math.round((h - cropH) / 2);
    const cropped = document.createElement("canvas");
    cropped.width = cropW;
    cropped.height = cropH;
    const cctx = cropped.getContext("2d");
    cctx.drawImage(canvas, sx, sy, cropW, cropH, 0, 0, cropW, cropH);
    preprocessCanvas(cropped);
    return cropped;
  };

  // --- ZXing attempt on a canvas or image element ---
  const tryZXingOnCanvasOrImage = async (canvasOrImage) => {
    try {
      // Try decodeFromImageElement if it's an HTMLImageElement
      if (canvasOrImage instanceof HTMLImageElement) {
        try {
          const res = await readerRef.current.decodeFromImageElement(canvasOrImage);
          return res?.getText?.() || res?.text || String(res);
        } catch (e) {
          // fallback to canvas method below
          console.warn("decodeFromImageElement failed", e);
        }
      }

      // If it's a canvas, we attempt to use decodeFromCanvas (may not exist on all builds)
      if (canvasOrImage instanceof HTMLCanvasElement) {
        try {
          // many builds support decodeFromCanvas
          if (typeof readerRef.current.decodeFromCanvas === "function") {
            const res = await readerRef.current.decodeFromCanvas(canvasOrImage);
            return res?.getText?.() || res?.text || String(res);
          }
        } catch (e) {
          console.warn("decodeFromCanvas failed", e);
        }

        // As an alternative, create an Image from canvas and call decodeFromImageElement
        try {
          const img = new Image();
          img.src = canvasOrImage.toDataURL("image/png");
          await new Promise((r) => (img.onload = r));
          const res = await readerRef.current.decodeFromImageElement(img);
          return res?.getText?.() || res?.text || String(res);
        } catch (e) {
          console.warn("decodeFromCanvas->Image fallback failed", e);
        }
      }
    } catch (e) {
      console.warn("tryZXingOnCanvasOrImage error", e);
    }
    return null;
  };

  // --- OCR fallback using tesseract.js ---
  const runOcrOnCanvas = async (canvas) => {
    if (!enableOCRFallback) return null;
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = createWorker();
      await worker.load();
      await worker.loadLanguage("eng");
      await worker.initialize("eng");
      await worker.setParameters({ tessedit_char_whitelist: "0123456789" });
      const { data } = await worker.recognize(canvas);
      await worker.terminate();
      const digits = (data.text || "").replace(/\s+/g, "");
      const match = digits.match(/\d{8,14}/);
      if (match && match[0]) return match[0];
    } catch (e) {
      console.warn("OCR error", e);
    }
    return null;
  };

  // --- file upload handler ---
  const handleFileInput = async (file) => {
    if (!file) return;
    // stop camera if active
    stopCamera();

    setMode("file");
    setStatusMsg("Processing image...");
    detectedRef.current = false;

    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      await new Promise((res, rej) => {
        img.onload = () => res();
        img.onerror = (e) => rej(e);
      });

      const canvas = getCanvasFromImage(img);

      // First try ZXing on the processed canvas
      const zres = await tryZXingOnCanvasOrImage(canvas);
      if (zres) {
        detectedRef.current = true;
        successFeedback();
        setStatusMsg("Detected (ZXing): " + zres);
        if (typeof onDetected === "function") onDetected(zres);
        URL.revokeObjectURL(url);
        return;
      }

      // Next fallback to OCR digits
      const ores = await runOcrOnCanvas(canvas);
      if (ores) {
        detectedRef.current = true;
        successFeedback();
        setStatusMsg("Detected (OCR): " + ores);
        if (typeof onDetected === "function") onDetected(ores);
        URL.revokeObjectURL(url);
        return;
      }

      setStatusMsg("No barcode found in image.");
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("File processing failed:", e);
      setStatusMsg("Failed to process image.");
    }
  };

  // --- camera startup (getUserMedia first, then ZXing decode loop) ---
  const startCamera = async () => {
    detectedRef.current = false;
    setStatusMsg("Requesting camera access...");

    // ensure old stream stopped
    stopCamera();

    const reader = readerRef.current || new BrowserMultiFormatReader();
    readerRef.current = reader;

    // looser constraints - just prefer environment
    const constraintsPref = { video: { facingMode: { ideal: "environment" } }, audio: false };

    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraintsPref);
      // success
    } catch (err) {
      console.warn("Environment camera constraint failed, trying generic video", err);
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch (err2) {
        console.error("getUserMedia failed entirely:", err2);
        setStatusMsg("Camera access denied or not available.");
        return;
      }
    }

    if (!stream) {
      setStatusMsg("Unable to get camera stream.");
      return;
    }

    streamRef.current = stream;
    // attach stream and play
    try {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // ensure muted & playsInline
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        await videoRef.current.play().catch((e) => {
          // some recoverable autoplay issues
          console.warn("video.play() error:", e);
        });
      }
    } catch (e) {
      console.warn("attach stream error", e);
    }

    // save track for torch toggling
    try {
      const tracks = stream.getVideoTracks();
      if (tracks && tracks.length) {
        activeTrackRef.current = tracks[0];
        const caps = activeTrackRef.current.getCapabilities?.();
        if (caps?.torch) setTorchAvailable(true);
      }
    } catch (e) {
      // ignore
    }

    setMode("live");
    setStatusMsg("Point camera at barcode (rear camera preferred).");

    // start ZXing continuous decode on the video element
    try {
      // prefer decodeFromVideoElementContinuously if available
      if (typeof reader.decodeFromVideoElementContinuously === "function") {
        reader.decodeFromVideoElementContinuously(videoRef.current, async (result, err) => {
          if (result && !detectedRef.current) {
            detectedRef.current = true;
            const text = result?.getText?.() || result?.text || String(result);
            console.log("ZXing detected:", text);
            successFeedback();
            stopCamera();
            if (typeof onDetected === "function") onDetected(text);
            return;
          }
          if (err) {
            // ignore noisy NotFound errors
            const name = err?.name || (err && err.constructor && err.constructor.name) || "";
            if (!/NotFound/i.test(name)) {
              console.warn("ZXing error:", err);
            }
          }
        });
      } else {
        // fallback: use decodeFromVideoDevice (some builds)
        try {
          const devices = await listVideoInputDevices();
          const back = devices?.find((d) => /back|rear|environment/i.test(d.label));
          const chosen = back?.deviceId;
          await reader.decodeFromVideoDevice(chosen || undefined, videoRef.current, (result, err) => {
            if (result && !detectedRef.current) {
              detectedRef.current = true;
              const text = result?.getText?.() || result?.text || String(result);
              console.log("ZXing detected (device):", text);
              successFeedback();
              stopCamera();
              if (typeof onDetected === "function") onDetected(text);
            }
            if (err) {
              const name = err?.name || "";
              if (!/NotFound/i.test(name)) {
                console.warn("ZXing error (device):", err);
              }
            }
          });
        } catch (e) {
          console.warn("decodeFromVideoDevice fallback failed", e);
        }
      }
    } catch (e) {
      console.warn("Start decode loop failed:", e);
    }

    // set up OCR fallback polling on the cropped video frame (if enabled)
    if (enableOCRFallback) {
      ocrAttemptsRef.current = 0;
      if (ocrTimerRef.current) clearInterval(ocrTimerRef.current);
      ocrTimerRef.current = setInterval(async () => {
        if (detectedRef.current || ocrAttemptsRef.current >= maxOcrAttempts) {
          if (ocrTimerRef.current) clearInterval(ocrTimerRef.current);
          return;
        }
        try {
          const canvas = getCroppedCanvasFromVideo();
          if (!canvas) return;
          const z = await tryZXingOnCanvasOrImage(canvas);
          if (z && !detectedRef.current) {
            detectedRef.current = true;
            successFeedback();
            stopCamera();
            if (typeof onDetected === "function") onDetected(z);
            return;
          }
          const o = await runOcrOnCanvas(canvas);
          if (o && !detectedRef.current) {
            detectedRef.current = true;
            successFeedback();
            stopCamera();
            if (typeof onDetected === "function") onDetected(o);
            return;
          }
        } catch (e) {
          console.warn("OCR polling error", e);
        } finally {
          ocrAttemptsRef.current++;
          if (ocrAttemptsRef.current >= maxOcrAttempts && ocrTimerRef.current) {
            clearInterval(ocrTimerRef.current);
          }
        }
      }, ocrIntervalMs);
    }
  };

  // --- stop camera only (keeps readerRef intact) ---
  const stopCamera = () => {
    try {
      // if reader has a reset or stop method, call it
      try { readerRef.current?.reset(); } catch (e) {}
    } catch (e) {
      // ignore
    }
    if (ocrTimerRef.current) {
      clearInterval(ocrTimerRef.current);
      ocrTimerRef.current = null;
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((t) => {
          try { t.stop(); } catch (e) {}
        });
      } catch (e) {}
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
      } catch (e) {}
    }
    activeTrackRef.current = null;
    setTorchAvailable(false);
  };

  // --- full cleanup ---
  const cleanupAll = () => {
    stopCamera();
    try { readerRef.current = null; } catch {}
    detectedRef.current = false;
  };

  useEffect(() => {
    // instantiate reader once
    readerRef.current = new BrowserMultiFormatReader();
    // start camera automatically
    startCamera();

    return () => {
      cleanupAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- toggle torch ---
  const toggleTorch = async () => {
    try {
      const track = activeTrackRef.current;
      if (!track) return;
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      if (!caps.torch) return;
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn((s) => !s);
    } catch (err) {
      console.warn("Torch toggle failed:", err);
    }
  };

  // --- retry (reset detection and restart camera if live) ---
  const handleRetry = async () => {
    detectedRef.current = false;
    ocrAttemptsRef.current = 0;
    setStatusMsg("Retrying...");
    stopCamera();
    // small delay to ensure camera freed
    setTimeout(() => {
      if (mode === "live") startCamera();
    }, 250);
  };

  // --- UI handlers ---
  const handleSwitchToLive = async () => {
    setMode("live");
    setStatusMsg("Starting live scanner...");
    detectedRef.current = false;
    // ensure file processing cleared
    stopCamera();
    setTimeout(() => startCamera(), 200);
  };

  const handleFileChange = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    await handleFileInput(file);
  };

  // --- render ---
  return (
    <div className="w-full flex flex-col items-center gap-3">
      <div className="flex gap-2">
        <button
          onClick={handleSwitchToLive}
          className={`px-3 py-2 rounded-lg ${mode === "live" ? "bg-blue-500 text-white" : "bg-gray-100"}`}
        >
          Live Scan
        </button>

        <label className={`px-3 py-2 rounded-lg ${mode === "file" ? "bg-blue-500 text-white" : "bg-gray-100"}`}>
          Choose File
          <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
        </label>
      </div>

      <div className="relative w-full" style={{ paddingTop: "56%" }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover rounded-lg bg-black"
        />
        {/* flash overlay */}
        <div
          aria-hidden
          className={`absolute inset-0 rounded-lg pointer-events-none transition-opacity duration-300 ${
            flashPulse ? "opacity-70 bg-green-400/40" : "opacity-0"
          }`}
        />
        {/* central scan box */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3/4 h-24 border-2 border-white/80 rounded-md pointer-events-none" />
      </div>

      <div className="flex gap-2 items-center">
        <button onClick={handleRetry} className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200">
          Retry
        </button>

        {torchAvailable && (
          <button onClick={toggleTorch} className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200">
            {torchOn ? "Torch Off" : "Torch On"}
          </button>
        )}

        <div className="text-sm text-gray-500">{statusMsg}</div>
      </div>
    </div>
  );
}
