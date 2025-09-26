// components/LiveBarcodeScanner.jsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/library";

/**
 * LiveBarcodeScanner
 *
 * Props:
 *  - onDetected(text: string) => void
 *  - preferredFormats (not actively enforced here due to cross-build differences)
 *  - enableBeep, enableFlash, enableOCRFallback, ocrIntervalMs, maxOcrAttempts
 */
export default function LiveBarcodeScanner({
  onDetected,
  preferredFormats = ["EAN_13", "UPC_A", "UPC_E", "EAN_8", "CODE_128", "QR_CODE"],
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

  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [flashPulse, setFlashPulse] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Starting camera...");

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
        try { o.stop(); ctx.close(); } catch {}
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

  // --- crop & preprocess the central scan box into a canvas ---
  const getCroppedCanvas = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return null;

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    // choose crop region to match overlay: center 75% width, approx 15% height
    const cropW = Math.round(vw * 0.75);
    const cropH = Math.round(vh * 0.15);
    const sx = Math.round((vw - cropW) / 2);
    const sy = Math.round((vh - cropH) / 2);

    const canvas = document.createElement("canvas");
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, cropW, cropH);

    // simple preprocessing: grayscale + threshold to black/white
    try {
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
        const bw = avg > 140 ? 255 : 0; // threshold tuned for camera; adjust if needed
        d[i] = d[i + 1] = d[i + 2] = bw;
      }
      ctx.putImageData(img, 0, 0);
    } catch (e) {
      // sometimes cross-origin or read errors - ignore and return raw canvas
    }

    return canvas;
  };

  // --- OCR fallback using tesseract.js on the cropped canvas ---
  const runOcrOnCroppedFrame = async () => {
    if (!enableOCRFallback) return null;
    const canvas = getCroppedCanvas();
    if (!canvas) return null;
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = createWorker();
      await worker.load();
      await worker.loadLanguage("eng");
      await worker.initialize("eng");
      // restrict to digits to speed up / reduce mistakes
      await worker.setParameters({ tessedit_char_whitelist: "0123456789" });
      const { data } = await worker.recognize(canvas);
      await worker.terminate();
      const digits = (data.text || "").replace(/\s+/g, "");
      const match = digits.match(/\d{8,14}/); // common barcode lengths
      if (match && match[0]) return match[0];
    } catch (err) {
      console.warn("OCR fallback error:", err);
    }
    return null;
  };

  // --- stop camera & cleanup ---
  const stopEverything = () => {
    try {
      readerRef.current?.reset();
    } catch (e) {}
    if (ocrTimerRef.current) {
      clearInterval(ocrTimerRef.current);
      ocrTimerRef.current = null;
    }
    const s = videoRef.current?.srcObject;
    if (s && s.getTracks) {
      s.getTracks().forEach((t) => {
        try { t.stop(); } catch (e) {}
      });
    }
    activeTrackRef.current = null;
    setStatusMsg("Scanner stopped.");
  };

  // --- main init effect ---
  useEffect(() => {
    detectedRef.current = false;
    ocrAttemptsRef.current = 0;

    const codeReader = new BrowserMultiFormatReader();
    readerRef.current = codeReader;

    let mounted = true;

    (async () => {
      try {
        setStatusMsg("Requesting camera devices...");
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();

        if (!mounted) return;
        if (!devices || !devices.length) {
          setStatusMsg("No camera devices found.");
          return;
        }

        // try to pick the back / environment camera by label, else choose first
        const back = devices.find((d) =>
          /back|rear|environment|camera 2|camera 1/i.test(d.label)
        );
        const chosenDeviceId = back ? back.deviceId : devices[0].deviceId;
        setStatusMsg("Starting camera...");

        // attempt to start decode with desired constraints (may or may not be respected)
        // NOTE: some builds accept constraints object as 4th arg — we'll pass it. If the library ignores it, it still works.
        const constraints = {
          video: {
            deviceId: chosenDeviceId ? { exact: chosenDeviceId } : undefined,
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        };

        await codeReader.decodeFromVideoDevice(
          chosenDeviceId || undefined,
          videoRef.current,
          async (result, err) => {
            // result is truthy when ZXing successfully decoded
            if (result && !detectedRef.current) {
              detectedRef.current = true;
              const text = result?.getText?.() || result?.text || String(result);
              console.log("ZXing detected:", text);
              successFeedback();
              stopEverything();
              if (typeof onDetected === "function") onDetected(text);
              return;
            }

            // not-found errors are normal for frames without codes; only log unusual errors
            if (err) {
              // Some builds set err.name === 'NotFoundException' or provide other types; skip noisy logs
              const name = err?.name || (err && err.constructor && err.constructor.name) || "";
              if (!/NotFoundException|NotFound/i.test(name)) {
                console.warn("ZXing error:", err);
              }
            }
          },
          constraints
        );

        // After decodeFromVideoDevice starts, grab the active track to check torch
        // The library sets video.srcObject; we check it a little later
        setTimeout(() => {
          try {
            const stream = videoRef.current?.srcObject;
            if (stream && stream.getVideoTracks && stream.getVideoTracks().length) {
              activeTrackRef.current = stream.getVideoTracks()[0];
              const caps = activeTrackRef.current.getCapabilities
                ? activeTrackRef.current.getCapabilities()
                : {};
              if (caps && caps.torch) setTorchAvailable(true);
            }
          } catch (e) {
            // ignore
          }
        }, 800);

        setStatusMsg("Point camera at barcode (rear camera preferred).");

        // set up OCR fallback polling if requested
        if (enableOCRFallback) {
          ocrAttemptsRef.current = 0;
          ocrTimerRef.current = setInterval(async () => {
            if (detectedRef.current || ocrAttemptsRef.current >= maxOcrAttempts) {
              if (ocrTimerRef.current) clearInterval(ocrTimerRef.current);
              return;
            }
            try {
              console.log("OCR fallback attempt", ocrAttemptsRef.current + 1);
              const found = await runOcrOnCroppedFrame();
              if (found && !detectedRef.current) {
                detectedRef.current = true;
                successFeedback();
                stopEverything();
                if (typeof onDetected === "function") onDetected(found);
              }
            } catch (e) {
              console.warn("OCR attempt error:", e);
            } finally {
              ocrAttemptsRef.current++;
              if (ocrAttemptsRef.current >= maxOcrAttempts && ocrTimerRef.current) {
                clearInterval(ocrTimerRef.current);
              }
            }
          }, ocrIntervalMs);
        }
      } catch (err) {
        console.error("Scanner init failed:", err);
        setStatusMsg("Failed to start camera scanner.");
      }
    })();

    return () => {
      mounted = false;
      stopEverything();
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

  // --- manual retry (allow scanning again) ---
  const handleRetry = () => {
    detectedRef.current = false;
    ocrAttemptsRef.current = 0;
    setStatusMsg("Retrying scan...");
    try {
      // reset the library's reader so it will continue
      readerRef.current?.reset();
      // re-run the effect by reloading the page/letting the component mount logic run — but usually reset is sufficient.
    } catch (e) {
      console.warn("Retry reset failed:", e);
    }
  };

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
