// components/compliance/ncaa/SourceCard.jsx
"use client";

import ExternalAnchor from "./ExternalAnchor";
import Pill from "./Pill";

export default function SourceCard({ item }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 hover:border-gray-300 transition">
      <div className="min-w-0">
        <div className="font-semibold text-gray-900 leading-snug">
          <ExternalAnchor href={item.url}>{item.title}</ExternalAnchor>
        </div>

        {item.note ? (
          <p className="text-sm text-gray-600 mt-1 leading-relaxed">{item.note}</p>
        ) : null}

        <div className="flex flex-wrap gap-2 mt-3">
          {(item.tags || []).map((t) => (
            <Pill key={t}>{t}</Pill>
          ))}
          {item.sourceType ? <Pill>{item.sourceType}</Pill> : null}
        </div>
      </div>
    </div>
  );
}