// components/info/ComplianceSection.jsx
"use client";

import SectionHeader from "./SectionHeader";
import ComplianceWordingCard from "./ComplianceWordingCard";
import ResourceLink from "./ResourceLink";

export default function ComplianceSection({ wording, ncaaSources, lastReviewed }) {
  const wordingItems = Array.isArray(wording)     ? wording     : [];
  const sourceItems  = Array.isArray(ncaaSources)  ? ncaaSources  : [];

  return (
    <section
      id="ncaa-compliance"
      className="max-w-6xl mx-auto px-4 sm:px-6 pb-16"
      style={{ scrollMarginTop: "calc(var(--app-header-h, 64px) + 24px)" }}
    >
      <SectionHeader
        kicker="Compliance"
        title="How we stay"
        titleAccent="NCAA-aligned"
        subtitle="We link directly to NCAA sources and design CheckPeak to support program-first compliance workflows."
      />

      {lastReviewed && (
        <p
          className="mt-2 text-center text-xs uppercase tracking-wide"
          style={{ fontFamily: "'Barlow', sans-serif", color: "#9BA8B4" }}
        >
          Last reviewed: {lastReviewed}
        </p>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {wordingItems.map((w) => (
          <ComplianceWordingCard key={w.key || w.href || w.title} item={w} />
        ))}
      </div>

      {/* Official resources */}
      {sourceItems.length > 0 && (
        <div className="mt-14">
          <SectionHeader
            kicker="Reference backbone"
            title="Official"
            titleAccent="NCAA resources"
            subtitle="Direct links to NCAA pages referenced by CheckPeak."
          />
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {sourceItems.map((s) => (
              <ResourceLink key={s.href} name={s.name} desc={s.desc} href={s.href} />
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div
        className="mt-8 px-5 py-4"
        style={{
          backgroundColor: "#FFFBF0",
          border: "1px solid #FFE0A8",
          borderLeft: "4px solid #E87722",
        }}
      >
        <p
          className="text-xs font-black uppercase tracking-wider mb-1"
          style={{ fontFamily: "'Barlow', sans-serif", color: "#7A4A0A" }}
        >
          Disclaimer
        </p>
        <p
          className="text-sm leading-relaxed"
          style={{ fontFamily: "'Barlow', sans-serif", color: "#7A4A0A" }}
        >
          CheckPeak is informational support and does not replace medical advice, team policy, or official NCAA
          guidance. Always confirm with your athletics health care staff and compliance office, especially if you are tested.
        </p>
      </div>
    </section>
  );
}