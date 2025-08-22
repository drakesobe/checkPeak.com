import { useState, useEffect } from "react";

export default function OCRUpload({ onScan }) {
  const [file, setFile] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(""); // Inline error message
  const [previewURL, setPreviewURL] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

  // Validate file type and size
  const validateFile = (selectedFile) => {
    if (!selectedFile.type.startsWith("image/")) {
      setError("Only image files are allowed.");
      return false;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("File is too large. Please upload an image under 5 MB.");
      return false;
    }
    setError("");
    return true;
  };

  // Handle file selection (click or drop)
  const handleFile = (selectedFile) => {
    if (!validateFile(selectedFile)) {
      setFile(null);
      setPreviewURL(null);
      return;
    }
    setFile(selectedFile);
    setPreviewURL(URL.createObjectURL(selectedFile));
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) handleFile(selectedFile);
  };

  // Handle drag events
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
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFile(droppedFile);
  };

  // Cleanup preview URL
  useEffect(() => {
    return () => {
      if (previewURL) URL.revokeObjectURL(previewURL);
    };
  }, [previewURL]);

  // Resize large images
  const resizeImage = (file) =>
    new Promise((resolve) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target.result;
      };

      img.onload = () => {
        const MAX_WIDTH = 1080;
        const MAX_HEIGHT = 1080;
        let { width, height } = img;

        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          const scale = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
          width = width * scale;
          height = height * scale;
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

  // OCR scan
  const handleScan = async () => {
    if (!file) return;

    setScanning(true);

    try {
      const processedFile = await resizeImage(file);

      const Tesseract = (await import("tesseract.js")).default;
      const { data } = await Tesseract.recognize(processedFile, "eng", {
        logger: (m) => {
          // Progress handled by global ProgressBar
        },
      });

      onScan(data.text);
    } catch (err) {
      setError("OCR failed. Please try again.");
      console.error(err);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="mt-6 font-sans space-y-4">
      {/* Drag-and-Drop + Click Upload Area */}
      <label
        className={`flex flex-col items-center justify-center w-full max-w-3xl mx-auto px-6 py-6 border-2 border-dashed rounded-2xl cursor-pointer transition
          ${isDragging ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-gray-50 hover:bg-gray-100"}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span className="text-gray-600 font-medium text-center">
          {file
            ? file.name
            : "Click to select a file, take a photo, or drag & drop an image"}
        </span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
      </label>

      {/* Live Preview */}
      {previewURL && (
        <div className="flex justify-center mt-2">
          <img
            src={previewURL}
            alt="Preview"
            className="max-h-64 rounded-xl border border-gray-200 shadow-md object-contain"
          />
        </div>
      )}

      {/* Inline Error */}
      {error && <p className="text-red-500 text-center">{error}</p>}

      {/* Scan Button */}
      <button
        onClick={handleScan}
        disabled={scanning || !file}
        className={`w-full md:w-auto px-6 py-3 rounded-2xl font-medium text-white shadow-md transition
          ${
            scanning || !file
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-[#46769B] hover:bg-blue-700"
          }`}
      >
        {scanning ? "Scanning..." : "Scan Label"}
      </button>
    </div>
  );
}
