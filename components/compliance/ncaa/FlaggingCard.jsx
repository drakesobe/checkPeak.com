"use client";

export default function FlaggingCard({ model }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="text-xl font-bold text-gray-900">{model.title}</h2>
      <p className="text-sm text-gray-600 mt-2 leading-relaxed">{model.subtitle}</p>

      <div className="grid gap-3 md:grid-cols-2 mt-4">
        {model.items.map((it) => (
          <div
            key={it.title}
            className="rounded-2xl bg-gray-50 p-4 ring-1 ring-inset ring-gray-200/70"
          >
            <div className="font-semibold text-gray-900">{it.title}</div>
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">{it.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}