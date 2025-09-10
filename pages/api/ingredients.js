import React, { useState } from "react";
import OCRSearchResults from "../components/OCRSearchResults";

export default function OCRSearchPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchTerm }),
      });

      if (!res.ok) {
        throw new Error("Failed to fetch data");
      }

      const data = await res.json();
      let filteredResults = data.records;

      // Optional: filter by searchTerm across ingredient name and synonyms
      const term = searchTerm.toLowerCase();
      filteredResults = filteredResults.filter(
        (r) =>
          (r.name && r.name.toLowerCase().includes(term)) ||
          (r.synonyms && r.synonyms.toLowerCase().includes(term))
      );

      setResults(filteredResults);
    } catch (err) {
      console.error(err);
      setError("There was an error fetching ingredients.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[2500px] mx-auto px-4 py-6 font-sans">
      <form
        onSubmit={handleSearch}
        className="flex flex-col md:flex-row gap-2 items-center mb-6"
      >
        <input
          type="text"
          placeholder="Search ingredient or substance..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
        >
          Search
        </button>
      </form>

      {loading && <p className="text-gray-500">Loading results...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {!loading && !error && results.length > 0 && (
        <OCRSearchResults searchTerm={searchTerm} matchedSubstances={results} />
      )}

      {!loading && !error && results.length === 0 && searchTerm && (
        <p className="text-gray-500 italic">No results found for "{searchTerm}"</p>
      )}
    </div>
  );
}
