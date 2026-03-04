// pages/privacy.js
import Head from "next/head";
import Link from "next/link";

/* -------------------------------------------------------------------------- */
/* Static data                                                                 */
/* -------------------------------------------------------------------------- */

const LAST_UPDATED = "January 15, 2025";
const EFFECTIVE    = "January 15, 2025";
const CONTACT_EMAIL = "hello@checkpeak.app";

const SECTIONS = [
  {
    id:    "information-we-collect",
    title: "Information We Collect",
    body: [
      {
        heading: "Information you provide directly",
        text: "When you create an account, we collect your email address and any profile information you choose to provide. If you contact us for support, we retain those communications to help resolve your issue.",
      },
      {
        heading: "Images you upload for scanning",
        text: "When you use CheckPeak to scan a supplement or nutrition label, the image is transmitted to our servers for optical character recognition (OCR) processing. We do not permanently store your uploaded images. Images are processed in memory and discarded immediately after the scan result is returned to you. We do not use your label images to train AI models.",
      },
      {
        heading: "Scan results and usage data",
        text: "We retain anonymised scan result data — the ingredients detected and their risk classifications — to improve the accuracy of our ingredient database. This data is not linked to your identity or account. We also collect standard usage analytics such as pages visited, features used, and session duration to understand how people use CheckPeak.",
      },
      {
        heading: "Saved stacks and preferences",
        text: "If you use the SmartStack feature and save products to your account, we store those associations (your email address and the product IDs you have saved) to sync your preferences across devices.",
      },
      {
        heading: "Technical and device data",
        text: "We automatically collect standard technical information including your IP address, browser type, device type, operating system, and referring URLs. This information is used for security, debugging, and aggregate analytics only.",
      },
    ],
  },
  {
    id:    "how-we-use-information",
    title: "How We Use Your Information",
    body: [
      {
        heading: "To provide the service",
        text: "We use your information to operate CheckPeak — processing scans, returning results, syncing your saved stacks, and authenticating your account.",
      },
      {
        heading: "To improve accuracy",
        text: "Anonymised scan data helps us expand and improve our ingredient database so CheckPeak gets more accurate over time. No personal information is involved in this process.",
      },
      {
        heading: "To communicate with you",
        text: "We may send you transactional emails (account confirmations, password resets) and, if you opt in, occasional product updates. You can unsubscribe from marketing emails at any time.",
      },
      {
        heading: "To protect the service",
        text: "We use technical data to detect abuse, prevent fraud, enforce our Terms of Service, and maintain the security and integrity of CheckPeak.",
      },
    ],
  },
  {
    id:    "sharing",
    title: "Sharing Your Information",
    body: [
      {
        heading: "We do not sell your data",
        text: "CheckPeak does not sell, rent, or trade your personal information to third parties. We are not affiliated with any supplement brand or manufacturer. Our business model is not dependent on monetising user data.",
      },
      {
        heading: "Service providers",
        text: "We work with a small number of trusted third-party service providers (hosting infrastructure, authentication, analytics) who process data on our behalf under strict data processing agreements. These providers are not permitted to use your data for their own purposes.",
      },
      {
        heading: "Legal requirements",
        text: "We may disclose information if required by law, court order, or governmental authority, or if we believe disclosure is necessary to protect the safety of any person or the integrity of our service.",
      },
      {
        heading: "Business transfers",
        text: "In the event of a merger, acquisition, or sale of all or a portion of our assets, user information may be transferred as part of that transaction. We will notify you before your personal data is subject to a different privacy policy.",
      },
    ],
  },
  {
    id:    "cookies",
    title: "Cookies & Tracking",
    body: [
      {
        heading: "Essential cookies",
        text: "We use cookies that are strictly necessary to operate CheckPeak — for example, to keep you signed in across sessions. These cannot be disabled without breaking the service.",
      },
      {
        heading: "Analytics cookies",
        text: "With your consent, we use analytics cookies to understand aggregate usage patterns. We do not use advertising cookies or cross-site tracking cookies of any kind.",
      },
      {
        heading: "Managing cookies",
        text: "You can manage your cookie preferences at any time using the Cookie Settings link in our footer. Most browsers also allow you to block or delete cookies directly from browser settings.",
      },
    ],
  },
  {
    id:    "your-rights",
    title: "Your Rights",
    body: [
      {
        heading: "Access and correction",
        text: "You can access and update your account information at any time from your account settings. If you need help correcting inaccurate data we hold about you, contact us and we will assist promptly.",
      },
      {
        heading: "Deletion",
        text: "You can delete your CheckPeak account at any time. Deleting your account removes your email address, saved stacks, and all personally identifiable information from our active systems within 30 days. Anonymised, non-identifiable scan data is retained to support database accuracy.",
      },
      {
        heading: "Data portability",
        text: "You can request a copy of the personal data associated with your account in a machine-readable format. Contact us at the email below to make this request.",
      },
      {
        heading: "European and California residents",
        text: "If you are located in the European Economic Area, UK, or California, you have additional rights under GDPR and CCPA respectively, including the right to object to processing and the right to non-discrimination. Contact us to exercise any of these rights.",
      },
    ],
  },
  {
    id:    "security",
    title: "Data Security",
    body: [
      {
        heading: "How we protect your data",
        text: "We use industry-standard security measures including TLS encryption in transit, encrypted storage at rest, and strict access controls. Only a small number of authorised personnel have access to production systems.",
      },
      {
        heading: "No system is perfect",
        text: "Despite our best efforts, no method of transmission or storage is 100% secure. If you discover a security vulnerability, please contact us responsibly at our support email before disclosing it publicly.",
      },
    ],
  },
  {
    id:    "children",
    title: "Children's Privacy",
    body: [
      {
        heading: "Age requirement",
        text: "CheckPeak is not directed at children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided us with personal information, please contact us and we will delete it promptly.",
      },
    ],
  },
  {
    id:    "changes",
    title: "Changes to This Policy",
    body: [
      {
        heading: "How we notify you",
        text: "If we make material changes to this Privacy Policy, we will notify you by email (to the address associated with your account) and by posting a prominent notice on the CheckPeak website at least 14 days before the changes take effect. Continued use of CheckPeak after the effective date constitutes your acceptance of the revised policy.",
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

export default function PrivacyPage() {
  return (
    <>
      <Head>
        <title>Privacy Policy — CheckPeak</title>
        <meta name="description" content="CheckPeak's privacy policy. How we collect, use, and protect your data when you use our supplement scanning tools." />
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
            background:   "rgba(248,249,250,0.95)",
            backdropFilter: "blur(12px)",
            borderColor:  "#e2e8f0",
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

            {/* ── Sidebar — sticky on desktop ── */}
            <aside className="hidden lg:block">
              <div className="sticky top-20 space-y-8">
                <TableOfContents sections={SECTIONS} />

                {/* Sister page link */}
                <div
                  className="rounded-xl p-4"
                  style={{ background: "#f1f5f9", border: "1px solid #e2e8f0" }}
                >
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Also read
                  </p>
                  <Link
                    href="/terms"
                    className="text-sm font-semibold transition-colors"
                    style={{ color: "#334155" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#5B9EC9"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "#334155"; }}
                  >
                    Terms of Service →
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
                  Privacy Policy
                </h1>

                <p className="mt-3 text-sm text-slate-500 leading-relaxed max-w-2xl">
                  This policy explains what information CheckPeak collects, how we use it,
                  and what rights you have over your data. We've written it in plain English
                  because we think you deserve to actually understand it.
                </p>

                <div className="mt-5 flex flex-wrap gap-4 text-xs text-slate-400">
                  <span>Effective: <strong className="text-slate-600">{EFFECTIVE}</strong></span>
                  <span>Last updated: <strong className="text-slate-600">{LAST_UPDATED}</strong></span>
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
                          <h3
                            className="text-sm font-bold text-slate-800 mb-1.5"
                          >
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
                  Questions about this policy?
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">
                  We're happy to explain anything in more detail. Reach out and a real
                  person will respond — not an automated form letter.
                </p>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all"
                  style={{
                    background: "#0A0C10",
                    color:      "#fff",
                  }}
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
                  href="/terms"
                  className="transition-colors"
                  style={{ color: "#94a3b8" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#5B9EC9"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "#94a3b8"; }}
                >
                  Terms of Service →
                </Link>
              </div>
            </main>
          </div>
        </div>
      </div>
    </>
  );
}