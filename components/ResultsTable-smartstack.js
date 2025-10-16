// components/ResultsTable-smartstack.js
"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";

/**
 * ResultsTableSmartstack
 *
 * Props:
 *  - matchedRecords: array of Airtable-like records for banned substances
 *      Each record is expected to be either:
 *        { id, fields: { "Substance Name", "Synonyms", "Banned By", "Ban Type", "Dosage Limit", "Notes", "Source / Citation", "Benefits", "Weaknesses", "Nutrient Antagonism" } }
 *      or a flattened object with similar keys (the component is defensive).
 *
 *  - matchedIngredients: array of Airtable-like records for detected ingredients
 *      Each record is expected to be either:
 *        { id, fields: { "Name"|"Ingredient Name", "Synonyms (Extended)", "PubChem CID", "Pharmacology Notes", "Benefits", "Weaknesses", "Nutrient Antagonism", "Sources / References" } }
 *      or a flattened object with similar keys (the component is defensive).
 *
 * Behavior:
 *  - Renders a banned-substances table with filter pills for Ban Type
 *  - Renders an ingredients-detected table directly below
 *  - Each row in the banned table is expandable (click row) to reveal extended fields including Benefits, Weaknesses, Nutrient Antagonism
 *  - Horizontal scroll gradients + mobile swipe hint for both tables
 *  - Does not fetch any data; expects parent to supply arrays
 */

const BAN_TYPE_COLORS = [
  { label: "Prohibited", color: "#d62828" },
  { label: "Limited to Out of Competition", color: "#f77f00" },
  { label: "Particular Sports", color: "#3fb0ac" },
];

function safeField(rec, ...keys) {
  if (!rec) return "";
  if (rec.fields) {
    for (const k of keys) {
      if (rec.fields[k] !== undefined && rec.fields[k] !== null && rec.fields[k] !== "") return rec.fields[k];
    }
  }
  for (const k of keys) {
    if (rec[k] !== undefined && rec[k] !== null && rec[k] !== "") return rec[k];
  }
  return "";
}

function cell(v) {
  if (v === undefined || v === null) return "-";
  if (typeof v === "string" && v.trim() === "") return "-";
  return v;
}

