"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/library";

export default function LiveBarcodeScanner({ onDetected }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const codeReaderRef = useRef(null);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    codeReaderRef.current = new BrowserMultiFormatReader();

    const startScanner = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const scanLoop = async () => {
          if (!videoRef.current || !scanning) return;

          try {
            const result = await codeReaderRef.current.decodeOnceFromVideoElement(videoRef.current);
            if (result) {
              // Draw bounding box
              drawBoundingBox(result.resultPoints);
              // Callback once detected
              onDetected(result.text || result.getText?.() || "");
              setScanning(false);
              stopStream();
            } else {
              requestAnimationFrame(scanLoop);
            }
          } catch (err) {
            requestAnimationFrame(scanLoop);
          }
        };

        scanLoop();
      } catch (err) {
        console.error("Live scanner error:", err);
        setError("Camera access denied or unavailable.");
      }
    };

    startScanner();

    return () => {
      stopStream();
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopStream = () => {
    if (videoRef.current?.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
  };

  const drawBoundingBox = (points) => {
    if (!canvasRef.current || !points || points.length < 2) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#46769B";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.stroke();
  };

  return (
    <div className="relative w-full h-[300px] rounded-xl overflow-hidden border border-gray-300">
      {error && <p className="absolute top-2 left-2 text-red-500 z-10">{error}</p>}
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted
      />
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
      />
      {scanning && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-white text-lg font-semibold bg-black/50 px-4 py-2 rounded-xl">
            Scanning...
          </p>
        </div>
      )}
    </div>
  );
}
