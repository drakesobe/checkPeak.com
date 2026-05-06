// components/athlete-today/complete-item-modal/components/PhotoSection.jsx
"use client";

import { useRef } from "react";
import { Camera, Image as ImageIcon, CheckCircle2 } from "lucide-react";
import { classNames } from "../../ui";
import Card from "./Card";
import SectionTitle from "./SectionTitle";
import { fileLabel } from "../utils/file";

export default function PhotoSection({
  evidenceRequired,
  submitting,
  selectedFile,
  previewUrl,
  onPickFile,
}) {
  const inputRef = useRef(null);

  return (
    <Card>
      <SectionTitle
        icon={<Camera className="w-4 h-4 text-[#46769B]" />}
        title="Photo"
        subtitle={
          evidenceRequired
            ? "Required - snap the machine display, bar, or a gym selfie."
            : "Add a photo if you'd like."
        }
        right={
          evidenceRequired ? (
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
              Required
            </span>
          ) : null
        }
      />

      <div className="mt-3 space-y-3">

        {/* Single action button - OS handles camera vs library natively */}
        <label className={classNames(
          "flex items-center justify-center gap-2 w-full rounded-xl border-2 px-4 py-3 cursor-pointer transition font-semibold text-sm",
          submitting ? "opacity-50 pointer-events-none" : "",
          selectedFile
            ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            : evidenceRequired
            ? "border-[#46769B]/40 bg-[#46769B]/5 text-[#1E3A5F] hover:bg-[#46769B]/10"
            : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
        )}>
          {selectedFile
            ? <><CheckCircle2 className="w-4 h-4 shrink-0" /> Change photo</>
            : <><Camera className="w-4 h-4 shrink-0" /> {evidenceRequired ? "Take or choose photo" : "Add a photo"}</>
          }
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            onChange={(e) => {
              onPickFile?.(e.target.files?.[0] || null);
              e.target.value = "";
            }}
            disabled={submitting}
            className="hidden"
          />
        </label>

        {/* Status row */}
        <div className={classNames(
          "rounded-xl border p-3 flex items-center gap-3",
          selectedFile
            ? "border-emerald-200 bg-emerald-50/60"
            : evidenceRequired
            ? "border-amber-200 bg-amber-50/60"
            : "border-gray-200 bg-gray-50"
        )}>
          <span className={classNames(
            "h-8 w-8 rounded-xl border bg-white flex items-center justify-center shrink-0",
            selectedFile ? "border-emerald-200" : evidenceRequired ? "border-amber-200" : "border-gray-200"
          )}>
            {selectedFile
              ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              : <ImageIcon className={classNames("w-4 h-4", evidenceRequired ? "text-amber-500" : "text-gray-400")} />
            }
          </span>
          <div className="min-w-0">
            <p className={classNames(
              "text-[12px] font-semibold",
              selectedFile ? "text-gray-900" : evidenceRequired ? "text-amber-900" : "text-gray-900"
            )}>
              {selectedFile ? "Photo selected" : evidenceRequired ? "Photo required" : "No photo"}
            </p>
            <p className={classNames(
              "text-[11px] truncate",
              selectedFile ? "text-gray-500" : evidenceRequired ? "text-amber-700" : "text-gray-500"
            )}>
              {selectedFile
                ? fileLabel(selectedFile)
                : evidenceRequired
                ? "Tap above to take or choose a photo."
                : "Tap above to add one, or submit as-is."}
            </p>
          </div>
        </div>

        {/* Preview */}
        {previewUrl ? (
          <div className="rounded-2xl overflow-hidden border border-gray-200">
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full h-52 sm:h-56 object-cover"
            />
            <div className="px-3 py-2 bg-gray-50 text-[11px] text-gray-500 font-medium">
              {evidenceRequired ? "Looks good - submit when ready." : "Photo attached."}
            </div>
          </div>
        ) : null}

      </div>
    </Card>
  );
}