export default function ResultsTableSmartstack({ matchedRecords = [], matchedIngredients = [] }) {
  // Banned table state
  const [activeBanType, setActiveBanType] = useState(null);
  const [expandedRows, setExpandedRows] = useState({}); // { id: true }
  const scrollRefBanned = useRef(null);
  const [showLeftShadowBanned, setShowLeftShadowBanned] = useState(false);
  const [showRightShadowBanned, setShowRightShadowBanned] = useState(false);
  const [showSwipeHintBanned, setShowSwipeHintBanned] = useState(false);
  const [fadeHintBanned, setFadeHintBanned] = useState(false);

  // Ingredients table state
  const scrollRefIng = useRef(null);
  const [showLeftShadowIng, setShowLeftShadowIng] = useState(false);
  const [showRightShadowIng, setShowRightShadowIng] = useState(false);
  const [showSwipeHintIng, setShowSwipeHintIng] = useState(false);
  const [fadeHintIng, setFadeHintIng] = useState(false);

  // Derived - filtered banned records
  const filteredBanned = useMemo(() => {
    if (!activeBanType) return matchedRecords || [];
    return (matchedRecords || []).filter((r) => {
      const b = (safeField(r, "Ban Type") || "").toString();
      return b === activeBanType;
    });
  }, [matchedRecords, activeBanType]);

  // If any matchedBanned or matchedIngredients provide extended fields, we'll show them in details.
  const anyBannedHasExtended = useMemo(() => {
    for (const r of matchedRecords || []) {
      if (safeField(r, "Benefits", "Weaknesses", "Nutrient Antagonism")) return true;
    }
    return false;
  }, [matchedRecords]);

  // Detect if ingredient results contain some of the 'display' fields (for columns)
  const anyIngredientHasPubchem = useMemo(() => {
    for (const r of matchedIngredients || []) {
      if (safeField(r, "PubChem CID")) return true;
    }
    return false;
  }, [matchedIngredients]);

  // Scroll helpers for banned
  useEffect(() => {
    const el = scrollRefBanned.current;
    if (!el) return;
    const checkScrollable = () => {
      if (el.scrollWidth > el.clientWidth) {
        setShowSwipeHintBanned(true);
        setFadeHintBanned(true);
      } else {
        setShowSwipeHintBanned(false);
        setFadeHintBanned(false);
      }
      setShowLeftShadowBanned(el.scrollLeft > 0);
      setShowRightShadowBanned(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
    };
    checkScrollable();
    const onScroll = () => {
      setShowLeftShadowBanned(el.scrollLeft > 0);
      setShowRightShadowBanned(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
      if (showSwipeHintBanned && el.scrollLeft > 5) setShowSwipeHintBanned(false);
    };
    el.addEventListener("scroll", onScroll);
    const onResize = () => checkScrollable();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [filteredBanned, showSwipeHintBanned]);

  // Auto-hide banned swipe hint
  useEffect(() => {
    if (!showSwipeHintBanned) return;
    const t1 = setTimeout(() => setFadeHintBanned(false), 2500);
    const t2 = setTimeout(() => setShowSwipeHintBanned(false), 3000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [showSwipeHintBanned]);

  // Scroll helpers for ingredients
  useEffect(() => {
    const el = scrollRefIng.current;
    if (!el) return;
    const checkScrollable = () => {
      if (el.scrollWidth > el.clientWidth) {
        setShowSwipeHintIng(true);
        setFadeHintIng(true);
      } else {
        setShowSwipeHintIng(false);
        setFadeHintIng(false);
      }
      setShowLeftShadowIng(el.scrollLeft > 0);
      setShowRightShadowIng(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
    };
    checkScrollable();
    const onScroll = () => {
      setShowLeftShadowIng(el.scrollLeft > 0);
      setShowRightShadowIng(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
      if (showSwipeHintIng && el.scrollLeft > 5) setShowSwipeHintIng(false);
    };
    el.addEventListener("scroll", onScroll);
    const onResize = () => checkScrollable();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [matchedIngredients, showSwipeHintIng]);

  // Auto-hide ingredients swipe hint
  useEffect(() => {
    if (!showSwipeHintIng) return;
    const t1 = setTimeout(() => setFadeHintIng(false), 2500);
    const t2 = setTimeout(() => setShowSwipeHintIng(false), 3000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [showSwipeHintIng]);

  // Badge renderer
  const getBadge = (banType) => {
    const c = BAN_TYPE_COLORS.find((b) => b.label === banType)?.color || "#999";
    return (
      <span
        className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
        style={{
          color: "white",
          backgroundColor: c,
          boxShadow: "0 0 0 1px rgba(255,255,255,0.08) inset",
        }}
      >
        {banType || "None"}
      </span>
    );
  };

  const toggleExpand = (id) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="w-full relative space-y-6">
      {/* ---------------- BANNED SUBSTANCES ---------------- */}
      <div>
        <div className="flex items-center justify-between mb-3 gap-3">
          <div className="flex gap-3 flex-wrap">
            {BAN_TYPE_COLORS.map((b) => (
              <button
                key={b.label}
                onClick={() => setActiveBanType(activeBanType === b.label ? null : b.label)}
                className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-colors text-sm ${
                  activeBanType === b.label ? "border-white/50 bg-white/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: b.color }} />
                <span className="font-medium">{b.label}</span>
              </button>
            ))}
            {activeBanType && (
              <button onClick={() => setActiveBanType(null)} className="text-sm text-white/80 underline underline-offset-2">
                Clear filter
              </button>
            )}
          </div>

          <div className="text-sm text-gray-300">
            {filteredBanned.length} detected
          </div>
        </div>

        <div className="relative rounded-xl border border-white/10 bg-gray-900/60 overflow-hidden">
          <div
            ref={scrollRefBanned}
            className="overflow-x-auto overflow-y-auto"
            style={{ scrollBehavior: "smooth", WebkitOverflowScrolling: "touch" }}
          >
            <table className="min-w-full text-sm">
              <thead className="bg-[#2a3d4d] text-white/95 sticky top-0 z-10">
                <tr>
                  {[
                    "Substance Name",
                    "Synonyms",
                    "Banned By",
                    "Ban Type",
                    "Dosage Limit",
                    "Notes",
                    "Source / Citation",
                  ].map((h) => (
                    <th key={h} className="px-4 py-2 text-left font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredBanned.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-white/70">
                      No banned substances detected for this filter.
                    </td>
                  </tr>
                ) : (
                  filteredBanned.map((rec, i) => {
                    const id = rec.id || i;
                    const f = rec.fields || rec || {};
                    const name = safeField(rec, "Substance Name", "Name") || "-";
                    const synonyms = safeField(rec, "Synonyms") || "-";
                    const bannedBy = safeField(rec, "Banned By") || "-";
                    const banType = safeField(rec, "Ban Type") || "";
                    const dosage = safeField(rec, "Dosage Limit") || "-";
                    const notes = safeField(rec, "Notes") || "-";
                    const source = safeField(rec, "Source / Citation", "Source") || "-";

                    const benefits = safeField(rec, "Benefits");
                    const weaknesses = safeField(rec, "Weaknesses");
                    const antagonism = safeField(rec, "Nutrient Antagonism");

                    const isExpanded = !!expandedRows[id];

                    return (
                      <React.Fragment key={id}>
                        <tr
                          className={`cursor-pointer ${i % 2 === 0 ? "bg-white/5" : "bg-white/0"} hover:bg-white/3`}
                          onClick={() => toggleExpand(id)}
                        >
                          <td className="px-4 py-2 text-white">{cell(name)}</td>
                          <td className="px-4 py-2 text-white/80">{cell(synonyms)}</td>
                          <td className="px-4 py-2 text-white/80">{cell(bannedBy)}</td>
                          <td className="px-4 py-2">{getBadge(banType)}</td>
                          <td className="px-4 py-2 text-white/80">{cell(dosage)}</td>
                          <td className="px-4 py-2 text-white/80">{cell(notes)}</td>
                          <td className="px-4 py-2 text-white/80 break-words">{cell(source)}</td>
                        </tr>

                        {/* Expanded details row */}
                        {isExpanded && (benefits || weaknesses || antagonism) && (
                          <tr>
                            <td colSpan={7} className="px-4 py-3 bg-white/2">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-100">
                                <div>
                                  <div className="font-semibold text-xs text-gray-200 mb-1">Benefits</div>
                                  <div className="text-gray-100 text-sm">{cell(benefits)}</div>
                                </div>
                                <div>
                                  <div className="font-semibold text-xs text-gray-200 mb-1">Weaknesses</div>
                                  <div className="text-gray-100 text-sm">{cell(weaknesses)}</div>
                                </div>
                                <div>
                                  <div className="font-semibold text-xs text-gray-200 mb-1">Nutrient Antagonism</div>
                                  <div className="text-gray-100 text-sm">{cell(antagonism)}</div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Left gradient (banned) */}
          {showLeftShadowBanned && (
            <div
              className="pointer-events-none absolute top-0 left-0 bottom-0 w-8 z-20"
              style={{ background: "linear-gradient(to right, rgba(26,32,44,0.95), transparent)" }}
            />
          )}

          {/* Right gradient (banned) */}
          {showRightShadowBanned && (
            <div
              className="pointer-events-none absolute top-0 right-0 bottom-0 w-8 z-20"
              style={{ background: "linear-gradient(to left, rgba(26,32,44,0.95), transparent)" }}
            />
          )}

          {/* Mobile swipe hint (banned) */}
          {showSwipeHintBanned && (
            <div
              className={`pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-white/60 text-xs select-none z-30 transition-opacity duration-500 ${
                fadeHintBanned ? "opacity-100" : "opacity-0"
              }`}
            >
              ← Swipe to scroll →
            </div>
          )}
        </div>
      </div>

      {/* ---------------- INGREDIENTS DETECTED ---------------- */}
      <div>
        <div className="flex items-center justify-between mb-3 gap-3">
          <h3 className="text-white font-semibold">Ingredients Detected</h3>
          <div className="text-sm text-gray-300">{(matchedIngredients || []).length} found</div>
        </div>

        <div className="relative rounded-xl border border-white/10 bg-gray-900/60 overflow-hidden">
          <div
            ref={scrollRefIng}
            className="overflow-x-auto overflow-y-auto"
            style={{ scrollBehavior: "smooth", WebkitOverflowScrolling: "touch" }}
          >
            <table className="min-w-full text-sm">
              <thead className="bg-[#2a3d4d] text-white/95 sticky top-0 z-10">
                <tr>
                  {["Ingredient Name", "Synonyms", anyIngredientHasPubchem ? "PubChem CID" : null, "Notes / Pharmacology", "Source / References"]
                    .filter(Boolean)
                    .map((h) => (
                      <th key={h} className="px-4 py-2 text-left font-semibold">
                        {h}
                      </th>
                    ))}
                </tr>
              </thead>

              <tbody>
                {(matchedIngredients || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-white/70">
                      No ingredients detected from the current scan.
                    </td>
                  </tr>
                ) : (
                  (matchedIngredients || []).map((rec, i) => {
                    const id = rec.id || i;
                    const f = rec.fields || rec || {};
                    const displayName = safeField(rec, "Name", "Ingredient Name", "Ingredient", "name") || "-";
                    const syn = safeField(rec, "Synonyms (Extended)", "Synonyms") || "-";
                    const pub = safeField(rec, "PubChem CID") || "-";
                    const pharm = safeField(rec, "Pharmacology Notes", "Notes") || "-";
                    const src = safeField(rec, "Sources / References", "Source / References", "Source", "Source / Citation") || "-";

                    return (
                      <tr key={id} className={i % 2 === 0 ? "bg-white/5" : "bg-white/0"}>
                        <td className="px-4 py-2 text-white">{cell(displayName)}</td>
                        <td className="px-4 py-2 text-white/80">{cell(syn)}</td>
                        {anyIngredientHasPubchem && <td className="px-4 py-2 text-white/80">{cell(pub)}</td>}
                        <td className="px-4 py-2 text-white/80">{cell(pharm)}</td>
                        <td className="px-4 py-2 text-white/80 break-words">{cell(src)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Left gradient (ingredients) */}
          {showLeftShadowIng && (
            <div
              className="pointer-events-none absolute top-0 left-0 bottom-0 w-8 z-20"
              style={{ background: "linear-gradient(to right, rgba(26,32,44,0.95), transparent)" }}
            />
          )}

          {/* Right gradient (ingredients) */}
          {showRightShadowIng && (
            <div
              className="pointer-events-none absolute top-0 right-0 bottom-0 w-8 z-20"
              style={{ background: "linear-gradient(to left, rgba(26,32,44,0.95), transparent)" }}
            />
          )}

          {/* Mobile swipe hint (ingredients) */}
          {showSwipeHintIng && (
            <div
              className={`pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-white/60 text-xs select-none z-30 transition-opacity duration-500 ${
                fadeHintIng ? "opacity-100" : "opacity-0"
              }`}
            >
              ← Swipe to scroll →
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
