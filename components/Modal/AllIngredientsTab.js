"use client";

function highlightMatches(text, records) {
  if (!text) return { __html: "" };
  if (!records?.length) return { __html: text };

  let highlighted = text;
  const words = new Set();

  records.forEach((rec) => {
    if (rec.name) words.add(rec.name.trim());
    (rec.synonyms || "").split(",").map((s) => s.trim()).filter(Boolean).forEach((s) => words.add(s));
  });

  Array.from(words).sort((a, b) => b.length - a.length).forEach((w) => {
    const safe = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${safe})`, "gi");
    highlighted = highlighted.replace(re, `<mark class="bg-yellow-300 text-black font-semibold px-0.5 rounded">$1</mark>`);
  });

  return { __html: highlighted };
}

export default function AllIngredientsTab({ loadingOCR, animDots, ocrText, matchedRecords }) {
  return (
    <div className="bg-gray-700 p-4 rounded-lg text-sm whitespace-pre-wrap min-h-[150px]">
      {loadingOCR ? (
        <div className="flex items-center gap-2">
          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
            <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" />
          </svg>
          <p>Scanning OCR{animDots}</p>
        </div>
      ) : (
        <div dangerouslySetInnerHTML={highlightMatches(ocrText, matchedRecords)} />
      )}
    </div>
  );
}
