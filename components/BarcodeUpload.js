"use client";

import { useEffect, useState, useRef } from "react";
import { BrowserMultiFormatReader } from "@zxing/library";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import ProgressBar from "./ProgressBar";

// Lazy load live scanner
const LiveBarcodeScanner = dynamic(() => import("./LiveBarcodeScanner"), { ssr: false });

export default function BarcodeUpload({ multiple = false, onResult, showScanButton = true }) {
  const [files, setFiles] = useState([]);
  const [previewURLs, setPreviewURLs] = useState([]);
  const [athleteNames, setAthleteNames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [animDots, setAnimDots] = useState("");
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [showLiveScanner, setShowLiveScanner] = useState(false);

  const fileInputRef = useRef(null);
  const MAX_FILE_SIZE = 5 * 1024 * 1024;

  // Animate loading dots
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => setAnimDots((d) => (d.length >= 3 ? "" : d + ".")), 450);
    return () => clearInterval(interval);
  }, [loading]);

  // Cleanup preview URLs
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
  const handleNameChange = (idx, value) => { const names = [...athleteNames]; names[idx] = value; setAthleteNames(names); };

  // --- Barcode decoding ---
  async function decodeBarcodeFromFile(file) {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const img = new Image();
          img.onload = async () => {
            try {
              const codeReader = new BrowserMultiFormatReader();
              const result = await codeReader.decodeFromImageElement(img);
              const barcodeText = result?.getText?.() || result?.text || "";
              codeReader.reset();
              resolve(barcodeText);
            } catch (err) { reject(err); }
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

  // --- Fetch matches from server ---
  async function fetchMatches(barcode, labelImage) {
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
      const data = await fetchMatches(barcodeText, labelImage);

      setProgress(90);
      const result = {
        barcode: barcodeText,
        productName: data?.productName || "Unknown product",
        rawIngredients: data?.ocrText || "",
        matchedBanned: data?.matchedBanned || [],
        matchedIngredients: data?.matchedIngredients || [],
        source: data?.debug?.fetchedIngredientsSource || "OCR",
        idx,
      };

      if (typeof onResult === "function") await onResult(result);

      setProgress(100);
      return result;
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to process barcode.");
      throw err;
    } finally {
      setTimeout(() => { setLoading(false); setProgress(0); }, 350);
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

  // --- UI ---
  return (
    <div className="mt-6 font-sans space-y-4">
      {/* Upload Box */}
      <div
        onClick={() => setShowChoiceModal(true)}
        className={`flex flex-col items-center justify-center w-full max-w-3xl mx-auto px-6 py-6 border-2 border-dashed rounded-2xl cursor-pointer transition ${
          isDragging ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-gray-50 hover:bg-gray-100"
        }`}
      >
        <span className="text-gray-600 text-center font-medium">
          {files.length ? `${files.length} file${files.length > 1 ? "s" : ""} selected` : "Tap to choose an image or take a photo"}
        </span>
      </div>

      {/* Hidden File Input */}
      <input
        type="file"
        accept="image/*"
        multiple={multiple}
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Modal Choice */}
      <AnimatePresence>
        {showChoiceModal && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-xl w-80 p-6 space-y-4 hover:shadow-2xl transition-shadow"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-semibold text-gray-800">Choose Action</h2>
                <button onClick={() => setShowChoiceModal(false)} className="text-gray-400 hover:text-gray-700 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-gray-600 text-sm">Select how you want to add a barcode: live scanning or from an image.</p>
              <div className="flex flex-col gap-3 mt-2">
                <button
                  className="w-full bg-[#46769B] hover:bg-[#365b7a] text-white rounded-xl py-3 font-medium transition"
                  onClick={() => { setShowChoiceModal(false); setShowLiveScanner(true); }}
                >
                  Start Live Scanner
                </button>
                <button
                  className="w-full border border-gray-300 rounded-xl py-3 font-medium text-gray-700 hover:bg-gray-50 transition"
                  onClick={() => { setShowChoiceModal(false); fileInputRef.current?.click(); }}
                >
                  Take Photo / Upload
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Scanner */}
      <AnimatePresence>
        {showLiveScanner && (
          <motion.div
            className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="bg-white rounded-2xl shadow-xl w-[90%] max-w-md p-4 relative">
              <button className="absolute top-3 right-3 text-gray-600 hover:text-black" onClick={() => setShowLiveScanner(false)}>
                <X className="w-6 h-6" />
              </button>
              <LiveBarcodeScanner onDetected={(code) => { setShowLiveScanner(false); handleDecodedBarcodePipeline(code); }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview / Input */}
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
          <img src={previewURLs[idx]} alt="Preview" className="max-h-48 rounded-xl border border-gray-200 shadow-md object-contain mt-1" loading="lazy" />
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
