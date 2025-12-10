// pages/index.js
"use client";

import Head from "next/head";
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FaBolt, FaCheckCircle, FaHistory } from "react-icons/fa";

export default function HomePage() {
  const [searchQuery] = useState("");
  const [earlyEmail, setEarlyEmail] = useState("");
  const [earlyRole, setEarlyRole] = useState("Athlete");
  const [earlyOrg, setEarlyOrg] = useState("");
  const [earlyLoading, setEarlyLoading] = useState(false);
  const [earlyError, setEarlyError] = useState("");
  const [earlySuccess, setEarlySuccess] = useState(false);

  // Simple GA event helper (no-op if gtag not present)
  const track = (action, params = {}) => {
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", action, params);
    }
  };

  // Particle background shapes (hero)
  const particles = [
    { cx: 100, cy: 120, r: 2.3, dur: 11, delay: 0 },
    { cx: 400, cy: 180, r: 2, dur: 12, delay: 0.3 },
    { cx: 700, cy: 220, r: 2.5, dur: 10, delay: 0.6 },
    { cx: 200, cy: 400, r: 1.8, dur: 14, delay: 0.4 },
    { cx: 600, cy: 500, r: 2.1, dur: 13, delay: 0.7 },
    { cx: 900, cy: 600, r: 2.2, dur: 12, delay: 0.2 },
    { cx: 1100, cy: 180, r: 2, dur: 11, delay: 0.5 },
    { cx: 300, cy: 700, r: 1.9, dur: 15, delay: 0.6 },
    { cx: 500, cy: 300, r: 2.4, dur: 13, delay: 0.8 },
    { cx: 800, cy: 100, r: 2.3, dur: 14, delay: 0.4 },
    { cx: 950, cy: 400, r: 2.2, dur: 12, delay: 0.9 },
    { cx: 650, cy: 650, r: 2, dur: 15, delay: 0.3 },
  ];

  // Early access submit → wired for Airtable via /api/waitlist
  const handleEarlyAccessSubmit = async (e) => {
    e.preventDefault();
    setEarlyError("");
    setEarlySuccess(false);

    const email = earlyEmail.trim();
    if (!email || !email.includes("@")) {
      setEarlyError("Please enter a valid email.");
      return;
    }

    setEarlyLoading(true);
    try {
      track("early_access_submit", {
        source: "home",
        role: earlyRole,
      });

      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          role: earlyRole,
          organization: earlyOrg || null,
        }),
      });

      if (!res.ok) {
        throw new Error("Unable to save your request. Please try again.");
      }

      setEarlySuccess(true);
      setEarlyEmail("");
      setEarlyOrg("");
      setEarlyRole("Athlete");
    } catch (err) {
      console.error(err);
      setEarlyError(
        err?.message || "Something went wrong. Please try again shortly."
      );
    } finally {
      setEarlyLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>PEAK — Supplement Label Scanner | Detect Banned Substances</title>
        <meta
          name="description"
          content="PEAK scans supplement labels to detect banned substances and help athletes and professionals stay compliant. Fast label scanning, reliable detection, and documented checks."
        />

        {/* Open Graph */}
        <meta property="og:title" content="PEAK — Supplement Label Scanner" />
        <meta
          property="og:description"
          content="Scan supplement labels in seconds. Detect banned substances, aliases, and risky ingredients before they cost you eligibility."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://checkpeak.com" />
        <meta
          property="og:image"
          content={`https://checkpeak.com/api/og-image?q=${encodeURIComponent(
            searchQuery || "PEAK — Supplement Label Scanner"
          )}`}
        />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@checkPeak_" />
        <meta name="twitter:title" content="PEAK — Supplement Label Scanner" />
        <meta
          name="twitter:description"
          content="Scan supplement labels fast and accurately. Detect banned substances and stay compliant."
        />
        <meta
          name="twitter:image"
          content={`https://checkpeak.com/api/og-image?q=${encodeURIComponent(
            searchQuery || "PEAK — Supplement Label Scanner"
          )}`}
        />
      </Head>

      {/* PAGE CONTENT — NavBar is now global in _app.js */}
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans flex flex-col">
        {/* HERO */}
        <section
          className="relative bg-gradient-to-r from-[#46769B] to-[#1D2433] text-white"
          aria-labelledby="hero-heading"
        >
          {/* Background layer */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <svg
              className="w-full h-full"
              aria-hidden="true"
            >
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
                <radialGradient id="g2" cx="60%" cy="40%" r="80%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
                  <stop
                    offset="60%"
                    stopColor="rgba(100,130,180,1)"
                    stopOpacity="0.16"
                  />
                  <stop
                    offset="100%"
                    stopColor="rgba(29,36,51,1)"
                    stopOpacity="0.05"
                  />
                </radialGradient>
                <radialGradient id="g3" cx="40%" cy="70%" r="80%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.75)" />
                  <stop
                    offset="60%"
                    stopColor="rgba(120,140,200,1)"
                    stopOpacity="0.14"
                  />
                  <stop
                    offset="100%"
                    stopColor="rgba(29,36,51,1)"
                    stopOpacity="0.05"
                  />
                </radialGradient>
                <filter id="blurA">
                  <feGaussianBlur stdDeviation="28" />
                </filter>
                <filter id="blurB">
                  <feGaussianBlur stdDeviation="32" />
                </filter>
                <filter id="blurC">
                  <feGaussianBlur stdDeviation="36" />
                </filter>
              </defs>

              {particles.map((p, i) => (
                <motion.circle
                  key={i}
                  cx={p.cx}
                  cy={p.cy}
                  r={p.r}
                  fill="rgba(255,255,255,0.34)"
                  animate={{
                    cx: [p.cx, p.cx + 26, p.cx - 18, p.cx],
                    cy: [p.cy, p.cy + 18, p.cy - 14, p.cy],
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

          {/* Foreground content */}
          <div className="relative max-w-4xl mx-auto px-4 pt-24 pb-16 sm:pt-28 sm:pb-20 md:pt-32 md:pb-24 flex flex-col items-center text-center gap-5">
            <motion.h1
              id="hero-heading"
              className="text-[2.2rem] leading-tight sm:text-4xl md:text-5xl font-bold tracking-tight"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              NAVIGATE YOUR SUPPLEMENTS.
              <br className="hidden sm:block" />
              <span className="font-semibold block mt-1 md:mt-2">
                Perform at your PEAK.
              </span>
            </motion.h1>

            <motion.p
              className="text-sm sm:text-base md:text-lg max-w-2xl mx-auto text-gray-100/95"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.6 }}
            >
              Scan any supplement label in seconds. Catch banned substances,
              hidden aliases, and risky ingredients before they cost you
              eligibility or trust.
            </motion.p>

            {/* Micro reassurance pills */}
            <motion.div
              className="mt-1 flex flex-col sm:flex-row gap-2 sm:gap-4 text-[11px] sm:text-xs text-gray-100/85 items-start sm:items-center justify-center"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Built for athletes, coaches & performance staff</span>
              </div>
              <div className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Informed by trusted banned-substance lists</span>
              </div>
              <div className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Absolutely free to use</span>
              </div>
            </motion.div>

            {/* CTAs */}
            <motion.div
              className="flex flex-col md:flex-row gap-3 mt-4 w-full md:w-auto items-stretch md:items-center justify-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.6 }}
            >
              <Link href="/ocr" className="w-full md:w-auto">
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => track("scan_start", { source: "hero" })}
                  className="w-full flex items-center justify-center gap-3 px-7 py-3 bg-[#46769B] text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all"
                  aria-label="Scan a label with PEAK"
                >
                  Scan a Label
                </motion.button>
              </Link>

              <Link href="/search" className="w-full md:w-auto">
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => track("demo_search_start", { source: "hero" })}
                  className="w-full px-7 py-3 bg-white/8 border border-white/30 text-white font-semibold rounded-2xl shadow-md hover:bg-white/12 transition-all"
                  aria-label="Try a demo search"
                >
                  Try a Demo Search
                </motion.button>
              </Link>
            </motion.div>
          </div>

          {/* Scroll cue — desktop only so it doesn’t crowd mobile */}
          <div className="hidden md:flex absolute bottom-4 left-1/2 -translate-x-1/2 flex-col items-center text-[10px] text-white/70">
            <span>See how PEAK works</span>
            <span className="animate-bounce text-xs">↓</span>
          </div>
        </section>

        {/* Mini social proof strip */}
        <section className="bg-white py-4 border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] sm:text-xs text-gray-500">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-gray-700">
                Built using lists trusted by:
              </span>
              <span className="uppercase tracking-wide">WADA</span>
              <span className="w-0.5 h-3 bg-gray-300" />
              <span className="uppercase tracking-wide">NCAA</span>
              <span className="w-0.5 h-3 bg-gray-300" />
              <span className="uppercase tracking-wide">UFC</span>
              <span className="w-0.5 h-3 bg-gray-300" />
              <span className="uppercase tracking-wide">Pro Leagues</span>
            </div>
            <div className="text-[10px] text-gray-400">
              Not affiliated or endorsed. Used as reference sources only.
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-12 bg-white">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">
              How PEAK Keeps You Ahead
            </h2>
            <div className="grid gap-6 sm:grid-cols-3 text-sm">
              <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
                <p className="text-xs font-semibold text-[#46769B] mb-1">
                  STEP 1
                </p>
                <h3 className="font-semibold mb-2">Scan any label</h3>
                <p className="text-gray-600">
                  Upload a photo or paste ingredients. No complex setup, no
                  training required.
                </p>
              </div>
              <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
                <p className="text-xs font-semibold text-[#46769B] mb-1">
                  STEP 2
                </p>
                <h3 className="font-semibold mb-2">We parse & match</h3>
                <p className="text-gray-600">
                  Ingredients are matched against a deep database of banned
                  substances, synonyms, and high-risk compounds.
                </p>
              </div>
              <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
                <p className="text-xs font-semibold text-[#46769B] mb-1">
                  STEP 3
                </p>
                <h3 className="font-semibold mb-2">You get clarity</h3>
                <p className="text-gray-600">
                  PEAK flags potential issues so athletes, coaches, and staff
                  can document due diligence and move forward confidently.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Why choose PEAK */}
        <section className="py-16 bg-white">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">
              Why Choose PEAK?
            </h2>
            <div className="grid md:grid-cols-3 gap-8 text-center">
              {[
                {
                  icon: (
                    <FaBolt
                      size={30}
                      className="mx-auto mb-2 text-[#46769B]"
                    />
                  ),
                  title: "Fast Scanning",
                  desc: "Instantly scan and analyze supplement labels for potential banned substances.",
                },
                {
                  icon: (
                    <FaCheckCircle
                      size={30}
                      className="mx-auto mb-2 text-emerald-500"
                    />
                  ),
                  title: "Reliable Detection",
                  desc: "Cross-check ingredients against robust lists including synonyms, aliases, and red-flag compounds.",
                },
                {
                  icon: (
                    <FaHistory
                      size={30}
                      className="mx-auto mb-2 text-purple-500"
                    />
                  ),
                  title: "Track Your Checks",
                  desc: "Maintain a scan history so athletes and staff can demonstrate responsible verification.",
                },
              ].map((f, i) => (
                <div
                  key={i}
                  className="p-6 bg-gradient-to-b from-gray-50 to-white rounded-xl shadow hover:shadow-xl transition-transform hover:scale-[1.03]"
                >
                  {f.icon}
                  <h3 className="text-xl font-semibold mb-2">{f.title}</h3>
                  <p className="text-gray-600">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats & comparison */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">
              Built for High-Stakes Decisions
            </h2>

            <div className="grid md:grid-cols-3 gap-8 text-center mb-12">
              <div className="p-6 bg-white rounded-xl shadow hover:shadow-lg transition">
                <p className="text-4xl font-extrabold text-[#46769B] mb-2">
                  20,000+
                </p>
                <p className="text-gray-700">
                  Ingredients, aliases & flagged substances referenced
                </p>
              </div>

              <div className="p-6 bg-white rounded-xl shadow hover:shadow-lg transition">
                <p className="text-4xl font-extrabold text-[#46769B] mb-2">
                  50+
                </p>
                <p className="text-gray-700">
                  Categories from major organizations considered
                </p>
              </div>

              <div className="p-6 bg-white rounded-xl shadow hover:shadow-lg transition">
                <p className="text-4xl font-extrabold text-[#46769B] mb-2">
                  ~10s
                </p>
                <p className="text-gray-700">
                  Average time to sanity-check a label
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h3 className="text-2xl font-semibold text-center mb-8">
                With PEAK vs. Without PEAK
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 rounded-xl bg-gradient-to-b from-blue-50 to-white border border-blue-100">
                  <h4 className="text-xl font-semibold text-[#46769B] mb-4">
                    With PEAK
                  </h4>
                  <ul className="space-y-3 text-gray-700 text-left text-sm">
                    <li>✔ Fast label scanning with OCR</li>
                    <li>✔ Matches against extensive banned & watch lists</li>
                    <li>✔ Captures synonyms, slang, and brand names</li>
                    <li>✔ Scan history for documentation & reviews</li>
                    <li>✔ Designed for athletes, teams & support staff</li>
                  </ul>
                </div>

                <div className="p-6 rounded-xl bg-gradient-to-b from-gray-50 to-white border border-gray-200">
                  <h4 className="text-xl font-semibold text-gray-800 mb-4">
                    Without PEAK
                  </h4>
                  <ul className="space-y-3 text-gray-600 text-left text-sm">
                    <li>✖ Manually Googling every ingredient</li>
                    <li>✖ Easy to miss hidden or alternate names</li>
                    <li>✖ Reliance on scattered PDFs & old lists</li>
                    <li>✖ No audit trail or system for checks</li>
                    <li>✖ Ongoing uncertainty and risk</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center text-xs text-gray-600">
              Click on our <span className="font-semibold">SmartStack</span> tab — deeper insights into ingredient quality, interactions, and stack
              design.
            </div>
          </div>
        </section>

        {/* Logos */}
        <section className="py-12 bg-white">
          <div className="max-w-6xl mx-auto px-4 text-center">
            <h3 className="text-2xl font-semibold mb-8">
              Built Using Lists Trusted By
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center justify-center">
              {["ncaa", "ufc", "wada", "nba"].map((logo) => (
                <div key={logo} className="flex items-center justify-center">
                  <img
                    src={`/logos/${logo}.svg`}
                    alt={logo.toUpperCase()}
                    className="h-10 object-contain opacity-70 hover:opacity-100 transition"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              ))}
            </div>

            <p className="mt-6 text-gray-600 text-xs md:text-sm max-w-3xl mx-auto">
              PEAK references banned-substance information published by global
              and professional organizations to inform its database. It is not
              officially affiliated with, endorsed by, or acting on behalf of
              these organizations.
            </p>
          </div>
        </section>

        {/* Early access */}
        <section className="py-14 bg-white">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h3 className="text-2xl font-semibold mb-3">
              Request early access to PEAK.
            </h3>
            <p className="text-gray-600 mb-6 text-sm md:text-base">
              On a mission to help athletes and professionals verify supplements
              and perform with total confidence. Ideal for teams, universities,
              performance facilities, and serious individual athletes.
            </p>

            <form
              onSubmit={handleEarlyAccessSubmit}
              className="flex flex-col gap-3 items-stretch sm:flex-row sm:items-center sm:justify-center"
            >
              <input
                type="email"
                required
                value={earlyEmail}
                onChange={(e) => setEarlyEmail(e.target.value)}
                placeholder="Work or team email"
                className="w-full sm:w-64 px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#46769B]"
              />
              <select
                value={earlyRole}
                onChange={(e) => setEarlyRole(e.target.value)}
                className="w-full sm:w-40 px-3 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#46769B]"
              >
                <option>Athlete</option>
                <option>Coach / Staff</option>
                <option>Compliance</option>
                <option>Performance Gym</option>
                <option>Organization</option>
              </select>
              <input
                type="text"
                value={earlyOrg}
                onChange={(e) => setEarlyOrg(e.target.value)}
                placeholder="Team / organization (optional)"
                className="w-full sm:w-52 px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#46769B]"
              />
              <button
                type="submit"
                disabled={earlyLoading}
                className={`w-full sm:w-auto px-6 py-3 rounded-xl bg-[#46769B] text-white font-semibold text-sm shadow-sm hover:brightness-110 transition ${
                  earlyLoading ? "opacity-70 cursor-not-allowed" : ""
                }`}
              >
                {earlyLoading ? "Submitting..." : "Request Access"}
              </button>
            </form>

            {earlyError && (
              <p className="mt-3 text-xs text-red-500">{earlyError}</p>
            )}
            {earlySuccess && (
              <p className="mt-3 text-xs text-emerald-600">
                Request received. We’ll keep you informed on access and updates!
              </p>
            )}

            <p className="mt-3 text-[10px] text-gray-500">
              No spam. Your info is used only to coordinate access and updates.
            </p>
          </div>
        </section>

        {/* Disclaimer */}
        <section className="py-12">
          <div className="max-w-3xl mx-auto px-4">
            <div className="p-6 bg-yellow-50 border-l-4 border-yellow-300 rounded-lg shadow-sm text-left text-yellow-800 text-xs md:text-sm">
              <p className="font-semibold mb-1">Important Notice:</p>
              <p>
                PEAK provides guidance on potentially banned or high-risk
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
