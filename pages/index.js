"use client";

import Head from "next/head";
import { useState, useRef } from "react";
import Link from "next/link";
import NavBar from "../components/NavBar";
import OCRUpload from "../components/OCRUpload";
import { motion, AnimatePresence } from "framer-motion";
import { FaBolt, FaCheckCircle, FaHistory } from "react-icons/fa";
import SearchBar from "../components/SearchBar";
import OCRSearchResults from "../components/OCRSearchResults";

export default function HomePage() {
  const [userType, setUserType] = useState("");
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
      </Head>

      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
        <NavBar />

        {/* HERO */}
        <section className="relative bg-gradient-to-r from-[#46769B] to-[#1D2433] text-white h-[70vh] flex flex-col justify-center items-center text-center px-4 overflow-hidden">
          {/* Animated Background */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
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
            Know exactly what's in your supplements - fast, accurate, and hassle-free.
          </motion.p>

          <motion.div className="flex flex-col md:flex-row gap-6 mt-8 z-10">
            <motion.button
              onClick={scrollToSearch}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 bg-gradient-to-r from-[#46769B] to-[#3a5e85] text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all"
            >
              Try Demo
            </motion.button>

            <Link href="/smartstack" passHref>
              <motion.a
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-gradient-to-r from-[#46769B] to-[#3a5e85] text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all inline-block text-center"
              >
                Explore SmartStack
              </motion.a>
            </Link>
          </motion.div>
        </section>

        {/* Search Demo Section */}
        <section ref={searchRef} className="py-16 bg-gray-50">
          <div className="max-w-5xl mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-6">Search Substances</h2>
            <p className="text-gray-600 mb-8">
              Type a substance, synonym, or banned by to instantly check if it's prohibited.
            </p>

            <form
              onSubmit={handleSearch}
              className="bg-white p-6 rounded-2xl shadow-md border border-blue-100 space-y-4 max-w-2xl mx-auto"
            >
              <SearchBar value={searchQuery} onChange={setSearchQuery} />
              <button
                type="submit"
                className="px-6 py-3 rounded-2xl text-white font-medium bg-[#46769B] hover:bg-[#3a5e85] transition-colors"
              >
                Search
              </button>
              {error && <p className="text-red-500 mt-2">{error}</p>}
            </form>

            <div className="bg-white p-6 rounded-2xl shadow-md border border-blue-100 mt-8">
              <OCRSearchResults searchTerm={searchQuery} matchedSubstances={searchResults} />
            </div>
          </div>
        </section>

        {/* OCR Upload Section */}
        <AnimatePresence>
          {userType && (
            <motion.section
              className="py-16 bg-gray-50"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.6 }}
            >
              <div className="max-w-5xl mx-auto px-4 text-center">
                <h2 className="text-3xl font-bold mb-6">
                  {userType === "individual"
                    ? "Scan Your Supplement Label"
                    : "Upload Labels for Your Organization"}
                </h2>
                <p className="text-gray-600 mb-8">
                  Upload one or multiple supplement labels to quickly check for banned substances and maintain compliance.
                </p>

                <motion.div
                  className="p-4 rounded-2xl border-2 border-dashed border-blue-200 hover:shadow-lg transition"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                >
                  <OCRUpload multiple={true} />
                </motion.div>

                <div className="mt-6">
                  {userType === "individual" ? (
                    <Link
                      href="/login"
                      className="px-8 py-3 bg-[#46769B] text-white font-bold rounded-2xl shadow-md hover:bg-[#3a5e85] transition hover:shadow-lg"
                    >
                      Start Scanning
                    </Link>
                  ) : (
                    <Link
                      href="/org-login"
                      className="px-8 py-3 bg-[#46769B] text-white font-bold rounded-2xl shadow-md hover:bg-[#3a5e85] transition hover:shadow-lg"
                    >
                      Create Organization Account
                    </Link>
                  )}
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Features */}
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

        {/* Disclaimer */}
        <section className="py-12">
          <div className="max-w-3xl mx-auto p-6 bg-yellow-50 border-l-4 border-yellow-300 rounded-lg shadow-sm text-left text-yellow-800 text-sm md:text-base">
            <p className="font-semibold mb-1">Important Notice:</p>
            <p>
              PEAK provides guidance on banned substances using our database and label analysis. It is <strong>not 100% comprehensive</strong>. Users should verify with a certified authority before consuming any substances.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
