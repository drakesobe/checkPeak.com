// LiveBarcodeScanner.jsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  BrowserMultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
} from "@zxing/library";

// Map friendly format names to BarcodeFormat enums
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
  MAXICODE: BarcodeFormat.MAXICODE,
  PDF_417: BarcodeFormat.PDF_417,
  QR_CODE: BarcodeFormat.QR_CODE,
  RSS_14: BarcodeFormat.RSS_14,
  RSS_EXPANDED: BarcodeFormat.RSS_EXPANDED,
  UPC_A: BarcodeFormat.UPC_A,
  UPC_E: BarcodeFormat.UPC_E,
  UPC_EAN_EXTENSION: BarcodeFormat.UPC_EAN_EXTENSION,
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

  // --- small beep via WebAudio ---
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
        try { o.stop(); ctx.close(); } catch (e) {}
      }, duration + 20);
    } catch (e) {
      // ignore audio errors
    }
  };

  // --- simple flash + optional vibrate ---
  const successFeedback = (doBeep = true) => {
    if (doBeep && enableBeep) playBeep();
    if (navigator.vibrate) navigator.vibrate(120);
    if (enableFlash) {
      setFlashPulse(true);
      setTimeout(() => setFlashPulse(false), 600);
    }
  };

  useEffect(() => {
    const hints = new Map();
    const mapped = mapFormats(preferredFormats);
    if (mapped.length) hints.set(DecodeHintType.POSSIBLE_FORMATS, mapped);

    const codeReader = new BrowserMultiFormatReader(hints);
    readerRef.current = codeReader;

    let stopped = false;

    (async function start() {
      try {
        const devices = await codeReader.listVideoInputDevices();
        let chosen = undefined;
        if (devices && devices.length) {
          const back = devices.find((d) =>
            /back|rear|environment|camera 2|camera 1/i.test(d.label)
          );
          chosen = back ? back.deviceId : devices[0].deviceId;
        }

        await codeReader.decodeFromVideoDevice(
          chosen || undefined,
          videoRef.current,
          async (result, err) => {
            if (result && !detectedRef.current) {
              detectedRef.current = true;
              const text = result?.getText?.() || result?.text || "";
              successFeedback(true);
              // stop ZXing to avoid duplicates
              try { codeReader.reset(); } catch (e) {}
              // stop camera tracks
              const stream = videoRef.current?.srcObject;
              if (stream?.getTracks) stream.getTracks().forEach((t) => t.stop());
              activeTrackRef.current = null;
              if (typeof onDetected === "function") onDetected(text);
            } // ignore errors
          }
        );

        // after stream starts, check torch capability
        const stream = videoRef.current?.srcObject;
        if (stream && stream.getVideoTracks) {
          const tracks = stream.getVideoTracks();
          if (tracks && tracks.length) {
            activeTrackRef.current = tracks[0];
            const caps = tracks[0].getCapabilities ? tracks[0].getCapabilities() : {};
            if (caps && caps.torch) setTorchAvailable(true);
          }
        }

        // set up periodic OCR fallback attempts if enabled
        if (enableOCRFallback) {
          ocrAttemptsRef.current = 0;
          ocrTimerRef.current = setInterval(async () => {
            if (detectedRef.current || ocrAttemptsRef.current >= maxOcrAttempts) {
              clearInterval(ocrTimerRef.current);
              return;
            }
            // capture frame and run OCR once
            try {
              await runOcrOnVideoFrame(); // will call onDetected if finds digits
            } catch (e) {
              // ignore
            } finally {
              ocrAttemptsRef.current++;
              if (ocrAttemptsRef.current >= maxOcrAttempts) clearInterval(ocrTimerRef.current);
            }
          }, ocrIntervalMs);
        }
      } catch (err) {
        console.error("Failed to start camera scanner:", err);
      }
    })();

    return () => {
      stopped = true;
      try { readerRef.current?.reset(); } catch (e) {}
      if (ocrTimerRef.current) clearInterval(ocrTimerRef.current);
      const stream = videoRef.current?.srcObject;
      if (stream && stream.getTracks) stream.getTracks().forEach((t) => t.stop());
      activeTrackRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // toggle torch if supported
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

  // OCR fallback helper (captures a frame and runs tesseract digits-only)
  const runOcrOnVideoFrame = async () => {
    if (!videoRef.current) return null;
    try {
      // draw scaled frame to canvas
      const video = videoRef.current;
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return null;
      const maxSide = 1200;
      const scale = Math.min(1, maxSide / Math.max(w, h));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // dynamic import Tesseract
      const { createWorker } = await import("tesseract.js");
      const worker = createWorker({
        // logger: m => console.log(m),
      });
      await worker.load();
      await worker.loadLanguage("eng");
      await worker.initialize("eng");
      // only digits to speed up and increase accuracy
      await worker.setParameters({
        tessedit_char_whitelist: "0123456789",
      });

      const { data } = await worker.recognize(canvas);
      await worker.terminate();
      if (!data || !data.text) return null;
      const digits = (data.text || "").replace(/\s+/g, "");
      // find numeric sequence of likely barcode length (8-14 digits)
      const match = digits.match(/\d{8,14}/);
      if (match && match[0]) {
        if (!detectedRef.current) {
          detectedRef.current = true;
          successFeedback(true);
          // stop camera and reset reader
          try { readerRef.current?.reset(); } catch (e) {}
          const stream = videoRef.current?.srcObject;
          if (stream?.getTracks) stream.getTracks().forEach((t) => t.stop());
          if (typeof onDetected === "function") onDetected(match[0]);
        }
        return match[0];
      }
    } catch (err) {
      console.warn("OCR fallback failed:", err);
    }
    return null;
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
        {/* visual success flash overlay */}
        <div
          aria-hidden
          className={`absolute inset-0 rounded-lg pointer-events-none transition-opacity duration-300 ${flashPulse ? "opacity-70 bg-green-400/40" : "opacity-0"}`}
        />
        {/* central scan box */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3/4 h-24 border-2 border-white/80 rounded-md pointer-events-none" />
      </div>

      <div className="flex gap-2 items-center">
        <button
          onClick={() => {
            // allow user to request another scan attempt: reset detection flag
            detectedRef.current = false;
            ocrAttemptsRef.current = 0;
            if (readerRef.current) {
              try { readerRef.current.reset(); } catch (e) {}
            }
          }}
          className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
        >
          Retry
        </button>

        {torchAvailable && (
          <button onClick={toggleTorch} className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200">
            {torchOn ? "Torch Off" : "Torch On"}
          </button>
        )}
        <div className="text-sm text-gray-500">Point camera at barcode (rear camera preferred).</div>
      </div>
    </div>
  );
}
