import { useState } from "react";
import NavBar from "../components/NavBar";
import SearchBar from "../components/SearchBar";
import OCRResults from "../components/OCRResults";
import { SpeedInsights } from "@vercel/speed-insights/next"

export default function HomePage() {
  const [activeTab, setActiveTab] = useState("Search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    setError("");
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      });
      const data = await res.json();
      setSearchResults(data.records || []);
    } catch (err) {
      console.error("Search error:", err);
      setSearchResults([]);
      setError("Search failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <NavBar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <h1 className="text-3xl font-bold text-gray-900">Search Substances</h1>

        <div className="bg-white p-6 rounded-2xl shadow-md border border-blue-100 space-y-4">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          <button
            style={{ backgroundColor: "#46769B" }}
            className="px-6 py-3 rounded-2xl text-white font-medium transition-colors hover:brightness-110"
            onClick={handleSearch}
          >
            Search
          </button>

          {error && <p className="text-red-500 mt-2">{error}</p>}
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-md border border-blue-100">
          <OCRResults ocrText="" matchedSubstances={searchResults} />
        </div>
      </main>
    </div>
  );
}
