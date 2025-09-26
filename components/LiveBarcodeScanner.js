// components/LiveBarcodeScanner.jsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import Quagga from "@ericblade/quagga2";

/**
 * LiveBarcodeScanner (Enhanced)
 *
 * Props:
 *  - onDetected(code: string) => void
 *  - readers: array of Quagga reader strings (default: ["code_128_reader","ean_reader","ean_8_reader","upc_reader"])
 *  - enableBeep (default true)
 *  - enableFlash (visual overlay) (default true)
 *  - keepScanning (if true, don't stop on first detection) (default false)
 *  - duplicateDelayMs (ms to ignore repeated identical scans, default 3000)
 *  - autoStart (start scanner on mount, default false)
 *
 * Notes:
 *  - Drop-in replacement for the Quagga-based version.
 *  - Works better on mobile. Use `Start Scanner` to ensure user interaction required for autoplay on some browsers.
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
  const containerRef = useRef(null); // Quagga will inject video into this container
  const overlayRef = useRef(null); // canvas overlay for drawing boxes
  const lastDetectedRef = useRef({ code: null, time: 0 });
  const scanningRef = useRef(false);
  const [scannerStarted, setScannerStarted] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Idle");
  const [flashPulse, setFlashPulse] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [facingMode, setFacingMode] = useState("environment"); // or 'user'
  const fpsRef = useRef({ lastTs: 0, frames: 0, fps: 0 });

  // beep
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
      setTimeout(() => setFlashPulse(false), 500);
    }
  };

  // draw overlay (boxes/line) from Quagga result
  const drawOverlay = (result) => {
    try {
      const canvas = overlayRef.current;
      const ctx = canvas?.getContext("2d");
      const container = containerRef.current;
      if (!canvas || !ctx || !container) return;

      // size canvas to container
      const rect = container.getBoundingClientRect();
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // draw boxes (possible)
      if (result && result.boxes) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        result.boxes
          .filter((b) => b !== result.box)
          .forEach((box) => {
            ctx.beginPath();
            box.forEach((p, i) => {
              const x = (p.x / result.codeResult?.line?.length) * canvas.width || p.x;
              // quagga2 gives pixel coords; just use them relative to container instead of scaling by line length
            });
            // Quagga2 boxes are in image coords; we can draw using given coords scaled
            ctx.beginPath();
            for (let i = 0; i < box.length; i++) {
              const p = box[i];
              const x = (p.x / result.imgWidth) * canvas.width;
              const y = (p.y / result.imgHeight) * canvas.height;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
          });
      }

      // highlight main box
      if (result && result.box) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(0,255,0,0.85)";
        ctx.beginPath();
        const b = result.box;
        for (let i = 0; i < b.length; i++) {
          const p = b[i];
          const x = (p.x / result.imgWidth) * canvas.width;
          const y = (p.y / result.imgHeight) * canvas.height;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      }

      // draw decoded line if present
      if (result && result.codeResult && result.codeResult.decodedCodes) {
        // optional visual hint for decoded segments
      }
    } catch (e) {
      // don't crash on overlay issues
      // console.warn("overlay draw err", e);
    }
  };

  // compute fps from onProcessed events
  const trackFps = () => {
    const now = performance.now();
    const s = fpsRef.current;
    if (!s.lastTs) s.lastTs = now;
    s.frames++;
    if (now - s.lastTs >= 1000) {
      s.fps = Math.round((s.frames * 1000) / (now - s.lastTs));
      s.frames = 0;
      s.lastTs = now;
    }
  };

  // find the active video element that Quagga created inside the container
  const getQuaggaVideoEl = () => {
    const container = containerRef.current;
    if (!container) return null;
    return container.querySelector("video");
  };

  // attempt to find track capabilities and determine torch availability
  const detectTorch = async () => {
    try {
      const videoEl = getQuaggaVideoEl();
      const stream = videoEl?.srcObject;
      const track = stream?.getVideoTracks?.()[0];
      if (!track) return setTorchAvailable(false);
      const caps = track.getCapabilities?.();
      setTorchAvailable(Boolean(caps && caps.torch));
    } catch (e) {
      setTorchAvailable(false);
    }
  };

  // toggle torch if supported
  const toggleTorch = async () => {
    try {
      const videoEl = getQuaggaVideoEl();
      const stream = videoEl?.srcObject;
      const track = stream?.getVideoTracks?.()[0];
      if (!track) {
        console.warn("No video track for torch");
        return;
      }
      const caps = track.getCapabilities?.();
      if (!caps || !caps.torch) {
        console.warn("Torch not supported");
        setTorchAvailable(false);
        return;
      }
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn((s) => !s);
    } catch (e) {
      console.warn("toggleTorch failed", e);
    }
  };

  // start Quagga scanner
  const startScanner = async () => {
    if (scanningRef.current) return;
    setStatusMsg("Requesting camera...");
    scanningRef.current = true;
    setScannerStarted(true);

    // init config
    const config = {
      inputStream: {
        type: "LiveStream",
        // Quagga will insert video into this element
        target: containerRef.current,
        constraints: {
          facingMode: facingMode, // environment or user
        },
        // optional area to prioritize (percentages)
        area: {
          top: "20%", // top offset
          right: "10%",
          left: "10%",
          bottom: "20%",
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

      setStatusMsg("Scanning for barcodes...");
    } catch (err) {
      console.error("Quagga init/start failed", err);
      setStatusMsg("Camera not available");
      scanningRef.current = false;
      setScannerStarted(false);
      return;
    }

    // detect torch availability after start
    setTimeout(detectTorch, 600);

    // On every frame processed -> draw overlay and track fps
    Quagga.onProcessed((result) => {
      trackFps();
      try {
        // Quagga provides result with imgWidth/imgHeight and boxes/box
        drawOverlay(result);
      } catch (e) {}
    });

    Quagga.onDetected((data) => {
      try {
        const code = data?.codeResult?.code;
        if (!code) return;

        const now = Date.now();
        const last = lastDetectedRef.current;
        if (last.code === code && now - last.time < duplicateDelayMs) {
          // duplicate within cooldown -> ignore
          return;
        }
        lastDetectedRef.current = { code, time: now };

        // feedback
        successFeedback();

        // call user callback
        if (typeof onDetected === "function") {
          try {
            onDetected(code);
          } catch (e) {
            console.warn("onDetected callback error", e);
          }
        }

        if (!keepScanning) {
          stopScanner();
        } else {
          // keep scanning; we already suppressed duplicates by lastDetectedRef
          setStatusMsg(`Detected: ${code}`);
        }
      } catch (e) {
        console.warn("onDetected handling failed", e);
      }
    });
  };

  const stopScanner = () => {
    try {
      Quagga.stop();
    } catch (e) {
      // ignore
    }
    Quagga.offProcessed && Quagga.offProcessed();
    Quagga.offDetected && Quagga.offDetected();
    scanningRef.current = false;
    setScannerStarted(false);
    setStatusMsg("Scanner stopped");
    // clear overlay
    const canvas = overlayRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // switch camera (toggle facing mode) and restart scanner
  const switchCamera = async () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
    stopScanner();
    setTimeout(() => startScanner(), 300);
  };

  // mounted/unmount behavior
  useEffect(() => {
    if (autoStart) {
      // require a user gesture in some browsers; still attempt
      startScanner();
    }
    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // update debug fps displayed every 500ms
  useEffect(() => {
    const t = setInterval(() => {
      const s = fpsRef.current;
      // update status or leave debug toggle to UI
    }, 500);
    return () => clearInterval(t);
  }, []);

  // small UI and controls
  return (
    <div className="w-full flex flex-col items-center gap-3">
      <div className="flex gap-2">
        {!scannerStarted ? (
          <button
            onClick={startScanner}
            className="px-3 py-2 rounded-lg bg-blue-600 text-white"
          >
            Start Scanner
          </button>
        ) : (
          <button
            onClick={stopScanner}
            className="px-3 py-2 rounded-lg bg-red-500 text-white"
          >
            Stop Scanner
          </button>
        )}

        <button
          onClick={switchCamera}
          className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
        >
          Switch Camera
        </button>

        {torchAvailable && (
          <button
            onClick={toggleTorch}
            className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
          >
            {torchOn ? "Torch Off" : "Torch On"}
          </button>
        )}
      </div>

      {/* Video container (Quagga injects <video> here) */}
      <div className="relative w-full" style={{ paddingTop: "56%" }}>
        <div
          ref={containerRef}
          className="absolute inset-0 w-full h-full bg-black rounded-lg overflow-hidden"
        />
        {/* overlay canvas sits above Quagga video */}
        <canvas
          ref={overlayRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ width: "100%", height: "100%" }}
        />
        {/* flash overlay */}
        <div
          aria-hidden
          className={`absolute inset-0 rounded-lg pointer-events-none transition-opacity duration-300 ${
            flashPulse ? "opacity-70 bg-green-400/40" : "opacity-0"
          }`}
        />
        {/* scan guide */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3/4 h-24 border-2 border-white/80 rounded-md pointer-events-none" />
      </div>

      <div className="flex gap-3 items-center">
        <div className="text-sm text-gray-500">{statusMsg}</div>
      </div>
    </div>
  );
}
