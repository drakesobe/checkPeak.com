"use client";

import React, { useEffect, useRef, useState } from "react";
import Quagga from "@ericblade/quagga2";

/**
 * LiveBarcodeScanner (Beta)
 *
 * - Uses the native BarcodeDetector API when available (fast, hardware-accelerated).
 * - Falls back to Quagga when BarcodeDetector isn't available or fails.
 *
 * Safety / Accuracy:
 *  - NEVER uses OCR for barcodes (only real barcode decoders).
 *  - Validates numeric codes with UPC-A / EAN-13 check digits when possible.
 *  - Requires multi-frame consensus: same valid code must appear several times
 *    over ~700ms before we accept it.
 *
 * Props:
 *  - onDetected(code: string)           : callback when a barcode is confidently detected
 *  - readers = [...]                    : list of Quagga reader names
 *  - enableBeep = true                  : play a short beep on detection
 *  - enableFlash = true                 : small UI flash pulse on detection
 *  - keepScanning = false               : if true, scanner remains running after a detection
 *  - duplicateDelayMs = 3000            : debounce time for duplicate detections
 *  - autoStart = false                  : start automatically on mount
 */

function isLikelyValidBarcodeDigits(digits) {
  if (!digits) return false;
  const len = digits.length;
  if (len < 8 || len > 14) return false;

  // Helper for UPC-A (12 digits)
  const isValidUPCA = (d) => {
    if (d.length !== 12) return true; // don't block if not correct length for UPC-A
    const base = d.slice(0, 11);
    const check = d.slice(11);
    const sum = base
      .split("")
      .map((ch, i) => {
        const n = parseInt(ch, 10);
        return (i % 2 === 0 ? 3 * n : n);
      })
      .reduce((a, b) => a + b, 0);
    const expected = (10 - (sum % 10)) % 10;
    return String(expected) === check;
  };

  // Helper for EAN-13 (13 digits)
  const isValidEAN13 = (d) => {
    if (d.length !== 13) return true; // don't block if not correct length for EAN-13
    const base = d.slice(0, 12);
    const check = d.slice(12);
    const sum = base
      .split("")
      .map((ch, i) => {
        const n = parseInt(ch, 10);
        // Right to left weighting but easier: from left:
        // positions starting at 0: even -> 1x, odd -> 3x
        return (i % 2 === 0 ? n : 3 * n);
      })
      .reduce((a, b) => a + b, 0);
    const expected = (10 - (sum % 10)) % 10;
    return String(expected) === check;
  };

  if (len === 12 && !isValidUPCA(digits)) return false;
  if (len === 13 && !isValidEAN13(digits)) return false;

  // For EAN-8 / internal codes we don't block here; consensus will help.
  return true;
}

