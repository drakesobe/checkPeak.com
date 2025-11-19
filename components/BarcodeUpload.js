"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from "@zxing/library";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { X, Check } from "lucide-react";
import Cropper from "react-easy-crop";
import ProgressBar from "./ProgressBar";

// Lazy load live scanner (your existing beta scanner)
const LiveBarcodeScanner = dynamic(() => import("./LiveBarcodeScanner"), { ssr: false });

// Tiny beep (short 8-bit-ish click) — replace if you want a different sound
const BEEP_SRC =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA="; // extremely short silent-ish placeholder

// Helper: crop an image (by URL) to a given pixel region and return a File
async function getCroppedFileFromImage(imageSrc, cropPixels, filename = "cropped-barcode.jpg") {
  return new Promise((resolve, reject) => {
    try {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        canvas.width = cropPixels.width;
        canvas.height = cropPixels.height;

        ctx.drawImage(
          image,
          cropPixels.x,
          cropPixels.y,
          cropPixels.width,
          cropPixels.height,
          0,
          0,
          cropPixels.width,
          cropPixels.height
        );

        // Export as JPEG with some compression to keep size low
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Canvas is empty or crop failed"));
              return;
            }
            const file = new File([blob], filename, { type: "image/jpeg" });
            resolve(file);
          },
          "image/jpeg",
          0.8
        );
      };
      image.onerror = (e) => reject(e);
      image.src = imageSrc;
    } catch (err) {
      reject(err);
    }
  });
}

