// components/compliance/ncaa/PageHeader.jsx
"use client";

export default function PageHeader({ disclaimer }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold tracking-wide text-[#46769B]">COMPLIANCE</p>

      <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900">
        NCAA Rules & CheckPeak Compliance
      </h1>

      <p className="text-sm md:text-base text-gray-600 max-w-3xl leading-relaxed">
        Direct NCAA resources on drug testing, banned substances, supplements, sports wagering, and NIL -
        plus how CheckPeak supports compliance-first workflows.
      </p>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 mt-2">
        <div className="font-semibold text-amber-900">{disclaimer.title}</div>
        <p className="text-sm text-amber-900/90 mt-1 leading-relaxed">
          {disclaimer.body}
        </p>
      </div>
    </div>
  );
}