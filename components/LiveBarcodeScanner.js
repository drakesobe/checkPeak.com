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

  const [mode, setMode] = useState("live");
  const [statusMsg, setStatusMsg] = useState("Idle");
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [flashPulse, setFlashPulse] = useState(false);
  const [scannerStarted, setScannerStarted] = useState(false);

  // --- Audio beep ---
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
        try {
          o.stop();
          ctx.close();
        } catch (e) {}
      }, duration + 20);
    } catch (e) {}
  };

  const successFeedback = () => {
    playBeep();
    if (navigator.vibrate) navigator.vibrate(120);
    if (enableFlash) {
      setFlashPulse(true);
      setTimeout(() => setFlashPulse(false), 600);
    }
  };

  const preprocessCanvas = (canvas) => {
    try {
      const ctx = canvas.getContext("2d");
      const w = canvas.width;
      const h = canvas.height;
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      const THRESH = 140;
      for (let i = 0; i < d.length; i += 4) {
        const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
        const bw = avg > THRESH ? 255 : 0;
        d[i] = d[i + 1] = d[i + 2] = bw;
      }
      ctx.putImageData(img, 0, 0);
    } catch (e) {
      console.warn("preprocessCanvas error", e);
    }
  };

  const getCroppedCanvasFromVideo = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return null;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const cropW = Math.round(vw * 0.75);
    const cropH = Math.round(vh * 0.18);
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

  const tryZXingOnCanvasOrImage = async (canvasOrImage) => {
    try {
      if (canvasOrImage instanceof HTMLImageElement) {
        try {
          const res = await readerRef.current.decodeFromImageElement(canvasOrImage);
          return res?.getText?.() || res?.text || String(res);
        } catch (e) {}
      }
      if (canvasOrImage instanceof HTMLCanvasElement) {
        try {
          if (typeof readerRef.current.decodeFromCanvas === "function") {
            const res = await readerRef.current.decodeFromCanvas(canvasOrImage);
            return res?.getText?.() || res?.text || String(res);
          }
        } catch (e) {}
        try {
          const img = new Image();
          img.src = canvasOrImage.toDataURL("image/png");
          await new Promise((r) => (img.onload = r));
          const res = await readerRef.current.decodeFromImageElement(img);
          return res?.getText?.() || res?.text || String(res);
        } catch (e) {}
      }
    } catch (e) {}
    return null;
  };

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

  const stopScanner = () => {
    try {
      readerRef.current?.reset();
    } catch (e) {}
    if (ocrTimerRef.current) clearInterval(ocrTimerRef.current);
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch (e) {}
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

  const cleanupAll = () => {
    stopScanner();
    try {
      readerRef.current = null;
    } catch {}
    detectedRef.current = false;
  };

  const startCamera = async () => {
    detectedRef.current = false;
    setStatusMsg("Requesting camera access...");
    stopScanner();

    if (!readerRef.current) readerRef.current = new BrowserMultiFormatReader();
    const reader = readerRef.current;

    let chosenDeviceId = null;
    try {
      const devices = await listVideoInputDevices();
      const rear = devices.find((d) => /back|rear|environment/i.test(d.label));
      chosenDeviceId = rear?.deviceId;
    } catch (e) {
      console.warn("listVideoInputDevices failed", e);
    }

    const constraints = {
      video: chosenDeviceId
        ? { deviceId: { exact: chosenDeviceId } }
        : { facingMode: { ideal: "environment" } },
      audio: false,
    };

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      console.warn("getUserMedia failed", err);
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch (err2) {
        console.error("Camera access denied", err2);
        setStatusMsg("Camera not available.");
        return;
      }
    }

    if (!stream) {
      setStatusMsg("No camera stream available.");
      return;
    }

    streamRef.current = stream;
    try {
      const video = videoRef.current;
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
    } catch (e) {
      console.warn("video.play() failed", e);
    }

    const tracks = stream.getVideoTracks();
    if (tracks && tracks.length) {
      activeTrackRef.current = tracks[0];
      const caps = activeTrackRef.current.getCapabilities?.();
      if (caps?.torch) setTorchAvailable(true);
    }

    setMode("live");
    setStatusMsg("Scanning for barcodes...");
    setScannerStarted(true);

    try {
      if (typeof reader.decodeFromVideoElementContinuously === "function") {
        reader.decodeFromVideoElementContinuously(videoRef.current, (result, err) => {
          if (result && !detectedRef.current) {
            detectedRef.current = true;
            successFeedback();
            stopScanner();
            onDetected(result.getText?.() || result?.text || String(result));
          }
          if (err && !/NotFound/i.test(err?.name || "")) console.warn(err);
        });
      }
    } catch (e) {
      console.warn("decodeFromVideoElementContinuously failed", e);
    }

    if (enableOCRFallback) {
      ocrAttemptsRef.current = 0;
      if (ocrTimerRef.current) clearInterval(ocrTimerRef.current);
      ocrTimerRef.current = setInterval(async () => {
        if (detectedRef.current || ocrAttemptsRef.current >= maxOcrAttempts) {
          clearInterval(ocrTimerRef.current);
          return;
        }
        try {
          const canvas = getCroppedCanvasFromVideo();
          if (!canvas) return;
          const z = await tryZXingOnCanvasOrImage(canvas);
          if (z && !detectedRef.current) {
            detectedRef.current = true;
            successFeedback();
            stopScanner();
            onDetected(z);
            return;
          }
          const o = await runOcrOnCanvas(canvas);
          if (o && !detectedRef.current) {
            detectedRef.current = true;
            successFeedback();
            stopScanner();
            onDetected(o);
            return;
          }
        } catch (e) {
          console.warn("OCR polling error", e);
        } finally {
          ocrAttemptsRef.current++;
        }
      }, ocrIntervalMs);
    }
  };

  useEffect(() => {
    readerRef.current = new BrowserMultiFormatReader();
    return () => cleanupAll();
  }, []);

  return (
    <div className="w-full flex flex-col items-center gap-3">
      {!scannerStarted && (
        <button
          onClick={startCamera}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          Start Scanner
        </button>
      )}

      <div className="flex gap-2">
        <button
          onClick={startCamera}
          className={`px-3 py-2 rounded-lg ${
            mode === "live" ? "bg-blue-500 text-white" : "bg-gray-100"
          }`}
        >
          Live Scan
        </button>

        <label
          className={`px-3 py-2 rounded-lg ${
            mode === "file" ? "bg-blue-500 text-white" : "bg-gray-100"
          }`}
        >
          Choose File
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              if (e?.target?.files?.[0]) {
                stopScanner();
                handleFileInput(e.target.files[0]);
              }
            }}
            className="hidden"
          />
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
        <div
          aria-hidden
          className={`absolute inset-0 rounded-lg pointer-events-none transition-opacity duration-300 ${
            flashPulse ? "opacity-70 bg-green-400/40" : "opacity-0"
          }`}
        />
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3/4 h-24 border-2 border-white/80 rounded-md pointer-events-none" />
      </div>

      <div className="flex gap-2 items-center">
        <button
          onClick={() => {
            detectedRef.current = false;
            ocrAttemptsRef.current = 0;
            setStatusMsg("Retrying...");
            stopScanner();
            setTimeout(() => startCamera(), 250);
          }}
          className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
        >
          Retry
        </button>

        {torchAvailable && (
          <button
            onClick={async () => {
              const track = activeTrackRef.current;
              if (!track) return;
              const caps = track.getCapabilities?.();
              if (!caps.torch) return;
              await track.applyConstraints({ advanced: [{ torch: !torchOn }] });
              setTorchOn((s) => !s);
            }}
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
