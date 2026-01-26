// /components/dashboard/NextStepCard.jsx
"use client";

import { ShieldCheck, ChevronRight } from "lucide-react";
import { useState } from "react";
import { classNames } from "./ui";

export default function NextStepCard({ actions = [], onAction }) {
  const [showAllMobile, setShowAllMobile] = useState(false);

  const primaryAction = actions[0] || null;
  const extraActions = actions.slice(1);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Next step
          </p>
        </div>

        {extraActions.length > 0 && (
          <button
            onClick={() => setShowAllMobile((v) => !v)}
            className="md:hidden text-[11px] font-semibold text-blue-700 hover:underline"
          >
            {showAllMobile ? "Less" : "More"}
          </button>
        )}
      </div>

      {/* Primary action */}
      {!primaryAction ? (
        <p className="text-xs text-gray-600">You’re all caught up.</p>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
          <span className="text-xs text-gray-700">
            {primaryAction.label}
          </span>
          <button
            onClick={() => onAction(primaryAction)}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 hover:underline shrink-0"
          >
            {primaryAction.cta}
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Extra actions */}
      {extraActions.length > 0 && (
        <ul
          className={classNames(
            "mt-2 space-y-2",
            showAllMobile ? "block" : "hidden md:block",
          )}
        >
          {extraActions.map((item, idx) => (
            <li
              key={idx}
              className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5"
            >
              <span className="text-xs text-gray-700">{item.label}</span>
              <button
                onClick={() => onAction(item)}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 hover:underline"
              >
                {item.cta}
                <ChevronRight className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
