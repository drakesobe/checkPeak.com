"use client";

import React from "react";

/**
 * ResultsTable
 * - Displays banned substances
 * - Highlights only the words actually found in raw OCR
 */
export default function ResultsTable({ records = [], highlightedCells = {}, rawOCR = "" }) {
  if (!records || records.length === 0) return null;

  // Normalize OCR once
  const normalizedOCR = rawOCR.toLowerCase();

  const renderHighlighted = (text, recId) => {
    if (!text || !highlightedCells[recId]) return text;

    const terms = text.split(/,\s*/).filter(Boolean);

    return terms.map((term, index) => {
      const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (regex.test(normalizedOCR)) {
        return (
          <span key={index} style={{ color: highlightedCells[recId].color, fontWeight: 600 }}>
            {term}
            {index < terms.length - 1 ? ", " : ""}
          </span>
        );
      }
      return index < terms.length - 1 ? term + ", " : term;
    });
  };

  return (
    <div className="overflow-x-auto w-full">
      <table className="min-w-full w-full bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
        <thead className="bg-[#46769B] text-white">
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
              <th key={h} className="px-4 py-2 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((rec) => {
            const fields = rec.fields || {};
            const banType = fields["Ban Type"] || "None";
            const color = highlightedCells[rec.id]?.color || "#111827";

            return (
              <tr key={rec.id} className="hover:bg-gray-100 transition">
                <td className="px-4 py-2">{renderHighlighted(fields["Substance Name"], rec.id)}</td>
                <td className="px-4 py-2">{renderHighlighted(fields["Synonyms"], rec.id)}</td>
                <td className="px-4 py-2">{fields["Banned By"] || ""}</td>
                <td className="px-4 py-2" style={{ color, fontWeight: 600 }}>{banType}</td>
                <td className="px-4 py-2">{fields["Dosage Limit"] || ""}</td>
                <td className="px-4 py-2">{fields["Notes"] || ""}</td>
                <td className="px-4 py-2 max-w-xs break-words whitespace-normal">{fields["Source / Citation"] || ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
