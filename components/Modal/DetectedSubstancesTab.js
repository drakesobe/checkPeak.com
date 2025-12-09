"use client";

import React, { useEffect, useState, useMemo } from "react";

export default function DetectedSubstancesTab({
  matchedRecords = [],
  error = "",
  hideCounts = false,
}) {
  const [expanded, setExpanded] = useState({});
  const [records, setRecords] = useState(matchedRecords);

  // Normalize Airtable-style records into a uniform shape
  const normalizedRecords = useMemo(() => {
    if (!records || !records.length) return [];

    return records.map((r) => {
      // Airtable-style
      const f = r?.fields || r || {};
      return {
        id: r.id || r.recordId || f.id || Math.random().toString(36).slice(2),
        name:
          f["Substance Name"] ||
          f["Name"] ||
          f["Ingredient Name"] ||
          r.name ||
          "Unnamed substance",
        banType: (f["Ban Type"] || r.banType || "").toString().trim(),
        bannedBy: f["Banned By"] || r.bannedBy || "",
        synonyms:
          f["Synonyms"] ||
          f["Synonyms (Extended)"] ||
          r.synonyms ||
          "",
        dosageLimit: f["Dosage Limit"] || r.dosageLimit || "",
        notes: f["Notes"] || f["Pharmacology Notes"] || r.notes || "",
        benefits: (f["Benefits"] || r.benefits || "").toString(),
        weaknesses: (f["Weaknesses"] || r.weaknesses || "").toString(),
        antagonisms:
          (f["Nutrient Antagonism"] ||
            f["Nutrient Antagonisms"] ||
            f["Nutrient Interactions"] ||
            r.antagonisms ||
            "") + "",
        source:
          f["Source / Citation"] ||
          f["Sources / References"] ||
          f["Source / Notes"] ||
          r.source ||
          "",
      };
    });
  }, [records]);

  // Ban type color map (same 3-tier scheme as the rest of the app)
  const banTypeStyles = {
    Prohibited: {
      pillBg: "rgba(214,40,40,0.15)",
      pillText: "#FCA5A5",
      leftBorder: "#D62828",
    },
    "Limited to Out of Competition": {
      pillBg: "rgba(247,127,0,0.14)",
      pillText: "#FED7AA",
      leftBorder: "#F77F00",
    },
    "Particular Sports": {
      pillBg: "rgba(0,48,73,0.28)",
      pillText: "#BFDBFE",
      leftBorder: "#003049",
    },
    default: {
      pillBg: "rgba(148,163,184,0.22)",
      pillText: "#E5E7EB",
      leftBorder: "#4B5563",
    },
  };

  // Keep local state in sync when parent passes fresh scan data
  useEffect(() => {
    setRecords(matchedRecords || []);
    setExpanded({}); // collapse when new results arrive
  }, [matchedRecords]);

  const toggleRow = (id) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  // Aggregate counts by ban type for optional summary chips
  const countsByBanType = useMemo(() => {
    const counts = {};
    normalizedRecords.forEach((rec) => {
      const key = rec.banType || "Not Classified";
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [normalizedRecords]);

  // ----- Error + empty states -----
  if (error) {
    return (
      <div className="mt-4 rounded-xl bg-red-900/40 border border-red-500/60 px-3 py-2 text-center text-sm text-red-100">
        ⚠️ Error loading detected substances:{" "}
        <span className="font-medium">{error}</span>
      </div>
    );
  }

  if (!normalizedRecords.length) {
    return (
      <p className="text-gray-300 text-center mt-4 text-sm">
        ✅ No banned substances detected from this label scan.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Optional summary chips (hidden when `hideCounts` is true, like in CompareModal) */}
      {!hideCounts && (
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(countsByBanType).map(([banType, count]) => {
            const style = banTypeStyles[banType] || banTypeStyles.default;
            return (
              <span
                key={banType}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 font-semibold"
                style={{
                  backgroundColor: style.pillBg,
                  color: style.pillText,
                }}
              >
                <span>{banType}</span>
                <span className="text-[10px] text-white/70">({count})</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Accordion cards – mobile-first, compare-friendly layout */}
      <div className="space-y-3">
        {normalizedRecords.map((rec) => {
          const {
            id,
            name,
            banType,
            bannedBy,
            synonyms,
            dosageLimit,
            notes,
            benefits,
            weaknesses,
            antagonisms,
            source,
          } = rec;

          const isOpen = !!expanded[id];
          const style = banTypeStyles[banType] || banTypeStyles.default;

          const whatItDoesText = benefits || notes || "";

          return (
            <div
              key={id}
              className="rounded-2xl border bg-gray-900/80 shadow-sm overflow-hidden transition hover:shadow-md"
              style={{
                borderColor: "rgba(148,163,184,0.35)",
                borderLeftWidth: 4,
                borderLeftColor: style.leftBorder,
              }}
            >
              {/* HEADER */}
              <button
                type="button"
                onClick={() => toggleRow(id)}
                className="w-full text-left px-3 py-3 sm:px-4 sm:py-3 flex items-start justify-between gap-3"
                aria-expanded={isOpen}
                aria-controls={`detected-rec-${id}`}
              >
                <div className="flex-1 min-w-0 space-y-1">
                  {/* Top row: pills + meta */}
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {banType && (
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                        style={{
                          backgroundColor: style.pillBg,
                          color: style.pillText,
                        }}
                      >
                        {banType}
                      </span>
                    )}
                    {bannedBy && (
                      <span className="inline-flex items-center rounded-full bg-gray-800 px-2 py-0.5 text-[10px] font-medium text-gray-200 max-w-full">
                        <span className="mr-1 text-[10px] font-semibold text-gray-400">
                          Banned by:
                        </span>
                        <span className="truncate">{bannedBy}</span>
                      </span>
                    )}
                    {dosageLimit && (
                      <span className="inline-flex items-center rounded-full bg-slate-800/90 px-2 py-0.5 text-[10px] font-medium text-slate-100">
                        Dosage: {dosageLimit}
                      </span>
                    )}
                  </div>

                  {/* Name */}
                  <h3 className="text-sm sm:text-base font-semibold text-slate-50 truncate">
                    {name}
                  </h3>

                  {/* Synonyms */}
                  {synonyms && (
                    <p className="text-[11px] text-slate-300 line-clamp-2">
                      <span className="font-semibold text-slate-400">
                        Also labeled as:
                      </span>{" "}
                      {synonyms}
                    </p>
                  )}
                </div>

                <div className="flex items-center pl-1 pt-1">
                  <span className="text-xs text-slate-300 mr-1 hidden sm:inline">
                    {isOpen ? "Hide" : "Details"}
                  </span>
                  <span className="text-slate-400 text-sm">
                    {isOpen ? "▴" : "▾"}
                  </span>
                </div>
              </button>

              {/* BODY */}
              {isOpen && (
                <div
                  id={`detected-rec-${id}`}
                  className="px-3 sm:px-4 pb-3 sm:pb-4 pt-1 border-t border-slate-700/70 bg-slate-950/70 text-[11px] sm:text-sm text-slate-100 space-y-4"
                >
                  {/* Three-panel layout like OCRScanResults: What it does / Things to watch / Interactions */}
                  {(whatItDoesText || weaknesses || antagonisms) && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {whatItDoesText && (
                        <div className="bg-slate-900/90 rounded-lg border border-slate-700 px-3 py-2">
                          <p className="text-[11px] sm:text-xs font-semibold text-slate-50 mb-1">
                            What it does
                          </p>
                          <p className="text-[11px] sm:text-xs leading-relaxed whitespace-pre-line text-slate-100">
                            {whatItDoesText}
                          </p>
                        </div>
                      )}

                      {weaknesses && (
                        <div className="bg-rose-950/40 rounded-lg border border-rose-800/70 px-3 py-2">
                          <p className="text-[11px] sm:text-xs font-semibold text-rose-50 mb-1">
                            Things to watch for
                          </p>
                          <p className="text-[11px] sm:text-xs leading-relaxed whitespace-pre-line text-rose-100">
                            {weaknesses}
                          </p>
                        </div>
                      )}

                      {antagonisms && (
                        <div className="bg-amber-950/30 rounded-lg border border-amber-800/70 px-3 py-2">
                          <p className="text-[11px] sm:text-xs font-semibold text-amber-50 mb-1">
                            Interactions with other nutrients
                          </p>
                          <p className="text-[11px] sm:text-xs leading-relaxed whitespace-pre-line text-amber-100">
                            {antagonisms}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Source / references */}
                  {source && (
                    <div className="bg-slate-900/80 rounded-lg border border-slate-700 px-3 py-2">
                      <p className="text-[11px] sm:text-xs font-semibold text-slate-100 mb-1">
                        Where this information comes from
                      </p>
                      <p className="leading-relaxed break-words text-slate-200 text-[11px] sm:text-xs">
                        {source}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
