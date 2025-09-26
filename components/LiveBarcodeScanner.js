"use client";

import React, { useEffect, useRef, useState } from "react";
import Quagga from "@ericblade/quagga2";

/**
 * LiveBarcodeScanner
 *
 * Props:
 *  - onDetected(text: string) => void
 *  - enableBeep / enableFlash
 */
export default function LiveBarcodeScanner({
  onDetected,
  enableBeep = true,
  enableFlash = true,
}) {
  const videoRef = useRef(null);
  const [scannerStarted, setScannerStarted] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Idle");
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

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

  const startScanner = () => {
    setStatusMsg("Requesting camera...");
    setScannerStarted(true);

    Quagga.init(
      {
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: videoRef.current,
          constraints: {
            facingMode: "environment",
          },
        },
        locator: {
          patchSize: "medium",
          halfSample: true,
        },
        decoder: {
          readers: ["code_128_reader", "ean_reader", "ean_8_reader", "upc_reader"],
        },
        locate: true,
      },
      (err) => {
        if (err) {
          console.error(err);
          setStatusMsg("Camera not available");
          return;
        }
        Quagga.start();
        setStatusMsg("Scanning for barcodes...");
      }
    );

    Quagga.onProcessed((result) => {
      // Optional: add processing feedback
    });

    Quagga.onDetected((data) => {
      const code = data.codeResult.code;
      if (code) {
        playBeep();
        onDetected(code);
        stopScanner();
      }
    });
  };

  const stopScanner = () => {
    try {
      Quagga.stop();
    } catch (e) {}
    setScannerStarted(false);
    setStatusMsg("Scanner stopped");
  };

  useEffect(() => {
    return () => stopScanner();
  }, []);

  return (
    <div className="w-full flex flex-col items-center gap-3">
      {!scannerStarted && (
        <button
          onClick={startScanner}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          Start Scanner
        </button>
      )}

      <div className="relative w-full" style={{ paddingTop: "56%" }}>
        <div
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover rounded-lg bg-black"
        />
      </div>

      {scannerStarted && (
        <button
          onClick={stopScanner}
          className="px-4 py-2 bg-red-500 text-white rounded-lg"
        >
          Stop Scanner
        </button>
      )}

      <div className="text-sm text-gray-500">{statusMsg}</div>
    </div>
  );
}
