// components/info/ComplianceSection.jsx
"use client";

import SectionHeader from "./SectionHeader";
import ComplianceWordingCard from "./ComplianceWordingCard";
import ResourceLink from "./ResourceLink";

export default function ComplianceSection({ wording, ncaaSources, lastReviewed }) {
  const wordingItems = Array.isArray(wording) ? wording : [];
  const sourceItems = Array.isArray(ncaaSources) ? ncaaSources : [];

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-12 scroll-mt-24">
      <SectionHeader
        kicker="Compliance"
        title="How we stay NCAA-aligned"
        subtitle="We link directly to NCAA sources and design CheckPeak to support program-first compliance workflows."
      />

      {lastReviewed ? (
        <div className="mt-4 text-center text-xs text-slate-500">
        </div>
      ) : null}

      {/* ✅ More boxes: 1-col mobile, 2-col md, 3-col lg */}
      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {wordingItems.map((w) => (
          <ComplianceWordingCard key={w.key || w.href || w.title} item={w} />
        ))}
      </div>

      <div className="mt-10">
        <SectionHeader
          kicker="Reference backbone"
          title="Official NCAA resources"
          subtitle="Direct links to NCAA pages and resources referenced by CheckPeak."
        />

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {sourceItems.map((s) => (
            <ResourceLink key={s.href} name={s.name} desc={s.desc} href={s.href} />
          ))}
        </div>

        <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 p-5 sm:p-6 shadow-sm">
          <p className="text-sm font-extrabold text-rose-900">Disclaimer</p>
          <p className="mt-1 text-sm text-rose-900/90 leading-relaxed">
            CheckPeak is informational support and does not replace medical advice, team policy, or official NCAA guidance.
            Always confirm with your athletics health care staff and compliance office, especially if you are tested.
          </p>
        </div>
      </div>
    </section>
  );
}