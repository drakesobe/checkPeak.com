"use client";

import { useState }      from "react";
import SearchBar         from "../components/SearchBar";
import OCRSearchResults  from "../components/OCRSearchResults";
import { DS }            from "../components/scanResultsTokens";

// DS colors now come from scanResultsTokens - single source of truth.
// Component-scoped font classes (sp- prefix avoids collisions with sr- / cp-)
const PAGE_FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=Barlow:wght@400;500;600;700&display=swap');
  .sp-display { font-family: 'Barlow Condensed', sans-serif; letter-spacing: 0.03em; }
  .sp-body    { font-family: 'Barlow', sans-serif; }
`;

export default function SearchPage() {
  const [searchQuery, setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [error, setError]               = useState("");
  const [isSearching, setIsSearching]   = useState(false);
  const [hasSearched, setHasSearched]   = useState(false);
  const [tipsOpen, setTipsOpen]         = useState(false);

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
    if (!value.trim()) {
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

  const TipsContent = () => (
    <ul className="sp-body space-y-3">
      {[
        {
          bold: "Try ingredient names first.",
          rest: 'For example, "synephrine" instead of a brand name.',
        },
        {
          bold: "Search aliases or slang.",
          rest: "Some substances appear under multiple names - searching the alias works too.",
        },
        {
          bold: "Partial names work.",
          rest: 'Try "phenyl" to find all phenyl-containing compounds.',
        },
      ].map(({ bold, rest }) => (
        <li key={bold} className="flex gap-2.5 items-start">
          <span
            className="mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: DS.brand, marginTop: 6 }}
          />
          <p className="text-xs leading-relaxed" style={{ color: DS.bodyText }}>
            <span className="font-semibold">{bold}</span>{" "}
            <span style={{ color: DS.labelText }}>{rest}</span>
          </p>
        </li>
      ))}
      <li
        className="text-[10px] pt-2 leading-relaxed"
        style={{
          color: DS.dimText,
          borderTop: `1px dashed ${DS.border}`,
        }}
      >
        PEAK surfaces potential matches and risk flags but does not replace
        official rulings from your governing body or medical professional.
      </li>
    </ul>
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PAGE_FONTS }} />

      <div
        className="sp-body min-h-screen"
        style={{ backgroundColor: DS.pageBg }}
      >
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-20 space-y-8">

          {/* ── PAGE HEADER ─────────────────────────────────────────── */}
          <section className="space-y-3">
            <span
              className="sp-body inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest"
              style={{
                backgroundColor: DS.brandBg,
                color: DS.brand,
                border: `1px solid ${DS.brandBorder}`,
              }}
            >
              Ingredient &amp; substance lookup
            </span>

            <h1
              className="sp-display"
              style={{
                fontSize: "clamp(1.6rem, 4vw, 2.2rem)",
                fontWeight: 800,
                color: DS.bodyText,
                lineHeight: 1.15,
              }}
            >
              Search substances &amp; ingredients
            </h1>

            <p
              className="sp-body text-sm leading-relaxed max-w-2xl"
              style={{ color: DS.labelText }}
            >
              Look up specific ingredients, potential aliases, and flagged
              substances in the PEAK database. Great for quick checks before
              you build or buy a stack.
            </p>
          </section>

          {/* ── SEARCH FORM + TIPS ──────────────────────────────────── */}
          <section className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">

            {/* Search form */}
            <form
              onSubmit={handleSearch}
              className="space-y-4 rounded-2xl p-5 sm:p-6"
              style={{
                backgroundColor: DS.cardBg,
                border: `1.5px solid ${DS.border}`,
                boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
              }}
            >
              {/* Label row */}
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="peak-search"
                  className="sp-body text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: DS.labelText }}
                >
                  Search by ingredient, alias, or partial name
                </label>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="sp-body text-[11px] font-semibold transition-colors"
                    style={{ color: DS.dimText }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = DS.brand)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = DS.dimText)}
                  >
                    Clear ✕
                  </button>
                )}
              </div>

              {/* Input */}
              <SearchBar
                id="peak-search"
                value={searchQuery}
                onChange={handleChange}
              />

              {/* Helper text */}
              <p className="sp-body text-[11px]" style={{ color: DS.dimText }}>
                Examples:{" "}
                <span
                  className="font-semibold"
                  style={{ color: DS.bodyText }}
                >
                  &quot;DMAA&quot;, &quot;Yohimbine&quot;,
                  &quot;1,3-dimethylamylamine&quot;
                </span>
              </p>

              {/* Min length hint */}
              {!error &&
                searchQuery.trim() &&
                searchQuery.trim().length < MIN_LENGTH && (
                  <p
                    className="sp-body text-[11px]"
                    style={{ color: DS.dimText }}
                  >
                    Add at least {MIN_LENGTH} characters to search.
                  </p>
                )}

              {/* Submit + error */}
              <div className="space-y-2">
                <button
                  type="submit"
                  disabled={isSearching}
                  className="sp-body w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xl text-sm font-bold text-white transition-all"
                  style={{
                    backgroundColor: DS.brand,
                    opacity: isSearching ? 0.75 : 1,
                    cursor: isSearching ? "not-allowed" : "pointer",
                    letterSpacing: "0.04em",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSearching) e.currentTarget.style.filter = "brightness(1.12)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.filter = "none";
                  }}
                >
                  {isSearching ? (
                    <>
                      <span
                        className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"
                      />
                      Searching…
                    </>
                  ) : (
                    "Search →"
                  )}
                </button>

                {error && (
                  <p className="sp-body text-xs text-red-500 mt-1">{error}</p>
                )}
              </div>

              {/* Mobile tips toggle */}
              <div
                className="lg:hidden pt-4"
                style={{ borderTop: `1px solid ${DS.border}` }}
              >
                <button
                  type="button"
                  onClick={() => setTipsOpen((v) => !v)}
                  className="sp-body flex items-center justify-between w-full text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: DS.labelText }}
                >
                  Tips for better results
                  <span style={{ color: DS.dimText }}>{tipsOpen ? "▲" : "▼"}</span>
                </button>
                {tipsOpen && (
                  <div className="mt-3">
                    <TipsContent />
                  </div>
                )}
              </div>
            </form>

            {/* Desktop tips panel */}
            <aside className="hidden lg:block">
              <div
                className="rounded-2xl p-5 space-y-4 h-full"
                style={{
                  backgroundColor: DS.cardBg,
                  border: `1.5px solid ${DS.border}`,
                  boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
                }}
              >
                <p
                  className="sp-body text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: DS.labelText }}
                >
                  Tips for better results
                </p>
                <TipsContent />
              </div>
            </aside>
          </section>

          {/* ── RESULTS SECTION ─────────────────────────────────────── */}
          <section
            className="rounded-2xl p-5 sm:p-6"
            style={{
              backgroundColor: DS.cardBg,
              border: `1.5px solid ${DS.border}`,
              boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
            }}
          >
            {/* Results header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
              <div>
                <h2
                  className="sp-display"
                  style={{ fontSize: "1rem", fontWeight: 700, color: DS.bodyText }}
                >
                  Search results
                </h2>
                <p
                  className="sp-body text-[11px] mt-0.5"
                  style={{ color: DS.dimText }}
                >
                  Matches are based on the current PEAK ingredient and substance database.
                </p>
              </div>

              {hasSearched && (
                <p
                  className="sp-body text-[11px] text-left sm:text-right"
                  style={{ color: DS.labelText }}
                >
                  {hasResults ? (
                    <>
                      Found{" "}
                      <span className="font-bold" style={{ color: DS.bodyText }}>
                        {searchResults.length}
                      </span>{" "}
                      match{searchResults.length !== 1 ? "es" : ""} for{" "}
                      <span className="font-bold" style={{ color: DS.bodyText }}>
                        &quot;{searchQuery.trim()}&quot;
                      </span>
                    </>
                  ) : (
                    <>
                      No matches for{" "}
                      <span className="font-bold" style={{ color: DS.bodyText }}>
                        &quot;{searchQuery.trim()}&quot;
                      </span>
                    </>
                  )}
                </p>
              )}
            </div>

            {/* ── States ── */}

            {/* Searching */}
            {isSearching && (
              <div className="py-14 flex flex-col items-center gap-3">
                <span
                  className="inline-block w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: `${DS.brand}40`, borderTopColor: DS.brand }}
                />
                <p className="sp-body text-sm" style={{ color: DS.labelText }}>
                  Searching the database…
                </p>
              </div>
            )}

            {/* Idle - nothing searched yet */}
            {!isSearching && !hasSearched && (
              <div className="py-14 text-center space-y-2">
                <div
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl mx-auto mb-2"
                  style={{
                    backgroundColor: DS.brandBg,
                    border: `1px solid ${DS.brandBorder}`,
                  }}
                >
                  <span style={{ fontSize: 18, color: DS.brand }}>⌕</span>
                </div>
                <p className="sp-body text-sm" style={{ color: DS.bodyText }}>
                  Enter an ingredient or substance above to get started.
                </p>
                <p className="sp-body text-xs" style={{ color: DS.dimText }}>
                  Try &quot;Caffeine&quot;, &quot;DMAA&quot;, or &quot;Beta Alanine&quot;
                </p>
              </div>
            )}

            {/* Results */}
            {!isSearching && hasSearched && hasResults && (
              <OCRSearchResults
                searchTerm={searchQuery}
                matchedSubstances={searchResults}
              />
            )}

            {/* No results */}
            {!isSearching && hasSearched && !hasResults && (
              <div className="py-12 text-center space-y-4">
                <div
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl mx-auto"
                  style={{
                    backgroundColor: DS.brandBg,
                    border: `1px solid ${DS.brandBorder}`,
                  }}
                >
                  <span style={{ fontSize: 18, color: DS.brand }}>?</span>
                </div>
                <p className="sp-body text-sm" style={{ color: DS.bodyText }}>
                  No matches for{" "}
                  <span className="font-bold">&quot;{searchQuery.trim()}&quot;</span>
                </p>
                <p
                  className="sp-body text-xs max-w-xs mx-auto"
                  style={{ color: DS.labelText }}
                >
                  Try a shorter term, an alternate spelling, or a common alias.
                </p>
                <a
                  href="/suggest-ingredient"
                  className="sp-body inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors"
                  style={{
                    backgroundColor: DS.brandBg,
                    color: DS.brand,
                    border: `1px solid ${DS.brandBorder}`,
                  }}
                >
                  Suggest a missing ingredient →
                </a>
              </div>
            )}
          </section>
        </main>
      </div>
    </>
  );
}