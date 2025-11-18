"use client";

import React, { useEffect, useRef, useState } from "react";
import Quagga from "@ericblade/quagga2";

/**
 * LiveBarcodeScanner
 *
 * Improvements:
 *  - Auto-starts scanning on mount (no separate Start button needed).
 *  - Uses BarcodeDetector when available, with numeric + length validation.
 *  - Requires realistic barcode (8–14 digits) to avoid random noise.
 *  - Debounces duplicates using duplicateDelayMs.
 *  - Falls back cleanly to Quagga when native detection isn’t available.
 *  - Keeps torch + camera switch + overlay + haptic/flash feedback.
 */

export default function LiveBarcodeScanner({
  onDetected,
  readers = ["code_128_reader", "ean_reader", "ean_8_reader", "upc_reader"],
  enableBeep = true,
  enableFlash = true,
  keepScanning = false,
  duplicateDelayMs = 3000,
}) {
  const containerRef = useRef(null);
  const overlayRef = useRef(null);
  const videoRef = useRef(null); // used by native detector
  const detectorLoopRef = useRef(null); // rAF id for native loop
  const streamRef = useRef(null);
  const lastDetectedRef = useRef({ code: null, time: 0 });
  const stableCodeRef = useRef({ code: null, count: 0 });

  const [usingNative, setUsingNative] = useState(false);
  const [scannerStarted, setScannerStarted] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Preparing scanner…");
  const [flashPulse, setFlashPulse] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [facingMode, setFacingMode] = useState("environment"); // or 'user'
  const fpsRef = useRef({ lastTs: 0, frames: 0, fps: 0 });
  const barcodeDetectorRef = useRef(null);
  const audioRef = useRef(null);

  // Tiny beep sound via Web Audio
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
        } catch {}
      }, duration + 30);
    } catch {
      // ignore failures
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

  // Validate that a string looks like a real product barcode
  const isLikelyBarcode = (text) => {
    if (!text) return false;
    const digits = String(text).replace(/\D/g, "");
    // most UPC/EAN/ITF codes are 8–14 digits
    return /^\d{8,14}$/.test(digits);
  };

  // --- Overlay helpers ---
  const clearOverlay = () => {
    try {
      const canvas = overlayRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } catch {}
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
        boxes.forEach((box) => {
          ctx.beginPath();
          const scaleX = canvas.width / (videoEl.videoWidth || canvas.width || 1);
          const scaleY = canvas.height / (videoEl.videoHeight || canvas.height || 1);
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
        const scaleX = canvas.width / (videoEl.videoWidth || canvas.width || 1);
        const scaleY = canvas.height / (videoEl.videoHeight || canvas.height || 1);
        const x = (boundingBox.x || 0) * scaleX;
        const y = (boundingBox.y || 0) * scaleY;
        const w = (boundingBox.width || 0) * scaleX;
        const h = (boundingBox.height || 0) * scaleY;
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
      }
    } catch {
      // ignore drawing failures
    }
  };

  // --- FPS tracking (for debugging/status) ---
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
    } catch {}
  };

  // --- Torch detection & toggling ---
  const detectTorch = async () => {
    try {
      const stream = streamRef.current;
      const track = stream?.getVideoTracks?.()[0];
      const caps = track?.getCapabilities?.();
      setTorchAvailable(Boolean(caps && caps.torch));
    } catch {
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
    }
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
      setStatusMsg("Using software scanner…");
      return false;
    }

    try {
      if (!barcodeDetectorRef.current) {
        const formats = readersToBarcodeDetectorFormats(readers);
        try {
          barcodeDetectorRef.current = new window.BarcodeDetector({ formats });
        } catch {
          barcodeDetectorRef.current = new window.BarcodeDetector();
        }
      }
    } catch (e) {
      console.warn("BarcodeDetector instantiation failed:", e);
      setStatusMsg("Hardware scanner unavailable");
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
      setStatusMsg("Scanning…");
      setUsingNative(true);
      detectTorch().catch(() => {});
    } catch (e) {
      console.warn("getUserMedia failed for native detector:", e);
      setStatusMsg("Camera access denied");
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
              if (!rawValue || !isLikelyBarcode(rawValue)) continue;

              const digits = rawValue.replace(/\D/g, "");
              const now = Date.now();
              const last = lastDetectedRef.current;

              // stability: require the same code multiple frames in a row
              if (stableCodeRef.current.code === digits) {
                stableCodeRef.current.count += 1;
              } else {
                stableCodeRef.current.code = digits;
                stableCodeRef.current.count = 1;
              }

              // Ignore if not yet stable (e.g., fewer than 2 frames)
              if (stableCodeRef.current.count < 2) continue;

              // debounce duplicates
              if (last.code === digits && now - last.time < duplicateDelayMs) {
                continue;
              }
              lastDetectedRef.current = { code: digits, time: now };

              clearOverlay();
              if (r.cornerPoints && r.cornerPoints.length) {
                drawBoxNative([r.cornerPoints], null, v);
              } else if (r.boundingBox) {
                drawBoxNative([], r.boundingBox, v);
              }

              successFeedback();

              if (typeof onDetected === "function") {
                try {
                  onDetected(digits);
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
      setStatusMsg("Scanner not ready");
      return false;
    }

    try {
      Quagga.stop();
    } catch {}

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
      setStatusMsg("Scanning…");
      setUsingNative(false);
    } catch (err) {
      console.error("Quagga init/start failed:", err);
      setStatusMsg("Scanner unavailable");
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
          ctx.strokeStyle = "rgba(255,255,255,0.5)";
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
      } catch {
        // ignore
      }
    });

    Quagga.onDetected((data) => {
      try {
        const raw = data?.codeResult?.code;
        if (!raw || !isLikelyBarcode(raw)) return;

        const digits = raw.replace(/\D/g, "");
        const now = Date.now();
        const last = lastDetectedRef.current;

        // stability: require at least 2 consecutive detections of the same cleaned code
        if (stableCodeRef.current.code === digits) {
          stableCodeRef.current.count += 1;
        } else {
          stableCodeRef.current.code = digits;
          stableCodeRef.current.count = 1;
        }
        if (stableCodeRef.current.count < 2) return;

        if (last.code === digits && now - last.time < duplicateDelayMs) return;
        lastDetectedRef.current = { code: digits, time: now };

        successFeedback();

        if (typeof onDetected === "function") {
          try {
            onDetected(digits);
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
    setStatusMsg("Stopping…");

    try {
      if (detectorLoopRef.current) {
        cancelAnimationFrame(detectorLoopRef.current);
        detectorLoopRef.current = null;
      }
    } catch {}

    try {
      Quagga.stop();
    } catch {}

    try {
      const s = streamRef.current;
      if (s && s.getTracks) {
        s.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {}
        });
      }
      streamRef.current = null;
    } catch {}

    try {
      const v = videoRef.current;
      if (v) {
        try {
          v.pause();
        } catch {}
        try {
          v.srcObject = null;
        } catch {}
        const container = containerRef.current;
        if (container && v.parentElement === container) {
          try {
            container.removeChild(v);
          } catch {}
        }
      }
    } catch {}

    clearOverlay();
    setScannerStarted(false);
    setUsingNative(false);
    setStatusMsg("Scanner stopped");
  };

  // Start: try native, then Quagga
  const start = async () => {
    if (scannerStarted) return;
    setScannerStarted(true);
    setStatusMsg("Starting scanner…");

    let nativeStarted = false;
    if ("BarcodeDetector" in window && navigator.mediaDevices?.getUserMedia) {
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
        }
      } catch (e) {
        console.error("Quagga fallback failed:", e);
        setStatusMsg("Scanner failed");
        setScannerStarted(false);
      }
    }
  };

  // Switch camera and restart
  const switchCamera = async () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // Auto-start on mount, clean up on unmount
  useEffect(() => {
    start();
    return () => {
      stop();
      try {
        Quagga.offDetected && Quagga.offDetected();
        Quagga.offProcessed && Quagga.offProcessed();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When facingMode changes while running, restart
  useEffect(() => {
    if (!scannerStarted) return;
    (async () => {
      await stop();
      await start();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  // UI
  return (
    <div className="w-full flex flex-col gap-3">
      {/* Top row: status + controls */}
      <div className="flex items-center justify-between">
        <div className="text-xs px-2 py-1 rounded-full bg-black/40 text-gray-100">
          {statusMsg}
          {fpsRef.current && fpsRef.current.fps
            ? ` · ${fpsRef.current.fps} FPS`
            : ""}
          {usingNative ? " · hardware" : " · software"}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={switchCamera}
            className="text-xs px-3 py-1.5 rounded-full bg-white/10 text-gray-100 border border-white/20 hover:bg-white/20"
          >
            Switch
          </button>
          {torchAvailable && (
            <button
              type="button"
              onClick={toggleTorch}
              className="text-xs px-3 py-1.5 rounded-full bg-white/10 text-gray-100 border border-white/20 hover:bg-white/20"
            >
              {torchOn ? "Torch Off" : "Torch On"}
            </button>
          )}
        </div>
      </div>

      {/* Scanner viewport */}
      <div className="relative w-full rounded-2xl overflow-hidden border border-white/20 bg-black">
        <div
          ref={containerRef}
          className="absolute inset-0 w-full h-full bg-black"
        />
        <canvas
          ref={overlayRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ width: "100%", height: "100%" }}
        />
        <div
          aria-hidden
          className={`absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-300 ${
            flashPulse ? "opacity-60 bg-white/25" : "opacity-0"
          }`}
        />
        {/* Center viewfinder frame */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-24 border-2 border-emerald-400 rounded-lg pointer-events-none" />
        {/* Aspect ratio box (16:9) */}
        <div style={{ paddingTop: "56.25%" }} />
      </div>

      <p className="text-[11px] text-gray-200">
        Align the barcode in the box and hold steady. We’ll capture it
        automatically once it’s clearly detected.
      </p>
    </div>
  );
}
