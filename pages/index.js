// pages/index.js
"use client";

import Head from "next/head";
import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FaBolt, FaCheckCircle, FaHistory } from "react-icons/fa";

export default function HomePage() {
  const ogText = "CheckPeak — Scan Supplements Fast";

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Athlete");
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

  // Email capture (still uses /api/waitlist, but positioned as "save + alerts")
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
          source: "home_save_alerts",
        }),
      });

      if (!res.ok) throw new Error("Unable to save. Please try again.");

      setOk(true);
      setEmail("");
      setOrg("");
      setRole("Athlete");
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
        <title>CheckPeak — Scan Supplements | Flag Banned Ingredients Fast</title>
        <meta
          name="description"
          content="Scan any supplement label in seconds to flag banned substances, hidden aliases, and risky ingredients. Built for athletes, coaches, and performance staff."
        />

        {/* Open Graph */}
        <meta property="og:title" content="CheckPeak — Supplement Scanner" />
        <meta
          property="og:description"
          content="Scan supplement labels fast. Flag banned substances and risky ingredients before they cost you eligibility."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://checkpeak.com" />
        <meta
          property="og:image"
          content={`https://checkpeak.com/api/og-image?q=${encodeURIComponent(
            ogText
          )}`}
        />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@checkPeak_" />
        <meta name="twitter:title" content="CheckPeak — Supplement Scanner" />
        <meta
          name="twitter:description"
          content="Scan supplement labels in seconds. Flag banned substances & risky ingredients."
        />
        <meta
          name="twitter:image"
          content={`https://checkpeak.com/api/og-image?q=${encodeURIComponent(
            ogText
          )}`}
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
                  <stop
                    offset="60%"
                    stopColor="rgba(70,118,155,1)"
                    stopOpacity="0.18"
                  />
                  <stop
                    offset="100%"
                    stopColor="rgba(29,36,51,1)"
                    stopOpacity="0.06"
                  />
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
          <div className="relative max-w-4xl mx-auto px-4 pt-24 pb-16 sm:pt-28 sm:pb-20 md:pt-32 md:pb-24 flex flex-col items-center text-center gap-5">
            {/* Micro trust */}
            <motion.div
              className="flex flex-wrap gap-2 justify-center text-[11px] sm:text-xs text-white/85"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20">
                Free to scan
              </span>
              <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20">
                Built for athletes & teams
              </span>
              <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20">
                Flags aliases & red-flag compounds
              </span>
            </motion.div>

            {/* Stronger hook + clear promise */}
            <motion.h1
              id="hero-heading"
              className="text-[2.2rem] leading-tight sm:text-4xl md:text-5xl font-bold tracking-tight"
              initial={{ opacity: 0, y: -18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              Don’t risk eligibility over a label.
              <br className="hidden sm:block" />
              <span className="font-semibold block mt-1 md:mt-2">
                Scan supplements and catch red flags fast.
              </span>
            </motion.h1>

            <motion.p
              className="text-sm sm:text-base md:text-lg max-w-2xl mx-auto text-gray-100/95"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              CheckPeak flags banned ingredients, hidden aliases, and risky
              compounds in seconds—so you can make higher-confidence decisions
              before something costs you eligibility or trust.
            </motion.p>

            <p className="text-xs sm:text-sm text-white/80 -mt-1">
              Built for tested athletes, coaches, compliance, and performance staff.
            </p>

            {/* Primary CTA ONLY (clear + high contrast) */}
            <motion.div
              className="flex flex-col gap-3 mt-3 w-full md:w-auto items-stretch md:items-center justify-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.6 }}
            >
              <Link href="/ocr" className="w-full md:w-auto">
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => track("scan_start", { source: "hero" })}
                  className="w-full flex items-center justify-center gap-3 px-8 py-3.5 bg-[#46769B] text-white font-extrabold rounded-2xl shadow-xl hover:shadow-2xl hover:brightness-110 transition-all border border-white/20"
                  aria-label="Start a free supplement label scan"
                >
                  Start a Free Scan
                  <span className="text-white font-extrabold">→</span>
                </motion.button>
              </Link>

              <div className="text-[11px] text-white/80">
                No account needed • Takes ~10 seconds
              </div>

              <a
                href="#how"
                onClick={() => track("learn_more", { source: "hero" })}
                className="text-xs text-white/80 hover:text-white underline underline-offset-4"
              >
                See how it works ↓
              </a>
            </motion.div>
          </div>
        </section>

        {/* Social proof strip (edit numbers anytime) */}
        <section className="bg-white py-4 border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] sm:text-xs text-gray-600">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-1 rounded-full bg-gray-50 border border-gray-200">
                Built using reference lists: WADA / NCAA / NFL / MLB / NBA / Pro Orgs
              </span>
            </div>
            <div className="text-[10px] text-gray-400">
              Not affiliated or endorsed. Reference sources only.
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="py-12 bg-white">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">
              How CheckPeak Works
            </h2>

            <div className="grid gap-6 sm:grid-cols-3 text-sm">
              <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
                <p className="text-xs font-semibold text-[#46769B] mb-1">
                  STEP 1
                </p>
                <h3 className="font-semibold mb-2">Scan a label</h3>
                <p className="text-gray-600">
                  Upload a photo or paste ingredients. No setup. No account
                  required to run a scan.
                </p>
              </div>

              <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
                <p className="text-xs font-semibold text-[#46769B] mb-1">
                  STEP 2
                </p>
                <h3 className="font-semibold mb-2">We match intelligently</h3>
                <p className="text-gray-600">
                  We check ingredients against banned & watch references,
                  including synonyms, aliases, and high-risk compounds.
                </p>
              </div>

              <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
                <p className="text-xs font-semibold text-[#46769B] mb-1">
                  STEP 3
                </p>
                <h3 className="font-semibold mb-2">Get clarity fast</h3>
                <p className="text-gray-600">
                  See what’s flagged and why—so you can make a safer decision
                  with less guessing.
                </p>
              </div>
            </div>

            {/* Mid-page CTA repeat */}
            <div className="mt-10 flex justify-center">
              <Link href="/ocr">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => track("scan_start", { source: "mid_how" })}
                  className="px-7 py-3 bg-[#46769B] text-white font-semibold rounded-2xl shadow-md hover:shadow-lg transition"
                >
                  Start a Free Scan
                </motion.button>
              </Link>
            </div>
          </div>
        </section>

        {/* Why choose */}
        <section className="py-14 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-10">
              What You Get (In One Scan)
            </h2>

            <div className="grid md:grid-cols-3 gap-7 text-center">
              {[
                {
                  icon: (
                    <FaBolt size={30} className="mx-auto mb-2 text-[#46769B]" />
                  ),
                  title: "Fast signal",
                  desc: "Get a quick sanity-check without manually Googling every ingredient.",
                },
                {
                  icon: (
                    <FaCheckCircle
                      size={30}
                      className="mx-auto mb-2 text-emerald-500"
                    />
                  ),
                  title: "Alias detection",
                  desc: "Catches alternate names and “hidden” ingredient wording that people commonly miss.",
                },
                {
                  icon: (
                    <FaHistory
                      size={30}
                      className="mx-auto mb-2 text-purple-500"
                    />
                  ),
                  title: "Scan history (saveable)",
                  desc: "Build a record of what you checked—useful for athletes, teams, and staff workflows.",
                },
              ].map((f, i) => (
                <div
                  key={i}
                  className="p-6 bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition"
                >
                  {f.icon}
                  <h3 className="text-xl font-semibold mb-2">{f.title}</h3>
                  <p className="text-gray-600 text-sm">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Email capture repositioned as value */}
        <section className="py-14 bg-white">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h3 className="text-2xl font-semibold mb-3">
              Save your scans + get ingredient alerts.
            </h3>
            <p className="text-gray-600 mb-6 text-sm md:text-base">
              Want scan history, updates, and faster workflows as CheckPeak
              expands? Drop your email—no spam.
            </p>

            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-3 items-stretch sm:flex-row sm:items-center sm:justify-center"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email (to save scans & alerts)"
                className="w-full sm:w-72 px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#46769B]"
              />

              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full sm:w-44 px-3 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#46769B]"
              >
                <option>Athlete</option>
                <option>Coach / Staff</option>
                <option>Compliance</option>
                <option>Performance Gym</option>
                <option>Organization</option>
              </select>

              <input
                type="text"
                value={org}
                onChange={(e) => setOrg(e.target.value)}
                placeholder="Team / org (optional)"
                className="w-full sm:w-52 px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#46769B]"
              />

              <button
                type="submit"
                disabled={loading}
                className={`w-full sm:w-auto px-6 py-3 rounded-xl bg-[#46769B] text-white font-semibold text-sm shadow-sm hover:brightness-110 transition ${
                  loading ? "opacity-70 cursor-not-allowed" : ""
                }`}
              >
                {loading ? "Saving..." : "Save & Get Alerts"}
              </button>
            </form>

            <div className="mt-3" aria-live="polite">
              {err && <p className="text-xs text-red-500">{err}</p>}
              {ok && (
                <p className="text-xs text-emerald-600">
                  You’re in. We’ll keep you updated.
                </p>
              )}
            </div>

            <p className="mt-3 text-[10px] text-gray-500">
              No spam. Used only for updates + access to saved scan features.
            </p>

            {/* Final CTA */}
            <div className="mt-8 flex justify-center">
              <Link href="/ocr">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => track("scan_start", { source: "bottom" })}
                  className="px-7 py-3 bg-gray-900 text-white font-semibold rounded-2xl shadow-md hover:shadow-lg transition"
                >
                  Start a Free Scan
                </motion.button>
              </Link>
            </div>
          </div>
        </section>

        {/* Disclaimer */}
        <section className="py-12">
          <div className="max-w-3xl mx-auto px-4">
            <div className="p-6 bg-yellow-50 border-l-4 border-yellow-300 rounded-lg shadow-sm text-left text-yellow-800 text-xs md:text-sm">
              <p className="font-semibold mb-1">Important Notice:</p>
              <p>
                CheckPeak provides guidance on potentially banned or high-risk
                substances using its database and label analysis. It is{" "}
                <strong>not 100% comprehensive</strong>, and results do not
                replace official rulings or medical advice. Always verify with
                your governing body, certified authority, athletic trainer, or
                medical professional before consuming any product.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
