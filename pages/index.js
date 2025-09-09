"use client";

import Head from "next/head";
import { useState, useRef } from "react";
import Link from "next/link";
import NavBar from "../components/NavBar";
import OCRUpload from "../components/OCRUpload";
import { motion } from "framer-motion";
import { FaBolt, FaCheckCircle, FaHistory } from "react-icons/fa";
import SearchBar from "../components/SearchBar";
import OCRSearchResults from "../components/OCRSearchResults";

export default function HomePage() {
  const [userType, setUserType] = useState(""); // "individual" | "organization" | ""
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [error, setError] = useState("");

  const searchRef = useRef(null);

  const scrollToSearch = () => {
    searchRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    setError("");
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      });
      const data = await res.json();
      setSearchResults(data.records || []);
    } catch (err) {
      console.error("Search error:", err);
      setSearchResults([]);
      setError("Search failed. Please try again.");
    }
  };

  // Particle background shapes
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

  return (
    <>
      <Head>
        <title>PEAK — Supplement Label Scanner | Detect Banned Substances</title>
        <meta
          name="description"
          content="PEAK scans supplement labels to detect banned substances and help athletes stay compliant. Fast label scanning, reliable detection, and scan history for teams and individuals."
        />

        {/* Open Graph */}
        <meta property="og:title" content="PEAK — Supplement Label Scanner" />
        <meta property="og:description" content="Scan supplement labels fast and accurately. Detect banned substances and stay compliant!" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://checkpeak.com" />
        <meta
          property="og:image"
          content={`https://checkpeak.com/api/og-image?q=${encodeURIComponent(searchQuery || 'PEAK — Supplement Label Scanner')}`}
        />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@checkPeak_" />
        <meta name="twitter:title" content="PEAK — Supplement Label Scanner" />
        <meta name="twitter:description" content="Scan supplement labels fast and accurately. Detect banned substances and stay compliant!" />
        <meta
          name="twitter:image"
          content={`https://checkpeak.com/api/og-image?q=${encodeURIComponent(searchQuery || 'PEAK — Supplement Label Scanner')}`}
        />
      </Head>

      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
        <NavBar />

        {/* HERO */}
        <section
          className="relative bg-gradient-to-r from-[#46769B] to-[#1D2433] text-white h-[70vh] flex flex-col justify-center items-center text-center px-4 overflow-hidden"
          aria-labelledby="hero-heading"
        >
          {/* Animated background shapes (subtle + performant) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
            <defs>
              <radialGradient id="g1" cx="30%" cy="30%" r="80%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
                <stop offset="60%" stopColor="rgba(70,118,155,1)" stopOpacity="0.18" />
                <stop offset="100%" stopColor="rgba(29,36,51,1)" stopOpacity="0.06" />
              </radialGradient>
              <radialGradient id="g2" cx="60%" cy="40%" r="80%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
                <stop offset="60%" stopColor="rgba(100,130,180,1)" stopOpacity="0.16" />
                <stop offset="100%" stopColor="rgba(29,36,51,1)" stopOpacity="0.05" />
              </radialGradient>
              <radialGradient id="g3" cx="40%" cy="70%" r="80%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.75)" />
                <stop offset="60%" stopColor="rgba(120,140,200,1)" stopOpacity="0.14" />
                <stop offset="100%" stopColor="rgba(29,36,51,1)" stopOpacity="0.05" />
              </radialGradient>
              <filter id="blurA"><feGaussianBlur stdDeviation="28" /></filter>
              <filter id="blurB"><feGaussianBlur stdDeviation="32" /></filter>
              <filter id="blurC"><feGaussianBlur stdDeviation="36" /></filter>
            </defs>

            <motion.ellipse
              cx="220"
              cy="160"
              rx="140"
              ry="110"
              fill="url(#g1)"
              filter="url(#blurA)"
              animate={{ cx: [220, 320, 260, 220], cy: [160, 200, 140, 160], opacity: [0, 0.7, 0.7] }}
              transition={{ duration: 14, repeat: Infinity, repeatType: "loop", ease: "easeInOut" }}
            />
            <motion.ellipse
              cx="820"
              cy="360"
              rx="180"
              ry="150"
              fill="url(#g2)"
              filter="url(#blurB)"
              animate={{ cx: [820, 880, 780, 820], cy: [360, 410, 330, 360], opacity: [0, 0.65, 0.65] }}
              transition={{ duration: 18, repeat: Infinity, repeatType: "loop", ease: "easeInOut" }}
            />
            <motion.ellipse
              cx="520"
              cy="620"
              rx="260"
              ry="200"
              fill="url(#g3)"
              filter="url(#blurC)"
              animate={{ cx: [520, 580, 480, 520], cy: [620, 660, 590, 620], opacity: [0, 0.6, 0.6] }}
              transition={{ duration: 22, repeat: Infinity, repeatType: "loop", ease: "easeInOut" }}
            />

            {particles.map((p, i) => (
              <motion.circle
                key={i}
                cx={p.cx}
                cy={p.cy}
                r={p.r}
                fill="rgba(255,255,255,0.38)"
                animate={{ cx: [p.cx, p.cx + 30, p.cx - 20, p.cx], cy: [p.cy, p.cy + 20, p.cy - 15, p.cy], opacity: [0, 0.4, 0.4] }}
                transition={{ duration: p.dur, repeat: Infinity, ease: "linear", delay: p.delay }}
              />
            ))}
          </svg>

          {/* Hero Content */}
          <motion.h1
            id="hero-heading"
            className="text-4xl md:text-5xl font-bold z-10 tracking-tight"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            Navigate Supplements with Confidence
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl max-w-2xl mt-4 z-10 text-gray-100"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.8 }}
          >
            Know exactly what you're taking – fast, accurate, and hassle-free.
          </motion.p>

          <motion.div className="flex flex-col md:flex-row gap-4 mt-8 z-10">
            <motion.button
              onClick={scrollToSearch}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-3 px-6 md:px-8 py-3 bg-gradient-to-r from-[#46769B] to-[#3a5e85] text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all"
              aria-label="Try a demo search"
            >
              <span>Try a Demo Search</span>
            </motion.button>

            <Link href="/smartstack">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                className="px-6 md:px-8 py-3 bg-white/10 border border-white/20 text-white font-semibold rounded-2xl shadow transition-all"
                aria-label="Explore SmartStack"
              >
                Explore SmartStack
              </motion.button>
            </Link>
          </motion.div>
        </section>

        {/* Why Choose PEAK */}
        <section className="py-16 bg-white">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">Why Choose PEAK?</h2>
            <div className="grid md:grid-cols-3 gap-8 text-center">
              {[
                {
                  icon: <FaBolt size={30} className="mx-auto mb-2 text-blue-600" />,
                  title: "Fast Scanning",
                  desc: "Instantly scan and analyze supplement labels for banned substances.",
                },
                {
                  icon: <FaCheckCircle size={30} className="mx-auto mb-2 text-green-600" />,
                  title: "Reliable Detection",
                  desc: "Identify banned substances accurately, including synonyms and brand variations.",
                },
                {
                  icon: <FaHistory size={30} className="mx-auto mb-2 text-purple-600" />,
                  title: "Track Your Results",
                  desc: "Save and review your scans to maintain compliance over time.",
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

        {/* Trusted Coverage (stats + comparison) */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">The Most Comprehensive Supplement Scanner</h2>

            {/* Stats */}
            <div className="grid md:grid-cols-3 gap-8 text-center mb-12">
              <div className="p-6 bg-white rounded-xl shadow hover:shadow-lg transition">
                <p className="text-4xl font-extrabold text-[#46769B] mb-2">20,000+</p>
                <p className="text-gray-700">Banned substances & synonyms tracked</p>
              </div>

              <div className="p-6 bg-white rounded-xl shadow hover:shadow-lg transition">
                <p className="text-4xl font-extrabold text-[#46769B] mb-2">50+</p>
                <p className="text-gray-700">Categories from global authorities</p>
              </div>

              <div className="p-6 bg-white rounded-xl shadow hover:shadow-lg transition">
                <p className="text-4xl font-extrabold text-[#46769B] mb-2">~10s</p>
                <p className="text-gray-700">Average time to check a label</p>
              </div>
            </div>

            {/* Comparison grid */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h3 className="text-2xl font-semibold text-center mb-8">Why Choose PEAK Over Alternatives?</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 rounded-xl bg-gradient-to-b from-blue-50 to-white border border-blue-100">
                  <h4 className="text-xl font-semibold text-[#46769B] mb-4">With PEAK</h4>
                  <ul className="space-y-3 text-gray-700 text-left">
                    <li>✔ Fast label scanning with OCR</li>
                    <li>✔ Reliable detection of banned substances</li>
                    <li>✔ Includes synonyms, slang, and brand names</li>
                    <li>✔ Save and review your scans anytime</li>
                    <li>✔ Built with public lists from major authorities in mind</li>
                  </ul>
                </div>

                <div className="p-6 rounded-xl bg-gradient-to-b from-gray-50 to-white border border-gray-200">
                  <h4 className="text-xl font-semibold text-gray-800 mb-4">Without PEAK</h4>
                  <ul className="space-y-3 text-gray-600 text-left">
                    <li>✖ Manually searching ingredients on Google</li>
                    <li>✖ Risk of missing hidden or alternative names</li>
                    <li>✖ Outdated PDFs or scattered lists</li>
                    <li>✖ No way to track or save your results</li>
                    <li>✖ Uncertainty about compliance</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Search Substances */}
        <section ref={searchRef} className="py-16 bg-gray-50">
          <div className="max-w-5xl mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-6">Search Substances</h2>
            <p className="text-gray-600 mb-8">
              Type a substance, synonym, or banning authority to check whether it's listed.
            </p>

            <form
              onSubmit={handleSearch}
              className="bg-white p-6 rounded-2xl shadow-md border border-blue-100 space-y-4 max-w-2xl mx-auto"
            >
              <SearchBar value={searchQuery} onChange={setSearchQuery} />
              <div className="flex justify-center gap-4">
                <button
                  type="submit"
                  className="px-6 py-3 rounded-2xl text-white font-medium bg-[#46769B] hover:bg-[#3a5e85] transition-colors"
                >
                  Search
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                    setError("");
                  }}
                  className="px-6 py-3 rounded-2xl bg-gray-100 text-gray-800 font-medium border border-gray-200"
                >
                  Clear
                </button>
              </div>
              {error && <p className="text-red-500 mt-2">{error}</p>}
            </form>

            <div className="bg-white p-6 rounded-2xl shadow-md border border-blue-100 mt-8">
              <OCRSearchResults searchTerm={searchQuery} matchedSubstances={searchResults} />
            </div>
          </div>
        </section>

        {/* Trusted By (logos / placeholders) */}
        <section className="py-12 bg-white">
          <div className="max-w-6xl mx-auto px-4 text-center">
            <h3 className="text-2xl font-semibold mb-8">Built Using Lists Trusted By</h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center justify-center">
              <div className="flex items-center justify-center">
                <img src="/logos/ncaa.svg" alt="NCAA" className="h-10 object-contain transition" onError={(e)=>{e.currentTarget.style.display='none'}} />
              </div>
              <div className="flex items-center justify-center">
                <img src="/logos/ufc.svg" alt="UFC" className="h-10 object-contain transition" onError={(e)=>{e.currentTarget.style.display='none'}} />
              </div>
              <div className="flex items-center justify-center">
                <img src="/logos/wada.svg" alt="WADA" className="h-10 object-contain transition" onError={(e)=>{e.currentTarget.style.display='none'}} />
              </div>
              <div className="flex items-center justify-center">
                <img src="/logos/nba.svg" alt="NBA" className="h-10 object-contain transition" onError={(e)=>{e.currentTarget.style.display='none'}} />
              </div>
            </div>

            <p className="mt-6 text-gray-600 text-sm max-w-3xl mx-auto">
              PEAK references banned-substance data published by global and professional organizations to provide reliable insights.
              We are not officially affiliated or endorsed by these bodies - we simply use their public lists as part of our database.
            </p>
          </div>
        </section>

        {/* Disclaimer */}
        <section className="py-12">
          <div className="max-w-3xl mx-auto p-6 bg-yellow-50 border-l-4 border-yellow-300 rounded-lg shadow-sm text-left text-yellow-800 text-sm md:text-base">
            <p className="font-semibold mb-1">Important Notice:</p>
            <p>
              PEAK provides guidance on banned substances using our database and label analysis. It is <strong>not 100% comprehensive</strong>.
              Users should verify with their certified authority, athletic trainer, or medical professional before consuming any substances.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
