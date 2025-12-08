// pages/faq.jsx
import { useMemo, useState } from "react";
import Head from "next/head";

const rawFaqs = [
  {
    id: "what-is-checkpeak",
    category: "Getting Started",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 text-emerald-400"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <circle cx="12" cy="12" r="9" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 8v6m0 4h.01"
        />
      </svg>
    ),
    question: "What does CheckPeak actually do?",
    answer: `
      CheckPeak gives you a fast, clear breakdown of the ingredients in your supplements.
      You scan a label, and we highlight banned substances, risky compounds, and ingredients worth a second look.
      The goal isn't fear — it's clarity. You shouldn't need a chemistry degree to know what's going into your body.
    `,
  },
  {
    id: "how-scanning-works",
    category: "Getting Started",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 text-emerald-400"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <rect x="4" y="5" width="16" height="14" rx="2" ry="2" />
        <path d="M8 9h8M8 13h5" />
      </svg>
    ),
    question: "How does the scanner work?",
    answer: `
      Our OCR system reads your label photo, extracts the ingredient list, and matches everything against
      the CheckPeak Ingredient Database. This includes banned substances, synonyms, derivatives, and common blend names.
      You get a simple status result that tells you where to focus your attention — nothing more, nothing less.
    `,
  },
  {
    id: "accuracy",
    category: "Accuracy & Data",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 text-emerald-400"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    question: "How accurate are scans?",
    answer: `
      Accuracy mostly depends on the label image. Curved bottles, glossy backgrounds, tiny font sizes, and uneven lighting
      can make OCR struggle. A clear, straight photo gives the best results.

      That said — we update both the scanner and ingredient classifications consistently to stay ahead of new products.
    `,
  },
  {
    id: "why-flagged",
    category: "Flags & Safety",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 text-emerald-400"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path d="M6 4v16" strokeLinecap="round" strokeLinejoin="round" />
        <path
          d="M6 5h8l-2 3 2 3H6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    question: "Why was an ingredient flagged?",
    answer: `
      Flags appear for one of several reasons:
      • It’s banned or restricted for competition.
      • It’s chemically similar to a banned compound.
      • It’s under-researched or frequently mislabeled by brands.
      • It’s part of a proprietary blend with unknown dosage.

      A flag is not a verdict — it’s simply a signal that this ingredient deserves closer attention.
    `,
  },
  {
    id: "unknown",
    category: "Flags & Safety",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 text-emerald-400"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <circle cx="12" cy="12" r="9" />
        <path
          d="M9.5 9.5A2.5 2.5 0 0112 8a2.5 2.5 0 012.5 2.5c0 1.5-1.25 2.1-1.9 2.5-.4.25-.6.5-.6 1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M12 16.5h.01" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    question: "What does “Unknown” or “Needs Review” mean?",
    answer: `
      Sometimes ingredient names are vague, stylized, extremely new, or intentionally branded to avoid detection.
      When we can’t match a compound with high confidence, we mark it as “Unknown.”

      You can submit it through our “Suggest an Ingredient” page — we review user submissions regularly.
    `,
  },
  {
    id: "safety",
    category: "Flags & Safety",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 text-emerald-400"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path d="M12 4l7 4v4c0 4-3 7-7 8-4-1-7-4-7-8V8l7-4z" />
        <path d="M12 10v4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 16.5h.01" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    question: "Is this medical or drug-testing advice?",
    answer: `
      No. CheckPeak is an educational and reference tool only.
      It does not replace your doctor, pharmacist, coach, or testing organization.
      Always follow the rules of your sport and get professional advice before making decisions about supplements.
    `,
  },
  {
    id: "database-updates",
    category: "Accuracy & Data",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 text-emerald-400"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          d="M4 12a8 8 0 0114-5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M20 12a8 8 0 01-14 5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4 4v4h4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M20 20v-4h-4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    question: "How often do you update the ingredient database?",
    answer: `
      We keep a close eye on new research, regulatory changes, and supplement trends.
      On top of that, athlete and coach submissions help us spot new compounds early.
      Updates happen regularly — not once a year.
    `,
  },
  {
    id: "suggest",
    category: "Submissions & Support",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 text-emerald-400"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path d="M12 4v16" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 12h16" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    question: "Can I suggest a new ingredient or correction?",
    answer: `
      Yes — and it genuinely helps. As brands launch new products and rebrand old compounds,
      athlete feedback keeps our database ahead of the curve.

      Use the “Suggest an Ingredient” page in the footer to send us details directly.
    `,
  },
  {
    id: "pricing",
    category: "Submissions & Support",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 text-emerald-400"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <circle cx="12" cy="12" r="9" />
        <path
          d="M12 7v2m0 8v-2m-2.5-3A2.5 2.5 0 0112 11a2.5 2.5 0 012.5 2.5c0 1.5-1.25 2.1-1.9 2.5-.4.25-.6.5-.6 1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    question: "Is CheckPeak free?",
    answer: `
      Yes — core scanning is currently free while we build and refine the platform.
      If we introduce paid features later, we’ll be transparent about what’s changing and why,
      and we’ll always keep core safety insight a priority.
    `,
  },
];

