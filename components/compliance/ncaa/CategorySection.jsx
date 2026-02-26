// components/compliance/ncaa/CategorySection.jsx
"use client";

import SourceCard from "./SourceCard";

export default function CategorySection({ cat }) {
  return (
    <section id={cat.key} className="scroll-mt-28">
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">{cat.title}</h2>
        {cat.description ? (
          <p className="text-sm text-gray-600 mt-2 leading-relaxed max-w-3xl">
            {cat.description}
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2 mt-4">
        {(cat.items || []).map((item) => (
          <SourceCard key={item.url} item={item} />
        ))}
      </div>
    </section>
  );
}