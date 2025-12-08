"use client";

import { useState } from "react";
import SearchBar from "../components/SearchBar";
import OCRSearchResults from "../components/OCRSearchResults";

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [error, setError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const MIN_LENGTH = 2;

  const handleSearch = async (e) => {
    if (e) e.preventDefault();

    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < MIN_LENGTH) {
      setError(`Type at least ${MIN_LENGTH} characters to search.`);
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setError("");
    setIsSearching(true);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });

      const data = await res.json();
      setSearchResults(data.records || []);
      setHasSearched(true);
    } catch (err) {
      console.error("Search error:", err);
      setSearchResults([]);
      setHasSearched(false);
      setError("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleChange = (value) => {
    setSearchQuery(value);
    setError("");

    const trimmed = value.trim();
    if (!trimmed) {
      // Clear results when input is fully cleared
      setSearchResults([]);
      setHasSearched(false);
    }
  };

  const handleClear = () => {
    setSearchQuery("");
    setSearchResults([]);
    setError("");
    setHasSearched(false);
  };

  const hasResults = searchResults && searchResults.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16 space-y-8">
        {/* HEADER / HERO */}
        <section className="space-y-2">
          <span className="inline-flex items-center rounded-full border border-[#46769B]/30 bg-[#46769B]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#25445E]">
            Ingredient & substance lookup
          </span>

          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Search substances & ingredients
          </h1>

          <p className="max-w-2xl text-sm sm:text-base text-gray-600 leading-relaxed">
            Look up specific ingredients, potential aliases, and flagged substances in
            the PEAK database. Great for quick checks before you build or buy a stack.
          </p>
        </section>

        {/* MAIN LAYOUT: FORM + SIDE HINTS */}
        <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {/* SEARCH FORM */}
          <form
            onSubmit={handleSearch}
            className="bg-white p-4 sm:p-6 rounded-2xl shadow-md border border-blue-100 space-y-4"
          >
            {/* Search field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="peak-search"
                  className="text-xs font-semibold uppercase tracking-wide text-gray-500"
                >
                  Search by ingredient, alias, or partial name
                </label>

                {searchQuery && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-[11px] text-gray-500 hover:text-gray-700 underline-offset-2 hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>

              <SearchBar
                id="peak-search"
                value={searchQuery}
                onChange={handleChange}
              />

              <p className="text-[11px] text-gray-500">
                Examples:{" "}
                <span className="font-semibold text-gray-700">
                  &quot;DMAA&quot;, &quot;Yohimbine&quot;, &quot;1,3-dimethylamylamine&quot;
                </span>
                . You can also search partial names (e.g. &quot;phenyl&quot;).
              </p>
            </div>

            {/* Actions + error */}
            <div className="space-y-2">
              <button
                type="submit"
                disabled={isSearching}
                style={{ backgroundColor: "#46769B" }}
                className={`inline-flex items-center justify-center w-full sm:w-auto px-6 py-3 rounded-2xl text-white font-medium transition-colors hover:brightness-110 ${
                  isSearching ? "opacity-80 cursor-not-allowed" : ""
                }`}
              >
                {isSearching ? "Searching…" : "Search"}
              </button>

              {error && (
                <p className="text-red-500 text-xs sm:text-sm mt-1">
                  {error}
                </p>
              )}
            </div>

            {/* Hint for minimum length if user has typed something short */}
            {!error && searchQuery.trim() && searchQuery.trim().length < MIN_LENGTH && (
              <p className="text-[11px] text-gray-500">
                Add a bit more detail (at least {MIN_LENGTH} characters) to run a search.
              </p>
            )}
          </form>

          {/* SIDE PANEL: search tips */}
          <aside className="hidden lg:block">
            <div className="bg-white/80 backdrop-blur-sm border border-blue-100 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Tips for better results
              </h2>
              <ul className="text-xs text-gray-600 space-y-2">
                <li>
                  <span className="font-semibold text-gray-800">
                    Try ingredient names first.
                  </span>{" "}
                  For example, &quot;synephrine&quot; instead of a brand name.
                </li>
                <li>
                  If you know an{" "}
                  <span className="font-semibold text-gray-800">alias or slang</span>, you
                  can search that too — some substances appear under multiple names.
                </li>
                <li>
                  For complex labels, use the{" "}
                  <span className="font-semibold text-gray-800">Scan a Label</span> tool on
                  the home page to analyze the full ingredient panel.
                </li>
                <li className="text-[10px] text-gray-500 pt-1 border-t border-dashed border-gray-200">
                  PEAK surfaces potential matches and risk flags but does not replace
                  official rulings from your governing body or medical professional.
                </li>
              </ul>
            </div>
          </aside>
        </section>

        {/* RESULTS SECTION */}
        <section className="bg-white p-4 sm:p-6 rounded-2xl shadow-md border border-blue-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-gray-800">
                Search results
              </h2>
              <p className="text-[11px] text-gray-500">
                Matches are based on the current PEAK ingredient and substance database.
              </p>
            </div>

            {hasSearched && (
              <p className="text-[11px] text-gray-500 text-left sm:text-right">
                {hasResults ? (
                  <>
                    Found{" "}
                    <span className="font-semibold text-gray-800">
                      {searchResults.length}
                    </span>{" "}
                    match{searchResults.length !== 1 ? "es" : ""} for{" "}
                    <span className="font-semibold text-gray-800">
                      &quot;{searchQuery.trim()}&quot;
                    </span>
                    .
                  </>
                ) : (
                  <>
                    No direct matches found for{" "}
                    <span className="font-semibold text-gray-800">
                      &quot;{searchQuery.trim()}&quot;
                    </span>
                    .
                  </>
                )}
              </p>
            )}
          </div>

          {/* Content area */}
          {isSearching && (
            <div className="py-10 text-center text-sm text-gray-500">
              Searching the database…
            </div>
          )}

          {!isSearching && !hasSearched && (
            <div className="py-10 text-center text-sm text-gray-500">
              Start by typing an ingredient or substance name above, then hit{" "}
              <span className="font-semibold">Search</span>.
            </div>
          )}

          {!isSearching && hasSearched && hasResults && (
            <OCRSearchResults
              searchTerm={searchQuery}
              matchedSubstances={searchResults}
            />
          )}

          {!isSearching && hasSearched && !hasResults && (
            <div className="py-8 text-center text-sm text-gray-500">
              <p className="mb-2">
                No matches yet for{" "}
                <span className="font-semibold text-gray-800">
                  &quot;{searchQuery.trim()}&quot;
                </span>
                .
              </p>
              <p className="text-[11px] max-w-md mx-auto">
                Try adjusting the spelling, searching a shorter portion of the word, or
                looking up a related ingredient. If you think something is missing, you
                can also use{" "}
                <span className="font-semibold text-gray-800">Suggest an Ingredient</span>{" "}
                in the footer to flag it for review.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
