"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/library";
import ProgressBar from "./ProgressBar";

export default function BarcodeUpload({ multiple = false, onResult, showScanButton = true }) {
  const [files, setFiles] = useState([]);
  const [previewURLs, setPreviewURLs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [animDots, setAnimDots] = useState("");
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const MAX_FILE_SIZE = 5 * 1024 * 1024;

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setAnimDots((d) => (d.length >= 3 ? "" : d + ".")), 450);
    return () => clearInterval(id);
  }, [loading]);

  useEffect(() => {
    return () => previewURLs.forEach((u) => URL.revokeObjectURL(u));
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
    const arr = Array.from(fileList || []);
    const valid = arr.filter(validateFile);
    if (!valid.length) return;
    setFiles(valid);
    setPreviewURLs(valid.map((f) => URL.createObjectURL(f)));
  };

  const onFileInputChange = (e) => handleFiles(e.target.files);
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

  return (
    <div className="font-sans space-y-6 max-w-4xl mx-auto p-4">
      <label
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`block w-full border-2 border-dashed rounded-xl px-4 py-6 text-center cursor-pointer transition ${
          isDragging ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"
        }`}
      >
        <div className="text-sm text-gray-600">
          {files.length
            ? `${files.length} file${files.length > 1 ? "s" : ""} selected`
            : "Click or drag images here to upload (barcode image or product photo)"}
        </div>
        <input type="file" accept="image/*" multiple={multiple} onChange={onFileInputChange} className="hidden" />
      </label>

      {files.length > 0 && (
        <div className="space-y-4">
          {files.map((f, idx) => (
            <div key={idx} className="bg-white border rounded-xl p-3 shadow-sm flex gap-4 items-start">
              <img src={previewURLs[idx]} alt={f.name} className="w-28 h-28 object-contain rounded-md border" />
              <div className="flex-1 flex flex-col justify-center">
                <div className="font-medium">{f.name}</div>
                <div className="text-xs text-gray-500 mt-1">{(f.size / 1024).toFixed(0)} KB</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

      {/* Only render Scan Barcode button on Barcode tab */}
      {showScanButton && (
        <div className="mt-6">
          <button
            onClick={handleScanAllBarcodes}
            disabled={!files.length || loading}
            className={`w-full md:w-auto px-6 py-3 rounded-2xl font-medium text-white shadow-md transition ${
              !files.length || loading ? "bg-gray-400 cursor-not-allowed" : "bg-[#46769B] hover:bg-blue-700"
            }`}
          >
            {loading ? `Scanning${animDots}` : "Scan Barcode"}
          </button>
        </div>
      )}

      {loading && <ProgressBar progress={progress} scanning={loading} />}
    </div>
  );
}
