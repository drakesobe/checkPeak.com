// components/compliance/ncaa/QuickLinksCard.jsx
"use client";

import Link from "next/link";

export default function QuickLinksCard({ toc, lastReviewed }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 sticky top-4">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold text-gray-900">Quick links</div>
        {lastReviewed ? (
          <div className="text-[11px] text-gray-500">
            Last reviewed: <span className="font-semibold text-gray-700">{lastReviewed}</span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 mt-3">
        {toc.map((t) => (
          <a
            key={t.key}
            href={`#${t.key}`}
            className="text-sm text-gray-700 hover:text-gray-900"
          >
            → {t.title}
          </a>
        ))}
      </div>

      <div className="border-t border-gray-100 mt-4 pt-4">
        <div className="font-semibold text-gray-900">Program-first compliance</div>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          Built to reduce eligibility risk — without replacing your compliance office or athletics health care staff.
        </p>

        <div className="mt-3 flex flex-col gap-2">
          <Link href="/" className="text-sm text-[#46769B] hover:underline">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}