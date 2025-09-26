// components/LiveBarcodeScanner.jsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  BrowserMultiFormatReader,
  listVideoInputDevices,
  BarcodeFormat,
} from "@zxing/library";

/**
 * LiveBarcodeScanner
 *
 * Props:
 *  - onDetected(text: string) => void   // called immediately when a barcode is decoded
 *  - enableBeep (bool)                 // short beep on detection
 *  - enableFlash (bool)                // brief flash overlay on detection
 *  - enableOCRFallback (bool)          // use tesseract.js on cropped frames if ZXing misses
 *  - ocrIntervalMs (number)            // how often to run OCR fallback (ms)
 *  - maxOcrAttempts (number)
 *
 * Behavior:
 *  1. Ask for camera via getUserMedia() (ensures permission prompt)
 *  2. Attach stream to <video> and call video.play()
 *  3. Start continuous ZXing decode from the video element
 *  4. When ZXing returns a result -> call onDetected(result) and stop camera
 *  5. If ZXing can't decode, a periodic OCR fallback will capture a cropped canvas and attempt numeric OCR
 */

export default function LiveBarcodeScanner({
  onDetected,
  enableBeep = true,
  enableFlash = true,
  enableOCRFallback = true,
  ocrIntervalMs = 1500,
  maxOcrAttempts = 3,
}) {
  const videoRef = useRef(null);
  const readerRef = useRef(null); // ZXing reader instance
  const streamRef = useRef(null);
  const activeTrackRef = useRef(null);
  const detectedRef = useRef(false);
  const ocrTimerRef = useRef(null);
  const ocrAttemptsRef = useRef(0);

  const [statusMsg, setStatusMsg] = useState("Idle");
  const [flashPulse, setFlashPulse] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

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
      g.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
      o.start(now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + duration / 1000);
      setTimeout(() => {
        try { o.stop(); ctx.close(); } catch (e) {}
      }, duration + 20);
    } catch (e) {
      console.warn("beep failed", e);
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

  // --- crop & preprocess central scan box from video ---
  const getCroppedCanvasFromVideo = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return null;

    // crop central region (wider/taller to catch barcode area)
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const cropW = Math.round(vw * 0.8);
    const cropH = Math.round(vh * 0.25);
    const sx = Math.round((vw - cropW) / 2);
    const sy = Math.round((vh - cropH) / 2);

    const canvas = document.createElement("canvas");
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, cropW, cropH);

    // simple preprocess: convert to grayscale and adjust contrast/threshold
    try {
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = img.data;
      const THRESH = 140;
      for (let i = 0; i < d.length; i += 4) {
        const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
        // boost contrast slightly then threshold
        const v = Math.max(0, Math.min(255, (avg - 128) * 1.1 + 128));
        const bw = v > THRESH ? 255 : 0;
        d[i] = d[i + 1] = d[i + 2] = bw;
      }
      ctx.putImageData(img, 0, 0);
    } catch (e) {
      // if readback fails, return raw canvas
      console.warn("preprocess failed", e);
    }

    return canvas;
  };

  // --- OCR fallback using tesseract.js (digits only) ---
  const runOcrOnCanvas = async (canvas) => {
    if (!enableOCRFallback || !canvas) return null;
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
      if (match) return match[0];
    } catch (e) {
      console.warn("OCR failed", e);
    }
    return null;
  };

  // --- core: start camera and continuous ZXing decode ---
  const startScanner = async () => {
    detectedRef.current = false;
    ocrAttemptsRef.current = 0;
    setStatusMsg("Requesting camera...");

    // ensure previous stream stopped
    stopScanner();

    // create reader if needed
    if (!readerRef.current) {
      readerRef.current = new BrowserMultiFormatReader();
    }
    const reader = readerRef.current;

    // Prefer environment camera (no hard width/height so permission prompt shows reliably)
    const constraintsPref = { video: { facingMode: { ideal: "environment" } }, audio: false };

    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraintsPref);
    } catch (err) {
      console.warn("getUserMedia with facingMode failed, trying default video", err);
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch (err2) {
        console.error("Camera access failed", err2);
        setStatusMsg("Camera access denied or unavailable.");
        return;
      }
    }

    if (!stream) {
      setStatusMsg("Unable to access camera.");
      return;
    }

    streamRef.current = stream;

    // attach stream to video element
    try {
      const video = videoRef.current;
      video.srcObject = stream;
      video.muted = true; // required by many autoplay policies
      video.playsInline = true; // iOS
      await video.play().catch((e) => {
        console.warn("video.play() failed:", e);
      });
    } catch (e) {
      console.warn("attach stream error", e);
    }

    // save primary track for torch toggling
    try {
      const tracks = stream.getVideoTracks();
      if (tracks && tracks.length) {
        activeTrackRef.current = tracks[0];
        const caps = activeTrackRef.current.getCapabilities?.();
        if (caps?.torch) setTorchAvailable(true);
      }
    } catch (e) {
      console.warn("track capability check failed", e);
    }

    setStatusMsg("Scanning for barcodes...");

    // Prefer the continuously-decoding method if available
    try {
      if (typeof reader.decodeFromVideoElementContinuously === "function") {
        reader.decodeFromVideoElementContinuously(videoRef.current, (result, err) => {
          if (result && !detectedRef.current) {
            detectedRef.current = true;
            const txt = result?.getText?.() || result?.text || String(result);
            console.log("ZXing detected:", txt);
            successFeedback();
            setStatusMsg("Detected: " + txt);
            // stop camera & call onDetected
            stopScanner();
            if (typeof onDetected === "function") onDetected(txt);
            return;
          }
          if (err) {
            // ignore not-found noise
            const name = err?.name || (err && err.constructor && err.constructor.name) || "";
            if (!/NotFound/i.test(name)) console.warn("ZXing error:", err);
          }
        });
      } else {
        // fallback to decodeFromVideoDevice if continuous method not present
        // pick back camera if possible
        try {
          const devices = await listVideoInputDevices();
          const back = devices?.find((d) => /back|rear|environment/i.test(d.label));
          const chosen = back?.deviceId;
          reader.decodeFromVideoDevice(chosen || undefined, videoRef.current, (result, err) => {
            if (result && !detectedRef.current) {
              detectedRef.current = true;
              const txt = result?.getText?.() || result?.text || String(result);
              console.log("ZXing detected (device):", txt);
              successFeedback();
              setStatusMsg("Detected: " + txt);
              stopScanner();
              if (typeof onDetected === "function") onDetected(txt);
              return;
            }
            if (err) {
              const name = err?.name || "";
              if (!/NotFound/i.test(name)) console.warn("ZXing error (device):", err);
            }
          });
        } catch (e) {
          console.warn("decodeFromVideoDevice fallback failed", e);
        }
      }
    } catch (e) {
      console.warn("start decode loop failed", e);
    }

    // start OCR fallback polling (cropped canvas) to improve chance for UPC/EAN
    if (enableOCRFallback) {
      if (ocrTimerRef.current) clearInterval(ocrTimerRef.current);
      ocrAttemptsRef.current = 0;
      ocrTimerRef.current = setInterval(async () => {
        if (detectedRef.current || ocrAttemptsRef.current >= maxOcrAttempts) {
          if (ocrTimerRef.current) clearInterval(ocrTimerRef.current);
          return;
        }
        try {
          const canvas = getCroppedCanvasFromVideo();
          if (!canvas) return;
          // try ZXing on the cropped canvas first (works well for some builds)
          try {
            // many builds accept decodeFromCanvas or decodeFromImageElement - try both
            let zres = null;
            if (typeof reader.decodeFromCanvas === "function") {
              try {
                const res = reader.decodeFromCanvas(canvas);
                zres = res?.getText?.() || res?.text || String(res);
              } catch (e) {
                // ignore
              }
            }
            if (!zres) {
              // fallback: image element
              const tmp = new Image();
              tmp.src = canvas.toDataURL("image/png");
              await new Promise((r) => (tmp.onload = r));
              try {
                const res = await reader.decodeFromImageElement(tmp);
                zres = res?.getText?.() || res?.text || String(res);
              } catch (e) {
                // ignore
              }
            }
            if (zres && !detectedRef.current) {
              detectedRef.current = true;
              successFeedback();
              setStatusMsg("Detected (cropped ZXing): " + zres);
              stopScanner();
              if (typeof onDetected === "function") onDetected(zres);
              return;
            }
          } catch (e) {
            // ignore canvas decode errors
          }

          // then OCR fallback
          const ocrRes = await runOcrOnCanvas(canvas);
          if (ocrRes && !detectedRef.current) {
            detectedRef.current = true;
            successFeedback();
            setStatusMsg("Detected (OCR): " + ocrRes);
            stopScanner();
            if (typeof onDetected === "function") onDetected(ocrRes);
            return;
          }
        } catch (e) {
          console.warn("OCR poll error", e);
        } finally {
          ocrAttemptsRef.current++;
          if (ocrAttemptsRef.current >= maxOcrAttempts && ocrTimerRef.current) {
            clearInterval(ocrTimerRef.current);
          }
        }
      }, ocrIntervalMs);
    }
  };

  // --- stop everything & cleanup ---
  const stopScanner = () => {
    try {
      // reset ZXing reader decode loop if possible
      try { readerRef.current?.reset(); } catch (e) {}
    } catch (e) {}
    if (ocrTimerRef.current) {
      clearInterval(ocrTimerRef.current);
      ocrTimerRef.current = null;
    }
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => {
          try { t.stop(); } catch (e) {}
        });
      }
    } catch (e) {}
    streamRef.current = null;
    if (videoRef.current) {
      try { videoRef.current.srcObject = null; } catch (e) {}
    }
    activeTrackRef.current = null;
    setTorchAvailable(false);
  };

  // full cleanup on unmount
  useEffect(() => {
    // create reader instance
    readerRef.current = new BrowserMultiFormatReader();
    // start scanner automatically
    startScanner();

    return () => {
      stopScanner();
      try { readerRef.current = null; } catch (e) {}
      detectedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- toggle torch (if available) ---
  const toggleTorch = async () => {
    try {
      const track = activeTrackRef.current;
      if (!track) return;
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      if (!caps.torch) {
        console.warn("Torch not available on this device.");
        return;
      }
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn((s) => !s);
    } catch (err) {
      console.warn("Torch toggle failed", err);
    }
  };

  // retry scanning (clears detection and restarts)
  const handleRetry = async () => {
    detectedRef.current = false;
    setStatusMsg("Retrying scanner...");
    stopScanner();
    // slight delay to ensure resources freed
    setTimeout(() => {
      startScanner();
    }, 300);
  };

  // small UI
  return (
    <div className="w-full flex flex-col items-center gap-3">
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
        <button
          onClick={handleRetry}
          className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
        >
          Retry
        </button>

        {torchAvailable && (
          <button
            onClick={toggleTorch}
            className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
          >
            {torchOn ? "Torch Off" : "Torch On"}
          </button>
        )}

        <div className="text-sm text-gray-500">{statusMsg}</div>
      </div>
    </div>
  );
}
