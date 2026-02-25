// pages/index.js
"use client";

import Head from "next/head";
import { useMemo, useState } from "react";
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

export default function HomePage() {
  const ogText = "CheckPeak — Athlete Tools + Team Workflows";
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Coach / Staff");
  const [org, setOrg] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);

  // Simple GA event helper (no-op if gtag not present)
  const track = (action, params = {}) => {
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", action, params);
    }
  };

  // Slightly reduced particles for perf (especially mobile)
  const particles = useMemo(
    () => [
      { cx: 120, cy: 140, r: 2.2, dur: 12, delay: 0.1 },
      { cx: 380, cy: 220, r: 2.0, dur: 14, delay: 0.4 },
      { cx: 680, cy: 180, r: 2.5, dur: 11, delay: 0.2 },
      { cx: 220, cy: 420, r: 1.9, dur: 15, delay: 0.6 },
      { cx: 610, cy: 520, r: 2.2, dur: 13, delay: 0.7 },
      { cx: 980, cy: 240, r: 2.1, dur: 16, delay: 0.5 },
      { cx: 880, cy: 520, r: 2.0, dur: 12, delay: 0.3 },
      { cx: 520, cy: 320, r: 2.3, dur: 14, delay: 0.8 },
    ],
    []
  );

  // Email capture: positioned as "pilot + founding teams"
  const handleSubmit = async (e) => {
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
    } catch (e2) {
      console.error(e2);
      setErr(e2?.message || "Something went wrong. Please try again shortly.");
    } finally {
      setLoading(false);
    }
  };

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
        <meta property="og:url" content="https://checkpeak.com" />
        <meta
          property="og:image"
          content={`https://checkpeak.com/api/og-image?q=${encodeURIComponent(ogText)}`}
        />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@checkPeak_" />
        <meta name="twitter:title" content="CheckPeak — Athlete + Team Workflow" />
        <meta
          name="twitter:description"
          content="Workouts + nutrition + supplement screening. Athlete-friendly check-ins, staff review queues, and weekly summaries—built for programs."
        />
        <meta
          name="twitter:image"
          content={`https://checkpeak.com/api/og-image?q=${encodeURIComponent(ogText)}`}
        />
      </Head>

      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans flex flex-col">
        {/* HERO */}
        <section
          className="relative bg-gradient-to-r from-[#46769B] to-[#1D2433] text-white"
          aria-labelledby="hero-heading"
        >
          {/* Background */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <svg className="w-full h-full" aria-hidden="true">
              <defs>
                <radialGradient id="g1" cx="30%" cy="30%" r="80%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
                  <stop offset="60%" stopColor="rgba(70,118,155,1)" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="rgba(29,36,51,1)" stopOpacity="0.06" />
                </radialGradient>
              </defs>

              <rect width="100%" height="100%" fill="url(#g1)" opacity="0.8" />

              {particles.map((p, i) => (
                <motion.circle
                  key={i}
                  cx={p.cx}
                  cy={p.cy}
                  r={p.r}
                  fill="rgba(255,255,255,0.32)"
                  animate={{
                    cx: [p.cx, p.cx + 22, p.cx - 16, p.cx],
                    cy: [p.cy, p.cy + 16, p.cy - 12, p.cy],
                    opacity: [0, 0.35, 0.35],
                  }}
                  transition={{
                    duration: p.dur,
                    repeat: Infinity,
                    ease: "linear",
                    delay: p.delay,
                  }}
                />
              ))}
            </svg>
          </div>

          {/* Foreground */}
          <div className="relative max-w-6xl mx-auto px-4 pt-24 pb-16 sm:pt-28 sm:pb-20 md:pt-32 md:pb-24">
            <div className="flex flex-col items-center text-center gap-5">
              {/* Micro trust */}
              <motion.div
                className="flex flex-wrap gap-2 justify-center text-[11px] sm:text-xs text-white/90"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 flex items-center gap-2">
                  <FaUniversity /> Built for teams
                </span>
                <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 flex items-center gap-2">
                  <FaClipboardList /> Clear check-ins
                </span>
                <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 flex items-center gap-2">
                  <FaChartLine /> Weekly summaries
                </span>
                <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 flex items-center gap-2">
                  <FaShieldAlt /> Smarter supplement screening
                </span>
              </motion.div>

              {/* Headline */}
              <motion.h1
                id="hero-heading"
                className="text-[2.2rem] leading-[1.05] sm:text-4xl md:text-5xl font-extrabold tracking-tight max-w-4xl"
                initial={{ opacity: 0, y: -18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
              >
                Accountability builds confidence - even off campus.
              </motion.h1>

              <motion.p
                className="text-sm sm:text-base md:text-lg max-w-3xl mx-auto text-gray-100/95"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.6 }}
              >
                CheckPeak keeps athletes and staff aligned away from campus. Athletes get clear plans and quick check-ins.
                Coaches and trainers get a clean view of progress to keep athletes healthy and progressing.
              </motion.p>

              <p className="text-[11px] sm:text-xs text-white/85 -mt-1 max-w-3xl">
                Built for alignment-not surveillance. Programs decide what to require; athletes share only what’s needed.
              </p>

              {/* Value bullets */}
              <div className="mt-2 grid gap-3 sm:grid-cols-3 w-full max-w-5xl text-left">
                {[
                  {
                    icon: <FaDumbbell className="text-white/90" />,
                    title: "Workout check-ins",
                    desc: "Athletes complete workouts and check in quickly. Evidence (photo/video/notes) can be optional or required. YOUR program sets the rules.",
                  },
                  {
                    icon: <FaUtensils className="text-white/90" />,
                    title: "Nutrition plans that stick",
                    desc: "Meal-based targets, not tedious tracking. Coaches set macros by meal with dining hall vs at home tips. Athletes mark their meal or hydration is complete in seconds.",
                  },
                  {
                    icon: <FaShieldAlt className="text-white/90" />,
                    title: "Supplement screening",
                    desc: "At-home label scanning to flag banned/high-risk compounds and common aliases. Save scans to cut repeat research and reduce the risk of accidental positives.",
                  },
                ].map((x, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-white/15 bg-white/10 p-4 sm:p-5 backdrop-blur"
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-white/10 border border-white/15">
                        {x.icon}
                      </span>
                      {x.title}
                    </div>
                    <p className="mt-2 text-xs sm:text-sm text-white/85 leading-relaxed">{x.desc}</p>
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <motion.div
                className="flex flex-col gap-3 mt-6 w-full md:w-auto items-stretch md:items-center justify-center"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.6 }}
              >
                <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
                  {/* Primary: Open signup/login modal */}
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      track("cta_auth_open", { source: "hero", tab: "signup", role: "organization" });

                      if (typeof window !== "undefined") {
                        // Preferred: global event hook
                        window.dispatchEvent(
                          new CustomEvent("auth:open", {
                            detail: { tab: "signup", role: "organization" },
                          })
                        );

                        // Fallback: convenience helper if present
                        if (typeof window.__openLoginModal === "function") {
                          window.__openLoginModal({ tab: "signup", role: "organization" });
                        }
                      }
                    }}
                    className="w-full sm:w-auto flex items-center justify-center gap-3 px-7 py-3.5 bg-white text-[#1D2433] font-extrabold rounded-2xl shadow-xl hover:shadow-2xl transition-all"
                    aria-label="Sign up or log in"
                    type="button"
                  >
                    Get Started <span className="font-extrabold">→</span>
                  </motion.button>

                  {/* Secondary: Scan */}
                  <Link href="/nutrition-label-scanner" className="w-full sm:w-auto">
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => track("scan_start", { source: "hero" })}
                      className="w-full flex items-center justify-center gap-3 px-7 py-3.5 bg-[#46769B] text-white font-extrabold rounded-2xl shadow-xl hover:shadow-2xl hover:brightness-110 transition-all border border-white/20"
                      aria-label="Run a label scan"
                      type="button"
                    >
                      Scan a Label <span className="font-extrabold">→</span>
                    </motion.button>
                  </Link>
                </div>

                <div className="text-[11px] text-white/85">
                  Create an account to run check-ins • Athletes can scan labels free • Built for off-campus consistency
                </div>

                <a
                  href="#why"
                  onClick={() => track("learn_more", { source: "hero" })}
                  className="text-xs text-white/80 hover:text-white underline underline-offset-4"
                >
                  See how it works ↓
                </a>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Proof / positioning strip */}
        <section className="bg-white py-5 border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4">
            <div className="grid gap-3 md:grid-cols-3 text-[12px] text-gray-700">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex w-9 h-9 items-center justify-center rounded-xl bg-gray-50 border border-gray-200">
                  <FaClipboardList className="text-[#46769B]" />
                </span>
                <div>
                  <p className="font-semibold">Replace texts + spreadsheets</p>
                  <p className="text-gray-600 text-[11px] mt-0.5">
                    Check-ins land in one place with clear status, timestamps, and next steps - so nobody loses context.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex w-9 h-9 items-center justify-center rounded-xl bg-gray-50 border border-gray-200">
                  <FaUsers className="text-[#46769B]" />
                </span>
                <div>
                  <p className="font-semibold">Less guessing, more support</p>
                  <p className="text-gray-600 text-[11px] mt-0.5">
                    Athletes get clear expectations, how-to video links, and actionable feedback to reduce form mistakes, under-fueling, and confusion. Coaches and trainers get visibility to step in early - before issues pile up.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex w-9 h-9 items-center justify-center rounded-xl bg-gray-50 border border-gray-200">
                  <FaChartLine className="text-[#46769B]" />
                </span>
                <div>
                  <p className="font-semibold">Weekly summaries you can act on</p>
                  <p className="text-gray-600 text-[11px] mt-0.5">
                    A simple weekly view by athlete and team - so follow-ups are quick and fair.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 text-[10px] text-gray-400">
              Not affiliated or endorsed by any governing body. Designed as a workflow + screening tool.
            </div>
          </div>
        </section>

        {/* WHY / PROBLEMS */}
        <section id="why" className="py-14 bg-white">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto">
              <p className="text-xs font-semibold tracking-wide text-[#46769B]">WHY TEAMS USE CHECKPEAK</p>
              <h2 className="text-2xl md:text-3xl font-bold mt-2">Away-from-campus is where plans drift.</h2>
              <p className="text-sm text-gray-600 mt-3 leading-relaxed">
                Offseason, breaks, travel, and rehab are where routines get messy. CheckPeak keeps it simple: athletes check in,
                staff responds with quick feedback, and everyone stays aligned.
              </p>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-3 text-sm">
              {[
                {
                  q: "How much time and scholarship money gets burned when athletes return unready?",
                  a: "CheckPeak keeps offseason expectations clear and check-ins consistent - so you spend camp on install, not playing catch-up during for failed conditioning evals.",
                },
                {
                  q: "What are you losing when athletes don’t train - or train wrong - during the offseason?",
                  a: "Clear plans + how-to guidance + simple check-ins help catch form and compliance issues early - before they turn into missed time, lost progress, and a potential injuries.",
                },
                {
                  q: "How fast can staff answer, ‘Can I take this supplement?’ without digging for hours?",
                  a: "Saved scans + flagged ingredients give a quick, consistent starting point - so players and staff can review quickly and athletes don’t need toguess.",
                },
              ].map((x, i) => (
                <div key={i} className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-xs font-semibold text-[#46769B] mb-1">COMMON PROBLEM</p>
                  <h3 className="font-semibold mb-2 leading-snug">{x.q}</h3>
                  <p className="text-gray-600 leading-relaxed">{x.a}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-6">
              <p className="text-sm text-gray-700 leading-relaxed">
                One workflow instead of ten workarounds. CheckPeak replaces scattered texts and spreadsheets with a
                simple rhythm: clear expectations, quick check-ins, and consistent follow-ups - without needing extra staff.
              </p>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="py-14 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto">
              <p className="text-xs font-semibold tracking-wide text-[#46769B]">THE WORKFLOW</p>
              <h2 className="text-2xl md:text-3xl font-bold mt-2">Simple check-ins. Clear feedback.</h2>
              <p className="text-sm text-gray-600 mt-3 leading-relaxed">
                Easy for athletes to use, quick for staff to review. Everything stays organized by team, date, and athlete.
              </p>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              {[
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
                  desc: "See weekly progress by athlete/team so follow-ups are quick—and expectations stay clear.",
                  icon: <FaChartLine className="text-[#46769B]" />,
                },
              ].map((x, i) => (
                <div key={i} className="p-6 bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition">
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

                  if (typeof window !== "undefined") {
                    // preferred: event trigger
                    window.dispatchEvent(
                      new CustomEvent("auth:open", {
                        detail: { tab: "signup", role: "organization" },
                      })
                    );

                    // fallback: helper if present
                    if (typeof window.__openLoginModal === "function") {
                      window.__openLoginModal({ tab: "signup", role: "organization" });
                    }
                  }
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

        {/* MODULES / WHAT YOU GET */}
        <section className="py-14 bg-white">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto">
              <p className="text-xs font-semibold tracking-wide text-[#46769B]">WHAT YOU GET</p>
              <h2 className="text-2xl md:text-3xl font-bold mt-2">Three tools. One place.</h2>
              <p className="text-sm text-gray-600 mt-3 leading-relaxed">
                Athletes shouldn’t need five apps. Staff shouldn’t chase ten different channels. CheckPeak keeps it all in one place:
                workout templates, nutrition meal targets + hydration check-ins, review queues with clear outcomes, weekly summaries, saved scan history, and verified label scanning.
              </p>
            </div>

            <div className="mt-10 grid gap-7 md:grid-cols-3 text-center">
              {[
                {
                  icon: <FaDumbbell size={30} className="mx-auto mb-2 text-[#46769B]" />,
                  title: "Workout accountability",
                  desc: "Assign workout templates, collect quick photo check-ins, and review in a clean queue. Keep athletes on track helping minimize injuries and potential regression.",
                },
                {
                  icon: <FaUtensils size={30} className="mx-auto mb-2 text-purple-500" />,
                  title: "Nutrition targets",
                  desc: "Meal-based macro targets with dining hall vs home guidance - plus hydration goals. Athletes confirm meal + water in seconds (no tedious calorie tracking).",
                },
                {
                  icon: <FaShieldAlt size={30} className="mx-auto mb-2 text-emerald-600" />,
                  title: "Supplement label screening",
                  desc: "At-home label scanning to flag banned/high-risk compounds and common aliases. Save scans for quick reference so staff and athletes aren’t guessing.",
                },
              ].map((f, i) => (
                <div
                  key={i}
                  className="p-7 bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition"
                >
                  {f.icon}
                  <h3 className="text-xl font-semibold mb-2">{f.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-left">
                <p className="text-xs font-semibold tracking-wide text-[#46769B]">FOR COACHES & STAFF</p>
                <h3 className="text-lg font-bold mt-2">Less chasing. Cleaner communication.</h3>
                <ul className="mt-3 space-y-2 text-sm text-gray-700">
                  <li className="flex gap-2">
                    <span className="mt-0.5 text-emerald-600">
                      <FaCheckCircle />
                    </span>
                    Review queue with consistent outcomes (approved / needs info / follow-up)
                  </li>

                  <li className="flex gap-2">
                    <span className="mt-0.5 text-emerald-600">
                      <FaCheckCircle />
                    </span>
                    Set when proof is: optional or required with photo evidence based on the workout
                  </li>

                  <li className="flex gap-2">
                    <span className="mt-0.5 text-emerald-600">
                      <FaCheckCircle />
                    </span>
                    Weekly visibility by athlete + team to catch offseason drift before camp
                  </li>

                  <li className="flex gap-2">
                    <span className="mt-0.5 text-emerald-600">
                      <FaCheckCircle />
                    </span>
                    Feedback stays attached to each check-in (timestamps + context), so follow-ups are clean
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-left">
                <p className="text-xs font-semibold tracking-wide text-[#46769B]">FOR ATHLETES</p>
                <h3 className="text-lg font-bold mt-2">Clear plans. Easy check-ins.</h3>
                <ul className="mt-3 space-y-2 text-sm text-gray-700">
                  <li className="flex gap-2">
                  <span className="mt-0.5 text-emerald-600">
                    <FaCheckCircle />
                  </span>
                  One place to see workouts, instructions, and how-to links
                </li>

                <li className="flex gap-2">
                  <span className="mt-0.5 text-emerald-600">
                    <FaCheckCircle />
                  </span>
                  Meal-based macro targets + hydration, built for dining halls and real life (no tedious calorie tracking)
                </li>

                <li className="flex gap-2">
                  <span className="mt-0.5 text-emerald-600">
                    <FaCheckCircle />
                  </span>
                  Simple check-ins with notes - and photo/video evidence only when your program requires it
                </li>

                <li className="flex gap-2">
                  <span className="mt-0.5 text-emerald-600">
                    <FaCheckCircle />
                  </span>
                  Free label scans that flag high-risk ingredients and aliases - plus saved scan history
                </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* FOUNDING TEAMS / PRICING TEASER */}
        <section className="py-14 bg-gray-50 border-t border-gray-100">
          <div className="max-w-6xl mx-auto px-4">
            <div className="grid gap-8 lg:grid-cols-2 items-start">
              <div>
                <p className="text-xs font-semibold tracking-wide text-[#46769B]">PROGRAMS</p>
                <h2 className="text-2xl md:text-3xl font-bold mt-2">Founding 26 Teams</h2>
                <p className="text-sm text-gray-600 mt-3 leading-relaxed">
                  A simple, team-friendly way to roll out check-ins this year. Start with one team, build your templates, and
                  expand to more teams as you go. Built to work for programs of any size - without adding admin overhead.
                </p>

                <div className="mt-5 space-y-2 text-sm text-gray-700">
                  <div className="flex items-start gap-2">
                    <span className="mt-1 text-[#46769B]">
                      <FaCheckCircle />
                    </span>
                    <p>
                      <span className="font-semibold">$2,988 / team / year</span> for the first 26 teams onboarded
                    </p>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="mt-1 text-[#46769B]">
                      <FaCheckCircle />
                    </span>
                    <p>
                      <span className="font-semibold">30-day pilot included</span> to onboard athletes and set up plans
                    </p>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="mt-1 text-[#46769B]">
                      <FaCheckCircle />
                    </span>
                    <p>
                      <span className="font-semibold">Rate locked for 3 years</span> as long as you renew annually
                    </p>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="mt-1 text-[#46769B]">
                      <FaCheckCircle />
                    </span>
                    <p>
                      <span className="font-semibold">Use code</span> Founding26 at signup
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-row flex-wrap items-center justify-start gap-x-4 gap-y-2">
                <a
                  href="#pilot"
                  onClick={() => track("learn_more", { source: "founding_26" })}
                  className="text-sm font-semibold text-[#46769B] hover:underline underline-offset-4 whitespace-nowrap"
                >
                  What’s included in the pilot →
                </a>

                <button
                  type="button"
                  onClick={() => {
                    track("cta_auth_open", { source: "founding_26", tab: "signup", role: "organization" });

                    if (typeof window !== "undefined") {
                      window.dispatchEvent(
                        new CustomEvent("auth:open", {
                          detail: { tab: "signup", role: "organization" },
                        })
                      );

                      if (typeof window.__openLoginModal === "function") {
                        window.__openLoginModal({ tab: "signup", role: "organization" });
                      }
                    }
                  }}
                  className="text-sm font-semibold text-[#46769B] hover:underline underline-offset-4 whitespace-nowrap"
                >
                  Start with your team →
                </button>
              </div>

                <p className="mt-4 text-[11px] text-gray-500">
                  All-inclusive team pricing (There isn't a hidden per-athlete add-on, or multi-team upcharge).
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold tracking-wide text-[#46769B]">WHY IT’S WORTH IT</p>
                <h3 className="text-lg font-bold mt-2">Reduce the “return unready” scramble.</h3>
                <p className="text-sm text-gray-600 mt-3 leading-relaxed">
                  When athletes return behind, progress regresses and camp turns into catch-up. CheckPeak keeps the rhythm
                  steady - clear plans, quick check-ins, and early visibility—so you catch issues before they become setbacks.
                </p>

                <div className="mt-5 grid gap-3">
                  {[
                    {
                      title: "Workout accountability",
                      desc: "Check-ins keep routines steady during breaks and the offseason.",
                    },
                    {
                      title: "Nutrition targets",
                      desc: "Meal-based macro targets with dining hall vs home guidance - plus hydration goals.",
                    },
                    {
                      title: "Supplement label screening",
                      desc: "At-home label scanning to flag banned/high-risk compounds and their common aliases.",
                    },
                  ].map((x, i) => (
                    <div key={i} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <p className="font-semibold text-sm">{x.title}</p>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">{x.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <Link href="#lead" onClick={() => track("cta_interest", { source: "roi_card" })}>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        track("cta_auth_open", { source: "roi_card", tab: "signup", role: "organization" });

                        if (typeof window !== "undefined") {
                          window.dispatchEvent(
                            new CustomEvent("auth:open", {
                              detail: { tab: "signup", role: "organization" },
                            })
                          );

                          if (typeof window.__openLoginModal === "function") {
                            window.__openLoginModal({ tab: "signup", role: "organization" });
                          }
                        }
                      }}
                      className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl bg-[#46769B] text-white font-semibold text-sm shadow-sm hover:brightness-110 transition"
                      type="button"
                      aria-label="Get started"
                    >
                      Get started <span className="font-extrabold">→</span>
                    </motion.button>
                  </Link>
                  <p className="mt-3 text-[10px] text-gray-500 text-center">
                    30 days free to get athletes onboarded and your templates dialed in.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PILOT DETAILS */}
        <section id="pilot" className="py-14 bg-white border-t border-gray-100">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto">
              <p className="text-xs font-semibold tracking-wide text-[#46769B]">30-DAY PILOT</p>
              <h2 className="text-2xl md:text-3xl font-bold mt-2">Start with one team. Make it easy.</h2>
              <p className="text-sm text-gray-600 mt-3 leading-relaxed">
                The goal is simple: get athletes onboard, build your templates, and establish a weekly rhythm that feels fair and low-friction.
                You’ll finish with clear adoption and a repeatable process.
              </p>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              {[
                {
                  title: "Onboarding & setup",
                  items: [
                    "Configure staff roles + permissions (Admin / Trainer / Coach)",
                    "Invite athletes and connect them to your organization (tokens supported)",
                    "Create workout templates + nutrition meal targets—and choose when evidence is optional vs required",
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
                    "Competitive offseason: who’s staying competitive (and who isn’t)",
                    "Less regression: catch form/fueling gaps early to reduce avoidable setbacks",
                  ],
                },
              ].map((c, i) => (
                <div key={i} className="p-6 rounded-2xl border border-gray-200 bg-gray-50">
                  <h3 className="font-semibold text-lg">{c.title}</h3>
                  <ul className="mt-3 space-y-2 text-sm text-gray-700">
                    {c.items.map((it, j) => (
                      <li key={j} className="flex gap-2">
                        <span className="mt-0.5 text-emerald-600">
                          <FaCheckCircle />
                        </span>
                        <span className="leading-relaxed">{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-10 flex justify-center">
              <Link href="#lead" onClick={() => track("cta_interest", { source: "pilot_section" })}>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    track("cta_auth_open", { source: "pilot_section", tab: "signup", role: "organization" });

                    if (typeof window !== "undefined") {
                      window.dispatchEvent(
                        new CustomEvent("auth:open", {
                          detail: { tab: "signup", role: "organization" },
                        })
                      );

                      if (typeof window.__openLoginModal === "function") {
                        window.__openLoginModal({ tab: "signup", role: "organization" });
                      }
                    }
                  }}
                  className="px-8 py-3.5 rounded-2xl bg-[#1D2433] text-white font-extrabold shadow-sm hover:brightness-110 transition"
                  type="button"
                  aria-label="Request pilot details"
                >
                  Let's get started →
                </motion.button>
              </Link>
            </div>
          </div>
        </section>

        {/* SCAN BY CATEGORY */}
        <section className="bg-white py-12 border-t border-gray-100">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-wide text-[#46769B]">SUPPLEMENT TOOL</p>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Scan by category</h2>
                <p className="mt-2 text-sm text-gray-600 max-w-2xl">
                  Use the CheckPeak scan engine to screen labels and ingredients for banned/high-risk compounds and aliases.
                  Always verify final decisions with your governing body and certified professionals.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 md:justify-end">
                {[
                  { href: "/nutrition-label-scanner", label: "Nutrition Label", target: "nutrition-label-scanner" },
                  { href: "/supplement-label-scanner", label: "Supplement Label", target: "supplement-label-scanner" },
                  { href: "/banned-substance-checker", label: "Banned Substance", target: "banned-substance-checker" },
                  { href: "/pre-workout-label-scanner", label: "Pre-Workout", target: "pre-workout-label-scanner" },
                  { href: "/protein-powder-label-scanner", label: "Protein Powder", target: "protein-powder-label-scanner" },
                ].map((x) => (
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
                  onClick={() => track("internal_link", { source: "scan_by_category_helper", target: "nutrition-label-scanner" })}
                  className="font-semibold text-[#46769B] hover:underline underline-offset-4"
                >
                  Nutrition Label Scanner
                </a>{" "}
                — it covers most supplement facts panels and ingredient lists.
              </p>
            </div>
          </div>
        </section>

        {/* DISCLAIMER (Collapsible / inline) */}
        <section className="py-12">
          <div className="max-w-3xl mx-auto px-4">
            <div className="bg-yellow-50 border-l-4 border-yellow-300 rounded-lg shadow-sm text-left text-yellow-800">
              <button
                type="button"
                onClick={() => setDisclaimerOpen((v) => !v)}
                className="w-full p-6 flex items-start justify-between gap-4 text-left"
                aria-expanded={disclaimerOpen}
              >
                <div>
                  <p className="font-semibold mb-1 text-xs md:text-sm">Important Notice</p>
                  <p className="text-[11px] md:text-xs text-yellow-800/80">
                    {disclaimerOpen ? "Tap to hide details" : "Tap to view details"}
                  </p>
                </div>

                <span className="mt-1 shrink-0 text-yellow-800/80">
                  {disclaimerOpen ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </span>
              </button>

              {disclaimerOpen ? (
                <div className="px-6 pb-6 -mt-2">
                  <p className="leading-relaxed text-xs md:text-sm">
                    CheckPeak provides workflow tools for workouts and nutrition plans and screening guidance for potentially banned or high-risk
                    substances using databases and label analysis. It is <strong>not 100% comprehensive</strong>, and results do not replace
                    official rulings or medical advice. Always verify with your governing body, certified authority, athletic trainer,
                    or medical professional before consuming any product.
                  </p>

                  <div className="mt-3 text-[11px] text-yellow-900/70">
                    Tip: Use saved scans as a starting point - final decisions should follow your program’s compliance process.
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}