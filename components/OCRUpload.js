// components/OCRUpload.js
"use client";
import { useState, useEffect, useRef } from "react";
import OCRScanResults from "./OCRScanResults";
import ProgressBar from "./ProgressBar";

export default function OCRUpload({ multiple = false }) {
  const [files, setFiles] = useState([]);
  const [previewURLs, setPreviewURLs] = useState([]);
  const [ocrTexts, setOcrTexts] = useState([]); // store OCR per file
  const [matchedRecordsArr, setMatchedRecordsArr] = useState([]); // store records per file
  const [loading, setLoading] = useState(false);
  const [animDots, setAnimDots] = useState("");
  const [error, setError] = useState("");
  const [athleteNames, setAthleteNames] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const imageRefs = useRef([]);
  const canvasRefs = useRef([]);

  // Animate dots during loading
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setAnimDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, [loading]);

  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);

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
    setMatchedRecordsArr(new Array(validFiles.length).fill([]));
    setAthleteNames(validFiles.map(() => ""));
    imageRefs.current = new Array(validFiles.length).fill(null);
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

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => previewURLs.forEach((url) => URL.revokeObjectURL(url));
  }, [previewURLs]);

  const resizeImage = (file) =>
    new Promise((resolve) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => (img.src = e.target.result);
      img.onload = () => {
        const MAX_DIM = 800;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          const scale = Math.min(MAX_DIM / width, MAX_DIM / height);
          width *= scale;
          height *= scale;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
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

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Grayscale + contrast
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

    // Detect darker region
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
    cctx.drawImage(canvas, left, top, right - left, bottom - top, 0, 0, croppedCanvas.width, croppedCanvas.height);

    return croppedCanvas;
  };

  const handleScan = async () => {
    if (!files.length) return;
    setLoading(true);
    setOcrTexts(new Array(files.length).fill(""));
    setMatchedRecordsArr(new Array(files.length).fill([]));

    try {
      const Tesseract = (await import("tesseract.js")).default;
      const resizedFiles = await Promise.all(files.map(resizeImage));

      for (let i = 0; i < resizedFiles.length; i++) {
        const file = resizedFiles[i];

        // Wait for image to load
        const img = await new Promise((resolve, reject) => {
          const image = new Image();
          const reader = new FileReader();
          reader.onload = (e) => (image.src = e.target.result);
          image.onload = () => resolve(image);
          image.onerror = reject;
          reader.readAsDataURL(file);
        });

        const canvas = document.createElement("canvas");
        canvasRefs.current[i] = canvas;
        const preprocessed = await preprocessImage(img, canvas);

        const result = await Tesseract.recognize(preprocessed, "eng", {
          logger: (m) => console.log("OCR progress:", m),
          tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,%()-: ",
          oem: 1,
          psm: 6,
        });

        const text = result.data.text || "";
        setOcrTexts((prev) => {
          const updated = [...prev];
          updated[i] = text;
          return updated;
        });

        // Send OCR to API for banned substance check
        const res = await fetch("/api/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const data = await res.json();
        const records = data.records || [];
        setMatchedRecordsArr((prev) => {
          const updated = [...prev];
          updated[i] = records;
          return updated;
        });
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
      {/* Drag-and-drop + click area */}
      <label
        className={`flex flex-col items-center justify-center w-full max-w-3xl mx-auto px-6 py-6 border-2 border-dashed rounded-2xl cursor-pointer transition
          ${isDragging ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-gray-50 hover:bg-gray-100"}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span className="text-gray-600 text-center font-medium">
          {files.length
            ? `${files.length} file${files.length > 1 ? "s" : ""} selected`
            : "Click to select a file, take a photo, or drag & drop"}
        </span>
        <input
          type="file"
          accept="image/*"
          capture={isIOS() ? "environment" : undefined}
          multiple={multiple}
          onChange={handleFileChange}
          className="hidden"
        />
      </label>

      {/* Previews & Names */}
      {files.map((file, idx) => (
        <div key={idx} className="flex flex-col items-start space-y-1 max-w-3xl mx-auto">
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

      {/* Progress Bar */}
      {loading && (
        <ProgressBar progress={Math.round((ocrTexts.filter((r) => r).length / files.length) * 100)} />
      )}

      {/* Scan Button */}
      <button
        onClick={handleScan}
        disabled={loading || !files.length}
        className={`w-full md:w-auto px-6 py-3 rounded-2xl font-medium text-white shadow-md transition
          ${loading || !files.length ? "bg-gray-400 cursor-not-allowed" : "bg-[#46769B] hover:bg-blue-700"}`}
      >
        {loading ? `Scanning${animDots}` : multiple ? "Scan All Labels" : "Scan Label"}
      </button>

      {/* Results */}
      {files.map((file, idx) => (
        <OCRScanResults
          key={idx}
          ocrText={ocrTexts[idx]}
          matchedSubstances={matchedRecordsArr[idx]}
        />
      ))}
    </div>
  );
}
