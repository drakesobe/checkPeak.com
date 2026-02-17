// components/athlete-today/complete-item-modal/components/PhotoSection.jsx

"use client";

import { useRef } from "react";
import { Camera, Upload, Image as ImageIcon } from "lucide-react";
import { Button, classNames } from "../../ui";
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

  const captureBtnLabel = selectedFile ? "Change photo" : "Take photo";

  const openCamera = () => {
    if (submitting) return;
    inputRef.current?.click();
  };

  return (
    <Card>
      <SectionTitle
        icon={<Camera className="w-4 h-4 text-[#46769B]" />}
        title="Photo"
        subtitle={
          evidenceRequired
            ? "Required — take a quick pic and submit."
            : "Optional — take a pic if you want."
        }
        right={
          evidenceRequired ? (
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
              Required
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700">
              Optional
            </span>
          )
        }
      />

      <div className="mt-3 grid gap-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={openCamera}
            disabled={submitting}
            className="w-full sm:w-auto"
            title="Open camera / choose photo"
          >
            <Camera className="w-4 h-4" />
            {captureBtnLabel}
          </Button>

          <Button
            variant="secondary"
            onClick={openCamera}
            disabled={submitting}
            className="w-full sm:w-auto"
            title="Choose from library"
          >
            <Upload className="w-4 h-4" />
            Choose file
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => onPickFile?.(e.target.files?.[0] || null)}
          className="hidden"
        />

        <div
          className={classNames(
            "rounded-2xl border p-3",
            selectedFile
              ? "border-blue-200 bg-blue-50/40"
              : "border-gray-200 bg-gray-50"
          )}
        >
          <div className="flex items-start gap-2">
            <span className="h-9 w-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center shrink-0">
              <ImageIcon className="w-4 h-4 text-gray-600" />
            </span>

            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-gray-900">
                {selectedFile ? "Photo selected" : "No photo selected"}
              </p>
              <p className="text-[12px] text-gray-600 truncate">
                {selectedFile
                  ? fileLabel(selectedFile)
                  : evidenceRequired
                  ? "You need a photo to submit."
                  : "You can submit without a photo."}
              </p>
            </div>
          </div>
        </div>

        {previewUrl ? (
          <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full h-52 sm:h-56 object-cover"
            />
            <div className="px-3 py-2 text-[11px] text-gray-600">
              {evidenceRequired
                ? "Looks good — submit when ready."
                : "Optional photo attached — submit when ready."}
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
