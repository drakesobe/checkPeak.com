// pages/ocr.js
import { useState, useEffect } from "react";
import NavBar from "../components/NavBar";
import OCRUpload from "../components/OCRUpload";
import OCRScanResults from "../components/OCRScanResults";
import OCRSearchResults from "../components/OCRSearchResults";
import SearchBar from "../components/SearchBar";
import ProgressBar from "../components/ProgressBar";

export default function OCRPage() {
  const [activeTab, setActiveTab] = useState("Scan");
  const [ocrText, setOcrText] = useState("");
  const [matchedSubstances, setMatchedSubstances] = useState([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [scanning, setScanning] = useState(false);

  // Debounced search after typing or OCR
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setError("");
      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
        const data = await res.json();

        if (res.status === 429) {
          setError(data.error || "Too many requests. Please wait a few seconds.");
          return;
        }

        if (!Array.isArray(data.records)) {
          console.warn("Unexpected API response:", data);
          setError("Something went wrong. Please try again.");
          return;
        }

        setSearchResults(data.records);
      } catch (err) {
        console.error("Search error:", err);
        setError("Something went wrong. Please try again.");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  const handleOCRScan = async (text) => {
    setOcrText(text);
    setError("");
    setScanning(true);
    setProgress(0);

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
      setMatchedSubstances(data.records || []);
      clearInterval(interval);
      setProgress(100);
      setTimeout(() => setScanning(false), 500);
    } catch (err) {
      console.error("OCR check error:", err);
      setMatchedSubstances([]);
      setError("OCR scan failed. Try again.");
      clearInterval(interval);
      setProgress(0);
      setScanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <NavBar activeTab={activeTab} setActiveTab={setActiveTab} />
      {scanning && <ProgressBar progress={progress} scanning={scanning} />}

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Scan Tab */}
        {activeTab === "Scan" && (
          <>
            {/* Upload Card */}
            <div className="w-full bg-white p-6 rounded-2xl shadow-md mx-auto border border-blue-100">
              <OCRUpload onScan={handleOCRScan} />
            </div>

            {error && <p className="text-red-500 mt-2 text-center">{error}</p>}

            {/* Scan Results */}
            <div className="w-full bg-white p-6 rounded-2xl shadow-md mx-auto border border-blue-100 mt-4">
              <OCRScanResults ocrText={ocrText} matchedSubstances={matchedSubstances} />
            </div>
          </>
        )}

        {/* Search Tab */}
        {activeTab === "Search" && (
          <>
            <SearchBar value={query} onChange={setQuery} />
            {error && <p className="text-red-500 mt-2">{error}</p>}

            <div className="w-full bg-white p-6 rounded-2xl shadow-md mx-auto border border-blue-100 mt-4">
              <OCRSearchResults searchTerm={query} matchedSubstances={searchResults} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
