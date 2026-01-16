// pages/supplement-label-scanner.js
"use client";

import Head from "next/head";
import Link from "next/link";
import { motion } from "framer-motion";
import { useMemo } from "react";

export default function SupplementLabelScannerPage() {
  const title =
    "Supplement Label Scanner | Screen Ingredients for Red Flags – CheckPeak";
  const description =
    "Scan a supplement label to screen for banned ingredients, high-risk compounds, and alias wording. Fast, reference-based screening for tested athletes, coaches, and compliance.";

  const canonical = "https://checkpeak.com/supplement-label-scanner";

  const faqJsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is a supplement label scanner?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "A supplement label scanner extracts text from an ingredient label or supplement facts panel and helps you review what’s listed. CheckPeak adds athlete-focused screening by flagging banned ingredients, high-risk compounds, and alias wording.",
          },
        },
        {
          "@type": "Question",
          name: "Can this detect hidden or alternate ingredient names?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "CheckPeak can flag common alias wording and alternate names found in label text. However, undisclosed ingredients, contamination, or missing label details cannot be detected from a label scan alone.",
          },
        },
        {
          "@type": "Question",
          name: "Does scanning guarantee a product is safe or compliant?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "No. Scanning provides a quick screening signal, but it cannot guarantee compliance or safety. Always verify with your sport’s rules and trusted guidance for final decisions.",
          },
        },
        {
          "@type": "Question",
          name: "What photo works best for a scan?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "Use bright lighting and a straight-on photo of the ingredients panel. Avoid glare, heavy shadows, and blurry images to improve OCR accuracy.",
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
      name: "CheckPeak Supplement Label Scanner",
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

        {/* Canonical */}
        <link rel="canonical" href={canonical} />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />

        {/* JSON-LD */}
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
        {/* Header */}
        <header className="max-w-6xl mx-auto px-4 pt-8 sm:pt-12 pb-6">
          <div className="bg-white border border-blue-100 rounded-2xl shadow-md p-6 sm:p-8">
            <div className="flex flex-wrap gap-2 text-[11px] sm:text-xs text-gray-600">
              <span className="px-3 py-1 rounded-full bg-gray-50 border border-gray-200">
                Fast screening
              </span>
              <span className="px-3 py-1 rounded-full bg-gray-50 border border-gray-200">
                Alias-aware matching
              </span>
              <span className="px-3 py-1 rounded-full bg-gray-50 border border-gray-200">
                Built for tested athletes
              </span>
              <span className="px-3 py-1 rounded-full bg-gray-50 border border-gray-200">
                No affiliations
              </span>
            </div>

            <h1 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900 leading-[1.05]">
              Supplement Label Scanner
            </h1>

            <p className="mt-3 text-sm sm:text-base text-gray-700 leading-relaxed max-w-3xl">
              Upload a supplement label photo and screen the ingredient list for
              banned ingredients, high-risk compounds, and alias wording. Get a
              quick “red-flag pass” in seconds—then verify with trusted guidance
              for high-stakes decisions.
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

              <Link href="/nutrition-label-scanner#how">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-white border border-gray-200 text-gray-900 font-semibold shadow-sm hover:shadow-md transition"
                >
                  See how scanning works
                </motion.button>
              </Link>
            </div>

            <p className="mt-3 text-[11px] text-gray-500">
              Tip: Use bright lighting and a straight-on photo of the ingredient
              panel for best OCR accuracy.
            </p>
          </div>
        </header>

        {/* Crawlable content */}
        <section className="max-w-6xl mx-auto px-4 pb-14">
          <div className="bg-white border border-blue-100 rounded-2xl shadow-md p-6 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              Screen a supplement label before you trust it
            </h2>
            <p className="mt-2 text-gray-700 leading-relaxed">
              Supplement labels can be messy: proprietary blends, long chemical
              names, and alias wording can hide what’s actually listed. CheckPeak
              helps you screen labels quickly by extracting text and comparing it
              against reference lists for ingredients, high-risk compounds, and
              banned-substance terms.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                <p className="font-semibold text-gray-900">Ingredient clarity</p>
                <p className="mt-1 text-sm text-gray-600">
                  Extract and review what the label claims—fast.
                </p>
              </div>
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                <p className="font-semibold text-gray-900">Alias-aware screening</p>
                <p className="mt-1 text-sm text-gray-600">
                  Catch alternate names that can hide risk.
                </p>
              </div>
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                <p className="font-semibold text-gray-900">Quick signal</p>
                <p className="mt-1 text-sm text-gray-600">
                  A fast step before deeper research or staff review.
                </p>
              </div>
            </div>

            <h3 className="text-lg sm:text-xl font-bold mt-8 text-gray-900">
              Best practices
            </h3>
            <ol className="mt-3 space-y-2 text-gray-700 list-decimal list-inside">
              <li>Scan the ingredient panel for obvious red flags and alias wording.</li>
              <li>Confirm flagged items with your sport’s rules and trusted staff/resources.</li>
              <li>Prefer brands with reputable third-party testing and clear labeling.</li>
              <li>Save scans to document due diligence over time.</li>
            </ol>

            <div className="mt-10 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <Link href="/nutrition-label-scanner" className="w-full sm:w-auto">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-gray-900 text-white font-semibold shadow-md hover:shadow-lg transition"
                >
                  Scan a Label Now →
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
