// components/compliance/ncaa/DifferenceGrid.jsx
"use client";

export default function DifferenceGrid({ bullets }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="text-xl font-bold text-gray-900">What CheckPeak does (and doesn’t do)</h2>
      <div className="grid gap-3 md:grid-cols-2 mt-4">
        {bullets.map((b) => (
          <div key={b.title} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="font-semibold text-gray-900">{b.title}</div>
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">{b.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}