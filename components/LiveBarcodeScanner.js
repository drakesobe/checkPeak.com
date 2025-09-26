"use client";

import React, { useEffect, useRef, useState } from "react";
import Quagga from "@ericblade/quagga2";

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
  const lastDetectedRef = useRef({ code: null, time: 0 });
  const scanningRef = useRef(false);
  const [scannerStarted, setScannerStarted] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Idle");
  const [flashPulse, setFlashPulse] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [facingMode, setFacingMode] = useState("environment");

  const fpsRef = useRef({ lastTs: 0, frames: 0, fps: 0 });

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
    } catch (e) {}
  };

  const successFeedback = () => {
    playBeep();
    if (navigator.vibrate) navigator.vibrate(120);
    if (enableFlash) {
      setFlashPulse(true);
      setTimeout(() => setFlashPulse(false), 500);
    }
  };

  const drawOverlay = (result) => {
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
        result.boxes.forEach((box) => {
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
  };

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

  const getQuaggaVideoEl = () => {
    const container = containerRef.current;
    if (!container) return null;
    return container.querySelector("video");
  };

  const detectTorch = async () => {
    try {
      const videoEl = getQuaggaVideoEl();
      const stream = videoEl?.srcObject;
      const track = stream?.getVideoTracks?.()[0];
      const caps = track?.getCapabilities?.();
      setTorchAvailable(Boolean(caps && caps.torch));
    } catch (e) {
      setTorchAvailable(false);
    }
  };

  const toggleTorch = async () => {
    try {
      const videoEl = getQuaggaVideoEl();
      const stream = videoEl?.srcObject;
      const track = stream?.getVideoTracks?.()[0];
      if (!track) return;
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn((s) => !s);
    } catch (e) {
      console.warn("toggleTorch failed", e);
    }
  };

  const startScanner = async () => {
    if (scanningRef.current) return;
    setStatusMsg("Requesting camera...");
    scanningRef.current = true;
    setScannerStarted(true);

    const config = {
      inputStream: {
        type: "LiveStream",
        target: containerRef.current,
        constraints: {
          facingMode: facingMode,
        },
        area: undefined,
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

    setTimeout(detectTorch, 600);

    Quagga.onProcessed((result) => {
      trackFps();
      drawOverlay(result);
    });

    Quagga.onDetected((data) => {
      const code = data?.codeResult?.code;
      if (!code) return;
      const now = Date.now();
      const last = lastDetectedRef.current;
      if (last.code === code && now - last.time < duplicateDelayMs) return;
      lastDetectedRef.current = { code, time: now };
      successFeedback();
      if (typeof onDetected === "function") {
        onDetected(code);
      }
      if (!keepScanning) stopScanner();
      else setStatusMsg(`Detected: ${code}`);
    });
  };

  const stopScanner = () => {
    try {
      Quagga.stop();
    } catch (e) {}
    scanningRef.current = false;
    setScannerStarted(false);
    setStatusMsg("Scanner stopped");
    const canvas = overlayRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const switchCamera = async () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
    stopScanner();
    setTimeout(startScanner, 300);
  };

  useEffect(() => {
    if (autoStart) startScanner();
    return () => stopScanner();
  }, []);

  return (
    <div className="w-full flex flex-col items-center gap-3">
      <div className="flex gap-2">
        {!scannerStarted ? (
          <button onClick={startScanner} className="px-3 py-2 rounded-lg bg-blue-600 text-white">Start Scanner</button>
        ) : (
          <button onClick={stopScanner} className="px-3 py-2 rounded-lg bg-red-500 text-white">Stop Scanner</button>
        )}
        <button onClick={switchCamera} className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200">Switch Camera</button>
        {torchAvailable && (
          <button onClick={toggleTorch} className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200">{torchOn ? "Torch Off" : "Torch On"}</button>
        )}
      </div>

      <div className="relative w-full" style={{ paddingTop: "56%" }}>
        <div ref={containerRef} className="absolute inset-0 w-full h-full bg-black rounded-lg overflow-hidden" />
        <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ width: "100%", height: "100%" }} />
        <div aria-hidden className={`absolute inset-0 rounded-lg pointer-events-none transition-opacity duration-300 ${flashPulse ? "opacity-70 bg-green-400/40" : "opacity-0"}`} />
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3/4 h-24 border-2 border-white/80 rounded-md pointer-events-none" />
      </div>

      <div className="flex gap-3 items-center"><div className="text-sm text-gray-500">{statusMsg}</div></div>
    </div>
  );
}
