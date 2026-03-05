// hooks/useCrop.js
"use client";

import { useState, useCallback, useMemo } from "react";

// ---------------------------------------------------------------------------
// Crop + resize helpers
// Kept here since they're tightly coupled to crop confirmation logic.
// ---------------------------------------------------------------------------

async function decodeBitmapFromFile(file) {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { bitmap: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close?.() };
    } catch {
      // fall through
    }
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = (e) => resolve(e.target.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const im  = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src    = dataUrl;
  });

  return {
    bitmap: img,
    width:  img.naturalWidth  || img.width,
    height: img.naturalHeight || img.height,
    close:  () => {},
  };
}

async function cropFileToRegion(file, cropRect) {
  if (!cropRect || cropRect.width <= 0 || cropRect.height <= 0) {
    throw new Error("Invalid crop region");
  }

  const { bitmap, width, height, close } = await decodeBitmapFromFile(file);

  const sx = Math.max(0, Math.min(width  - 1, Math.round(cropRect.x)));
  const sy = Math.max(0, Math.min(height - 1, Math.round(cropRect.y)));
  const sw = Math.max(1, Math.min(width  - sx, Math.round(cropRect.width)));
  const sh = Math.max(1, Math.min(height - sy, Math.round(cropRect.height)));

  const canvas = document.createElement("canvas");
  canvas.width  = sw;
  canvas.height = sh;
  canvas.getContext("2d", { willReadFrequently: true })
    .drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Crop failed: empty blob"))),
      "image/jpeg",
      0.95
    );
  });

  close();

  return new File([blob], file.name.replace(/(\.\w+)?$/, "_crop.jpg"), {
    type: "image/jpeg",
  });
}

// ---------------------------------------------------------------------------
// useCrop hook
// ---------------------------------------------------------------------------

/**
 * @param {object}   options
 * @param {boolean}  options.multiple  — if true, steps through all files after each crop
 *
 * Returns:
 *   cropState       — { isOpen, cropIndex, crop, zoom, aspectMode, croppedFlags }
 *   aspectValue     — number | undefined — derived from aspectMode for react-easy-crop
 *   openCropFor     — (index: number) => void
 *   closeCrop       — () => void
 *   setCrop         — react-easy-crop onCropChange handler
 *   setZoom         — react-easy-crop onZoomChange handler
 *   setAspectMode   — "label" | "free"
 *   onCropComplete  — react-easy-crop onCropComplete handler
 *   confirmCrop     — (files, previewURLs, setFiles, setPreviewURLs) => Promise<void>
 */
export function useCrop({ multiple = false } = {}) {
  const [isOpen,            setIsOpen]           = useState(false);
  const [cropIndex,         setCropIndex]         = useState(null);
  const [crop,              setCrop]              = useState({ x: 0, y: 0 });
  const [zoom,              setZoom]              = useState(1);
  const [aspectMode,        setAspectMode]        = useState("label");
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [croppedFlags,      setCroppedFlags]      = useState([]);
  const [cropError,         setCropError]         = useState("");

  // Derived aspect ratio for react-easy-crop
  const aspectValue = useMemo(
    () => (aspectMode === "label" ? 3 / 4 : undefined),
    [aspectMode]
  );

  const resetCropControls = useCallback(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setAspectMode("label");
    setCropError("");
  }, []);

  const openCropFor = useCallback((index) => {
    resetCropControls();
    setCropIndex(index);
    setIsOpen(true);
  }, [resetCropControls]);

  const closeCrop = useCallback(() => {
    setIsOpen(false);
    setCropIndex(null);
    setCropError("");
  }, []);

  const onCropComplete = useCallback((_, pixelCrop) => {
    setCroppedAreaPixels(pixelCrop);
  }, []);

  // Initialize flags when new files are loaded
  const initFlags = useCallback((count) => {
    setCroppedFlags(new Array(count).fill(false));
  }, []);

  /**
   * confirmCrop — applies the crop to the file, updates previews,
   * and steps to the next file if multiple mode is enabled.
   *
   * Callers pass setter fns so this hook doesn't need to own files/previews.
   */
  const confirmCrop = useCallback(
    async (files, previewURLs, setFiles, setPreviewURLs) => {
      if (cropIndex == null || !croppedAreaPixels) {
        setIsOpen(false);
        return;
      }

      const originalFile = files[cropIndex];
      if (!originalFile) {
        setIsOpen(false);
        return;
      }

      try {
        const croppedFile = await cropFileToRegion(originalFile, croppedAreaPixels);

        // Update files
        const newFiles = [...files];
        newFiles[cropIndex] = croppedFile;
        setFiles(newFiles);

        // Update preview URLs — revoke old one to avoid memory leak
        const newPreviews = [...previewURLs];
        if (newPreviews[cropIndex]) URL.revokeObjectURL(newPreviews[cropIndex]);
        newPreviews[cropIndex] = URL.createObjectURL(croppedFile);
        setPreviewURLs(newPreviews);

        // Mark as cropped
        setCroppedFlags((prev) => {
          const next = [...prev];
          next[cropIndex] = true;
          return next;
        });

        // Step through remaining files in multiple mode
        const nextIdx = cropIndex + 1;
        if (multiple && nextIdx < newFiles.length) {
          resetCropControls();
          setCropIndex(nextIdx);
          // keep modal open
          return;
        }

        setIsOpen(false);
      } catch (err) {
        console.error("Crop confirm error:", err);
        setCropError("Could not crop image. Please try again or retake the photo.");
        setIsOpen(false);
      }
    },
    [cropIndex, croppedAreaPixels, multiple, resetCropControls]
  );

  return {
    cropState: {
      isOpen,
      cropIndex,
      crop,
      zoom,
      aspectMode,
      croppedFlags,
      cropError,
    },
    aspectValue,
    openCropFor,
    closeCrop,
    setCrop,
    setZoom,
    setAspectMode,
    onCropComplete,
    confirmCrop,
    initFlags,
  };
}