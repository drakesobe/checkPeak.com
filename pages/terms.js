// pages/terms.js
import Head from "next/head";
import Link from "next/link";

/* -------------------------------------------------------------------------- */
/* Static data                                                                 */
/* -------------------------------------------------------------------------- */

const LAST_UPDATED  = "January 15, 2026";
const EFFECTIVE     = "January 15, 2026";
const CONTACT_EMAIL = "support@checkpeak.com";

const SECTIONS = [
  {
    id:    "acceptance",
    title: "Acceptance of Terms",
    body: [
      {
        heading: "Agreement to these terms",
        text: "By accessing or using CheckPeak - including our website, scanning tools, SmartStack feature, and any associated mobile applications - you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree, please do not use CheckPeak.",
      },
      {
        heading: "Changes to these terms",
        text: "We may update these Terms from time to time. We will notify you of material changes by email and by posting a notice on the CheckPeak website at least 14 days before they take effect. Continued use after the effective date constitutes acceptance of the revised Terms.",
      },
    ],
  },
  {
    id:    "description",
    title: "Description of Service",
    body: [
      {
        heading: "What CheckPeak does",
        text: "CheckPeak provides tools that allow users to scan supplement and nutrition labels using optical character recognition (OCR), match detected ingredients against our database, and identify substances that are banned or flagged by sports governing bodies including WADA, USADA, and NCAA.",
      },
      {
        heading: "Informational purpose only",
        text: "CheckPeak is an informational tool. Our scan results, ingredient classifications, and risk assessments are provided for general informational purposes only. They do not constitute medical advice, dietary advice, or legal advice. You are responsible for verifying information independently before making decisions about supplements.",
      },
      {
        heading: "No guarantee of completeness",
        text: "Banned substance lists change. Manufacturers change formulations without notice. Our ingredient database may not be exhaustive or up to date at all times. CheckPeak does not guarantee that a product scanned as 'clear' is free of all prohibited substances, and we strongly advise athletes subject to anti-doping rules to consult their governing body before consuming any supplement.",
      },
      {
        heading: "SmartStack feature",
        text: "SmartStack provides curated supplement product listings with value scoring and comparison tools. Affiliate links to third-party retailers may be present. CheckPeak is not affiliated with any supplement brand or manufacturer. Value scores are calculated independently based on cost-per-serving analysis.",
      },
    ],
  },
  {
    id:    "accounts",
    title: "Accounts & Registration",
    body: [
      {
        heading: "Account creation",
        text: "Some features of CheckPeak require you to create an account. You agree to provide accurate and complete information when registering and to keep your login credentials secure. You are responsible for all activity that occurs under your account.",
      },
      {
        heading: "Account termination",
        text: "You may delete your account at any time from your account settings. We reserve the right to suspend or terminate accounts that violate these Terms, are used for abuse or fraud, or have been inactive for an extended period with prior notice.",
      },
    ],
  },
  {
    id:    "acceptable-use",
    title: "Acceptable Use",
    body: [
      {
        heading: "Permitted use",
        text: "You may use CheckPeak for your own personal, non-commercial purposes - scanning supplement labels, saving stacks, browsing SmartStack, and comparing products.",
      },
      {
        heading: "Prohibited conduct",
        text: "You agree not to: attempt to reverse-engineer, scrape, or extract our ingredient database or scan results in bulk; use automated bots or scripts to access the service; attempt to gain unauthorised access to any CheckPeak systems; submit content that is illegal, harmful, or violates the rights of others; or use CheckPeak for commercial purposes without our written permission.",
      },
      {
        heading: "Uploaded content",
        text: "When you upload an image for scanning, you confirm that you have the right to share that image and that it does not contain personal information of other individuals that they have not consented to share. You retain ownership of images you upload; by uploading you grant us a limited, temporary licence to process the image for the purpose of returning scan results to you.",
      },
    ],
  },
  {
    id:    "intellectual-property",
    title: "Intellectual Property",
    body: [
      {
        heading: "CheckPeak's IP",
        text: "The CheckPeak name, logo, website design, software, ingredient database, and all other content created by CheckPeak are protected by copyright and other intellectual property laws. You may not reproduce, distribute, or create derivative works from our content without our prior written permission.",
      },
      {
        heading: "Your content",
        text: "You retain all rights to the images and content you provide. We do not claim ownership over your uploaded label images. Our use is limited to processing your scan requests.",
      },
      {
        heading: "Feedback",
        text: "If you submit feedback, suggestions, or ideas about CheckPeak, you grant us a perpetual, royalty-free licence to use that feedback for any purpose without obligation to you.",
      },
    ],
  },
  {
    id:    "disclaimers",
    title: "Disclaimers & Limitations",
    body: [
      {
        heading: "Service provided as-is",
        text: "CheckPeak is provided on an \"as is\" and \"as available\" basis without warranties of any kind, either express or implied. We do not warrant that the service will be uninterrupted, error-free, or that scan results will be accurate or complete.",
      },
      {
        heading: "No anti-doping guarantee",
        text: "CheckPeak scan results must not be relied upon as a guarantee of compliance with any anti-doping policy. If you are subject to drug testing, consult your sports governing body and use only certified products from trusted sources. CheckPeak expressly disclaims liability for any anti-doping violations.",
      },
      {
        heading: "Limitation of liability",
        text: "To the maximum extent permitted by law, CheckPeak and its founders, employees, and affiliates will not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the service, even if we have been advised of the possibility of such damages.",
      },
      {
        heading: "Aggregate liability cap",
        text: "Our total cumulative liability to you for any claims arising from these Terms or your use of CheckPeak will not exceed the greater of (a) the amount you paid to CheckPeak in the 12 months preceding the claim, or (b) $50 USD.",
      },
    ],
  },
  {
    id:    "third-party",
    title: "Third-Party Links & Services",
    body: [
      {
        heading: "External links",
        text: "CheckPeak may contain links to third-party websites, including affiliate links to product retailers such as Amazon. We are not responsible for the content, privacy practices, or accuracy of any third-party site. The presence of an affiliate link does not constitute an endorsement of the linked product.",
      },
      {
        heading: "Affiliate disclosure",
        text: "CheckPeak participates in affiliate programmes. If you click a product link and make a purchase, we may earn a commission at no additional cost to you. This does not influence our product rankings, value scores, or ingredient safety assessments.",
      },
    ],
  },
  {
    id:    "governing-law",
    title: "Governing Law & Disputes",
    body: [
      {
        heading: "Governing law",
        text: "These Terms are governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to conflict of law principles.",
      },
      {
        heading: "Dispute resolution",
        text: "We encourage you to contact us first if you have a concern - most issues can be resolved quickly. If a formal dispute arises, you agree to attempt informal resolution before initiating any legal proceedings. Any unresolved disputes shall be resolved through binding arbitration in accordance with the American Arbitration Association rules.",
      },
      {
        heading: "Class action waiver",
        text: "You agree to resolve disputes with CheckPeak on an individual basis only. You waive the right to participate in class action lawsuits or class-wide arbitration.",
      },
    ],
  },
  {
    id:    "general",
    title: "General Provisions",
    body: [
      {
        heading: "Entire agreement",
        text: "These Terms, together with our Privacy Policy, constitute the entire agreement between you and CheckPeak regarding your use of the service and supersede all prior agreements.",
      },
      {
        heading: "Severability",
        text: "If any provision of these Terms is found to be unenforceable, the remaining provisions will continue in full force and effect.",
      },
      {
        heading: "No waiver",
        text: "Failure by CheckPeak to enforce any right or provision of these Terms will not constitute a waiver of that right or provision.",
      },
      {
        heading: "Contact",
        text: `For questions about these Terms, contact us at ${CONTACT_EMAIL}.`,
      },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Table of Contents                                                           */
/* -------------------------------------------------------------------------- */

function TableOfContents({ sections }) {
  return (
    <nav aria-label="Table of contents">
      <p
        className="text-[10px] font-bold uppercase tracking-widest mb-3"
        style={{ color: "#5B9EC9", fontFamily: "'Barlow Condensed', sans-serif" }}
      >
        Contents
      </p>
      <ol className="space-y-1.5">
        {sections.map((s, i) => (
          <li key={s.id} className="flex items-baseline gap-2.5">
            <span
              className="text-[11px] font-bold tabular-nums shrink-0 w-4"
              style={{ color: "rgba(91,158,201,0.6)", fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <a
              href={`#${s.id}`}
              className="text-xs leading-snug transition-colors"
              style={{ color: "#64748b" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#5B9EC9"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#64748b"; }}
            >
              {s.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function TermsPage() {
  return (
    <>
      <Head>
        <title>Terms of Service - CheckPeak</title>
        <meta name="description" content="CheckPeak's Terms of Service. Rules and guidelines for using our supplement scanning and SmartStack tools." />
        <meta name="robots" content="noindex" />
      </Head>

      <div
        className="min-h-screen"
        style={{ background: "#F8F9FA", fontFamily: "'Barlow', sans-serif" }}
      >

        {/* ── Top nav bar ─────────────────────────────────────────────────── */}
        <div
          className="sticky top-0 z-20 border-b"
          style={{
            background:     "rgba(248,249,250,0.95)",
            backdropFilter: "blur(12px)",
            borderColor:    "#e2e8f0",
          }}
        >
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-bold transition-colors"
              style={{ color: "#0A0C10", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.06em" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#5B9EC9"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#0A0C10"; }}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: "#5B9EC9" }}
                aria-hidden="true"
              />
              CHECKPEAK
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
              style={{
                background: "rgba(91,158,201,0.1)",
                border:     "1px solid rgba(91,158,201,0.25)",
                color:      "#5B9EC9",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(91,158,201,0.18)";
                e.currentTarget.style.color      = "#2d6fa3";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(91,158,201,0.1)";
                e.currentTarget.style.color      = "#5B9EC9";
              }}
            >
              ← Back to app
            </Link>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
          <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-16 xl:gap-20">

            {/* ── Sidebar - sticky on desktop ── */}
            <aside className="hidden lg:block">
              <div className="sticky top-20 space-y-8">
                <TableOfContents sections={SECTIONS} />

                {/* Important callout */}
                <div
                  className="rounded-xl p-4"
                  style={{
                    background: "rgba(91,158,201,0.06)",
                    border:     "1px solid rgba(91,158,201,0.18)",
                  }}
                >
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
                    style={{ color: "#5B9EC9", fontFamily: "'Barlow Condensed', sans-serif" }}
                  >
                    Important
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    CheckPeak scan results are <strong>not</strong> a guarantee
                    of anti-doping compliance. Always verify with your governing body.
                  </p>
                </div>

                {/* Sister page link */}
                <div
                  className="rounded-xl p-4"
                  style={{ background: "#f1f5f9", border: "1px solid #e2e8f0" }}
                >
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Also read
                  </p>
                  <Link
                    href="/privacy"
                    className="text-sm font-semibold transition-colors"
                    style={{ color: "#334155" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#5B9EC9"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "#334155"; }}
                  >
                    Privacy Policy →
                  </Link>
                </div>
              </div>
            </aside>

            {/* ── Main content ── */}
            <main>

              {/* Header */}
              <div className="mb-10 pb-8" style={{ borderBottom: "1px solid #e2e8f0" }}>
                <div className="flex items-center gap-2 mb-4">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
                    style={{
                      background: "rgba(91,158,201,0.1)",
                      border:     "1px solid rgba(91,158,201,0.25)",
                      color:      "#5B9EC9",
                      fontFamily: "'Barlow Condensed', sans-serif",
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#5B9EC9]" aria-hidden="true" />
                    Legal
                  </span>
                </div>

                <h1
                  className="text-4xl sm:text-5xl font-black text-slate-900 leading-tight"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.01em" }}
                >
                  Terms of Service
                </h1>

                <p className="mt-3 text-sm text-slate-500 leading-relaxed max-w-2xl">
                  These terms govern your use of CheckPeak. We've kept them as readable
                  as possible. If something's unclear, just ask - we'd rather explain
                  it than hide behind legal jargon.
                </p>

                <div className="mt-5 flex flex-wrap gap-4 text-xs text-slate-400">
                  <span>Effective: <strong className="text-slate-600">{EFFECTIVE}</strong></span>
                  <span>Last updated: <strong className="text-slate-600">{LAST_UPDATED}</strong></span>
                </div>

                {/* Anti-doping warning - most important notice, surfaced early */}
                <div
                  className="mt-6 rounded-xl px-4 py-3.5 flex gap-3"
                  style={{
                    background: "rgba(91,158,201,0.07)",
                    border:     "1px solid rgba(91,158,201,0.22)",
                  }}
                >
                  <span
                    className="text-lg leading-none shrink-0 mt-0.5"
                    aria-hidden="true"
                  >
                    ⚠️
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    <strong>Athletes:</strong> CheckPeak is an informational tool only.
                    Our scan results are not a guarantee that a supplement is free of
                    all banned substances. Banned substance lists change frequently.
                    Always verify with your sport's governing body before using any supplement.
                  </p>
                </div>
              </div>

              {/* Mobile ToC */}
              <div
                className="lg:hidden mb-8 rounded-xl p-5"
                style={{ background: "#f1f5f9", border: "1px solid #e2e8f0" }}
              >
                <TableOfContents sections={SECTIONS} />
              </div>

              {/* Sections */}
              <div className="space-y-14">
                {SECTIONS.map((section, i) => (
                  <section key={section.id} id={section.id}>

                    {/* Section header */}
                    <div className="flex items-baseline gap-3 mb-6">
                      <span
                        className="text-sm font-black tabular-nums"
                        style={{ color: "rgba(91,158,201,0.5)", fontFamily: "'Barlow Condensed', sans-serif" }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <h2
                        className="text-xl font-black text-slate-900"
                        style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.02em" }}
                      >
                        {section.title}
                      </h2>
                    </div>

                    {/* Sub-sections */}
                    <div className="space-y-6">
                      {section.body.map((item) => (
                        <div
                          key={item.heading}
                          className="pl-5"
                          style={{ borderLeft: "2px solid #e2e8f0" }}
                        >
                          <h3 className="text-sm font-bold text-slate-800 mb-1.5">
                            {item.heading}
                          </h3>
                          <p className="text-sm text-slate-600 leading-relaxed">
                            {item.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>

              {/* Contact block */}
              <div
                className="mt-16 rounded-2xl p-6 sm:p-8"
                style={{ background: "#f1f5f9", border: "1px solid #e2e8f0" }}
              >
                <h2
                  className="text-lg font-black text-slate-900 mb-2"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  Questions about these terms?
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">
                  We're happy to clarify anything. Contact us directly and a real
                  person will get back to you.
                </p>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all"
                  style={{ background: "#0A0C10", color: "#fff" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#5B9EC9"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#0A0C10"; }}
                >
                  {CONTACT_EMAIL}
                </a>
              </div>

              {/* Bottom nav */}
              <div
                className="mt-8 flex items-center justify-between text-xs text-slate-400"
                style={{ borderTop: "1px solid #e2e8f0", paddingTop: "1.5rem" }}
              >
                <span>© {new Date().getFullYear()} CheckPeak</span>
                <Link
                  href="/privacy"
                  className="transition-colors"
                  style={{ color: "#94a3b8" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#5B9EC9"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "#94a3b8"; }}
                >
                  Privacy Policy →
                </Link>
              </div>
            </main>
          </div>
        </div>
      </div>
    </>
  );
}