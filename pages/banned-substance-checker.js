// pages/banned-substance-checker.js
"use client";

import Head from "next/head";
import Link from "next/link";
import { motion } from "framer-motion";

export default function BannedSubstanceChecker() {
  const title =
    "Banned Substance Checker | Scan Supplement Ingredients for Red Flags – CheckPeak";
  const description =
    "Use CheckPeak’s banned substance checker to scan supplement labels and flag potentially banned or high-risk ingredients, aliases, and red-flag compounds in seconds.";

  const canonical = "https://checkpeak.com/banned-substance-checker";

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is a banned substance checker?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "A banned substance checker helps screen ingredient lists for substances that may be banned or restricted by certain sports organizations. CheckPeak scans label text and flags potential red flags and known aliases.",
        },
      },
      {
        "@type": "Question",
        name: "Does CheckPeak guarantee a product is compliant?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "No. Scanning can identify obvious red flags in label text, but it cannot guarantee compliance or safety. Contamination and undisclosed ingredients can still occur. Always confirm with your sport’s rules and trusted guidance.",
        },
      },
      {
        "@type": "Question",
        name: "Who should use a banned substance checker?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Tested athletes, coaches, trainers, and compliance staff who want a fast screening step before trusting a supplement label.",
        },
      },
    ],
  };

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

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      </Head>

      <main className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900">
        <section className="max-w-5xl mx-auto px-4 pt-16 pb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Banned Substance Checker
          </h1>
          <p className="mt-3 text-gray-700 max-w-2xl">
            CheckPeak is an athlete-focused banned substance checker that helps
            you scan supplement labels and flag potential red flags fast. Upload
            an ingredient label, and CheckPeak extracts text and checks it
            against reference lists—highlighting suspicious matches and aliases.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link href="/nutrition-label-scanner">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                className="px-7 py-3 rounded-2xl bg-[#46769B] text-white font-semibold shadow-md hover:shadow-lg transition"
              >
                Start a Free Scan →
              </motion.button>
            </Link>

            <Link href="/nutrition-label-scanner#how">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-7 py-3 rounded-2xl bg-white border border-gray-200 text-gray-900 font-semibold shadow-sm hover:shadow-md transition"
              >
                How it works
              </motion.button>
            </Link>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-4 pb-14">
          <div className="bg-white border border-blue-100 rounded-2xl shadow-md p-6 sm:p-8">
            <h2 className="text-xl font-bold">Why a banned substance checker matters</h2>
            <p className="mt-2 text-gray-700 leading-relaxed">
              For tested athletes, “I didn’t know” is rarely a defense. Labels
              can be confusing, blends can hide ingredient wording, and aliases
              can make a compound hard to spot. A banned substance checker is a
              fast screening step to reduce obvious risk before you commit.
            </p>

            <h2 className="text-xl font-bold mt-8">What CheckPeak looks for</h2>
            <ul className="mt-3 space-y-2 text-gray-700 list-disc list-inside">
              <li>Potentially banned or commonly restricted substances (reference-based)</li>
              <li>Aliases and alternate names used on labels</li>
              <li>High-risk compounds that deserve extra verification</li>
              <li>Ingredient matches that help you understand what’s inside</li>
            </ul>

            <h2 className="text-xl font-bold mt-8">Best practices for safer decisions</h2>
            <ol className="mt-3 space-y-2 text-gray-700 list-decimal list-inside">
              <li>Scan the label for obvious red flags and suspicious wording.</li>
              <li>Confirm ingredients with your sport’s rules and trusted staff.</li>
              <li>Prefer products with reputable testing and clear labeling.</li>
              <li>Save scans to build a history and document due diligence.</li>
            </ol>

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
