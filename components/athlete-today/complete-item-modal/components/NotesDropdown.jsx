// components/athlete-today/complete-item-modal/components/NotesDropdown.jsx

"use client";

import { useState } from "react";
import { ClipboardEdit, ChevronDown, ChevronUp } from "lucide-react";
import { classNames } from "../../ui";
import Card from "./Card";

export default function NotesDropdown({
  value,
  onChange,
  disabled,
  maxLength = 500,
}) {
  const [open, setOpen] = useState(false);
  const text = String(value || "");
  const len = text.length;

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={classNames(
          "w-full text-left rounded-2xl",
          "focus:outline-none focus:ring-2 focus:ring-[#46769B]/25"
        )}
        aria-expanded={open}
        disabled={disabled}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-9 w-9 rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0">
                <ClipboardEdit className="w-4 h-4 text-gray-700" />
              </span>

              <div className="min-w-0">
                <p className="text-sm font-extrabold text-gray-900">
                  Notes (optional)
                </p>
                <p className="text-[12px] text-gray-600 mt-0.5 leading-snug truncate">
                  {text.trim()
                    ? "Note added"
                    : "Add a quick note if you changed anything."}
                </p>
              </div>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <span className="text-[11px] text-gray-500 tabular-nums">
              {len}/{maxLength}
            </span>
            <span className="h-9 w-9 rounded-2xl border border-gray-200 bg-white flex items-center justify-center">
              {open ? (
                <ChevronUp className="w-5 h-5 text-gray-700" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-700" />
              )}
            </span>
          </div>
        </div>
      </button>

      {open ? (
        <div className="mt-3 border-t border-gray-200 pt-3">
          <textarea
            className="w-full min-h-[92px] sm:min-h-[104px] px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]/40"
            placeholder="Example: used 10 lbs less, swapped machine, short on time, felt easy/tough…"
            value={text}
            maxLength={maxLength}
            onChange={(e) => onChange?.(e.target.value)}
            disabled={disabled}
          />
        </div>
      ) : null}
    </Card>
  );
}
