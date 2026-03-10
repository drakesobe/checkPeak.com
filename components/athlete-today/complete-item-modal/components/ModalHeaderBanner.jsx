// components/athlete-today/complete-item-modal/components/ModalHeaderBanner.jsx
"use client";

import { AlertTriangle, X } from "lucide-react";
import { Pill, classNames } from "../../ui";

export default function ModalHeaderBanner({ itemTitle, evidenceRequired, onClose }) {
  return (
    <div className={classNames(
      "rounded-2xl border overflow-hidden",
      evidenceRequired ? "border-amber-200" : "border-gray-200"
    )}>
      {/* Item identity — the most important thing to read first */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-widest text-[#46769B] mb-1.5">
            Log item
          </p>
          <h2 className="text-base font-black text-gray-900 leading-snug">
            {itemTitle || "Workout item"}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 h-8 w-8 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition"
          title="Close"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Guidance strip */}
      <div className={classNames(
        "px-4 py-2.5 flex items-center gap-2.5",
        evidenceRequired ? "bg-amber-50" : "bg-gray-50"
      )}>
        {evidenceRequired ? (
          <>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <p className="text-[12px] text-amber-800 font-semibold leading-snug">
              Your coach requires proof for this item — snap a quick pic.
            </p>
          </>
        ) : (
          <p className="text-[12px] text-gray-500 font-semibold leading-snug">
            Photo optional — submit when ready.
          </p>
        )}
      </div>
    </div>
  );
}