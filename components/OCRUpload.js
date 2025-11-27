// components/OCRUpload.jsx
"use client";

import { useState, useEffect, useRef } from "react";
import ProgressBar from "./ProgressBar";
import Cropper from "react-easy-crop";

/**
 * Utility: crop a File (image) to the given region and return a new File.
 * `cropRect` is an object like: { x, y, width, height } in image pixels.
 */
async function cropFileToRegion(file, cropRect) {
  return new Promise((resolve, reject) => {
    if (!cropRect || cropRect.width <= 0 || cropRect.height <= 0) {
      return reject(new Error("Invalid crop region"));
    }

    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target.result;
    };
    reader.onerror = (err) => reject(err);

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = cropRect.width;
        canvas.height = cropRect.height;
        const ctx = canvas.getContext("2d");

        ctx.drawImage(
          img,
          cropRect.x,
          cropRect.y,
          cropRect.width,
          cropRect.height,
          0,
          0,
          cropRect.width,
          cropRect.height
        );

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error("Crop failed: empty blob"));
            }
            const croppedFile = new File(
              [blob],
              file.name.replace(/(\.\w+)?$/, "_crop.jpg"),
              { type: "image/jpeg" }
            );
            resolve(croppedFile);
          },
          "image/jpeg",
          0.95
        );
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (err) =>
      reject(err || new Error("Failed to load image for cropping"));

    reader.readAsDataURL(file);
  });
}

/**
 * OCRUpload
 * - Full uploader + OCR pipeline (resize, preprocess, Tesseract)
 * - Calls `onScan(text)` for each scanned file
 * - Hardened for mobile (iPhone HEIC handling, better errors)
 * - Camera vs Photo Library choice
 * - Label-only crop step using brand styling and minimal controls
 */
