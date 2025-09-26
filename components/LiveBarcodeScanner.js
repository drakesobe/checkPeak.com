// LiveBarcodeScanner.jsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  BrowserMultiFormatReader,
  DecodeHintType,
  BarcodeFormat,
} from "@zxing/browser";

// Map friendly names
const NAME_TO_FORMAT = {
  AZTEC: BarcodeFormat.AZTEC,
  CODABAR: BarcodeFormat.CODABAR,
  CODE_39: BarcodeFormat.CODE_39,
  CODE_93: BarcodeFormat.CODE_93,
  CODE_128: BarcodeFormat.CODE_128,
  DATA_MATRIX: BarcodeFormat.DATA_MATRIX,
  EAN_8: BarcodeFormat.EAN_8,
  EAN_13: BarcodeFormat.EAN_13,
  ITF: BarcodeFormat.ITF,
  PDF_417: BarcodeFormat.PDF_417,
  QR_CODE: BarcodeFormat.QR_CODE,
  UPC_A: BarcodeFormat.UPC_A,
  UPC_E: BarcodeFormat.UPC_E,
};

function mapFormats(arr = []) {
  const out = [];
  for (const name of arr) {
    const n = ("" + name).toUpperCase();
    if (NAME_TO_FORMAT[n]) out.push(NAME_TO_FORMAT[n]);
  }
  return out;
}

export default function LiveBarcodeScanner({
  onDetected,
  preferredFormats = ["EAN_13", "UPC_A", "UPC_E", "EAN_8", "CODE_128", "QR_CODE"],
  enableBeep = true,
  enableFlash = true,
  enableOCRFallback = true,
  ocrIntervalMs = 3500,
  maxOcrAttempts = 2,
}) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const detectedRef = useRef(false);
  const activeTrackRef = useRef(null);
  const ocrAttemptsRef = useRef(0);
  const ocrTimerRef = useRef(null);

  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [flashPulse, setFlashPulse] = useState(false);

  // --- beep ---
  const playBeep = (freq = 900, duration = 140) => {
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
    } catch {}
  };

  const successFeedback = () => {
    if (enableBeep) playBeep();
    if (navigator.vibrate) navigator.vibrate(120);
    if (enableFlash) {
      setFlashPulse(true);
      setTimeout(() => setFlashPulse(false), 600);
    }
  };

  // --- crop + preprocess frame ---
  const getCroppedFrame = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return null;

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    // crop to central box (same aspect ratio as overlay: ~75% width, height=24)
    const cropWidth = vw * 0.75;
    const cropHeight = vh * 0.15;
    const sx = (vw - cropWidth) / 2;
    const sy = (vh - cropHeight) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(video, sx, sy, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

    // preprocess: grayscale + threshold
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const bw = avg > 128 ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = bw;
    }
    ctx.putImageData(imageData, 0, 0);

    return canvas;
  };

  // --- OCR fallback ---
  const runOcrOnVideoFrame = async () => {
    try {
      const canvas = getCroppedFrame();
      if (!canvas) return null;

      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker({});
      await worker.load();
      await worker.loadLanguage("eng");
      await worker.initialize("eng");
      await worker.setParameters({
        tessedit_char_whitelist: "0123456789",
      });

      const { data } = await worker.recognize(canvas);
      await worker.terminate();

      const digits = (data.text || "").replace(/\s+/g, "");
      const match = digits.match(/\d{8,14}/);
      if (match && match[0]) {
        if (!detectedRef.current) {
          detectedRef.current = true;
          successFeedback();
          stopCamera();
          if (typeof onDetected === "function") onDetected(match[0]);
        }
        return match[0];
      }
    } catch (err) {
      console.warn("OCR fallback failed:", err);
    }
    return null;
  };

  const stopCamera = () => {
    try { readerRef.current?.reset(); } catch {}
    if (ocrTimerRef.current) clearInterval(ocrTimerRef.current);
    const stream = videoRef.current?.srcObject;
    if (stream && stream.getTracks) stream.getTracks().forEach((t) => t.stop());
    activeTrackRef.current = null;
  };

  useEffect(() => {
    const hints = new Map();
    const mapped = mapFormats(preferredFormats);
    if (mapped.length) hints.set(DecodeHintType.POSSIBLE_FORMATS, mapped);

    const codeReader = new BrowserMultiFormatReader(hints);
    readerRef.current = codeReader;

    (async function start() {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        let chosen;
        if (devices && devices.length) {
          const back = devices.find((d) =>
            /back|rear|environment/i.test(d.label)
          );
          chosen = back ? back.deviceId : devices[0].deviceId;
        }

        await codeReader.decodeFromVideoDevice(
          chosen || undefined,
          videoRef.current,
          (result, err) => {
            if (result && !detectedRef.current) {
              detectedRef.current = true;
              const text = result?.getText?.() || result?.text || "";
              console.log("ZXing detected:", text);
              successFeedback();
              stopCamera();
              if (typeof onDetected === "function") onDetected(text);
            }
            if (err && err.name !== "NotFoundException") {
              console.warn("ZXing error:", err);
            }
          },
          {
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
          }
        );

        // torch support
        const stream = videoRef.current?.srcObject;
        if (stream?.getVideoTracks) {
          const track = stream.getVideoTracks()[0];
          activeTrackRef.current = track;
          const caps = track.getCapabilities ? track.getCapabilities() : {};
          if (caps.torch) setTorchAvailable(true);
        }

        // OCR fallback timer
        if (enableOCRFallback) {
          ocrAttemptsRef.current = 0;
          ocrTimerRef.current = setInterval(async () => {
            if (detectedRef.current || ocrAttemptsRef.current >= maxOcrAttempts) {
              clearInterval(ocrTimerRef.current);
              return;
            }
            await runOcrOnVideoFrame();
            ocrAttemptsRef.current++;
          }, ocrIntervalMs);
        }
      } catch (err) {
        console.error("Failed to start scanner:", err);
      }
    })();

    return stopCamera;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <div className="w-full flex flex-col items-center gap-3">
      <div className="relative w-full" style={{ paddingTop: "56%" }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover rounded-lg"
        />
        <div
          aria-hidden
          className={`absolute inset-0 rounded-lg pointer-events-none transition-opacity duration-300 ${
            flashPulse ? "opacity-70 bg-green-400/40" : "opacity-0"
          }`}
        />
        {/* scan box */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3/4 h-24 border-2 border-white/80 rounded-md pointer-events-none" />
      </div>

      <div className="flex gap-2 items-center">
        <button
          onClick={() => {
            detectedRef.current = false;
            ocrAttemptsRef.current = 0;
            try { readerRef.current?.reset(); } catch {}
          }}
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
        <div className="text-sm text-gray-500">
          Align barcode inside the box (rear camera preferred).
        </div>
      </div>
    </div>
  );
}
