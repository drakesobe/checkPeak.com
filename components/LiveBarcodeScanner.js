"use client";

import React, { useEffect, useRef, useState } from "react";
import Quagga from "@ericblade/quagga2";

/**
 * LiveBarcodeScanner
 *
 * - Uses the native BarcodeDetector API when available (fast, hardware-accelerated).
 * - Falls back to Quagga when BarcodeDetector isn't available or fails.
 *
 * Props:
 *  - onDetected(code: string)           : callback when a barcode is detected
 *  - readers = [...]                    : list of Quagga reader names (keeps API backwards-compatible)
 *  - enableBeep = true                  : play a short beep on detection
 *  - enableFlash = true                 : small UI flash pulse on detection (doesn't control torch)
 *  - keepScanning = false               : if true, scanner remains running after a detection
 *  - duplicateDelayMs = 3000            : debounce time for duplicate detections
 *  - autoStart = false                  : start automatically on mount
 *
 * Behavior:
 *  - If BarcodeDetector exists, uses it with a requestAnimationFrame loop reading the <video>.
 *  - If not, falls back to Quagga (keeps most of your previous Quagga logic).
 *  - Exposes camera switching and torch control (when supported by the browser & camera).
 *  - Draws simple overlay boxes for detected codes.
 */

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
  const videoRef = useRef(null); // used by native detector
  const detectorLoopRef = useRef(null); // rAF id for native loop
  const streamRef = useRef(null);
  const lastDetectedRef = useRef({ code: null, time: 0 });
  const [usingNative, setUsingNative] = useState(false);
  const [scannerStarted, setScannerStarted] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Idle");
  const [flashPulse, setFlashPulse] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [facingMode, setFacingMode] = useState("environment"); // or 'user'
  const fpsRef = useRef({ lastTs: 0, frames: 0, fps: 0 });
  const barcodeDetectorRef = useRef(null);

  // Helper: beep + vibration + flash pulse UI
  const playBeep = (freq = 900, duration = 120) => {
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
        try {
          o.stop();
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

  // --- Overlay helpers ---
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

      // boxes: array of points [{x,y}...] in video pixel coords OR a DOMRect-like boundingBox
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,255,0,0.9)";
      ctx.fillStyle = "rgba(0,255,0,0.12)";

      if (Array.isArray(boxes) && boxes.length) {
        boxes.forEach((box) => {
          ctx.beginPath();
          box.forEach((p, i) => {
            // videoEl might be scaled to fit; transform coordinates proportionally
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
        // boundingBox might be {x,y,width,height} relative to video
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
      // ignore drawing failures
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

  // --- Torch detection & toggling ---
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

  // Map Quagga readers (strings) to BarcodeDetector formats list (best-effort)
  const readersToBarcodeDetectorFormats = (readerList = []) => {
    const out = new Set();
    for (const r of readerList) {
      const s = String(r).toLowerCase();
      if (s.includes("ean") || s.includes("upc")) out.add("ean_13"); // covers many EAN/UPC cases
      if (s.includes("code_128")) out.add("code_128");
      if (s.includes("code_39")) out.add("code_39");
      if (s.includes("qr")) out.add("qr_code");
      if (s.includes("data_matrix")) out.add("data_matrix");
      if (s.includes("pdf_417") || s.includes("pdf417")) out.add("pdf417");
      // Note: BarcodeDetector format names vary by browser implementation. Using the common ones.
    }
    // Always include ean_13 and upc if none found (most product barcodes)
    if (out.size === 0) {
      out.add("ean_13");
      out.add("code_128");
      out.add("qr_code");
    }
    return Array.from(out);
  };

  // --- Native BarcodeDetector loop ---
  const startNativeLoop = async () => {
    if (!("BarcodeDetector" in window)) {
      setStatusMsg("Native BarcodeDetector not available");
      return false;
    }

    // instantiate detector if not already
    try {
      if (!barcodeDetectorRef.current) {
        const formats = readersToBarcodeDetectorFormats(readers);
        // Some browsers throw if unknown formats supplied; wrap in try/catch
        try {
          barcodeDetectorRef.current = new window.BarcodeDetector({ formats });
        } catch (e) {
          // Some browsers accept no options -> try default
          barcodeDetectorRef.current = new window.BarcodeDetector();
        }
      }
    } catch (e) {
      console.warn("BarcodeDetector instantiation failed:", e);
      setStatusMsg("BarcodeDetector init failed");
      return false;
    }

    // create and attach video element if not there
    let videoEl = videoRef.current;
    if (!videoEl) {
      videoEl = document.createElement("video");
      videoEl.setAttribute("playsinline", ""); // important on iOS
      videoEl.style.width = "100%";
      videoEl.style.height = "100%";
      videoEl.style.objectFit = "cover";
      videoRef.current = videoEl;
    }

    // attach video element into container
    const container = containerRef.current;
    if (container && !container.contains(videoEl)) {
      // remove any existing children (Quagga overlay may exist) but we keep overlay canvas
      container.innerHTML = "";
      container.appendChild(videoEl);
    }

    // request camera with facingMode
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

    // detection loop using requestAnimationFrame
    const loop = async () => {
      try {
        const detector = barcodeDetectorRef.current;
        const v = videoRef.current;
        if (!detector || !v || v.readyState < 2) {
          detectorLoopRef.current = requestAnimationFrame(loop);
          return;
        }

        // call detect on video element
        try {
          const results = await detector.detect(v);
          trackFps();

          if (results && results.length) {
            // We'll pick the first result (but check others for better quality if desired)
            for (const r of results) {
              const rawValue = r.rawValue || (r.rawData ? String(r.rawData) : null);
              if (!rawValue) continue;

              const now = Date.now();
              const last = lastDetectedRef.current;
              if (last.code === rawValue && now - last.time < duplicateDelayMs) {
                // skip duplicate
                continue;
              }
              lastDetectedRef.current = { code: rawValue, time: now };

              // draw overlay - r.boundingBox or r.cornerPoints
              clearOverlay();
              if (r.cornerPoints && r.cornerPoints.length) {
                drawBoxNative([r.cornerPoints], null, v);
              } else if (r.boundingBox) {
                drawBoxNative([], r.boundingBox, v);
              }

              successFeedback();

              if (typeof onDetected === "function") {
                try {
                  onDetected(rawValue);
                } catch (e) {
                  console.warn("onDetected handler threw:", e);
                }
              }

              if (!keepScanning) {
                stop();
                return;
              }
              // if keeping scanning, still continue to check other results in same frame
            }
          } else {
            // no results: clear overlay occasionally
            // clearOverlay(); // keep overlay until next draw to avoid flicker
          }
        } catch (detErr) {
          // detection error (some frames can produce errors), ignore and continue
          // If the detector repeatedly throws, we may want to fallback to Quagga.
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

  // --- Quagga fallback start/stop logic (kept similar to your existing) ---
  const startQuagga = async () => {
    // cleanup container and attach Quagga live stream target
    const container = containerRef.current;
    if (!container) {
      setStatusMsg("No container for Quagga");
      return false;
    }

    // Ensure no previous Quagga instance is running
    try {
      Quagga.stop();
    } catch (e) {}

    // Quagga expects a DOM element reference as target
    const config = {
      inputStream: {
        type: "LiveStream",
        target: container,
        constraints: {
          facingMode: facingMode,
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
      setStatusMsg("Scanning (quagga)...");
      setUsingNative(false);
    } catch (err) {
      console.error("Quagga init/start failed:", err);
      setStatusMsg("Quagga camera init failed");
      return false;
    }

    setTimeout(detectTorch, 600);

    Quagga.onProcessed((result) => {
      // reuse your overlay drawing strategy: transform Quagga boxes to drawn overlay
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
      } catch (e) {
        // ignore overlay errors
      }
    });

    Quagga.onDetected((data) => {
      try {
        const code = data?.codeResult?.code;
        if (!code) return;
        const now = Date.now();
        const last = lastDetectedRef.current;
        if (last.code === code && now - last.time < duplicateDelayMs) return;
        lastDetectedRef.current = { code, time: now };
        successFeedback();
        if (typeof onDetected === "function") {
          try {
            onDetected(code);
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

  // Stop everything: Quagga, native loop, stop tracks, clear overlays
  const stop = async () => {
    setStatusMsg("Stopping scanner...");
    // cancel native loop
    try {
      if (detectorLoopRef.current) {
        cancelAnimationFrame(detectorLoopRef.current);
        detectorLoopRef.current = null;
      }
    } catch (e) {}

    // stop Quagga if it is running
    try {
      Quagga.stop();
    } catch (e) {}

    // stop media tracks if set
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

    // unset video srcObject
    try {
      const v = videoRef.current;
      if (v) {
        try {
          v.pause();
        } catch (e) {}
        try {
          v.srcObject = null;
        } catch (e) {}
        // remove video from container if it was appended
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

  // Start scanner: try native first, then Quagga fallback
  const start = async () => {
    if (scannerStarted) return;
    setStatusMsg("Starting scanner...");
    setScannerStarted(true);

    // Try native first
    let nativeStarted = false;
    if ("BarcodeDetector" in window && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const ok = await startNativeLoop();
        if (ok) nativeStarted = true;
      } catch (e) {
        console.warn("Native start failed:", e);
        nativeStarted = false;
      }
    }

    if (!nativeStarted) {
      // fallback to Quagga
      try {
        const ok = await startQuagga();
        if (!ok) {
          // both failed
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

  // Switch camera (toggle facingMode) and restart scanner
  const switchCamera = async () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
    // stop current scanner then start with new facingMode
    await stop();
    setTimeout(() => start(), 250);
  };

  // Auto-start on mount if requested
  useEffect(() => {
    if (autoStart) {
      start();
    }
    return () => {
      // cleanup
      stop();
      try {
        // Quagga cleanup listeners
        Quagga.offDetected && Quagga.offDetected();
        Quagga.offProcessed && Quagga.offProcessed();
      } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When facingMode changes while running, restart to apply new constraint
  useEffect(() => {
    if (!scannerStarted) return;
    (async () => {
      await stop();
      await start();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  // Expose UI small status and controls
  return (
    <div className="w-full flex flex-col items-center gap-3">
      <div className="flex gap-2">
        {!scannerStarted ? (
          <button
            onClick={start}
            className="px-3 py-2 rounded-lg bg-blue-600 text-white"
          >
            Start Scanner
          </button>
        ) : (
          <button onClick={stop} className="px-3 py-2 rounded-lg bg-red-500 text-white">
            Stop Scanner
          </button>
        )}

        <button onClick={switchCamera} className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200">
          Switch Camera
        </button>

        {torchAvailable && (
          <button onClick={toggleTorch} className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200">
            {torchOn ? "Torch Off" : "Torch On"}
          </button>
        )}
      </div>

      <div className="relative w-full" style={{ paddingTop: "56%" }}>
        {/* container for either video (native) or Quagga live stream */}
        <div
          ref={containerRef}
          className="absolute inset-0 w-full h-full bg-black rounded-lg overflow-hidden"
        />

        {/* overlay canvas (drawn on by both native and Quagga flows) */}
        <canvas
          ref={overlayRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ width: "100%", height: "100%" }}
        />

        {/* flash pulse UI */}
        <div
          aria-hidden
          className={`absolute inset-0 rounded-lg pointer-events-none transition-opacity duration-300 ${flashPulse ? "opacity-60 bg-white/30" : "opacity-0"}`}
        />

        {/* center viewfinder */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3/4 h-24 border-2 border-white/80 rounded-md pointer-events-none" />
      </div>

      <div className="flex gap-3 items-center">
        <div className="text-sm text-gray-500">
          {statusMsg} {fpsRef.current && fpsRef.current.fps ? `· ${fpsRef.current.fps} FPS` : ""}
          {usingNative ? " (native)" : scannerStarted ? " (software)" : ""}
        </div>
      </div>
    </div>
  );
}
