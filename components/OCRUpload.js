// components/OCRUpload.jsx
"use client";

import { useState, useEffect, useRef } from "react";
import ProgressBar from "./ProgressBar";

/**
 * OCRUpload
 * - full uploader + OCR pipeline (resize, preprocess, Tesseract)
 * - calls `onScan(text)` for each scanned file
 * - hardened for mobile (iPhone HEIC handling, better errors)
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

  const canvasRefs = useRef([]);

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
    // Size check
    if (file.size > MAX_FILE_SIZE) {
      setError("File too large. Max 5 MB. Try zooming in on just the label.");
      return false;
    }

    // Explicitly handle iPhone HEIC
    if (detectHeic(file)) {
      setError(
        "This photo is in HEIC format, which browsers can't reliably scan yet. " +
          "On iPhone, either:\n\n" +
          "• Take a screenshot of the label and upload the screenshot, OR\n" +
          "• Go to Settings → Camera → Formats → select “Most Compatible”, then retake the photo."
      );
      return false;
    }

    // Allow only JPEG/PNG
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setError("Unsupported image type. Please upload a JPG or PNG photo of the label.");
      return false;
    }

    setError("");
    return true;
  };

  const handleFiles = (selectedFiles) => {
    const validFiles = Array.from(selectedFiles || []).filter(validateFile);
    if (!validFiles.length) return;

    // Reset state for new batch
    setFiles(validFiles);
    setPreviewURLs(validFiles.map((f) => URL.createObjectURL(f)));
    setOcrTexts(new Array(validFiles.length).fill(""));
    setAthleteNames(validFiles.map(() => ""));
    canvasRefs.current = new Array(validFiles.length).fill(null);
  };

  const handleFileChange = (e) => handleFiles(e.target.files);

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
          const MAX_DIM = 800;
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

          // Convert back to File so the rest of pipeline is unchanged
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
          img.onerror = (err) => rej(err || new Error("Failed to load image."));
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

  return (
    <div className="mt-6 font-sans space-y-4">
      {/* Upload box */}
      <label
        className={`flex flex-col items-center justify-center w-full max-w-3xl mx-auto px-6 py-6 border-2 border-dashed rounded-2xl cursor-pointer transition ${
          isDragging
            ? "border-blue-400 bg-blue-50"
            : "border-gray-300 bg-gray-50 hover:bg-gray-100"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span className="text-gray-600 text-center font-medium">
          {files.length
            ? `${files.length} file${files.length > 1 ? "s" : ""} selected`
            : "Tap to choose a photo or take one (JPG/PNG only)"}
        </span>
        <span className="mt-1 text-xs text-gray-500 text-center">
          Tip: On iPhone, screenshot the label or set Camera → Formats → “Most
          Compatible” for best results.
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png"
          multiple={multiple}
          onChange={handleFileChange}
          className="hidden"
          capture="environment"
        />
      </label>

      {/* File previews */}
      {files.map((file, idx) => (
        <div
          key={idx}
          className="flex flex-col items-start space-y-1 max-w-3xl mx-auto"
        >
          <span className="font-medium text-sm sm:text-base">{file.name}</span>
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
        </div>
      ))}

      {/* Inline tip row */}
      <div className="flex items-center justify-between max-w-3xl mx-auto">
        <p className="text-xs sm:text-sm text-gray-500">
          Aim for a clear, close shot of just the ingredients panel.
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