export default function LiveBarcodeScanner({
  onDetected,
  readers = ["code_128_reader", "ean_reader", "ean_8_reader", "upc_reader"],
  enableBeep = true,
  enableFlash = true,
  keepScanning = false,
  duplicateDelayMs = 3000,
  autoStart = false,
}) {
  const containerRef = useRef(null);
  const overlayRef = useRef(null);
  const videoRef = useRef(null);
  const detectorLoopRef = useRef(null);
  const streamRef = useRef(null);
  const lastDetectedRef = useRef({ code: null, time: 0 });
  const recentDetectionsRef = useRef([]); // for multi-frame consensus

  const [usingNative, setUsingNative] = useState(false);
  const [scannerStarted, setScannerStarted] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Idle");
  const [flashPulse, setFlashPulse] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [facingMode, setFacingMode] = useState("environment");
  const [lastStableCode, setLastStableCode] = useState("");
  const fpsRef = useRef({ lastTs: 0, frames: 0, fps: 0 });
  const barcodeDetectorRef = useRef(null);

  // --- Feedback helpers (beep + vibrate + flash overlay) ---
  const playBeep = (freq = 900, duration = 120) => {
    if (!enableBeep) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
      osc.start(now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration / 1000);
      setTimeout(() => {
        try {
          osc.stop();
          ctx.close();
        } catch (e) {}
      }, duration + 30);
    } catch (e) {
      // ignore audio failures
    }
  };

  const successFeedback = () => {
    playBeep();
    if (navigator.vibrate) navigator.vibrate(120);
    if (enableFlash) {
      setFlashPulse(true);
      setTimeout(() => setFlashPulse(false), 450);
    }
  };

  // --- Overlay drawing helpers ---
  const clearOverlay = () => {
    try {
      const canvas = overlayRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } catch (e) {}
  };

  const drawBoxNative = (boxes = [], boundingBox = null, videoEl = null) => {
    try {
      const canvas = overlayRef.current;
      const ctx = canvas?.getContext("2d");
      const container = containerRef.current;
      if (!canvas || !ctx || !container || !videoEl) return;

      const rect = container.getBoundingClientRect();
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,255,0,0.9)";
      ctx.fillStyle = "rgba(0,255,0,0.12)";

      if (Array.isArray(boxes) && boxes.length) {
        const scaleX = canvas.width / videoEl.videoWidth || 1;
        const scaleY = canvas.height / videoEl.videoHeight || 1;
        boxes.forEach((box) => {
          ctx.beginPath();
          box.forEach((p, i) => {
            const x = (p.x || 0) * scaleX;
            const y = (p.y || 0) * scaleY;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          });
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        });
      } else if (boundingBox) {
        const scaleX = canvas.width / videoEl.videoWidth || 1;
        const scaleY = canvas.height / videoEl.videoHeight || 1;
        const x = (boundingBox.x || 0) * scaleX;
        const y = (boundingBox.y || 0) * scaleY;
        const w = (boundingBox.width || 0) * scaleX;
        const h = (boundingBox.height || 0) * scaleY;
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
      }
    } catch (e) {}
  };

  // FPS tracking for debug/status
  const trackFps = () => {
    try {
      const now = performance.now();
      const s = fpsRef.current;
      if (!s.lastTs) s.lastTs = now;
      s.frames++;
      if (now - s.lastTs >= 1000) {
        s.fps = Math.round((s.frames * 1000) / (now - s.lastTs));
        s.frames = 0;
        s.lastTs = now;
      }
    } catch (e) {}
  };

  // --- Torch detection & toggle ---
  const detectTorch = async () => {
    try {
      const stream = streamRef.current;
      const track = stream?.getVideoTracks?.()[0];
      const caps = track?.getCapabilities?.();
      setTorchAvailable(Boolean(caps && caps.torch));
    } catch (e) {
      setTorchAvailable(false);
    }
  };

  const toggleTorch = async () => {
    try {
      const stream = streamRef.current;
      const track = stream?.getVideoTracks?.()[0];
      if (!track) return;
      const constraints = { advanced: [{ torch: !torchOn }] };
      await track.applyConstraints(constraints);
      setTorchOn((prev) => !prev);
    } catch (e) {
      console.warn("toggleTorch failed", e);
    }
  };

  // readers -> BarcodeDetector formats
  const readersToBarcodeDetectorFormats = (readerList = []) => {
    const out = new Set();
    for (const r of readerList) {
      const s = String(r).toLowerCase();
      if (s.includes("ean") || s.includes("upc")) out.add("ean_13");
      if (s.includes("code_128")) out.add("code_128");
      if (s.includes("code_39")) out.add("code_39");
      if (s.includes("qr")) out.add("qr_code");
      if (s.includes("data_matrix")) out.add("data_matrix");
      if (s.includes("pdf_417") || s.includes("pdf417")) out.add("pdf417");
    }
    if (out.size === 0) {
      out.add("ean_13");
      out.add("code_128");
      out.add("qr_code");
    }
    return Array.from(out);
  };

  // --- Multi-frame consensus: only accept a code if it shows up consistently ---
  const considerCode = (rawValue) => {
    const now = Date.now();
    const digits = String(rawValue || "").replace(/\D/g, "");
    if (!digits) return null;

    if (!isLikelyValidBarcodeDigits(digits)) {
      // obvious failure → ignore
      return null;
    }

    // push current detection
    recentDetectionsRef.current.push({ code: digits, ts: now });

    // keep ~2.5s worth of detections
    recentDetectionsRef.current = recentDetectionsRef.current.filter(
      (d) => now - d.ts < 2500
    );

    const occurrences = recentDetectionsRef.current.filter(
      (d) => d.code === digits
    );

    // require at least 3 frames over at least 700ms
    if (
      occurrences.length >= 3 &&
      occurrences[occurrences.length - 1].ts - occurrences[0].ts >= 700
    ) {
      return digits;
    }

    return null;
  };

  // --- Native BarcodeDetector loop ---
  const startNativeLoop = async () => {
    if (!("BarcodeDetector" in window)) {
      setStatusMsg("Native BarcodeDetector not available");
      return false;
    }

    try {
      if (!barcodeDetectorRef.current) {
        const formats = readersToBarcodeDetectorFormats(readers);
        try {
          barcodeDetectorRef.current = new window.BarcodeDetector({ formats });
        } catch (e) {
          // Some browsers only accept default
          barcodeDetectorRef.current = new window.BarcodeDetector();
        }
      }
    } catch (e) {
      console.warn("BarcodeDetector instantiation failed:", e);
      setStatusMsg("BarcodeDetector init failed");
      return false;
    }

    let videoEl = videoRef.current;
    if (!videoEl) {
      videoEl = document.createElement("video");
      videoEl.setAttribute("playsinline", "");
      videoEl.style.width = "100%";
      videoEl.style.height = "100%";
      videoEl.style.objectFit = "cover";
      videoRef.current = videoEl;
    }

    const container = containerRef.current;
    if (container && !container.contains(videoEl)) {
      container.innerHTML = "";
      container.appendChild(videoEl);
    }

    try {
      const constraints = {
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      videoEl.srcObject = stream;
      await videoEl.play().catch(() => {});
      setStatusMsg("Scanning (native)...");
      setUsingNative(true);
      detectTorch().catch(() => {});
    } catch (e) {
      console.warn("getUserMedia failed for native detector:", e);
      setStatusMsg("Camera access denied / unavailable");
      return false;
    }

    const loop = async () => {
      try {
        const detector = barcodeDetectorRef.current;
        const v = videoRef.current;
        if (!detector || !v || v.readyState < 2) {
          detectorLoopRef.current = requestAnimationFrame(loop);
          return;
        }

        try {
          const results = await detector.detect(v);
          trackFps();

          if (results && results.length) {
            for (const r of results) {
              const rawValue =
                r.rawValue || (r.rawData ? String(r.rawData) : null);
              if (!rawValue) continue;

              const stableCode = considerCode(rawValue);
              if (!stableCode) continue;

              const now = Date.now();
              const last = lastDetectedRef.current;
              if (
                last.code === stableCode &&
                now - last.time < duplicateDelayMs
              ) {
                continue;
              }
              lastDetectedRef.current = { code: stableCode, time: now };

              clearOverlay();
              if (r.cornerPoints && r.cornerPoints.length) {
                drawBoxNative([r.cornerPoints], null, v);
              } else if (r.boundingBox) {
                drawBoxNative([], r.boundingBox, v);
              }

              successFeedback();
              setLastStableCode(stableCode);

              if (typeof onDetected === "function") {
                try {
                  onDetected(stableCode);
                } catch (e) {
                  console.warn("onDetected handler threw:", e);
                }
              }

              if (!keepScanning) {
                stop();
                return;
              }
            }
          }
        } catch (detErr) {
          console.warn("BarcodeDetector.detect() error:", detErr);
        }
      } catch (err) {
        console.error("Native detection loop failed:", err);
      } finally {
        detectorLoopRef.current = requestAnimationFrame(loop);
      }
    };

    detectorLoopRef.current = requestAnimationFrame(loop);
    return true;
  };

  // --- Quagga fallback ---
  const startQuagga = async () => {
    const container = containerRef.current;
    if (!container) {
      setStatusMsg("No container for Quagga");
      return false;
    }

    try {
      Quagga.stop();
    } catch (e) {}

    const config = {
      inputStream: {
        type: "LiveStream",
        target: container,
        constraints: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      },
      locator: {
        patchSize: "medium",
        halfSample: true,
      },
      decoder: {
        readers,
      },
      locate: true,
    };

    try {
      await new Promise((resolve, reject) => {
        Quagga.init(config, (err) => {
          if (err) {
            reject(err);
            return;
          }
          Quagga.start();
          resolve();
        });
      });
      setStatusMsg("Scanning (software)...");
      setUsingNative(false);
    } catch (err) {
      console.error("Quagga init/start failed:", err);
      setStatusMsg("Quagga camera init failed");
      return false;
    }

    setTimeout(detectTorch, 600);

    Quagga.onProcessed((result) => {
      try {
        const canvas = overlayRef.current;
        const ctx = canvas?.getContext("2d");
        const container = containerRef.current;
        if (!canvas || !ctx || !container) return;
        const rect = container.getBoundingClientRect();
        if (canvas.width !== rect.width || canvas.height !== rect.height) {
          canvas.width = rect.width;
          canvas.height = rect.height;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (result && result.boxes) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = "rgba(255,255,255,0.6)";
          result.boxes
            .filter((b) => b !== result.box)
            .forEach((box) => {
              ctx.beginPath();
              box.forEach((p, i) => {
                const x = (p.x / result.imgWidth) * canvas.width;
                const y = (p.y / result.imgHeight) * canvas.height;
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
              });
              ctx.closePath();
              ctx.stroke();
            });
        }

        if (result && result.box) {
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(0,255,0,0.85)";
          ctx.beginPath();
          result.box.forEach((p, i) => {
            const x = (p.x / result.imgWidth) * canvas.width;
            const y = (p.y / result.imgHeight) * canvas.height;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          });
          ctx.closePath();
          ctx.stroke();
        }
      } catch (e) {}
    });

    Quagga.onDetected((data) => {
      try {
        const rawCode = data?.codeResult?.code;
        if (!rawCode) return;

        const stableCode = considerCode(rawCode);
        if (!stableCode) return;

        const now = Date.now();
        const last = lastDetectedRef.current;
        if (
          last.code === stableCode &&
          now - last.time < duplicateDelayMs
        ) {
          return;
        }
        lastDetectedRef.current = { code: stableCode, time: now };

        successFeedback();
        setLastStableCode(stableCode);

        if (typeof onDetected === "function") {
          try {
            onDetected(stableCode);
          } catch (e) {
            console.warn("onDetected handler threw:", e);
          }
        }
        if (!keepScanning) stop();
      } catch (e) {
        console.warn("Quagga onDetected handler error:", e);
      }
    });

    return true;
  };

  // --- Stop everything ---
  const stop = async () => {
    setStatusMsg("Stopping scanner...");

    try {
      if (detectorLoopRef.current) {
        cancelAnimationFrame(detectorLoopRef.current);
        detectorLoopRef.current = null;
      }
    } catch (e) {}

    try {
      Quagga.stop();
    } catch (e) {}

    try {
      const s = streamRef.current;
      if (s && s.getTracks) {
        s.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch (e) {}
        });
      }
      streamRef.current = null;
    } catch (e) {}

    try {
      const v = videoRef.current;
      if (v) {
        try {
          v.pause();
        } catch (e) {}
        try {
          v.srcObject = null;
        } catch (e) {}
        const container = containerRef.current;
        if (container && v.parentElement === container) {
          try {
            container.removeChild(v);
          } catch (e) {}
        }
      }
    } catch (e) {}

    clearOverlay();
    setScannerStarted(false);
    setUsingNative(false);
    setStatusMsg("Scanner stopped");
  };

  const start = async () => {
    if (scannerStarted) return;
    setStatusMsg("Starting scanner...");
    setScannerStarted(true);
    setLastStableCode("");
    recentDetectionsRef.current = [];

    let nativeStarted = false;
    if (
      "BarcodeDetector" in window &&
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia
    ) {
      try {
        const ok = await startNativeLoop();
        if (ok) nativeStarted = true;
      } catch (e) {
        console.warn("Native start failed:", e);
        nativeStarted = false;
      }
    }

    if (!nativeStarted) {
      try {
        const ok = await startQuagga();
        if (!ok) {
          setStatusMsg("Scanner unavailable");
          setScannerStarted(false);
          return;
        }
      } catch (e) {
        console.error("Quagga fallback failed:", e);
        setStatusMsg("Scanner failed");
        setScannerStarted(false);
        return;
      }
    }
  };

  const switchCamera = async () => {
    setFacingMode((prev) =>
      prev === "environment" ? "user" : "environment"
    );
    await stop();
    setTimeout(() => start(), 250);
  };

  useEffect(() => {
    if (autoStart) {
      start();
    }
    return () => {
      stop();
      try {
        Quagga.offDetected && Quagga.offDetected();
        Quagga.offProcessed && Quagga.offProcessed();
      } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!scannerStarted) return;
    (async () => {
      await stop();
      await start();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  return (
    <div className="w-full flex flex-col items-center gap-3">
      {/* Header with Beta tag */}
      <div className="flex items-center justify-between w-full max-w-md mb-1">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-800">
            Live Barcode Scanner
          </h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 uppercase tracking-wide">
            Beta
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 justify-center">
        {!scannerStarted ? (
          <button
            onClick={start}
            className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm shadow hover:bg-blue-700"
          >
            Start Scanner
          </button>
        ) : (
          <button
            onClick={stop}
            className="px-3 py-2 rounded-lg bg-red-500 text-white text-sm shadow hover:bg-red-600"
          >
            Stop Scanner
          </button>
        )}

        <button
          onClick={switchCamera}
          className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-800"
        >
          Switch Camera
        </button>

        {torchAvailable && (
          <button
            onClick={toggleTorch}
            className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-800"
          >
            {torchOn ? "Torch Off" : "Torch On"}
          </button>
        )}
      </div>

      {/* Video + overlay */}
      <div className="relative w-full max-w-md" style={{ paddingTop: "56%" }}>
        <div
          ref={containerRef}
          className="absolute inset-0 w-full h-full bg-black rounded-lg overflow-hidden"
        />
        <canvas
          ref={overlayRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ width: "100%", height: "100%" }}
        />
        <div
          aria-hidden
          className={`absolute inset-0 rounded-lg pointer-events-none transition-opacity duration-300 ${
            flashPulse ? "opacity-60 bg-white/30" : "opacity-0"
          }`}
        />
        {/* Center viewfinder */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-24 border-2 border-white/80 rounded-md pointer-events-none" />
      </div>

      {/* Status + last code */}
      <div className="flex flex-col items-center gap-1 text-xs text-gray-600">
        <div>
          {statusMsg}
          {fpsRef.current && fpsRef.current.fps
            ? ` · ${fpsRef.current.fps} FPS`
            : ""}
          {usingNative
            ? " (native)"
            : scannerStarted
            ? " (software)"
            : ""}
        </div>
        {lastStableCode && (
          <div className="px-3 py-1 rounded-full bg-gray-100 text-gray-800 text-xs">
            Detected: <span className="font-mono">{lastStableCode}</span>
          </div>
        )}
      </div>
    </div>
  );
}
