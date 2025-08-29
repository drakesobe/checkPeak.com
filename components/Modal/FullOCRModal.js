"use client";

export default function FullOCRModal({ ocrText, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2">
      <div className="bg-gray-900 rounded-lg p-4 max-w-3xl w-full max-h-[80vh] overflow-y-auto text-sm text-gray-200">
        <div className="flex justify-between items-center mb-2">
          <strong className="text-white text-base">Full OCR Text</strong>
          <button
            onClick={onClose}
            className="text-white px-2 py-1 rounded bg-gray-700 hover:bg-gray-600"
          >
            ✕
          </button>
        </div>
        <pre className="whitespace-pre-wrap leading-snug text-xs">
          {ocrText || "No OCR text available."}
        </pre>
      </div>
    </div>
  );
}