export default function BarcodeUpload({
  multiple = false,
  onResult,
  showScanButton = true,
  preferredFormats,
}) {
  // UI state
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
  const [showSuccess, setShowSuccess] = useState(false);
  const [enableChime, setEnableChime] = useState(true);

  // NEW: crop modal state
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageIndex, setCropImageIndex] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.8);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const fileInputRef = useRef(null);
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  // ZXing reader reuse
  const codeReaderRef = useRef(null);
  // audio ref
  const audioRef = useRef(null);

  useEffect(() => {
    audioRef.current = typeof Audio !== "undefined" ? new Audio(BEEP_SRC) : null;
  }, []);

  // animate dots while loading
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => setAnimDots((d) => (d.length >= 3 ? "" : d + ".")), 450);
    return () => clearInterval(interval);
  }, [loading]);

  // cleanup objectURLs
  useEffect(() => {
    return () => previewURLs.forEach((url) => URL.revokeObjectURL(url));
  }, [previewURLs]);

  // instantiate ZXing once
  useEffect(() => {
    try {
      codeReaderRef.current = new BrowserMultiFormatReader();
    } catch (err) {
      console.warn("Failed to create ZXing reader:", err);
      codeReaderRef.current = null;
    }
    return () => {
      try {
        codeReaderRef.current?.reset?.();
      } catch (e) {}
      codeReaderRef.current = null;
    };
  }, []);

  // mapping for readable preferredFormats -> BarcodeFormat
  const NAME_TO_FORMAT = {
    AZTEC: BarcodeFormat.AZTEC,
    CODABAR: BarcodeFormat.CODABAR,
    CODE_39: BarcodeFormat.CODE_39,
    CODE_93: BarcodeFormat.CODE_93,
    CODE_128: BarcodeFormat.CODE_128,
    DATA_MATRIX: BarcodeFormat.DATA_MATRIX,
    EAN_8: BarcodeFormat.EAN_8,
    EAN_13: BarcodeFormat.EAN_13,
    ITF: BarcodeFormat.ITF,
    MAXICODE: BarcodeFormat.MAXICODE,
    PDF_417: BarcodeFormat.PDF_417,
    QR_CODE: BarcodeFormat.QR_CODE,
    RSS_14: BarcodeFormat.RSS_14,
    RSS_EXPANDED: BarcodeFormat.RSS_EXPANDED,
    UPC_A: BarcodeFormat.UPC_A,
    UPC_E: BarcodeFormat.UPC_E,
    UPC_EAN_EXTENSION: BarcodeFormat.UPC_EAN_EXTENSION,
  };

  const mapFormats = (arr = []) => {
    const out = [];
    for (const name of arr) {
      const n = ("" + name).toUpperCase();
      if (NAME_TO_FORMAT[n]) out.push(NAME_TO_FORMAT[n]);
    }
    return out;
  };

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
  const handleNameChange = (idx, value) => {
    const names = [...athleteNames];
    names[idx] = value;
    setAthleteNames(names);
  };

  // --- ZXing based barcode decoding from File/Blob ---
  async function decodeBarcodeFromFile(file) {
    try {
      let bitmap;
      try {
        bitmap = await createImageBitmap(file);
      } catch (err) {
        // fallback: create Image from dataURL
        const dataUrl = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
        bitmap = await new Promise((res, rej) => {
          const img = new Image();
          img.onload = () => {
            const c = document.createElement("canvas");
            c.width = img.width;
            c.height = img.height;
            const ctx = c.getContext("2d");
            ctx.drawImage(img, 0, 0);
            createImageBitmap(c).then(res).catch(rej);
          };
          img.onerror = rej;
          img.src = dataUrl;
        });
      }

      const reader = codeReaderRef.current || new BrowserMultiFormatReader();

      // if preferred formats given, set hints (if supported)
      if (preferredFormats && Array.isArray(preferredFormats)) {
        try {
          const formats = mapFormats(preferredFormats);
          if (formats.length) {
            const hints = new Map();
            hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
            // Some builds let you pass hints via constructor; here we just prepare them
            // for potential future usage.
          }
        } catch (e) {
          // ignore
        }
      }

      const MAX_SIDE = 1400;
      const rotations = [0, 90, 180, 270];
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));

      const preprocessCanvas = () => {
        try {
          const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const d = id.data;
          const contrast = 1.35;
          for (let i = 0; i < d.length; i += 4) {
            const r = d[i], g = d[i + 1], b = d[i + 2];
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            let v = ((gray - 128) * contrast) + 128;
            v = Math.max(0, Math.min(255, v));
            d[i] = d[i + 1] = d[i + 2] = v;
          }
          ctx.putImageData(id, 0, 0);
        } catch (err) {
          // ignore
        }
      };

      let lastErr = null;

      for (const rot of rotations) {
        try {
          if (rot % 180 === 0) {
            canvas.width = Math.round(bitmap.width * scale);
            canvas.height = Math.round(bitmap.height * scale);
          } else {
            canvas.width = Math.round(bitmap.height * scale);
            canvas.height = Math.round(bitmap.width * scale);
          }

          ctx.save();
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate((rot * Math.PI) / 180);
          ctx.drawImage(
            bitmap,
            -(bitmap.width * scale) / 2,
            -(bitmap.height * scale) / 2,
            bitmap.width * scale,
            bitmap.height * scale
          );
          ctx.restore();

          preprocessCanvas();

          const dataUrl = canvas.toDataURL("image/png");
          const tmpImg = new Image();
          // eslint-disable-next-line no-await-in-loop
          await new Promise((res, rej) => {
            tmpImg.onload = res;
            tmpImg.onerror = rej;
            tmpImg.src = dataUrl;
          });

          // eslint-disable-next-line no-await-in-loop
          const result = await reader.decodeFromImageElement(tmpImg);
          const barcodeText = result?.getText?.() || result?.text || "";
          try {
            reader.reset?.();
          } catch (e) {}
          if (barcodeText) return barcodeText;
        } catch (err) {
          lastErr = err;
        }
      }

      throw lastErr || new Error("No barcode decoded from image.");
    } catch (err) {
      throw err;
    }
  }

  // --- server fetch (barcode → providers → Airtable matches) ---
  async function fetchMatches(barcode) {
    // IMPORTANT: we only send the numeric barcode, not the full image,
    // to avoid hitting body size limits for barcode flows.
    const resp = await fetch("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcode, isBarcodeFlow: true }),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => null);
      throw new Error(txt || `Barcode check failed with status ${resp.status}`);
    }
    return resp.json();
  }

  const successChime = () => {
    setShowSuccess(true);
    if (enableChime && audioRef.current) {
      try {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      } catch (e) {}
    }
    setTimeout(() => setShowSuccess(false), 900);
  };

  async function handleDecodedBarcodePipeline(barcodeText, idx = null) {
    setError("");
    if (!barcodeText || !/\d/.test(String(barcodeText))) {
      setError("Decoded value doesn't look like a barcode (no digits).");
      return;
    }

    setLoading(true);
    setProgress(10);
    try {
      setProgress(25);
      const data = await fetchMatches(barcodeText);

      console.log("[BarcodeUpload] API check response:", data);
      console.log("[BarcodeUpload] API debug:", data?.debug || null);

      setProgress(85);
      const result = {
        barcode: barcodeText,
        productName: data?.productName || "Unknown product",
        rawIngredients: data?.ocrText || "",
        matchedBanned: data?.matchedBanned || [],
        matchedIngredients: data?.matchedIngredients || [],
        source: data?.debug?.fetchedFrom || "providers",
        idx,
      };

      successChime();

      if (typeof onResult === "function") await onResult(result);

      setProgress(100);
      return result;
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to process barcode.");
      throw err;
    } finally {
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 350);
    }
  }

  // Scan a single File (cropped or original)
  const handleScanSingleFile = async (file, idx) => {
    try {
      setLoading(true);
      setProgress(15);
      const code = await decodeBarcodeFromFile(file);
      if (!code) throw new Error("No barcode decoded");
      setProgress(60);
      await handleDecodedBarcodePipeline(code, idx);
    } catch (err) {
      console.warn("Scan failed for index", idx, err);
      setError(err.message || "Failed to scan this image.");
    } finally {
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 300);
    }
  };

  // Scan all files (without cropping) - still useful for quick flows
  const handleScanAllBarcodes = async () => {
    if (!files.length) return;
    setLoading(true);
    for (let i = 0; i < files.length; i++) {
      try {
        await handleScanSingleFile(files[i], i);
      } catch (err) {
        console.warn("Scan failed for index", i, err);
      }
    }
    setLoading(false);
  };

  // ---------- Crop modal handlers ----------
  const onCropComplete = useCallback((_, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const openCropForIndex = (idx) => {
    setCropImageIndex(idx);
    setCrop({ x: 0, y: 0 });
    setZoom(1.8);
    setCroppedAreaPixels(null);
    setCropModalOpen(true);
  };

  const handleConfirmCropAndScan = async () => {
    try {
      if (cropImageIndex == null || !previewURLs[cropImageIndex] || !croppedAreaPixels) {
        setCropModalOpen(false);
        return;
      }
      setLoading(true);
      setProgress(10);

      const src = previewURLs[cropImageIndex];
      const originalName = files[cropImageIndex]?.name || "barcode.jpg";

      const croppedFile = await getCroppedFileFromImage(src, croppedAreaPixels, originalName);

      setProgress(35);
      await handleScanSingleFile(croppedFile, cropImageIndex);

      setCropModalOpen(false);
    } catch (err) {
      console.error("Cropping or scanning failed:", err);
      setError(err.message || "Failed to crop and scan barcode.");
    } finally {
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 300);
    }
  };

  return (
    <div className="mt-6 font-sans space-y-4">
      {/* Upload / Trigger Box */}
      <div
        onClick={() => setShowChoiceModal(true)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center w-full max-w-3xl mx-auto px-6 py-6 border-2 border-dashed rounded-2xl cursor-pointer transition ${
          isDragging ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-gray-50 hover:bg-gray-100"
        }`}
      >
        <span className="text-gray-600 text-center font-medium text-sm sm:text-base">
          {files.length
            ? `${files.length} file${files.length > 1 ? "s" : ""} selected`
            : "Tap to start live scan or choose a photo of the barcode"}
        </span>
        <span className="mt-1 text-xs text-gray-400">
          For best results, crop tightly around the barcode before scanning.
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

      {/* Choice Modal (Live vs Upload) */}
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
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    Scan a Barcode
                    <span className="text-[0.65rem] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      Beta
                    </span>
                  </h2>
                  <p className="text-gray-500 text-xs mt-1">
                    Live scanner works best under good light. Photo upload + crop gives you the most control.
                  </p>
                </div>
                <button
                  onClick={() => setShowChoiceModal(false)}
                  className="text-gray-400 hover:text-gray-700 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col gap-3 mt-2">
                <button
                  className="w-full bg-[#46769B] hover:bg-[#365b7a] text-white rounded-xl py-3 font-medium transition text-sm"
                  onClick={() => {
                    setShowChoiceModal(false);
                    setShowLiveScanner(true);
                  }}
                >
                  Start Live Scanner (Beta)
                </button>
                <button
                  className="w-full border border-gray-300 rounded-xl py-3 font-medium text-gray-700 hover:bg-gray-50 transition text-sm"
                  onClick={() => {
                    setShowChoiceModal(false);
                    fileInputRef.current?.click();
                  }}
                >
                  Take Photo / Upload Barcode
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Scanner Overlay */}
      <AnimatePresence>
        {showLiveScanner && (
          <motion.div
            className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="bg-white rounded-2xl shadow-xl w-[92%] max-w-md p-4 relative">
              <button
                className="absolute top-3 right-3 text-gray-600 hover:text-black"
                onClick={() => setShowLiveScanner(false)}
              >
                <X className="w-6 h-6" />
              </button>
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    Live Barcode Scanner
                    <span className="text-[0.6rem] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      Beta
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">
                    Center the barcode in the box and hold still until it beeps.
                  </p>
                </div>
              </div>
              <LiveBarcodeScanner
                onDetected={(code) => {
                  // Live scanner only sends the numeric code; we do not upload any image.
                  setShowLiveScanner(false);
                  handleDecodedBarcodePipeline(code);
                }}
                preferredFormats={preferredFormats}
                enableBeep
                enableFlash
                keepScanning={false}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview / Cropping Controls */}
      {files.map((file, idx) => (
        <div
          key={idx}
          className="flex flex-col items-start space-y-2 max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-3"
        >
          <div className="flex items-center justify-between w-full gap-2">
            <span className="font-medium text-sm truncate">{file.name}</span>
            <button
              type="button"
              onClick={() => openCropForIndex(idx)}
              className="text-xs px-3 py-1.5 rounded-full border border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              Crop Barcode Area
            </button>
          </div>
          <input
            type="text"
            placeholder="Athlete or Team Name (optional)"
            value={athleteNames[idx]}
            onChange={(e) => handleNameChange(idx, e.target.value)}
            className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
          />
          <img
            src={previewURLs[idx]}
            alt="Preview"
            className="max-h-48 rounded-xl border border-gray-200 shadow-sm object-contain mt-1 w-full bg-gray-50"
            loading="lazy"
          />
          <div className="flex items-center justify-between w-full gap-2 text-xs text-gray-500 mt-1">
            <span>Tip: crop tightly around the barcode for the cleanest read.</span>
            <button
              type="button"
              onClick={() => handleScanSingleFile(files[idx], idx)}
              className="px-3 py-1.5 rounded-full bg-[#46769B] text-white font-semibold hover:bg-blue-700"
              disabled={loading}
            >
              Scan This Image
            </button>
          </div>
        </div>
      ))}

      {/* small hint row */}
      <div className="flex items-center justify-between max-w-3xl mx-auto text-xs text-gray-500">
        <div>Good lighting + sharp focus = fewer misread digits.</div>
      </div>

      {error && <p className="text-red-500 text-center text-sm">{error}</p>}

      {showScanButton && files.length > 0 && (
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

      {/* success checkmark */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.22 }}
            className="fixed bottom-8 right-8 z-50"
          >
            <div className="bg-white/90 backdrop-blur-md p-3 rounded-full shadow-lg border border-gray-200">
              <Check className="w-6 h-6 text-green-600" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Crop modal */}
      <AnimatePresence>
        {cropModalOpen && cropImageIndex != null && previewURLs[cropImageIndex] && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-2xl w-[95%] max-w-md max-h-[90vh] flex flex-col overflow-hidden"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div>
                  <h2 className="text-sm font-semibold text-gray-800">Crop Barcode Area</h2>
                  <p className="text-xs text-gray-500">
                    Drag and zoom to fit the barcode inside the frame, then tap “Use Crop &amp; Scan”.
                  </p>
                </div>
                <button
                  onClick={() => setCropModalOpen(false)}
                  className="text-gray-400 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative flex-1 bg-black">
                <Cropper
                  image={previewURLs[cropImageIndex]}
                  crop={crop}
                  zoom={zoom}
                  aspect={5} // wide, good for barcodes
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                  showGrid={false}
                  restrictPosition={true}
                />
              </div>

              <div className="px-4 pt-3 pb-4 border-t border-gray-100 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-16">Zoom</span>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.1}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setCropModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmCropAndScan}
                    className="px-4 py-2 rounded-xl bg-[#46769B] text-white text-xs font-semibold shadow-sm hover:bg-blue-700"
                  >
                    Use Crop &amp; Scan
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
