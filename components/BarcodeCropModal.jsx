// components/BarcodeCropModal.jsx
"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { X, Check } from "lucide-react";

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

  canvas.width = width;
  canvas.height = height;

  ctx.drawImage(
    image,
    x,
    y,
    width,
    height,
    0,
    0,
    width,
    height
  );

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        const file = new File([blob], "barcode-crop.png", { type: "image/png" });
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            blob,
            file,
            dataUrl: reader.result, // for preview if needed
          });
        };
        reader.readAsDataURL(blob);
      },
      "image/png",
      0.9
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
  const [zoom, setZoom] = useState(1.5);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [working, setWorking] = useState(false);

  const handleCropComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleUseCrop = async () => {
    if (!croppedAreaPixels || !src || working) return;
    setWorking(true);
    try {
      const result = await getCroppedImage(src, croppedAreaPixels);
      if (!result) {
        setWorking(false);
        return;
      }
      if (typeof onCropped === "function") onCropped(result);
    } catch (e) {
      console.error("Cropping failed:", e);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[95%] max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800">
            Crop to Barcode
          </h2>
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
              aspect={4.0} // wide area for barcodes
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
              showGrid={false}
              restrictPosition={true}
              objectFit="contain"
            />
          )}

          {/* guide box */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-4/5 h-16 border-2 border-white/80 rounded-sm shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
        </div>

        {/* Controls */}
        <div className="px-4 py-3 border-t border-gray-200 space-y-3">
          {/* Zoom slider */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 whitespace-nowrap">
              Zoom
            </span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 accent-[#46769B]"
            />
          </div>

          <div className="flex justify-end gap-2">
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
