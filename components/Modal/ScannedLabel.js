"use client";

/**
 * Highlights any matched record terms in the OCR text.
 */
function highlightMatches(text, records) {
  if (!text) return { __html: "" };
  if (!records?.length) return { __html: text };

  let highlighted = text;
  const words = new Set();
  records.forEach((rec) => {
    const f = rec.fields || {};
    if (f["Substance Name"]) words.add(f["Substance Name"]);
    (f["Synonyms"] || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => words.add(s));
  });

  words.forEach((w) => {
    const safe = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${safe})`, "gi");
    highlighted = highlighted.replace(
      re,
      `<mark class="bg-yellow-300 text-black font-semibold px-0.5 rounded">$1</mark>`
    );
  });

  return { __html: highlighted };
}

function Spinner({ text }) {
  return (
    <div className="flex items-center gap-2">
      <svg
        className="animate-spin h-5 w-5 text-white"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
          className="opacity-25"
        />
        <path
          fill="currentColor"
          d="M4 12a8 8 0 018-8v8H4z"
          className="opacity-75"
        />
      </svg>
      <p>{text}</p>
    </div>
  );
}

export default function ScannedLabel({
  loadingOCR,
  animDots,
  ocrText,
  matchedRecords,
}) {
  return (
    <div className="bg-gray-700 p-4 rounded-lg text-gray-100 min-h-[100px] text-sm whitespace-pre-wrap">
      {loadingOCR ? (
        <Spinner text={`Loading OCR${animDots}`} />
      ) : (
        <div
          dangerouslySetInnerHTML={highlightMatches(ocrText, matchedRecords)}
        />
      )}
    </div>
  );
}