export default function OCRUpload({ multiple = false, onScan }) {
  const [files, setFiles] = useState([]);
  const [previewURLs, setPreviewURLs] = useState([]);
  const [ocrTexts, setOcrTexts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [animDots, setAnimDots] = useState("");
  const [error, setError] = useState("");
  const [athleteNames, setAthleteNames] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showChoiceModal, setShowChoiceModal] = useState(false);

  // Crop-related state
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropIndex, setCropIndex] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  // Aspect mode: "label" | "free"
  const [aspectMode, setAspectMode] = useState("label");

  // Track which files have been cropped (for UI tags)
  const [croppedFlags, setCroppedFlags] = useState([]);

  // For better scanning UX: show which file is being processed
  const [currentScanIndex, setCurrentScanIndex] = useState(null);

  const canvasRefs = useRef([]);

  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png"];

  // Animate dots during loading
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setAnimDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, [loading]);

  // Cleanup blob URLs
  useEffect(() => {
    return () => previewURLs.forEach((url) => URL.revokeObjectURL(url));
  }, [previewURLs]);

  const detectHeic = (file) => {
    const type = (file.type || "").toLowerCase();
    const name = (file.name || "").toLowerCase();
    return (
      type.includes("heic") ||
      type.includes("heif") ||
      name.endsWith(".heic") ||
      name.endsWith(".heif")
    );
  };

  const validateFile = (file) => {
    if (file.size > MAX_FILE_SIZE) {
      setError("File too large. Max 5 MB. Try zooming in on just the label.");
      return false;
    }

    // Explicitly handle iPhone HEIC
    if (detectHeic(file)) {
      setError(
        "This photo is in HEIC format, which browsers can't reliably scan yet.\n\n" +
          "On iPhone, either:\n" +
          "• Take a screenshot of the label and upload the screenshot, or\n" +
          "• Go to Settings → Camera → Formats → select “Most Compatible”, then retake the photo."
      );
      return false;
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setError("Unsupported image type. Please upload a JPG or PNG photo of the label.");
      return false;
    }

    setError("");
    return true;
  };

  const resetCropState = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setAspectMode("label"); // default to label text
  };

  const handleFiles = (selectedFiles) => {
    const validFiles = Array.from(selectedFiles || []).filter(validateFile);
    if (!validFiles.length) return;

    // Revoke any previous preview URLs before replacing them
    previewURLs.forEach((url) => URL.revokeObjectURL(url));

    setFiles(validFiles);
    const urls = validFiles.map((f) => URL.createObjectURL(f));
    setPreviewURLs(urls);
    setOcrTexts(new Array(validFiles.length).fill(""));
    setAthleteNames(validFiles.map(() => ""));
    setCroppedFlags(validFiles.map(() => false));
    canvasRefs.current = new Array(validFiles.length).fill(null);

    // Open crop modal for the first file to let user crop down to the label
    if (validFiles.length > 0) {
      resetCropState();
      setCropIndex(0);
      setShowCropModal(true);
    }
  };

  const handleCameraInputChange = (e) => handleFiles(e.target.files);
  const handleFileInputChange = (e) => handleFiles(e.target.files);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const resizeImage = (file) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      const fail = (err) => {
        console.warn("Image load/resize failed:", err);
        reject(err || new Error("Failed to load image for OCR."));
      };

      reader.onload = (e) => {
        img.src = e.target.result;
      };
      reader.onerror = fail;
      img.onerror = fail;

      img.onload = () => {
        try {
          // Slightly higher dimension for better text clarity
          const MAX_DIM = 1400;
          let { width, height } = img;
          if (width > MAX_DIM || height > MAX_DIM) {
            const scale = Math.min(MAX_DIM / width, MAX_DIM / height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) return fail("Canvas toBlob returned null.");
              resolve(
                new File([blob], file.name, {
                  type: "image/jpeg",
                })
              );
            },
            "image/jpeg",
            0.9
          );
        } catch (err) {
          fail(err);
        }
      };

      reader.readAsDataURL(file);
    });

  const preprocessImage = async (img, canvas) => {
    const ctx = canvas.getContext("2d");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Contrast stretch in grayscale
    let min = 255,
      max = 0;
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
      if (gray < min) min = gray;
      if (gray > max) max = gray;
    }
    const scale = 255 / (max - min || 1);
    for (let i = 0; i < data.length; i += 4) {
      let gray = 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
      gray = Math.max(0, Math.min(255, (gray - min) * scale));
      data[i] = data[i + 1] = data[i + 2] = gray;
    }
    ctx.putImageData(imageData, 0, 0);

    // Auto-crop darker region (text area) + upscale slightly
    let top = canvas.height,
      bottom = 0,
      left = canvas.width,
      right = 0;
    for (let y = 0; y < canvas.height; y += 2) {
      for (let x = 0; x < canvas.width; x += 2) {
        const idx = (y * canvas.width + x) * 4;
        if (data[idx] < 100) {
          if (x < left) left = x;
          if (x > right) right = x;
          if (y < top) top = y;
          if (y > bottom) bottom = y;
        }
      }
    }
    if (right - left < 20 || bottom - top < 20) return canvas;

    const scaleFactor = 3;
    const croppedCanvas = document.createElement("canvas");
    croppedCanvas.width = (right - left) * scaleFactor;
    croppedCanvas.height = (bottom - top) * scaleFactor;
    const cctx = croppedCanvas.getContext("2d");
    cctx.drawImage(
      canvas,
      left,
      top,
      right - left,
      bottom - top,
      0,
      0,
      croppedCanvas.width,
      croppedCanvas.height
    );
    return croppedCanvas;
  };

  const handleScan = async () => {
    if (!files.length) {
      setError("Please add a label photo first.");
      return;
    }
    setLoading(true);
    setError("");
    setOcrTexts(new Array(files.length).fill(""));
    setCurrentScanIndex(0);

    try {
      const Tesseract = (await import("tesseract.js")).default;
      const resizedFiles = await Promise.all(
        files.map((file) =>
          resizeImage(file).catch((err) => {
            console.warn("Resize failed for file:", file.name, err);
            throw new Error(
              `We couldn't process the image "${file.name}". Try cropping closer to the label or taking a screenshot and uploading that.`
            );
          })
        )
      );

      for (let i = 0; i < resizedFiles.length; i++) {
        setCurrentScanIndex(i);
        const file = resizedFiles[i];
        const img = new Image();
        const reader = new FileReader();

        const imgLoaded = new Promise((res, rej) => {
          img.onload = res;
          img.onerror = (err) =>
            rej(err || new Error("Failed to load image."));
        });

        reader.onload = (e) => {
          img.src = e.target.result;
        };
        reader.onerror = (err) =>
          console.warn("FileReader error during OCR:", err);

        reader.readAsDataURL(file);
        await imgLoaded;

        const canvas = document.createElement("canvas");
        canvasRefs.current[i] = canvas;

        const preprocessed = await preprocessImage(img, canvas);

        const result = await Tesseract.recognize(preprocessed, "eng", {
          logger: (m) => console.log("OCR progress:", m),
          tessedit_char_whitelist:
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,%()-: ",
          oem: 1,
          psm: 6,
        });

        const text = result.data.text || "";
        setOcrTexts((prev) => {
          const updated = [...prev];
          updated[i] = text;
          return updated;
        });

        if (typeof onScan === "function") {
          try {
            await onScan(text);
          } catch (err) {
            console.error("onScan callback error:", err);
          }
        }
      }
    } catch (err) {
      console.error("OCR failed:", err);
      setError(
        err?.message ||
          "OCR failed on this photo. Try zooming in on the ingredients panel or taking a screenshot and uploading that."
      );
    } finally {
      setLoading(false);
      setCurrentScanIndex(null);
    }
  };

  const handleNameChange = (idx, value) => {
    const newNames = [...athleteNames];
    newNames[idx] = value;
    setAthleteNames(newNames);
  };

  const onCropComplete = (_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  };

  const handleConfirmCrop = async () => {
    if (cropIndex == null || croppedAreaPixels == null) {
      setShowCropModal(false);
      return;
    }
    try {
      const originalFile = files[cropIndex];
      if (!originalFile) {
        setShowCropModal(false);
        return;
      }

      const croppedFile = await cropFileToRegion(originalFile, croppedAreaPixels);

      const newFiles = [...files];
      newFiles[cropIndex] = croppedFile;
      setFiles(newFiles);

      const newPreviews = [...previewURLs];
      if (newPreviews[cropIndex]) {
        URL.revokeObjectURL(newPreviews[cropIndex]);
      }
      newPreviews[cropIndex] = URL.createObjectURL(croppedFile);
      setPreviewURLs(newPreviews);

      const newFlags = [...croppedFlags];
      newFlags[cropIndex] = true;
      setCroppedFlags(newFlags);

      setShowCropModal(false);
    } catch (err) {
      console.error("Crop apply error:", err);
      setError("Could not crop image. Please try again or retake the photo.");
      setShowCropModal(false);
    }
  };

  const openCropForIndex = (idx) => {
    if (!previewURLs[idx]) return;
    resetCropState();
    setCropIndex(idx);
    setShowCropModal(true);
  };

  // Derived aspect value from mode
  let aspectValue;
  if (aspectMode === "label") {
    aspectValue = 3 / 4; // tall-ish for ingredient panels
  } else {
    aspectValue = undefined; // free-form
  }

  return (
    <div className="mt-6 font-sans space-y-5">
      {/* Header / Steps */}
      <div className="max-w-3xl mx-auto flex flex-col gap-1">
        <div className="inline-flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-[#46769B]/30 bg-[#46769B]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#46769B]">
            Step 1 · Label Scan
          </span>
        </div>
        <h2 className="text-base sm:text-lg font-semibold text-gray-900">
          Scan a supplement nutrition label
        </h2>
        <p className="text-xs sm:text-sm text-gray-500">
          Upload a clear photo, crop around the ingredients panel, then scan it for
          banned substances and ingredient details.
        </p>
      </div>

      {/* Upload card */}
      <div
        className={`flex flex-col items-center justify-center w-full max-w-3xl mx-auto px-6 py-6 rounded-2xl cursor-pointer transition border-2 border-dashed ${
          isDragging
            ? "border-[#46769B] bg-[#f0f5fa]"
            : "border-gray-300 bg-[#f7f9fc] hover:bg-[#edf3fb]"
        }`}
        onClick={() => setShowChoiceModal(true)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span className="text-gray-900 text-center font-semibold text-sm sm:text-base">
          {files.length
            ? `${files.length} label photo${
                files.length > 1 ? "s" : ""
              } selected`
            : "Tap to add a nutrition label photo"}
        </span>
        <span className="mt-1 text-[11px] sm:text-xs text-gray-500 text-center max-w-md">
          Hold your phone about 6–8 inches away until the text looks sharp. You can
          crop to just the ingredients panel before scanning.
        </span>
        <span className="mt-3 text-[11px] text-gray-500 text-center">
          Drag and drop a label photo, or tap to use your camera or photo library.
        </span>
      </div>

      {/* Hidden inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        multiple={multiple}
        className="hidden"
        onChange={handleCameraInputChange}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        multiple={multiple}
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Choice modal: Camera vs Photo Library */}
      {showChoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Add Label Photo
              </h2>
              <button
                onClick={() => setShowChoiceModal(false)}
                className="text-gray-400 hover:text-gray-700 text-lg leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Choose how you want to add your nutrition label. A single, sharp photo of
              the ingredients panel works best.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowChoiceModal(false);
                  cameraInputRef.current?.click();
                }}
                className="w-full py-3 rounded-xl bg-[#46769B] text-white font-medium hover:bg-[#365b7a] transition shadow-sm text-sm"
              >
                Use Camera
              </button>
              <button
                onClick={() => {
                  setShowChoiceModal(false);
                  fileInputRef.current?.click();
                }}
                className="w-full py-3 rounded-xl border border-gray-300 text-gray-800 font-medium hover:bg-gray-50 transition text-sm"
              >
                Choose from Photos / Files
              </button>
            </div>
            <p className="text-[11px] text-gray-500 mt-1 leading-snug">
              iPhone tip: If photos fail to scan, take a screenshot of the label and
              upload the screenshot instead.
            </p>
          </div>
        </div>
      )}

      {/* Crop modal */}
      {showCropModal && cropIndex != null && previewURLs[cropIndex] && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md bg-neutral-900 rounded-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
              <div className="flex flex-col">
                <h2 className="text-sm font-semibold text-white">
                  Crop Label Area
                </h2>
                <p className="text-[11px] text-neutral-400">
                  Drag the box over just the ingredients panel. Use the zoom slider if
                  needed.
                </p>
              </div>
              <button
                onClick={() => setShowCropModal(false)}
                className="text-neutral-400 hover:text-white text-lg leading-none"
                aria-label="Close crop"
              >
                ×
              </button>
            </div>

            {/* Cropper */}
            <div className="relative w-full h-[58vh] bg-black">
              <Cropper
                image={previewURLs[cropIndex]}
                crop={crop}
                zoom={zoom}
                aspect={aspectValue}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                showGrid={false}
              />
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-3 px-4 py-3 bg-neutral-900 border-t border-neutral-800">
              {/* Presets */}
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setAspectMode("label")}
                  className={`flex-1 px-3 py-1.5 rounded-xl text-[11px] font-medium border ${
                    aspectMode === "label"
                      ? "border-emerald-400 bg-emerald-500/10 text-emerald-200"
                      : "border-neutral-700 text-neutral-200 hover:bg-neutral-800"
                  }`}
                >
                  Label Text
                </button>
                <button
                  type="button"
                  onClick={() => setAspectMode("free")}
                  className={`flex-1 px-3 py-1.5 rounded-xl text-[11px] font-medium border ${
                    aspectMode === "free"
                      ? "border-amber-400 bg-amber-500/10 text-amber-200"
                      : "border-neutral-700 text-neutral-200 hover:bg-neutral-800"
                  }`}
                >
                  Free Crop
                </button>
              </div>

              {/* Zoom slider */}
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-neutral-300 w-12">
                  Zoom
                </span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 accent-[#46769B]"
                  aria-label="Crop zoom"
                />
                <span className="text-[11px] text-neutral-400 w-10 text-right">
                  {zoom.toFixed(1)}x
                </span>
              </div>

              <button
                onClick={handleConfirmCrop}
                className="mt-1 w-full px-4 py-2.5 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:bg-[#365b7a] transition shadow-sm"
              >
                Use Crop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Previews */}
      {files.map((file, idx) => (
        <div
          key={idx}
          className="flex flex-col items-start space-y-2 max-w-3xl mx-auto rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
        >
          <div className="flex items-center justify-between w-full gap-2">
            <div className="flex flex-col">
              <span className="font-medium text-xs sm:text-sm text-gray-900 truncate">
                {file.name}
              </span>
              <span className="text-[10px] text-gray-400">
                Label {idx + 1} of {files.length}
              </span>
            </div>
            {croppedFlags[idx] && (
              <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                Cropped
              </span>
            )}
          </div>

          <label className="w-full text-[11px] text-gray-600">
            Athlete or Team Name (optional)
            <input
              type="text"
              value={athleteNames[idx]}
              onChange={(e) => handleNameChange(idx, e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#46769B] focus:border-transparent text-xs sm:text-sm"
            />
          </label>

          <img
            src={previewURLs[idx]}
            alt={`Label preview ${idx + 1}`}
            className="max-h-48 rounded-xl border border-gray-200 shadow-sm object-contain mt-1 w-full sm:w-auto bg-white"
            loading="lazy"
          />

          <div className="flex items-center justify-between w-full mt-1">
            <button
              type="button"
              onClick={() => openCropForIndex(idx)}
              className="inline-flex items-center px-3 py-1.5 rounded-xl text-[11px] font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Re-Crop Label Area
            </button>
            {ocrTexts[idx] && (
              <span className="text-[11px] text-[#46769B] font-medium">
                OCR ready
              </span>
            )}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between max-w-3xl mx-auto">
        <p className="text-[11px] sm:text-xs text-gray-500">
          Tip: Avoid shadows, glare, and extreme angles on the nutrition panel. If a scan
          fails, try retaking the photo slightly farther back and re-cropping.
        </p>
      </div>

      {error && (
        <p className="whitespace-pre-line text-red-500 text-center text-sm mt-1 max-w-3xl mx-auto bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {loading && (
        <div className="max-w-3xl mx-auto space-y-2">
          <ProgressBar
            progress={Math.round(
              (ocrTexts.filter((r) => r).length / (files.length || 1)) * 100
            )}
          />
          {currentScanIndex != null && (
            <p className="text-[11px] text-gray-500 text-right">
              Scanning label {currentScanIndex + 1} of {files.length}
              {animDots}
            </p>
          )}
        </div>
      )}

      <div className="max-w-3xl mx-auto flex justify-end">
        <button
          onClick={handleScan}
          disabled={loading || !files.length}
          className={`w-full md:w-auto px-6 py-3 rounded-2xl font-medium text-white shadow-md transition text-sm sm:text-base flex items-center justify-center ${
            loading || !files.length
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-[#46769B] hover:bg-[#365b7a]"
          }`}
        >
          {loading
            ? currentScanIndex != null
              ? `Scanning ${currentScanIndex + 1} of ${files.length}${animDots}`
              : `Scanning${animDots}`
            : multiple
            ? "Scan All Labels"
            : "Scan Label"}
        </button>
      </div>
    </div>
  );
}
