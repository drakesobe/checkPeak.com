// pages/index.js
"use client";

import Head from "next/head";
import HeroSection from "@/components/HeroSection";
import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  FaBolt,
  FaCheckCircle,
  FaHistory,
  FaShieldAlt,
  FaDumbbell,
  FaUtensils,
  FaClipboardList,
  FaUsers,
  FaChartLine,
  FaUniversity,
} from "react-icons/fa";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Pulled outside the component — no dependencies on props/state, so there's
// no reason to recreate this function on every render.
function track(action, params = {}) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", action, params);
  }
}

// Centralise the auth-modal open logic so it isn't copy-pasted six times.
// Accepts an optional { tab, role } config.
function openAuthModal({ tab = "signup", role = "organization" } = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("auth:open", { detail: { tab, role } }));
  if (typeof window.__openLoginModal === "function") {
    window.__openLoginModal({ tab, role });
  }
}

// ---------------------------------------------------------------------------
// Static data (outside component — avoids re-creation on every render)
// ---------------------------------------------------------------------------

const PARTICLES = [
  { cx: 120, cy: 140, r: 2.2, dur: 12, delay: 0.1 },
  { cx: 380, cy: 220, r: 2.0, dur: 14, delay: 0.4 },
  { cx: 680, cy: 180, r: 2.5, dur: 11, delay: 0.2 },
  { cx: 220, cy: 420, r: 1.9, dur: 15, delay: 0.6 },
  { cx: 610, cy: 520, r: 2.2, dur: 13, delay: 0.7 },
  { cx: 980, cy: 240, r: 2.1, dur: 16, delay: 0.5 },
  { cx: 880, cy: 520, r: 2.0, dur: 12, delay: 0.3 },
  { cx: 520, cy: 320, r: 2.3, dur: 14, delay: 0.8 },
];

const VALUE_BULLETS = [
  {
    icon: <FaDumbbell className="text-white/90" />,
    title: "Workout check-ins",
    desc: "Athletes complete workouts and check in quickly. Evidence (photo/video/notes) can be optional or required. YOUR program sets the rules.",
  },
  {
    icon: <FaUtensils className="text-white/90" />,
    title: "Nutrition plans that stick",
    desc: "Meal-based targets, not tedious tracking. Coaches set macros by meal with dining hall vs at home tips. Athletes mark their meal or hydration complete in seconds.",
  },
  {
    icon: <FaShieldAlt className="text-white/90" />,
    title: "Supplement screening",
    desc: "At-home label scanning to flag banned/high-risk compounds and common aliases. Save scans to cut repeat research and reduce the risk of accidental positives.",
  },
];

const PROOF_STRIPS = [
  {
    icon: <FaClipboardList className="text-[#46769B]" />,
    title: "Replace texts + spreadsheets",
    desc: "Check-ins land in one place with clear status, timestamps, and next steps — so nobody loses context.",
  },
  {
    icon: <FaUsers className="text-[#46769B]" />,
    title: "Less guessing, more support",
    desc: "Athletes get clear expectations, how-to video links, and actionable feedback to reduce form mistakes, under-fueling, and confusion. Coaches and trainers get visibility to step in early — before issues pile up.",
  },
  {
    icon: <FaChartLine className="text-[#46769B]" />,
    title: "Weekly summaries you can act on",
    desc: "A simple weekly view by athlete and team — so follow-ups are quick and fair.",
  },
];

const WHY_PROBLEMS = [
  {
    q: "How much time and scholarship money gets burned when athletes return unready?",
    a: "CheckPeak keeps offseason expectations clear and check-ins consistent — so you spend camp on install, not playing catch-up on failed conditioning evals.",
  },
  {
    q: "What are you losing when athletes don't train — or train wrong — during the offseason?",
    a: "Clear plans + how-to guidance + simple check-ins help catch form and compliance issues early — before they turn into missed time, lost progress, and potential injuries.",
  },
  {
    q: "How fast can staff answer, 'Can I take this supplement?' without digging for hours?",
    a: "Saved scans + flagged ingredients give a quick, consistent starting point — so players and staff can review quickly and athletes don't need to guess.",
  },
];

