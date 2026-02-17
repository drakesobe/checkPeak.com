// components/athlete-today/complete-item-modal/components/ModalHeaderBanner.jsx

"use client";

import { Info, AlertTriangle, X } from "lucide-react";
import { Pill, classNames } from "../../ui";

export default function ModalHeaderBanner({ evidenceRequired, onClose }) {
  return (
    <div
      className={classNames(
        "rounded-2xl border p-3 sm:p-4",
        evidenceRequired
          ? "border-amber-200 bg-amber-50"
          : "border-gray-200 bg-gray-50"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-gray-700 font-semibold flex items-center gap-2">
            <Info className="w-4 h-4 text-gray-400" />
            Keep it quick
          </p>

          <p className="text-[12px] text-gray-700 mt-2 leading-snug">
            Snap the machine display, bar on rack, treadmill screen, or a quick
            selfie in the gym.
          </p>

          <div className="mt-2">
            {evidenceRequired ? (
              <Pill tone="warn">
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                Photo required
              </Pill>
            ) : (
              <Pill>Photo optional</Pill>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-xl border border-gray-200 bg-white p-2 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30"
          title="Close"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-gray-600" />
        </button>
      </div>
    </div>
  );
}