const categories = ["All", ...Array.from(new Set(rawFaqs.map((f) => f.category)))];

export default function FAQPage() {
  const [openId, setOpenId] = useState(rawFaqs[0]?.id ?? null);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [search, setSearch] = useState("");

  const filteredFaqs = useMemo(() => {
    return rawFaqs.filter((faq) => {
      const matchesCategory =
        selectedCategory === "All" || faq.category === selectedCategory;

      const q = search.trim().toLowerCase();
      if (!q) return matchesCategory;

      const haystack = (faq.question + " " + faq.answer).toLowerCase();
      const matchesSearch = haystack.includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, search]);

  const toggle = (id) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <>
      <Head>
        <title>FAQs | CheckPeak</title>
        <meta
          name="description"
          content="Frequently asked questions about CheckPeak—scanning, ingredient flags, safety, and accuracy in plain language."
        />
      </Head>

      <main className="min-h-screen bg-black text-gray-100">
        <div className="mx-auto max-w-4xl px-4 pb-20 pt-14 sm:px-6 lg:px-8">
          {/* Top header block */}
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-emerald-300">
                Frequently Asked Questions
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-3xl">
                Quick answers, no jargon.
              </h1>
              <p className="mt-2 text-sm text-gray-400 leading-relaxed">
                Learn how CheckPeak works, what our flags mean, and how to use scans
                alongside your own research, coaches, and doctors. Written for athletes,
                not chemists.
              </p>
            </div>

            <div className="text-right text-[11px] text-gray-500">
              <p>Last updated: {new Date().getFullYear()}</p>
              <p>More questions? <a href="/contact" className="text-emerald-300 hover:text-emerald-200 underline underline-offset-4">Contact support</a></p>
            </div>
          </div>

          {/* Search + category filters */}
          <div className="flex flex-col gap-4 rounded-xl border border-gray-850 bg-gray-950/60 p-4 mb-8">
            {/* Search */}
            <div>
              <label
                htmlFor="faq-search"
                className="block text-[11px] font-medium uppercase tracking-wide text-gray-500"
              >
                Search questions
              </label>
              <div className="mt-1 flex items-center gap-2 rounded-md border border-gray-800 bg-black/60 px-2 py-1.5">
                <svg
                  className="h-4 w-4 text-gray-500"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <circle cx="11" cy="11" r="6" />
                  <path
                    d="M16 16l3 3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <input
                  id="faq-search"
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by topic (e.g. flags, accuracy, banned)..."
                  className="w-full bg-transparent text-xs text-gray-100 placeholder-gray-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Categories */}
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                Topics
              </p>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => {
                  const isActive = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={[
                        "rounded-full border px-3 py-1 text-[11px] transition",
                        isActive
                          ? "border-emerald-400 bg-emerald-500/15 text-emerald-200"
                          : "border-gray-700 bg-black/40 text-gray-400 hover:border-emerald-400/60 hover:text-emerald-200",
                      ].join(" ")}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* FAQ accordion list */}
          <div className="space-y-3">
            {filteredFaqs.length === 0 && (
              <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4 text-sm text-gray-400">
                No questions matched your search. Try another keyword or reset filters.
              </div>
            )}

            {filteredFaqs.map((faq) => (
              <div
                key={faq.id}
                className="rounded-lg border border-gray-800 bg-gray-900/40 transition hover:border-emerald-500/40 hover:bg-gray-900/60"
              >
                <button
                  type="button"
                  onClick={() => toggle(faq.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                  aria-expanded={openId === faq.id}
                  aria-controls={`${faq.id}-content`}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-900/70 border border-gray-800">
                      {faq.icon}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-white">
                        {faq.question}
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {faq.category}
                      </span>
                    </div>
                  </div>

                  <svg
                    className={`h-4 w-4 transform text-gray-400 transition ${
                      openId === faq.id ? "rotate-180 text-emerald-300" : ""
                    }`}
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {/* Animated content */}
                <div
                  id={`${faq.id}-content`}
                  className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out ${
                    openId === faq.id ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  {openId === faq.id && (
                    <div className="px-4 pb-4 text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                      {faq.answer}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Soft footer disclaimer */}
          <div className="mt-12 rounded-lg border border-gray-800 bg-gray-900/70 p-4 text-xs text-gray-500 leading-relaxed">
            CheckPeak is built to help athletes and coaches make cleaner, more informed
            supplement decisions. It should always be used alongside your own research
            and input from qualified professionals — especially if you compete under
            strict testing rules.
          </div>
        </div>
      </main>
    </>
  );
}
