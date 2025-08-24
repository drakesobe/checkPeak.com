// pages/index.js
import Head from "next/head";
import { useState } from "react";
import Link from "next/link";
import NavBar from "../components/NavBar";
import OCRUpload from "../components/OCRUpload";
import { motion, AnimatePresence } from "framer-motion";
import { FaUser, FaUsers, FaBolt, FaCheckCircle, FaHistory } from "react-icons/fa";

export default function HomePage() {
  const [userType, setUserType] = useState("");

  // Balanced particle definitions (positions, sizes, durations, delays)
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
          {/* Background: blobs + particles */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            <svg className="w-full h-full block" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden>
              <defs>
                {/* Brand-matched radial gradients (dimmed) */}
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

                {/* Blur filters */}
                <filter id="blurA" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="28" result="bA" />
                  <feBlend in="SourceGraphic" in2="bA" mode="normal" />
                </filter>
                <filter id="blurB" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="32" result="bB" />
                  <feBlend in="SourceGraphic" in2="bB" mode="normal" />
                </filter>
                <filter id="blurC" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="36" result="bC" />
                  <feBlend in="SourceGraphic" in2="bC" mode="normal" />
                </filter>
              </defs>

              {/* Blob 1 (left/top) - dimmed */}
              <motion.ellipse
                cx="220"
                cy="160"
                rx="140"
                ry="110"
                fill="url(#g1)"
                filter="url(#blurA)"
                initial={{ opacity: 0 }}
                animate={{
                  cx: [220, 320, 260, 220],
                  cy: [160, 200, 140, 160],
                  rx: [140, 150, 142, 140],
                  ry: [110, 118, 112, 110],
                  opacity: [0, 0.7, 0.7],
                }}
                transition={{ duration: 14, repeat: Infinity, repeatType: "loop", ease: "easeInOut" }}
              />

              {/* Blob 2 (right/center) - dimmed */}
              <motion.ellipse
                cx="820"
                cy="360"
                rx="180"
                ry="150"
                fill="url(#g2)"
                filter="url(#blurB)"
                initial={{ opacity: 0 }}
                animate={{
                  cx: [820, 880, 780, 820],
                  cy: [360, 410, 330, 360],
                  rx: [180, 188, 182, 180],
                  ry: [150, 158, 152, 150],
                  opacity: [0, 0.65, 0.65],
                }}
                transition={{ duration: 18, repeat: Infinity, repeatType: "loop", ease: "easeInOut" }}
              />

              {/* Blob 3 (bottom/center-left) - dimmed */}
              <motion.ellipse
                cx="520"
                cy="620"
                rx="260"
                ry="200"
                fill="url(#g3)"
                filter="url(#blurC)"
                initial={{ opacity: 0 }}
                animate={{
                  cx: [520, 580, 480, 520],
                  cy: [620, 660, 590, 620],
                  rx: [260, 268, 262, 260],
                  ry: [200, 208, 202, 200],
                  opacity: [0, 0.6, 0.6],
                }}
                transition={{ duration: 22, repeat: Infinity, repeatType: "loop", ease: "easeInOut" }}
              />

              {/* Particles - spread for balance */}
              {particles.map((p, i) => (
                <motion.circle
                  key={i}
                  cx={p.cx}
                  cy={p.cy}
                  r={p.r}
                  fill="rgba(255,255,255,0.38)"
                  initial={{ opacity: 0 }}
                  animate={{
                    cx: [p.cx, p.cx + 30, p.cx - 20, p.cx],
                    cy: [p.cy, p.cy + 20, p.cy - 15, p.cy],
                    opacity: [0, 0.4, 0.4],
                  }}
                  transition={{ duration: p.dur, repeat: Infinity, ease: "linear", delay: p.delay }}
                />
              ))}
            </svg>
          </div>

          {/* HERO CONTENT (front) */}
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-4xl md:text-5xl font-bold mb-4 z-10"
          >
            Welcome to PEAK
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.8 }}
            className="text-lg md:text-xl max-w-2xl mb-8 z-10"
          >
            Scan supplement labels quickly to detect banned substances and stay competition-safe. PEAK helps athletes and teams with fast, reliable label analysis and tracking.
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="flex flex-col md:flex-row gap-6 z-10"
          >
            {/* Individual -> go to /ocr */}
            <Link href="/ocr" legacyBehavior>
              <a
                onClick={() => setUserType("individual")}
                aria-label="I am an Individual"
                className={`flex items-center gap-2 px-8 py-4 rounded-2xl text-white font-semibold shadow-md transition-transform hover:scale-105 ${
                  userType === "individual" ? "bg-blue-700" : "bg-[#46769B]"
                }`}
              >
                <FaUser size={20} /> I am an Individual
              </a>
            </Link>

            {/* Organization -> go to /signup (create account) */}
            <Link href="/signup" legacyBehavior>
              <a
                onClick={() => setUserType("organization")}
                aria-label="I am an Organization"
                className={`flex items-center gap-2 px-8 py-4 rounded-2xl text-white font-semibold shadow-md transition-transform hover:scale-105 ${
                  userType === "organization" ? "bg-blue-700" : "bg-[#46769B]"
                }`}
              >
                <FaUsers size={20} /> I am an Organization
              </a>
            </Link>
          </motion.div>
        </section>

        {/* OCR Upload Section */}
        <AnimatePresence>
          {userType && (
            <motion.section
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.6 }}
              className="py-16 bg-gray-50"
            >
              <div className="max-w-5xl mx-auto px-4 text-center">
                <h2 className="text-3xl font-bold mb-6">
                  {userType === "individual" ? "Scan Your Supplement Label" : "Upload Labels for Your Organization"}
                </h2>
                <p className="text-gray-600 mb-8">
                  Upload one or multiple supplement labels to quickly check for banned substances and maintain compliance.
                </p>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                  <OCRUpload multiple={true} />
                </motion.div>

                <div className="mt-6">
                  {userType === "individual" ? (
                    <Link href="/ocr">
                      <a className="px-8 py-3 bg-green-600 text-white font-bold rounded-2xl shadow-md hover:bg-green-700 transition">Start Scanning</a>
                    </Link>
                  ) : (
                    <Link href="/signup">
                      <a className="px-8 py-3 bg-purple-600 text-white font-bold rounded-2xl shadow-md hover:bg-purple-700 transition">Create Organization Account</a>
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
              <div className="p-6 bg-gray-50 rounded-xl shadow hover:shadow-lg transition-transform hover:scale-105">
                <FaBolt size={30} className="mx-auto mb-2 text-blue-600" />
                <h3 className="text-xl font-semibold mb-2">Fast Scanning</h3>
                <p className="text-gray-600">Instantly scan and analyze supplement labels for banned substances.</p>
              </div>

              <div className="p-6 bg-gray-50 rounded-xl shadow hover:shadow-lg transition-transform hover:scale-105">
                <FaCheckCircle size={30} className="mx-auto mb-2 text-green-600" />
                <h3 className="text-xl font-semibold mb-2">Reliable Detection</h3>
                <p className="text-gray-600">Identify banned substances accurately, including synonyms and brand variations.</p>
              </div>

              <div className="p-6 bg-gray-50 rounded-xl shadow hover:shadow-lg transition-transform hover:scale-105">
                <FaHistory size={30} className="mx-auto mb-2 text-purple-600" />
                <h3 className="text-xl font-semibold mb-2">Track Your Results</h3>
                <p className="text-gray-600">Save and review your scans to maintain compliance over time.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Disclaimer */}
        <section className="py-12">
          <div className="max-w-3xl mx-auto p-4 bg-yellow-50 border-l-4 border-yellow-300 rounded-lg text-left text-yellow-800 text-sm md:text-base">
            <p className="font-semibold mb-1">⚠️ Important Notice:</p>
            <p>
              PEAK provides guidance on banned substances using our database and label analysis. It is <strong>not 100% comprehensive</strong>.
              Users should verify with a certified authority before consuming any substances.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
