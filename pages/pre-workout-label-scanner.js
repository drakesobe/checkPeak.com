// pages/pre-workout-label-scanner.js
"use client";

import Head from "next/head";
import Link from "next/link";
import { motion } from "framer-motion";
import { useMemo } from "react";

export default function PreWorkoutLabelScannerPage() {
  const title =
    "Pre-Workout Label Scanner | Screen High-Risk Ingredients – CheckPeak";
  const description =
    "Scan pre-workout labels to screen for banned ingredients, high-risk stimulants, and alias wording. Fast, reference-based screening for tested athletes and coaches.";

  const canonical = "https://checkpeak.com/pre-workout-label-scanner";

  const faqJsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Why scan pre-workout labels?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "Pre-workouts can include stimulant blends, proprietary formulas, and long ingredient lists. Scanning helps you quickly screen for banned substances, high-risk compounds, and alias wording before trusting a product.",
          },
        },
        {
          "@type": "Question",
          name: "Can a scan detect everything in a pre-workout?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "No. A scan can only analyze what appears on the label. Undisclosed ingredients, contamination, or organization-specific restrictions may still apply.",
          },
        },
        {
          "@type": "Question",
          name: "Does CheckPeak guarantee compliance?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "No. CheckPeak provides reference-based screening to surface obvious risks. Always confirm with your sport’s rules and trusted guidance for final decisions.",
          },
        },
        {
          "@type": "Question",
          name: "What photo works best for scanning?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "Use bright lighting and a straight-on photo of the ingredients panel. Avoid glare and blur for best OCR extraction.",
          },
        },
      ],
    }),
    []
  );

  const appJsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "CheckPeak Pre-Workout Label Scanner",
      applicationCategory: "HealthApplication",
      operatingSystem: "Web",
      url: canonical,
      description,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    }),
    [canonical, description]
  );

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />

        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd) }}
        />
      </Head>

      <main className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900">
        <header className="max-w-6xl mx-auto px-4 pt-8 sm:pt-12 pb-6">
          <div className="bg-white border border-blue-100 rounded-2xl shadow-md p-6 sm:p-8">
            <div className="flex flex-wrap gap-2 text-[11px] sm:text-xs text-gray-600">
              <span className="px-3 py-1 rounded-full bg-gray-50 border border-gray-200">
                High-risk category
              </span>
              <span className="px-3 py-1 rounded-full bg-gray-50 border border-gray-200">
                Stim blend aware
              </span>
              <span className="px-3 py-1 rounded-full bg-gray-50 border border-gray-200">
                Alias-aware matching
              </span>
              <span className="px-3 py-1 rounded-full bg-gray-50 border border-gray-200">
                No affiliations
              </span>
            </div>

            <h1 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900 leading-[1.05]">
              Pre-Workout Label Scanner
            </h1>

            <p className="mt-3 text-sm sm:text-base text-gray-700 leading-relaxed max-w-3xl">
              Pre-workouts are one of the highest-risk supplement categories.
              Scan the label to screen for banned ingredients, high-risk
              stimulants, and alias wording-fast. Then verify with trusted
              guidance for final decisions.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link href="/nutrition-label-scanner">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-[#46769B] text-white font-semibold shadow-md hover:shadow-lg transition"
                >
                  Run a Free Scan →
                </motion.button>
              </Link>

              <Link href="/banned-substance-checker">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-white border border-gray-200 text-gray-900 font-semibold shadow-sm hover:shadow-md transition"
                >
                  Banned substance checker
                </motion.button>
              </Link>
            </div>

            <p className="mt-3 text-[11px] text-gray-500">
              Tip: Scan the ingredients panel (not the marketing panel) for best accuracy.
            </p>
          </div>
        </header>

        <section className="max-w-6xl mx-auto px-4 pb-14">
          <div className="bg-white border border-blue-100 rounded-2xl shadow-md p-6 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              Why pre-workouts are higher risk
            </h2>
            <p className="mt-2 text-gray-700 leading-relaxed">
              Many pre-workouts use proprietary blends and stimulant stacks with
              long ingredient lists. Alias wording and “blend” formatting can make
              it harder to spot red flags quickly. A fast label scan helps you
              surface obvious risks before you commit.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                <p className="font-semibold text-gray-900">Proprietary blends</p>
                <p className="mt-1 text-sm text-gray-600">
                  Blends can obscure exact dosages and ingredient emphasis.
                </p>
              </div>
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                <p className="font-semibold text-gray-900">Stimulant stacking</p>
                <p className="mt-1 text-sm text-gray-600">
                  Higher chance of ingredients that require extra verification.
                </p>
              </div>
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                <p className="font-semibold text-gray-900">Alias wording</p>
                <p className="mt-1 text-sm text-gray-600">
                  Alternate names can hide what’s really listed.
                </p>
              </div>
            </div>

            <h3 className="text-lg sm:text-xl font-bold mt-8 text-gray-900">
              Best practices for tested athletes
            </h3>
            <ol className="mt-3 space-y-2 text-gray-700 list-decimal list-inside">
              <li>Scan the ingredients panel and supplement facts for red flags.</li>
              <li>Confirm flagged items with your sport’s rules and trusted staff.</li>
              <li>Prefer products with reputable third-party testing and clear labeling.</li>
              <li>Save scans to document what you reviewed.</li>
            </ol>

            <div className="mt-10 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <Link href="/nutrition-label-scanner" className="w-full sm:w-auto">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-gray-900 text-white font-semibold shadow-md hover:shadow-lg transition"
                >
                  Scan a Pre-Workout Label →
                </motion.button>
              </Link>

              <div className="text-[11px] text-gray-500">
                No account needed to scan • Unlock to save scan history
              </div>
            </div>

            <p className="text-xs text-gray-500 mt-8">
              CheckPeak is a screening tool and cannot guarantee compliance or product safety.
              Always confirm with your governing body and trusted guidance.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
