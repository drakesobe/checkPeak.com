// components/OCRScanResults.js
import React from "react";
import OCRResultsBase from "./OCRResultsBase";

export default function OCRScanResults({ ocrText = "", detectedSubstances = [], showOCR = true }) {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 space-y-6">
      <OCRResultsBase
        ocrText={ocrText}
        detectedSubstances={detectedSubstances}
        showOCR={showOCR}
      />
    </div>
  );
}
