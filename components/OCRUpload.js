"use client";

import { useState, useEffect, useRef } from "react";
import ProgressBar from "./ProgressBar";

/**
 * OCRUpload
 * - full uploader + OCR pipeline (resize, preprocess, Tesseract)
 * - calls `onScan(text, { avgConfidence })` for each scanned file
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
  const MAX_DIM = 2400; // higher resolution for small text

  // Animate dots during loading
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setAnimDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, [loading]);

  const validateFile = (file) => {
    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed.");
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("File too large. Max 5 MB.");
      return false;
    }
    setError("");
    return true;
  };

  const handleFiles = (selectedFiles) => {
    const validFiles = Array.from(selectedFiles).filter(validateFile);
    if (!validFiles.length) return;

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

  useEffect(() => {
    return () => previewURLs.forEach((url) => URL.revokeObjectURL(url));
  }, [previewURLs]);

  const resizeImage = (file) =>
    new Promise((resolve) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => (img.src = e.target.result);
      img.onload = () => {
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
          (blob) =>
            resolve(
              new File([blob], file.name, {
                type: file.type,
              })
            ),
          file.type
        );
      };
      reader.readAsDataURL(file);
    });

  const preprocessImage = async (img, canvas) => {
    const ctx = canvas.getContext("2d");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);

    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // --- grayscale + dynamic contrast stretch ---
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

    // --- light sharpening to crisp text edges ---
    const applySharpen = () => {
      const copy = new Uint8ClampedArray(data);
      const width = canvas.width;
      const height = canvas.height;
      const kernel = [
        0, -1, 0,
        -1, 5, -1,
        0, -1, 0,
      ];
      const kSize = 3;
      const half = Math.floor(kSize / 2);

      for (let y = half; y < height - half; y++) {
        for (let x = half; x < width - half; x++) {
          let r = 0,
            g = 0,
            b = 0;
          let kIndex = 0;

          for (let ky = -half; ky <= half; ky++) {
            for (let kx = -half; kx <= half; kx++) {
              const px = x + kx;
              const py = y + ky;
              const pIdx = (py * width + px) * 4;
              const w = kernel[kIndex++];
              r += copy[pIdx] * w;
              g += copy[pIdx + 1] * w;
              b += copy[pIdx + 2] * w;
            }
          }

          const idx = (y * width + x) * 4;
          data[idx] = Math.max(0, Math.min(255, r));
          data[idx + 1] = Math.max(0, Math.min(255, g));
          data[idx + 2] = Math.max(0, Math.min(255, b));
          // alpha unchanged
        }
      }
    };

    applySharpen();
    ctx.putImageData(imageData, 0, 0);

    // --- auto-crop dark text block, then scale up ---
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
    // If we didn't find a clear block, just return current canvas
    if (right - left < 20 || bottom - top < 20) return canvas;

    const scaleFactor = 3;
    const croppedCanvas = document.createElement("canvas");
    croppedCanvas.width = (right - left) * scaleFactor;
    croppedCanvas.height = (bottom - top) * scaleFactor;
    const cctx = croppedCanvas.getContext("2d");
    cctx.imageSmoothingEnabled = true;
    cctx.imageSmoothingQuality = "high";
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
    if (!files.length) return;
    setLoading(true);
    setOcrTexts(new Array(files.length).fill(""));

    try {
      const Tesseract = (await import("tesseract.js")).default;
      const resizedFiles = await Promise.all(files.map(resizeImage));

      for (let i = 0; i < resizedFiles.length; i++) {
        const file = resizedFiles[i];

        // load image
        const img = new Image();
        const reader = new FileReader();
        const imgLoaded = new Promise((res) => (img.onload = res));
        reader.onload = (e) => (img.src = e.target.result);
        reader.readAsDataURL(file);
        await imgLoaded;

        const canvas = document.createElement("canvas");
        canvasRefs.current[i] = canvas;

        const preprocessed = await preprocessImage(img, canvas);
        const dataUrl = preprocessed.toDataURL("image/jpeg", 0.9);

        const result = await Tesseract.recognize(dataUrl, "eng", {
          logger: (m) => console.log("OCR progress:", m),
          tessedit_char_whitelist:
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,%()-: ",
          psm: 6, // dense block of text
          preserve_interword_spaces: 1,
          user_defined_dpi: 300,
        });

        const { text, words, confidence } = result.data || {};
        const cleanText = text || "";

        const avgConfidence =
          words && words.length
            ? words.reduce((sum, w) => sum + (w.confidence || 0), 0) /
              words.length
            : confidence || 0;

        setOcrTexts((prev) => {
          const updated = [...prev];
          updated[i] = cleanText;
          return updated;
        });

        if (typeof onScan === "function") {
          try {
            await onScan(cleanText, { avgConfidence });
          } catch (err) {
            console.error("onScan callback error:", err);
          }
        }
      }
    } catch (err) {
      console.error("OCR failed:", err);
      setError("OCR failed. Please try again.");
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
            : "Tap to choose a photo or take one (camera or gallery)"}
        </span>
        <input
          type="file"
          accept="image/*"
          multiple={multiple}
          onChange={handleFileChange}
          className="hidden"
        />
      </label>

      {files.map((file, idx) => (
        <div
          key={idx}
          className="flex flex-col items-start space-y-1 max-w-3xl mx-auto"
        >
          <span className="font-medium">{file.name}</span>
          <input
            type="text"
            placeholder="Athlete or Team Name (optional)"
            value={athleteNames[idx]}
            onChange={(e) => handleNameChange(idx, e.target.value)}
            className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <img
            src={previewURLs[idx]}
            alt="Preview"
            className="max-h-48 rounded-xl border border-gray-200 shadow-md object-contain mt-1"
            loading="lazy"
          />
        </div>
      ))}

      {error && <p className="text-red-500 text-center">{error}</p>}

      {loading && files.length > 0 && (
        <ProgressBar
          progress={Math.round(
            (ocrTexts.filter((r) => r).length / files.length) * 100
          )}
        />
      )}

      <button
        onClick={handleScan}
        disabled={loading || !files.length}
        className={`w-full md:w-auto px-6 py-3 rounded-2xl font-medium text-white shadow-md transition ${
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
