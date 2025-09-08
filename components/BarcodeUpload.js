"use client";

import { useEffect, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/library";
import ProgressBar from "./ProgressBar";

export default function BarcodeUpload({ multiple = false, onResult, showScanButton = true }) {
  const [files, setFiles] = useState([]);
  const [previewURLs, setPreviewURLs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [animDots, setAnimDots] = useState("");
  const [error, setError] = useState("");
  const [athleteNames, setAthleteNames] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  const MAX_FILE_SIZE = 5 * 1024 * 1024;

  // Animate dots during loading
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => setAnimDots((d) => (d.length >= 3 ? "" : d + ".")), 450);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    return () => previewURLs.forEach((url) => URL.revokeObjectURL(url));
  }, [previewURLs]);

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

  const handleFiles = (fileList) => {
    const valid = Array.from(fileList || []).filter(validateFile);
    if (!valid.length) return;
    setFiles(valid);
    setPreviewURLs(valid.map((f) => URL.createObjectURL(f)));
    setAthleteNames(valid.map(() => ""));
  };

  const handleFileInputChange = (e) => handleFiles(e.target.files);
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); };

  const handleNameChange = (idx, value) => {
    const names = [...athleteNames];
    names[idx] = value;
    setAthleteNames(names);
  };

  // --- Full barcode pipeline from your working code ---
  async function decodeBarcodeFromFile(file) {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const img = new Image();
          img.onload = async () => {
            try {
              const codeReader = new BrowserMultiFormatReader();
              const result = await codeReader.decodeFromImageElement(img);
              const barcodeText =
                result && (typeof result.getText === "function" ? result.getText() : result.text || "");
              codeReader.reset();
              resolve(barcodeText);
            } catch (err) {
              reject(err);
            }
          };
          img.onerror = () => reject(new Error("Failed to load image for decoding."));
          img.src = ev.target.result;
        };
        reader.onerror = () => reject(new Error("FileReader failed"));
        reader.readAsDataURL(file);
      } catch (err) {
        reject(err);
      }
    });
  }

  async function fetchIngredientsAndCheck(barcode, labelImage) {
    const resp = await fetch("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcode, labelImage, barcode: true }),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => null);
      throw new Error(txt || `Barcode check failed with status ${resp.status}`);
    }
    return resp.json();
  }

  async function handleDecodedBarcodePipeline(barcodeText, labelImage = null, idx = null) {
    setError("");
    setLoading(true);
    setProgress(5);
    try {
      setProgress(20);
      const data = await fetchIngredientsAndCheck(barcodeText, labelImage);

      const rawIngredients = data?.ocrText || "";
      const matched = data?.matchedBanned || [];
      const source = data?.debug?.fetchedIngredients
        ? data.debug.fetchedIngredients.includes("OFF")
          ? "OpenFoodFacts"
          : data.debug.fetchedIngredients.includes("USDA")
          ? "USDA"
          : data.debug.fetchedIngredients.includes("FoodRepo")
          ? "FoodRepo"
          : "OCR"
        : "OCR";

      setProgress(90);
      const result = {
        barcode: barcodeText,
        productName: data?.productName || "Unknown product",
        rawIngredients,
        matchedBanned: matched,
        source,
        idx,
      };

      if (typeof onResult === "function") {
        try {
          await onResult(result);
        } catch (cbErr) {
          console.warn("onResult callback threw:", cbErr);
        }
      }

      setProgress(100);
      return result;
    } catch (err) {
      console.error("handleDecodedBarcodePipeline error:", err);
      setError(err.message || "Failed to process barcode.");
      throw err;
    } finally {
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 350);
    }
  }

  const handleScanAllBarcodes = async () => {
    if (!files.length) return;
    setLoading(true);
    for (let i = 0; i < files.length; i++) {
      try {
        const code = await decodeBarcodeFromFile(files[i]);
        if (!code) throw new Error("No barcode decoded");
        const labelImage = previewURLs[i] || null;
        await handleDecodedBarcodePipeline(code, labelImage, i);
      } catch (err) {
        console.warn("Scan failed for index", i, err);
      }
    }
    setLoading(false);
  };

  // --- UI matches OCRUpload design ---
  return (
    <div className="mt-6 font-sans space-y-4">
      <label
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center w-full max-w-3xl mx-auto px-6 py-6 border-2 border-dashed rounded-2xl cursor-pointer transition ${
          isDragging ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-gray-50 hover:bg-gray-100"
        }`}
      >
        <span className="text-gray-600 text-center font-medium">
          {files.length ? `${files.length} file${files.length > 1 ? "s" : ""} selected` : "Tap to choose an image or take a photo"}
        </span>
        <input type="file" accept="image/*" multiple={multiple} onChange={handleFileInputChange} className="hidden" />
      </label>

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

      {showScanButton && (
        <button
          onClick={handleScanAllBarcodes}
          disabled={!files.length || loading}
          className={`w-full md:w-auto px-6 py-3 rounded-2xl font-medium text-white shadow-md transition ${
            !files.length || loading ? "bg-gray-400 cursor-not-allowed" : "bg-[#46769B] hover:bg-blue-700"
          }`}
        >
          {loading ? `Scanning${animDots}` : multiple ? "Scan All Barcodes" : "Scan Barcode"}
        </button>
      )}

      {loading && <ProgressBar progress={progress} scanning={loading} />}
    </div>
  );
}
