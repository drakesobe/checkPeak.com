// components/OCRUpload.jsx
"use client";

import { useState, useEffect, useRef } from "react";
import ProgressBar from "./ProgressBar";
import Cropper from "react-easy-crop";

/**
 * Utility: crop a File (image) to the given region and return a new File.
 * `crop` is an object like: { x, y, width, height } in image pixels.
 */
async function cropFileToRegion(file, crop) {
  return new Promise((resolve, reject) => {
    if (!crop || crop.width <= 0 || crop.height <= 0) {
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
        canvas.width = crop.width;
        canvas.height = crop.height;
        const ctx = canvas.getContext("2d");

        ctx.drawImage(
          img,
          crop.x,
          crop.y,
          crop.width,
          crop.height,
          0,
          0,
          crop.width,
          crop.height
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
 * - full uploader + OCR pipeline (resize, preprocess, Tesseract)
 * - calls `onScan(text)` for each scanned file
 * - hardened for mobile (iPhone HEIC handling, better errors)
 * - improved UX: explicit Camera vs Photo Library choice
 * - NEW: optional crop step so users can crop down to just the label
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
      // revoke old URL to avoid leaks
      if (newPreviews[cropIndex]) {
        URL.revokeObjectURL(newPreviews[cropIndex]);
      }
      newPreviews[cropIndex] = URL.createObjectURL(croppedFile);
      setPreviewURLs(newPreviews);

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

  return (
    <div className="mt-6 font-sans space-y-4">
      {/* Upload card */}
      <div
        className={`flex flex-col items-center justify-center w-full max-w-3xl mx-auto px-6 py-6 border-2 border-dashed rounded-2xl cursor-pointer transition ${
          isDragging
            ? "border-blue-400 bg-blue-50"
            : "border-gray-300 bg-gray-50 hover:bg-gray-100"
        }`}
        onClick={() => setShowChoiceModal(true)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span className="text-gray-700 text-center font-semibold">
          {files.length
            ? `${files.length} file${files.length > 1 ? "s" : ""} selected`
            : "Tap to add a label photo"}
        </span>
        <span className="mt-1 text-xs text-gray-500 text-center">
          Use your camera or photo library. JPG/PNG only for best OCR results.
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
                className="text-gray-400 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Choose how you want to add your nutrition label.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowChoiceModal(false);
                  cameraInputRef.current?.click();
                }}
                className="w-full py-3 rounded-xl bg-[#46769B] text-white font-medium hover:bg-[#365b7a] transition shadow-sm"
              >
                Use Camera
              </button>
              <button
                onClick={() => {
                  setShowChoiceModal(false);
                  fileInputRef.current?.click();
                }}
                className="w-full py-3 rounded-xl border border-gray-300 text-gray-800 font-medium hover:bg-gray-50 transition"
              >
                Choose from Photos / Files
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              iPhone tip: If photos fail to scan, take a screenshot of the label
              and upload the screenshot instead.
            </p>
          </div>
        </div>
      )}

      {/* Crop modal */}
      {showCropModal && cropIndex != null && previewURLs[cropIndex] && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md bg-neutral-900 rounded-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
              <h2 className="text-sm font-semibold text-white">
                Crop Label Area
              </h2>
              <button
                onClick={() => setShowCropModal(false)}
                className="text-neutral-400 hover:text-white text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="relative w-full h-[60vh] bg-black">
              <Cropper
                image={previewURLs[cropIndex]}
                crop={crop}
                zoom={zoom}
                aspect={3 / 4}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                showGrid={false}
              />
            </div>

            <div className="flex items-center gap-3 px-4 py-3 bg-neutral-900 border-t border-neutral-800">
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1"
              />
              <button
                onClick={handleConfirmCrop}
                className="px-4 py-2 rounded-xl bg-white text-black text-sm font-semibold"
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
          className="flex flex-col items-start space-y-2 max-w-3xl mx-auto"
        >
          <span className="font-medium text-sm sm:text-base">
            {file.name}
          </span>
          <input
            type="text"
            placeholder="Athlete or Team Name (optional)"
            value={athleteNames[idx]}
            onChange={(e) => handleNameChange(idx, e.target.value)}
            className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
          />
          <img
            src={previewURLs[idx]}
            alt="Preview"
            className="max-h-48 rounded-xl border border-gray-200 shadow-md object-contain mt-1 w-full sm:w-auto bg-white"
            loading="lazy"
          />
          <button
            type="button"
            onClick={() => openCropForIndex(idx)}
            className="mt-1 inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            Crop Label Area
          </button>
        </div>
      ))}

      <div className="flex items-center justify-between max-w-3xl mx-auto">
        <p className="text-xs sm:text-sm text-gray-500">
          Aim for a clear shot, then crop down to just the ingredients panel for best results.
        </p>
      </div>

      {error && (
        <p className="whitespace-pre-line text-red-500 text-center text-sm mt-1">
          {error}
        </p>
      )}

      {loading && (
        <ProgressBar
          progress={Math.round(
            (ocrTexts.filter((r) => r).length / (files.length || 1)) * 100
          )}
        />
      )}

      <button
        onClick={handleScan}
        disabled={loading || !files.length}
        className={`w-full md:w-auto px-6 py-3 rounded-2xl font-medium text-white shadow-md transition text-sm sm:text-base ${
          loading || !files.length
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-[#46769B] hover:bg-blue-700"
        }`}
      >
        {loading
          ? `Scanning${animDots}`
          : multiple
          ? "Scan All Labels"
          : "Scan Label"}
      </button>
    </div>
  );
}
