"use client";

import React, { useEffect, useRef, useState } from "react";
import Quagga from "@ericblade/quagga2";

/**
 * LiveBarcodeScanner (Beta)
 *
 * Improvements:
 *  - Uses native BarcodeDetector when available (fast, hardware-accelerated).
 *  - Falls back to Quagga when BarcodeDetector fails or is unavailable.
 *  - Only accepts **stable** barcodes:
 *      • numeric-only
 *      • length 8–14
 *      • same code must appear across multiple frames and a minimum duration
 *  - Requests continuous focus where supported (via track constraints).
 *  - Shows status text to reassure the user it's "locking on" instead of glitching.
 *"use client";

import React, { useEffect, useRef, useState } from "react";
import Quagga from "@ericblade/quagga2";

/**
 * LiveBarcodeScanner (BETA)
 *
 * - Uses native BarcodeDetector when available (fast & hardware-accelerated).
 * - Falls back to Quagga when BarcodeDetector is missing or fails.
 * - NO OCR: only real barcode decoding from bars.
 *
 * Reliability features:
 *  - UPC-A style normalization + check digit validation.
 *  - Multi-frame consensus: only accept codes seen multiple times over time.
 *  - Debounces duplicates.
 *
 * Props:
 *  - onDetected(code: string)           : callback when a final stable barcode is detected
 *  - readers = [...]                    : list of Quagga reader names
 *  - enableBeep = true                  : short beep on detection
 *  - enableFlash = true                 : white flash overlay on detection
 *  - keepScanning = false               : keep scanning after a detection
 *  - duplicateDelayMs = 3000            : debounce time for duplicate detections
 *  - autoStart = false                  : auto-start scanning on mount
 */

// ---- Helpers: UPC normalization & validation ----
function calculateUPCACheckDigit(upcaWithoutChecksum) {
  const digits = String(upcaWithoutChecksum).replace(/\D/g, "");
  if (digits.length !== 11) return null;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const n = parseInt(digits[i], 10);
    // odd positions (0,2,4...) are multiplied by 3 in UPC-A
    sum += (i % 2 === 0 ? 3 : 1) * n;
  }
  const mod = sum % 10;
  const check = (10 - mod) % 10;
  return String(check);
}

/**
 * Very focused normalize for product barcodes:
 * - Accepts EAN-13 and UPC-A style
 * - If 13 digits and starts with 0 -> treat as UPC-A by dropping leading 0
 * - If 12 digits -> assume already UPC-A
 * - If 11 digits -> compute check digit
 */
