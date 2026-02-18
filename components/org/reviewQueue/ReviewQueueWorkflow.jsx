// components/org/reviewQueue/ReviewQueueWorkflow.jsx
"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, HelpCircle, ChevronDown, Info } from "lucide-react";

/**
 * ReviewQueueWorkflow (ultra-light)
 * - Tooltip-style panel a coach MAY read
 * - One toggle button (More) to expand/collapse
 * - No refresh button
 * - Minimal default line + optional expanded tips
 */

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function TipRow({ icon: Icon, title, body }) {
  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-gray-500" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        <div className="text-[12px] text-gray-600 mt-0.5 leading-relaxed">{body}</div>
      </div>
    </div>
  );
}

export default function ReviewQueueWorkflow() {
  const [open, setOpen] = useState(false);

  return (
    <section className="bg-white rounded-2xl shadow-md border border-blue-100 p-4 sm:p-5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-gray-900">Review tips</div>
          <div className="text-xs text-gray-600 mt-1 leading-relaxed">Quick reminder for moving through the queue.</div>
        </div>

        {/* Single toggle button */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cx(
            "inline-flex items-center justify-center gap-2",
            "px-3 py-2 rounded-2xl border border-gray-200",
            "bg-white hover:bg-gray-50 transition",
            "text-xs font-semibold text-gray-800"
          )}
          aria-expanded={open}
          title="More"
        >
          More
          <ChevronDown className={cx("w-4 h-4 transition-transform", open ? "rotate-180" : "")} />
        </button>
      </div>

      {/* Minimal default (always visible) */}
      <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-3">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-gray-500 mt-[1px] shrink-0" />
          <p className="text-[12px] text-gray-700 leading-relaxed">
            Start with <span className="font-semibold">Pending</span>. If you can’t confirm, request{" "}
            <span className="font-semibold">Needs info</span>. Otherwise <span className="font-semibold">Approve</span>.
          </p>
        </div>
      </div>

      {/* Expanded details (optional) */}
      {open ? (
        <div className="mt-4 space-y-3">
          <TipRow
            icon={AlertTriangle}
            title="Pending first"
            body="These are waiting on you. Open, verify the upload, and decide."
          />
          <TipRow
            icon={HelpCircle}
            title="Needs info"
            body="Use when the upload is unclear or incomplete. Leave a short note."
          />
          <TipRow icon={CheckCircle2} title="Approve" body="Approve when the upload matches the workout." />

          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
            <div className="text-[11px] font-semibold text-gray-600">Example note</div>
            <div className="text-[12px] text-gray-800 mt-1 leading-relaxed">
              “Image is too blurry to confirm setup — please resubmit with a clearer photo.”
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
