// components/OCRUpload.js
import { useState, useEffect } from "react";
import ProgressBar from "./ProgressBar";

export default function OCRUpload({ onScan, onBatchScan, multiple = false }) {
  const [files, setFiles] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [previewURLs, setPreviewURLs] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [athleteNames, setAthleteNames] = useState([]);
  const [results, setResults] = useState([]);
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);

  const validateFile = (file) => {
    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed.");
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("File is too large. Max 5 MB.");
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
    setAthleteNames(validFiles.map(() => ""));
    setResults(new Array(validFiles.length).fill(""));
  };

  const handleFileChange = (e) => handleFiles(e.target.files);

  // Drag-and-drop handlers
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

  // Resize image for faster OCR
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

  // Browser-safe Tesseract.js v6 scan
  const handleScan = async () => {
    if (!files.length) return;
    setScanning(true);
    setError("");
    setResults(new Array(files.length).fill(""));

    try {
      const Tesseract = (await import("tesseract.js")).default;

      // Convert resized files to base64
      const resizedFiles = await Promise.all(files.map(resizeImage));
      const base64Files = await Promise.all(
        resizedFiles.map(
          (f) =>
            new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) => resolve(e.target.result);
              reader.readAsDataURL(f);
            })
        )
      );

      for (let i = 0; i < base64Files.length; i++) {
        // Direct recognize call avoids createWorker issues
        const { data } = await Tesseract.recognize(base64Files[i], "eng");

        setResults((prev) => {
          const updated = [...prev];
          updated[i] = data.text;
          return updated;
        });

        // Call callbacks progressively
        if (!multiple && onScan) onScan(data.text);
        else if (multiple && onBatchScan)
          onBatchScan([...results.slice(0, i + 1), data.text]);
      }
    } catch (err) {
      console.error(err);
      setError("OCR failed. Please try again.");
    } finally {
      setScanning(false);
    }
  };

  const handleNameChange = (index, value) => {
    const newNames = [...athleteNames];
    newNames[index] = value;
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

      {/* Athlete Names & Previews */}
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

      {/* Inline Error */}
      {error && <p className="text-red-500 text-center">{error}</p>}

      {/* Progress Bar */}
      {scanning && (
        <ProgressBar
          progress={Math.round((results.filter((r) => r).length / files.length) * 100)}
        />
      )}

      {/* Scan Button */}
      <button
        onClick={handleScan}
        disabled={scanning || !files.length}
        className={`w-full md:w-auto px-6 py-3 rounded-2xl font-medium text-white shadow-md transition
          ${scanning || !files.length ? "bg-gray-400 cursor-not-allowed" : "bg-[#46769B] hover:bg-blue-700"}`}
      >
        {scanning ? "Scanning..." : multiple ? "Scan All Labels" : "Scan Label"}
      </button>
    </div>
  );
}