function normalizeToUPCAClient(rawValue) {
  if (!rawValue) return null;
  let digits = String(rawValue).replace(/\D/g, "");
  if (!digits) return null;

  // EAN-13 with leading 0 -> UPC-A
  if (digits.length === 13 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  if (digits.length === 12) {
    return digits;
  }

  if (digits.length === 11) {
    const check = calculateUPCACheckDigit(digits);
    if (!check) return null;
    return digits + check;
  }

  // For now, ignore other lengths (8,7,6, etc.) for robustness.
  return null;
}

function isValidUPCA(code) {
  const digits = String(code).replace(/\D/g, "");
  if (digits.length !== 12) return false;
  const base = digits.slice(0, 11);
  const expected = calculateUPCACheckDigit(base);
  const actual = digits[11];
  return expected !== null && expected === actual;
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
  const lastConfirmedRef = useRef(null);
  const [usingNative, setUsingNative] = useState(false);
  const [scannerStarted, setScannerStarted] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Idle");
  const [flashPulse, setFlashPulse] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [facingMode, setFacingMode] = useState("environment");
  const fpsRef = useRef({ lastTs: 0, frames: 0, fps: 0 });
  const barcodeDetectorRef = useRef(null);

  // Rolling buffer of detections for multi-frame consensus
  const recentDetectionsRef = useRef([]);
  const [candidateCode, setCandidateCode] = useState("");

  // Helper: beep + vibration + flash pulse UI
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
      }, duration + 20);
    } catch (e) {
      // ignore
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

  // Overlay helpers
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
      if (!canvas || !ctx || !container) return;
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
        boxes.forEach((box) => {
          ctx.beginPath();
          box.forEach((p, i) => {
            const scaleX = canvas.width / videoEl.videoWidth || 1;
            const scaleY = canvas.height / videoEl.videoHeight || 1;
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
    } catch (e) {
      // ignore
    }
  };

  // track fps (used when native detection is running)
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

  // Torch detection & toggling
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
      setTorchOn((s) => !s);
    } catch (e) {
      console.warn("toggleTorch failed", e);
    }
  };

  // Map Quagga readers to BarcodeDetector formats (best-effort)
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

  // ---- Multi-frame consensus logic ----
  function considerStableCode(rawValue) {
    const now = Date.now();
    const normalized = normalizeToUPCAClient(rawValue);
    if (!normalized || !isValidUPCA(normalized)) {
      return null;
    }

    // Add to rolling window
    const arr = recentDetectionsRef.current;
    arr.push({ code: normalized, ts: now });

    // Keep only last 2500ms
    const cutoff = now - 2500;
    recentDetectionsRef.current = arr.filter((d) => d.ts >= cutoff);

    const occ = recentDetectionsRef.current.filter(
      (d) => d.code === normalized
    );

    if (occ.length < 3) {
      // Not enough hits yet
      setCandidateCode(normalized);
      return null;
    }

    const spanMs = occ[occ.length - 1].ts - occ[0].ts;
    if (spanMs < 700) {
      // seen but too fast, keep waiting for more stable readings
      setCandidateCode(normalized);
      return null;
    }

    // stable enough
    setCandidateCode(normalized);
    return normalized;
  }

  // ---- Native BarcodeDetector loop ----
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

              // visually show current candidate
              setCandidateCode(rawValue);

              const stable = considerStableCode(rawValue);
              if (!stable) {
                // not yet stable; keep scanning
                if (r.cornerPoints && r.cornerPoints.length) {
                  clearOverlay();
                  drawBoxNative([r.cornerPoints], null, v);
                } else if (r.boundingBox) {
                  clearOverlay();
                  drawBoxNative([], r.boundingBox, v);
                }
                continue;
              }

              const now = Date.now();
              const last = lastDetectedRef.current;
              if (
                last.code === stable &&
                now - last.time < duplicateDelayMs
              ) {
                continue;
              }
              lastDetectedRef.current = { code: stable, time: now };

              // draw stable box
              clearOverlay();
              if (r.cornerPoints && r.cornerPoints.length) {
                drawBoxNative([r.cornerPoints], null, v);
              } else if (r.boundingBox) {
                drawBoxNative([], r.boundingBox, v);
              }

              if (lastConfirmedRef.current === stable && !keepScanning) {
                // already handled this code and we stopped before
                continue;
              }
              lastConfirmedRef.current = stable;

              successFeedback();

              if (typeof onDetected === "function") {
                try {
                  onDetected(stable);
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

  // ---- Quagga fallback ----
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
        const cont = containerRef.current;
        if (!canvas || !ctx || !cont) return;
        const rect = cont.getBoundingClientRect();
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
        const raw = data?.codeResult?.code;
        if (!raw) return;

        setCandidateCode(raw);

        const stable = considerStableCode(raw);
        if (!stable) return;

        const now = Date.now();
        const last = lastDetectedRef.current;
        if (last.code === stable && now - last.time < duplicateDelayMs) return;
        lastDetectedRef.current = { code: stable, time: now };

        if (lastConfirmedRef.current === stable && !keepScanning) {
          return;
        }
        lastConfirmedRef.current = stable;

        successFeedback();
        if (typeof onDetected === "function") {
          try {
            onDetected(stable);
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

  // Stop everything
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
        const cont = containerRef.current;
        if (cont && v.parentElement === cont) {
          try {
            cont.removeChild(v);
          } catch (e) {}
        }
      }
    } catch (e) {}

    clearOverlay();
    setScannerStarted(false);
    setUsingNative(false);
    setCandidateCode("");
    setStatusMsg("Scanner stopped");
  };

  // Start scanner: native first, then Quagga
  const start = async () => {
    if (scannerStarted) return;
    setStatusMsg("Starting scanner...");
    setScannerStarted(true);
    recentDetectionsRef.current = [];
    lastConfirmedRef.current = null;
    setCandidateCode("");

    let nativeStarted = false;
    if ("BarcodeDetector" in window && navigator.mediaDevices?.getUserMedia) {
      try {
        const ok = await startNativeLoop();
        if (ok) nativeStarted = true;
      } catch (e) {
        console.warn("Native start failed:", e);
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
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
    await stop();
    setTimeout(() => start(), 250);
  };

  // Auto-start
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

  // Restart when facingMode changes
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
      {/* Header row with Beta tag */}
      <div className="flex items-center justify-between w-full max-w-md">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-gray-800">
            Live Barcode Scanner
          </h2>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-semibold uppercase tracking-wide">
            Beta
          </span>
        </div>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap gap-2">
        {!scannerStarted ? (
          <button
            onClick={start}
            className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium shadow hover:bg-blue-700"
          >
            Start Scanner
          </button>
        ) : (
          <button
            onClick={stop}
            className="px-3 py-2 rounded-lg bg-red-500 text-white text-sm font-medium shadow hover:bg-red-600"
          >
            Stop Scanner
          </button>
        )}

        <button
          onClick={switchCamera}
          className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium border border-gray-300"
        >
          Switch Camera
        </button>

        {torchAvailable && (
          <button
            onClick={toggleTorch}
            className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium border border-gray-300"
          >
            {torchOn ? "Torch Off" : "Torch On"}
          </button>
        )}
      </div>

      {/* Video + overlay area */}
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

        {/* white flash pulse */}
        <div
          aria-hidden
          className={`absolute inset-0 rounded-lg pointer-events-none transition-opacity duration-300 ${
            flashPulse ? "opacity-60 bg-white/30" : "opacity-0"
          }`}
        />

        {/* center viewfinder box */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-24 border-2 border-white/80 rounded-md pointer-events-none shadow-[0_0_0_1px_rgba(0,0,0,0.3)]" />

        {/* candidate code overlay */}
        {candidateCode && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/70 text-white text-xs font-mono shadow">
            Candidate: {String(candidateCode).replace(/\s+/g, "")}
          </div>
        )}
      </div>

      {/* status line */}
      <div className="flex gap-3 items-center text-xs text-gray-500">
        <span>
          {statusMsg}
          {fpsRef.current && fpsRef.current.fps
            ? ` · ${fpsRef.current.fps} FPS`
            : ""}
          {usingNative
            ? " · Native detector"
            : scannerStarted
            ? " · Software decoder"
            : ""}
        </span>
      </div>
    </div>
  );
}