const WORKFLOW_STEPS = [
  {
    step: "STEP 1",
    title: "Set plans",
    desc: "Create workout templates and nutrition plans for offseason, in-season, rehab, or return-to-play.",
    icon: <FaClipboardList className="text-[#46769B]" />,
  },
  {
    step: "STEP 2",
    title: "Athletes check in",
    desc: "Athletes submit one check-in per workout with notes and optional evidence. You choose when proof is required and when a simple confirmation is enough.",
    icon: <FaDumbbell className="text-[#46769B]" />,
  },
  {
    step: "STEP 3",
    title: "Staff reviews",
    desc: "Review in a queue: approve, request info, or leave feedback. Keep it consistent and fair across athletes.",
    icon: <FaCheckCircle className="text-[#46769B]" />,
  },
  {
    step: "STEP 4",
    title: "Weekly overview",
    desc: "See weekly progress by athlete/team so follow-ups are quick — and expectations stay clear.",
    icon: <FaChartLine className="text-[#46769B]" />,
  },
];

const MODULES = [
  {
    icon: <FaDumbbell size={30} className="mx-auto mb-2 text-[#46769B]" />,
    title: "Workout accountability",
    desc: "Assign workout templates, collect quick photo check-ins, and review in a clean queue. Keep athletes on track to minimise injuries and potential regression.",
  },
  {
    icon: <FaUtensils size={30} className="mx-auto mb-2 text-purple-500" />,
    title: "Nutrition targets",
    desc: "Meal-based macro targets that are home or dining-hall friendly. Athletes track their meals + hydration in seconds — no tedious calorie counting.",
  },
  {
    icon: <FaShieldAlt size={30} className="mx-auto mb-2 text-emerald-600" />,
    title: "Supplement label screening",
    desc: "At-home label scanning to flag banned/high-risk compounds and common aliases. Save scans for quick reference so staff and athletes aren't guessing.",
  },
];

const COACH_CHECKLIST = [
  "Review queue with consistent outcomes (approved / needs info / follow-up)",
  "Set when proof is optional or required with photo evidence based on the workout",
  "Weekly visibility by athlete + team to catch offseason drift before camp",
  "Feedback stays attached to each check-in (timestamps + context) so follow-ups are clean",
];

const ATHLETE_CHECKLIST = [
  "One place to see workouts, instructions, and how-to links",
  "Meal-based macro targets + hydration, built for dining halls and real life — no tedious calorie tracking",
  "Simple check-ins with notes — photo/video evidence only when your program requires it",
  "Free label scans that flag high-risk ingredients and aliases, plus saved scan history",
];

const FOUNDING_FEATURES = [
  {
    title: "Workout accountability",
    desc: "Check-ins keep routines steady during breaks and the offseason.",
  },
  {
    title: "Nutrition targets",
    desc: "Meal-based macro targets with dining hall vs home guidance — plus hydration goals.",
  },
  {
    title: "Supplement label screening",
    desc: "At-home label scanning to flag banned/high-risk compounds and their common aliases.",
  },
];

const PILOT_COLUMNS = [
  {
    title: "Onboarding & setup",
    items: [
      "Configure staff roles + permissions (Admin / Trainer / Coach)",
      "Invite athletes and connect them to your organisation (tokens supported)",
      "Create workout templates + nutrition meal targets — and choose when evidence is optional vs required",
    ],
  },
  {
    title: "Weekly rhythm",
    items: [
      "Athletes complete workouts and submit quick check-ins (notes + photo/video only when required)",
      "Staff reviews in a queue with consistent outcomes (approved / needs info / follow-up) + attached feedback",
      "Weekly snapshot by athlete + team to catch drift early",
    ],
  },
  {
    title: "Expected results",
    items: [
      "Clearer execution: athletes know exactly what to do and how to do it",
      "Competitive offseason: see who's staying competitive — and who isn't",
      "Less regression: catch form/fuelling gaps early to reduce avoidable setbacks",
    ],
  },
];

