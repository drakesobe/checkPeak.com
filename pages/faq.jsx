// pages/faq.jsx
import { useMemo, useState } from "react";
import Head from "next/head";

const dot = (
  <span aria-hidden="true" className="block h-2 w-2 rounded-full bg-sky-400" />
);

const rawFaqs = [
  {
    id: "what-is-checkpeak",
    category: "Getting started",
    icon: dot,
    question: "What is CheckPeak?",
    answer: `
      CheckPeak is an accountability platform for college strength and conditioning programs. Coaches build the
      schedule, assign workouts and nutrition plans, and review proof that work was done. Athletes see what's due
      today on their phone, log it with a photo or video, and check supplements before they take them.
    `,
  },
  {
    id: "who-is-it-for",
    category: "Getting started",
    icon: dot,
    question: "Who is it built for?",
    answer: `
      Strength coaches, sport coaches and athletic staff at college programs, and the athletes on their roster.
      Staff accounts manage the program; athletes join with their team code and use the mobile app.
    `,
  },
  {
    id: "coach-setup",
    category: "For coaches",
    icon: dot,
    question: "How long does setup take?",
    answer: `
      Most programs are running the same day. After you sign up, a short checklist on your Today page walks you
      through getting athletes on the team (they join with your team code), setting season dates, assigning your
      first workout and inviting your staff.
    `,
  },
  {
    id: "coach-proof",
    category: "For coaches",
    icon: dot,
    question: "How do I know athletes actually did the work?",
    answer: `
      Workouts can require photo or video proof. Every submission lands in your Review Queue, timestamped, where you
      approve it or ask for more. You see who's done, who's behind and who hasn't checked in today.
    `,
  },
  {
    id: "coach-compliance",
    category: "Compliance & safety",
    icon: dot,
    question: "Does it help with NCAA countable-hour rules?",
    answer: `
      Yes. You set your season dates once, and CheckPeak tracks required (countable) and voluntary activity against
      them so your schedule stays inside the rules. It supports your compliance office; it doesn't replace it.
    `,
  },
  {
    id: "supplement-scanner",
    category: "Compliance & safety",
    icon: dot,
    question: "How does the supplement check work?",
    answer: `
      Athletes photograph a supplement label or scan its barcode. We read every ingredient and check it against
      banned-substance lists from the NCAA, WADA and the major pro leagues, then give a clear result: flagged,
      needs review, or no match. "No match" is never a guarantee: banned lists cover whole classes of substances and
      products can be contaminated, so third-party certified products are always the safest choice.
    `,
  },
  {
    id: "athlete-app",
    category: "For athletes",
    icon: dot,
    question: "What do athletes need?",
    answer: `
      The CheckPeak app and the team code from their coach. The app shows today's workouts, nutrition and classes,
      lets them log proof, message their coaches and check supplements.
    `,
  },
  {
    id: "privacy",
    category: "Compliance & safety",
    icon: dot,
    question: "Who can see an athlete's data?",
    answer: `
      Only the athlete and staff on their own program. Athletes' supplement scans stay private to them unless they
      choose to share one.
    `,
  },
  {
    id: "pricing",
    category: "Pricing",
    icon: dot,
    question: "How much does it cost?",
    answer: `
      Free for programs with up to 10 athletes. Unlimited athletes, staff and every feature is one flat monthly or
      annual price, with no per-seat fees. See the pricing page for current rates.
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
          content="Answers for college coaches and athletes: setup, workout proof, NCAA compliance, supplement checks and pricing."
        />
      </Head>

      <main className="min-h-screen bg-black text-gray-100">
        <div className="mx-auto max-w-4xl px-4 pb-20 pt-14 sm:px-6 lg:px-8">
          {/* Top header block */}
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-sky-300">
                Frequently Asked Questions
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-3xl">
                Quick answers, no jargon.
              </h1>
              <p className="mt-2 text-sm text-gray-400 leading-relaxed">
                How CheckPeak works for college programs: setup, accountability,
                compliance and supplement checks.
              </p>
            </div>

            <div className="text-right text-[11px] text-gray-500">
              <p>Last updated: {new Date().getFullYear()}</p>
              <p>More questions? <a href="/contact" className="text-sky-300 hover:text-sky-200 underline underline-offset-4">Contact support</a></p>
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
                          ? "border-sky-400 bg-sky-500/15 text-sky-200"
                          : "border-gray-700 bg-black/40 text-gray-400 hover:border-sky-400/60 hover:text-sky-200",
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
                className="rounded-lg border border-gray-800 bg-gray-900/40 transition hover:border-sky-500/40 hover:bg-gray-900/60"
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
                      openId === faq.id ? "rotate-180 text-sky-300" : ""
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
            and input from qualified professionals - especially if you compete under
            strict testing rules.
          </div>
        </div>
      </main>
    </>
  );
}
