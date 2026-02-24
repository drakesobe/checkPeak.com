// components/org/nutrition/page/PlaceholderPanel.jsx
"use client";

export default function PlaceholderPanel({ title, subtitle, ctaLabel, onCta, children }) {
  return (
    <section className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900">{title}</h2>
          {subtitle ? <p className="text-sm text-gray-600 mt-1">{subtitle}</p> : null}
        </div>

        {ctaLabel ? (
          <button
            type="button"
            onClick={onCta}
            className="px-4 py-2 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#46769B]/35"
          >
            {ctaLabel}
          </button>
        ) : null}
      </div>

      <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">{children}</div>
    </section>
  );
}