const SCAN_LINKS = [
  { href: "/nutrition-label-scanner", label: "Nutrition Label", target: "nutrition-label-scanner" },
  { href: "/supplement-label-scanner", label: "Supplement Label", target: "supplement-label-scanner" },
  { href: "/banned-substance-checker", label: "Banned Substance", target: "banned-substance-checker" },
  { href: "/pre-workout-label-scanner", label: "Pre-Workout", target: "pre-workout-label-scanner" },
  { href: "/protein-powder-label-scanner", label: "Protein Powder", target: "protein-powder-label-scanner" },
];

// ---------------------------------------------------------------------------
// Reusable sub-components
// ---------------------------------------------------------------------------

// Checklist row used in both the Coaches and Athletes panels.
function CheckItem({ text }) {
  return (
    <li className="flex gap-2">
      <span className="mt-0.5 shrink-0 text-emerald-600">
        <FaCheckCircle />
      </span>
      <span>{text}</span>
    </li>
  );
}

// The repeated "open auth modal" CTA button used in several sections.
function AuthCTAButton({ source, className, children, ...rest }) {
  const handleClick = useCallback(() => {
    track("cta_auth_open", { source, tab: "signup", role: "organization" });
    openAuthModal();
  }, [source]);

  return (
    <button type="button" onClick={handleClick} className={className} {...rest}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function HomePage() {
  const ogText = "CheckPeak — Athlete Tools + Team Workflows";

  // Derive the canonical URL from the environment so it works across
  // staging / production without hardcoding.
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://checkpeak.com";

  const [disclaimerOpen, setDisclaimerOpen] = useState(false);

  // Email-capture form state
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Coach / Staff");
  const [org, setOrg] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setErr("");
      setOk(false);

      const clean = email.trim();
      if (!clean || !clean.includes("@")) {
        setErr("Please enter a valid email.");
        return;
      }

      setLoading(true);
      try {
        track("email_capture_submit", { source: "home", role });

        const res = await fetch("/api/waitlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: clean,
            role,
            organization: org || null,
            source: "home_founding_teams",
          }),
        });

        if (!res.ok) throw new Error("Unable to save. Please try again.");

        setOk(true);
        setEmail("");
        setOrg("");
        setRole("Coach / Staff");
      } catch (error) {
        console.error(error);
        setErr(error?.message || "Something went wrong. Please try again shortly.");
      } finally {
        setLoading(false);
      }
    },
    [email, role, org]
  );

  return (
    <>
      <Head>
        <title>CheckPeak — Workouts + Nutrition Plans + Supplement Screening</title>
        <meta
          name="description"
          content="CheckPeak keeps athletes and staff aligned away from campus: workout check-ins with optional evidence, full-form nutrition plans, and supplement label scanning to flag banned/high-risk ingredients."
        />

        {/* Open Graph */}
        <meta property="og:title" content="CheckPeak — Athlete + Team Workflow" />
        <meta
          property="og:description"
          content="Away-from-campus made simple: workouts + nutrition plans + supplement screening. Athlete-friendly check-ins, staff review queues, and weekly summaries."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={siteUrl} />
        <meta
          property="og:image"
          content={`${siteUrl}/api/og-image?q=${encodeURIComponent(ogText)}`}
        />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@checkPeak_" />
        <meta name="twitter:title" content="CheckPeak — Athlete + Team Workflow" />
        <meta
          name="twitter:description"
          content="Workouts + nutrition + supplement screening. Athlete-friendly check-ins, staff review queues, and weekly summaries — built for programs."
        />
        <meta
          name="twitter:image"
          content={`${siteUrl}/api/og-image?q=${encodeURIComponent(ogText)}`}
        />
      </Head>

      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans flex flex-col">

        {/* ================================================================
            HERO
        ================================================================ */}
        <HeroSection />

        {/* ================================================================
            WHY / PROBLEMS
        ================================================================ */}
        <section id="why" className="py-14 bg-white">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto">
              <p className="text-xs font-semibold tracking-wide text-[#46769B]">WHY TEAMS USE CHECKPEAK</p>
              <h2 className="text-2xl md:text-3xl font-bold mt-2">Away-from-campus is where plans drift.</h2>
              <p className="text-sm text-gray-600 mt-3 leading-relaxed">
                Offseason, breaks, travel, and rehab are where routines get messy. CheckPeak keeps it simple:
                athletes check in, staff responds with quick feedback, and everyone stays aligned.
              </p>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-3 text-sm">
              {WHY_PROBLEMS.map((x) => (
                <div key={x.q} className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-xs font-semibold text-[#46769B] mb-1">COMMON PROBLEM</p>
                  <h3 className="font-semibold mb-2 leading-snug">{x.q}</h3>
                  <p className="text-gray-600 leading-relaxed">{x.a}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-6">
              <p className="text-sm text-gray-700 leading-relaxed">
                One workflow instead of ten workarounds. CheckPeak replaces scattered texts and spreadsheets
                with a simple rhythm: clear expectations, quick check-ins, and consistent follow-ups —
                without needing extra staff.
              </p>
            </div>
          </div>
        </section>

        {/* ================================================================
            HOW IT WORKS
        ================================================================ */}
        <section className="py-14 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto">
              <p className="text-xs font-semibold tracking-wide text-[#46769B]">THE WORKFLOW</p>
              <h2 className="text-2xl md:text-3xl font-bold mt-2">Simple check-ins. Clear feedback.</h2>
              <p className="text-sm text-gray-600 mt-3 leading-relaxed">
                Easy for athletes to use, quick for staff to review. Everything stays organised by team, date, and athlete.
              </p>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              {WORKFLOW_STEPS.map((x) => (
                <div
                  key={x.step}
                  className="p-6 bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-[#46769B]">{x.step}</p>
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-blue-50 border border-blue-100">
                      {x.icon}
                    </span>
                  </div>
                  <h3 className="font-semibold mt-3">{x.title}</h3>
                  <p className="text-gray-600 mt-2 text-sm leading-relaxed">{x.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => {
                  track("internal_link", { source: "workflow", target: "auth_modal_org" });
                  openAuthModal();
                }}
                className="text-sm font-semibold text-[#46769B] hover:underline underline-offset-4"
              >
                Explore the team dashboard →
              </button>

              <Link
                href="/nutrition-label-scanner"
                onClick={() => track("internal_link", { source: "workflow", target: "nutrition-label-scanner" })}
                className="text-sm font-semibold text-[#46769B] hover:underline underline-offset-4"
              >
                Run a supplement scan →
              </Link>
            </div>
          </div>
        </section>

        {/* ================================================================
            MODULES / WHAT YOU GET
        ================================================================ */}
        <section className="py-14 bg-white">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto">
              <p className="text-xs font-semibold tracking-wide text-[#46769B]">WHAT YOU GET</p>
              <h2 className="text-2xl md:text-3xl font-bold mt-2">Three tools. One place.</h2>
              <p className="text-sm text-gray-600 mt-3 leading-relaxed">
                Athletes shouldn't need five apps. Staff shouldn't chase ten different channels.
                CheckPeak keeps it all in one place: workout templates, nutrition meal targets + hydration
                check-ins, review queues with clear outcomes, weekly summaries, saved scan history, and
                verified label scanning.
              </p>
            </div>

            <div className="mt-10 grid gap-7 md:grid-cols-3 text-center">
              {MODULES.map((f) => (
                <div
                  key={f.title}
                  className="p-7 bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition"
                >
                  {f.icon}
                  <h3 className="text-xl font-semibold mb-2">{f.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>

            {/* Coaches + Athletes panels */}
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-left">
                <p className="text-xs font-semibold tracking-wide text-[#46769B]">FOR COACHES & STAFF</p>
                <h3 className="text-lg font-bold mt-2">Less chasing. Cleaner communication.</h3>
                <ul className="mt-3 space-y-2 text-sm text-gray-700">
                  {COACH_CHECKLIST.map((item) => (
                    <CheckItem key={item} text={item} />
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-left">
                <p className="text-xs font-semibold tracking-wide text-[#46769B]">FOR ATHLETES</p>
                <h3 className="text-lg font-bold mt-2">Clear plans. Easy check-ins.</h3>
                <ul className="mt-3 space-y-2 text-sm text-gray-700">
                  {ATHLETE_CHECKLIST.map((item) => (
                    <CheckItem key={item} text={item} />
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================
            FOUNDING TEAMS / PRICING TEASER
        ================================================================ */}
        <section className="py-14 bg-gray-50 border-t border-gray-100">
          <div className="max-w-6xl mx-auto px-4">
            <div className="grid gap-8 lg:grid-cols-2 items-start">

              {/* Left — copy */}
              <div>
                <p className="text-xs font-semibold tracking-wide text-[#46769B]">PROGRAMS</p>
                <h2 className="text-2xl md:text-3xl font-bold mt-2">Founding 26 Teams</h2>
                <p className="text-sm text-gray-600 mt-3 leading-relaxed">
                  A simple, team-friendly way to roll out check-ins this year. Start with one team, build your
                  templates, and expand to more teams as you go. Built to work for programs of any size —
                  without adding admin overhead.
                </p>

                <div className="mt-5 space-y-2 text-sm text-gray-700">
                  {[
                    { bold: "$2,988 / year", rest: "for the first 26 teams onboarded" },
                    { bold: "30-day pilot included", rest: "to onboard athletes and set up plans" },
                    { bold: "Rate locked for 3 years", rest: "as long as you renew annually" },
                    { bold: "Use code", rest: "Founding26 at signup" },
                  ].map(({ bold, rest }) => (
                    <div key={bold} className="flex items-start gap-2">
                      <span className="mt-1 text-[#46769B] shrink-0">
                        <FaCheckCircle />
                      </span>
                      <p>
                        <span className="font-semibold">{bold}</span> {rest}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-row flex-wrap items-center justify-start gap-x-4 gap-y-2">
                  <a
                    href="#pilot"
                    onClick={() => track("learn_more", { source: "founding_26" })}
                    className="text-sm font-semibold text-[#46769B] hover:underline underline-offset-4 whitespace-nowrap"
                  >
                    What's included in the pilot →
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      track("cta_auth_open", { source: "founding_26", tab: "signup", role: "organization" });
                      openAuthModal();
                    }}
                    className="text-sm font-semibold text-[#46769B] hover:underline underline-offset-4 whitespace-nowrap"
                  >
                    Start with your team →
                  </button>
                </div>

                <p className="mt-4 text-[11px] text-gray-500">
                  All-inclusive team pricing — no hidden per-athlete add-ons or multi-team upcharges.
                </p>
              </div>

              {/* Right — value card */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold tracking-wide text-[#46769B]">WHY IT'S WORTH IT</p>
                <h3 className="text-lg font-bold mt-2">Reduce the "return unready" scramble.</h3>
                <p className="text-sm text-gray-600 mt-3 leading-relaxed">
                  When athletes return behind, progress regresses and camp turns into catch-up. CheckPeak
                  keeps the rhythm steady — clear plans, quick check-ins, and early visibility — so you catch
                  issues before they become setbacks.
                </p>

                <div className="mt-5 grid gap-3">
                  {FOUNDING_FEATURES.map((x) => (
                    <div key={x.title} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <p className="font-semibold text-sm">{x.title}</p>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">{x.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  {/*
                    FIX: Removed the wrapping <Link href="#lead"> — nesting an interactive
                    element inside another is invalid HTML and breaks screen readers.
                    The button itself handles the action; no anchor is needed here.
                  */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      track("cta_auth_open", { source: "roi_card", tab: "signup", role: "organization" });
                      openAuthModal();
                    }}
                    className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl bg-[#46769B] text-white font-semibold text-sm shadow-sm hover:brightness-110 transition"
                    type="button"
                    aria-label="Get started"
                  >
                    Get started <span className="font-extrabold">→</span>
                  </motion.button>

                  <p className="mt-3 text-[10px] text-gray-500 text-center">
                    30 days free to get athletes onboarded and your templates dialled in.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================
            PILOT DETAILS
        ================================================================ */}
        <section id="pilot" className="py-14 bg-white border-t border-gray-100">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto">
              <p className="text-xs font-semibold tracking-wide text-[#46769B]">30-DAY PILOT</p>
              <h2 className="text-2xl md:text-3xl font-bold mt-2">Start with one team. Make it easy.</h2>
              <p className="text-sm text-gray-600 mt-3 leading-relaxed">
                The goal is simple: get athletes onboard, build your templates, and establish a weekly rhythm
                that feels fair and low-friction. You'll finish with clear adoption and a repeatable process.
              </p>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              {PILOT_COLUMNS.map((c) => (
                <div key={c.title} className="p-6 rounded-2xl border border-gray-200 bg-gray-50">
                  <h3 className="font-semibold text-lg">{c.title}</h3>
                  <ul className="mt-3 space-y-2 text-sm text-gray-700">
                    {c.items.map((it) => (
                      <CheckItem key={it} text={it} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-10 flex justify-center">
              {/*
                FIX: Removed wrapping <Link href="#lead"> around a button — same
                invalid nesting issue as the ROI card above.
              */}
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  track("cta_auth_open", { source: "pilot_section", tab: "signup", role: "organization" });
                  openAuthModal();
                }}
                className="px-8 py-3.5 rounded-2xl bg-[#1D2433] text-white font-extrabold shadow-sm hover:brightness-110 transition"
                type="button"
                aria-label="Get started from pilot section"
              >
                Let's get started →
              </motion.button>
            </div>
          </div>
        </section>

        {/* ================================================================
            SCAN BY CATEGORY
        ================================================================ */}
        <section className="bg-white py-12 border-t border-gray-100">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-wide text-[#46769B]">SUPPLEMENT TOOL</p>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Scan by category</h2>
                <p className="mt-2 text-sm text-gray-600 max-w-2xl">
                  Use the CheckPeak scan engine to screen labels and ingredients for banned/high-risk compounds
                  and aliases. Always verify final decisions with your governing body and certified professionals.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 md:justify-end">
                {SCAN_LINKS.map((x) => (
                  <a
                    key={x.href}
                    href={x.href}
                    onClick={() => track("internal_link", { source: "scan_by_category", target: x.target })}
                    className="px-3 py-2 rounded-full text-xs font-semibold border border-gray-200 bg-gray-50 hover:bg-white hover:shadow-sm transition"
                  >
                    {x.label}
                  </a>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5">
              <p className="text-sm text-gray-700 leading-relaxed">
                Not sure which one to use? Start with{" "}
                <a
                  href="/nutrition-label-scanner"
                  onClick={() =>
                    track("internal_link", {
                      source: "scan_by_category_helper",
                      target: "nutrition-label-scanner",
                    })
                  }
                  className="font-semibold text-[#46769B] hover:underline underline-offset-4"
                >
                  Nutrition Label Scanner
                </a>{" "}
                — it covers most supplement facts panels and ingredient lists.
              </p>
            </div>
          </div>
        </section>

        {/* ================================================================
            DISCLAIMER (collapsible)
        ================================================================ */}
        <section className="py-12">
          <div className="max-w-3xl mx-auto px-4">
            <div className="bg-yellow-50 border-l-4 border-yellow-300 rounded-lg shadow-sm text-left text-yellow-800">
              <button
                type="button"
                onClick={() => setDisclaimerOpen((v) => !v)}
                className="w-full p-6 flex items-start justify-between gap-4 text-left"
                aria-expanded={disclaimerOpen}
                aria-controls="disclaimer-body"
              >
                <div>
                  <p className="font-semibold mb-1 text-xs md:text-sm">Important Notice</p>
                  <p className="text-[11px] md:text-xs text-yellow-800/80">
                    {disclaimerOpen ? "Tap to hide details" : "Tap to view details"}
                  </p>
                </div>
                <span className="mt-1 shrink-0 text-yellow-800/80" aria-hidden="true">
                  {disclaimerOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </span>
              </button>

              {disclaimerOpen && (
                <div id="disclaimer-body" className="px-6 pb-6 -mt-2">
                  <p className="leading-relaxed text-xs md:text-sm">
                    CheckPeak provides workflow tools for workouts and nutrition plans, plus screening guidance
                    for potentially banned or high-risk substances using databases and label analysis. It is{" "}
                    <strong>not 100% comprehensive</strong>, and results do not replace official rulings or
                    medical advice. Always verify with your governing body, certified authority, athletic
                    trainer, or medical professional before consuming any product.
                  </p>
                  <p className="mt-3 text-[11px] text-yellow-900/70">
                    Tip: Use saved scans as a starting point — final decisions should follow your program's
                    compliance process.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

      </div>
    </>
  );
}
