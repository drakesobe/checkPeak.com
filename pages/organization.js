// pages/organization.js
import { useState } from "react";
import NavBar from "../components/NavBar";
import OCRUpload from "../components/OCRUpload";
import OCRScanResults from "../components/OCRScanResults";
import ProgressBar from "../components/ProgressBar";

export default function OrganizationPage() {
  const [ocrTextList, setOcrTextList] = useState([]); // array for batch uploads
  const [matchedSubstancesList, setMatchedSubstancesList] = useState([]);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [scanning, setScanning] = useState(false);

  // Handle batch OCR scan for multiple uploads
  const handleOCRBatchScan = async (texts) => {
    setOcrTextList([]);
    setMatchedSubstancesList([]);
    setError("");
    setScanning(true);
    setProgress(0);

    const totalFiles = texts.length;
    let completed = 0;

    for (let i = 0; i < totalFiles; i++) {
      const text = texts[i];
      const interval = setInterval(() => {
        setProgress((prev) => Math.min(prev + Math.random() * 5, 80));
      }, 200);

      try {
        const res = await fetch("/api/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const data = await res.json();

        setOcrTextList((prev) => [...prev, text]);
        setMatchedSubstancesList((prev) => [...prev, data.records || []]);
        completed++;
        setProgress(Math.round((completed / totalFiles) * 100));

        clearInterval(interval);
      } catch (err) {
        console.error("OCR check error:", err);
        setError(`OCR scan failed for file ${i + 1}.`);
        clearInterval(interval);
      }
    }

    setScanning(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <NavBar activeTab="" setActiveTab={() => {}} />
      {scanning && <ProgressBar progress={progress} scanning={scanning} />}

      <main className="max-w-6xl mx-auto px-4 py-12 space-y-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 text-center">
          Organization OCR Scan
        </h1>
        <p className="text-center text-gray-700 max-w-2xl mx-auto">
          Upload supplement labels for team or organizational review. Ensure all substances 
          are safe for athletes. This tool is <strong>not 100% comprehensive</strong>; final approval 
          should always be verified with your head athletic trainer or sports nutritionist.
        </p>

        {/* Batch Upload Card */}
        <div className="w-full bg-white p-6 rounded-2xl shadow-md border border-blue-100 mx-auto">
          <OCRUpload onBatchScan={handleOCRBatchScan} multiple />
        </div>

        {error && <p className="text-red-500 text-center">{error}</p>}

        {/* Scan Results for each uploaded file */}
        {ocrTextList.map((ocrText, index) => (
          <div key={index} className="w-full bg-white p-6 rounded-2xl shadow-md border border-blue-100 mx-auto mt-4">
            <h2 className="text-xl font-bold mb-2">File {index + 1} Results</h2>
            <OCRScanResults
              ocrText={ocrText}
              matchedSubstances={matchedSubstancesList[index]}
            />
          </div>
        ))}
      </main>
    </div>
  );
}
