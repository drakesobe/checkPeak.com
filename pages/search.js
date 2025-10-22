"use client";

import { useState } from "react";
import NavBar from "../components/NavBar";
import SearchBar from "../components/SearchBar";
import OCRSearchResults from "../components/OCRSearchResults";

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [error, setError] = useState("");

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
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
      <NavBar activeTab="Search" setActiveTab={() => {}} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Page title */}
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center sm:text-left">
          Search Substances & Ingredients
        </h1>

        {/* Search form */}
        <form
          onSubmit={handleSearch}
          className="bg-white p-4 sm:p-6 rounded-2xl shadow-md border border-blue-100 space-y-4"
        >
          <SearchBar value={searchQuery} onChange={setSearchQuery} />

          <button
            type="submit"
            style={{ backgroundColor: "#46769B" }}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl text-white font-medium transition-colors hover:brightness-110"
          >
            Search
          </button>

          {error && (
            <p className="text-red-500 text-sm sm:text-base mt-2 text-center sm:text-left">
              {error}
            </p>
          )}
        </form>

        {/* Results section */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-md border border-blue-100 overflow-x-auto">
          <OCRSearchResults
            searchTerm={searchQuery}
            matchedSubstances={searchResults}
          />
        </div>
      </main>
    </div>
  );
}
