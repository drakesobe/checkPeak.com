// components/BarcodeCropModal.jsx
"use client";

import { useState, useCallback, useMemo } from "react";
import Cropper from "react-easy-crop";
import { X, Check, Minus, Plus, MoveUp, MoveDown, MoveLeft, MoveRight } from "lucide-react";

function createImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.crossOrigin = "anonymous";
    img.src = src;
  });
}

async function getCroppedImage(src, cropPixels) {
  const image = await createImage(src);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const { x, y, width, height } = cropPixels;

  canvas.width = Math.max(1, Math.floor(width));
  canvas.height = Math.max(1, Math.floor(height));

  ctx.drawImage(
    image,
    Math.max(0, Math.floor(x)),
    Math.max(0, Math.floor(y)),
    Math.max(1, Math.floor(width)),
    Math.max(1, Math.floor(height)),
    0,
    0,
    Math.max(1, Math.floor(width)),
    Math.max(1, Math.floor(height))
  );

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return resolve(null);
        const file = new File([blob], "barcode-crop.jpg", { type: "image/jpeg" });

        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            blob,
            file,
            dataUrl: reader.result,
          });
        };
        reader.readAsDataURL(blob);
      },
      "image/jpeg",
      0.92
    );
  });
}

/**
 * BarcodeCropModal
 *
 * Props:
 *  - src: string (image URL or data URL to crop)
 *  - onCancel: () => void
 *  - onCropped: ({ file, blob, dataUrl }) => void
 */
export default function BarcodeCropModal({ src, onCancel, onCropped }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.8);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [working, setWorking] = useState(false);

  // NEW: let users tighten the guide box a lot
  // 0 = wide guide, 100 = very tight guide
  const [tightness, setTightness] = useState(55);

  // NEW: aspect mode
  const [aspectMode, setAspectMode] = useState("barcode"); // "barcode" | "free"

  const aspectValue = useMemo(() => {
    if (aspectMode === "free") return undefined;
    // Wider + thinner makes it easier to isolate bars + digits
    // Try 5/2 like your other component; feels tighter than 4.0
    return 5 / 2;
  }, [aspectMode]);

  const guide = useMemo(() => {
    // Map tightness 0..100 => width 0.88..0.55 and height 0.22..0.11 (relative to container)
    const t = Math.min(100, Math.max(0, tightness)) / 100;
    const w = 0.88 - t * 0.33; // 0.88 -> 0.55
    const h = 0.22 - t * 0.11; // 0.22 -> 0.11
    return { w, h };
  }, [tightness]);

  const handleCropComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleUseCrop = async () => {
    if (!croppedAreaPixels || !src || working) return;
    setWorking(true);
    try {
      const result = await getCroppedImage(src, croppedAreaPixels);
      if (!result) return;
      if (typeof onCropped === "function") onCropped(result);
    } catch (e) {
      console.error("Cropping failed:", e);
    } finally {
      setWorking(false);
    }
  };

  // Optional: micro-nudge controls (helps “tighten down” precisely)
  const nudge = (dx, dy) => {
    setCrop((prev) => ({
      x: prev.x + dx,
      y: prev.y + dy,
    }));
  };

  const zoomStep = 0.15;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-3">
      <div className="bg-white rounded-2xl shadow-2xl w-[95%] max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex flex-col">
            <h2 className="text-base sm:text-lg font-semibold text-gray-800">
              Crop to Barcode
            </h2>
            <p className="text-[11px] text-gray-500">
              Tighten the guide box, zoom in, and center the barcode bars + digits.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
            aria-label="Close crop"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Crop area */}
        <div className="relative flex-1 bg-black">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={aspectValue}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
              showGrid={false}
              restrictPosition={true}
              objectFit="contain"
              // NEW: faster feel on mobile
              zoomSpeed={1.15}
            />
          )}

          {/* Guide box (now adjustable) */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className="border-2 border-white/85 rounded-sm shadow-[0_0_0_9999px_rgba(0,0,0,0.40)]"
              style={{
                width: `${guide.w * 100}%`,
                height: `${guide.h * 100}%`,
              }}
            />
          </div>

          {/* Flash tiny label so user knows they can go smaller */}
          <div className="pointer-events-none absolute bottom-3 left-3 px-2 py-1 rounded-lg bg-black/55 text-white text-[10px]">
            Tip: Increase “Tightness” for a smaller crop box
          </div>
        </div>

        {/* Controls */}
        <div className="px-4 py-3 border-t border-gray-200 space-y-3">
          {/* Aspect controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAspectMode("barcode")}
              className={`flex-1 px-3 py-2 rounded-xl text-[11px] font-semibold border ${
                aspectMode === "barcode"
                  ? "border-[#46769B] bg-[#46769B]/10 text-[#2f506a]"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              Barcode Strip
            </button>
            <button
              type="button"
              onClick={() => setAspectMode("free")}
              className={`flex-1 px-3 py-2 rounded-xl text-[11px] font-semibold border ${
                aspectMode === "free"
                  ? "border-[#46769B] bg-[#46769B]/10 text-[#2f506a]"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              Free Crop
            </button>
          </div>

          {/* Tightness slider (NEW) */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 whitespace-nowrap">Tightness</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={tightness}
              onChange={(e) => setTightness(parseInt(e.target.value, 10))}
              className="flex-1 accent-[#46769B]"
              aria-label="Crop tightness"
            />
            <span className="text-[11px] text-gray-500 w-10 text-right">{tightness}%</span>
          </div>

          {/* Zoom controls (higher ceiling + +/- buttons) */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 whitespace-nowrap">Zoom</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(1, Number((z - zoomStep).toFixed(2))))}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
              aria-label="Zoom out"
            >
              <Minus className="w-4 h-4 text-gray-700" />
            </button>
            <input
              type="range"
              min={1}
              max={8}   // NEW: allow much tighter zoom
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 accent-[#46769B]"
              aria-label="Crop zoom"
            />
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(8, Number((z + zoomStep).toFixed(2))))}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
              aria-label="Zoom in"
            >
              <Plus className="w-4 h-4 text-gray-700" />
            </button>
            <span className="text-[11px] text-gray-500 w-12 text-right">{zoom.toFixed(2)}x</span>
          </div>

          {/* Optional micro-nudge (makes precise tightening easier) */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-gray-500">Nudge</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => nudge(0, -2)}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                aria-label="Nudge up"
              >
                <MoveUp className="w-4 h-4 text-gray-700" />
              </button>
              <button
                type="button"
                onClick={() => nudge(-2, 0)}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                aria-label="Nudge left"
              >
                <MoveLeft className="w-4 h-4 text-gray-700" />
              </button>
              <button
                type="button"
                onClick={() => nudge(2, 0)}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                aria-label="Nudge right"
              >
                <MoveRight className="w-4 h-4 text-gray-700" />
              </button>
              <button
                type="button"
                onClick={() => nudge(0, 2)}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                aria-label="Nudge down"
              >
                <MoveDown className="w-4 h-4 text-gray-700" />
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onCancel}
              disabled={working}
              className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleUseCrop}
              disabled={working || !croppedAreaPixels}
              className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold text-white shadow-sm ${
                working || !croppedAreaPixels
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-[#46769B] hover:bg-[#365776]"
              }`}
            >
              <Check className="w-4 h-4" />
              {working ? "Cropping…" : "Use this crop"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
