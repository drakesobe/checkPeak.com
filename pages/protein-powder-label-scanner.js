// pages/protein-powder-label-scanner.js
"use client";

import Head from "next/head";
import Link from "next/link";
import { motion } from "framer-motion";
import { useMemo } from "react";

export default function ProteinPowderLabelScannerPage() {
  const title =
    "Protein Powder Label Scanner | Screen Add-Ins & Blends – CheckPeak";
  const description =
    "Scan protein powder labels to screen add-ins, blends, and ingredient wording for banned substances and high-risk compounds. Fast screening for athletes and coaches.";

  const canonical = "https://checkpeak.com/protein-powder-label-scanner";

  const faqJsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Why scan protein powder labels?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "Protein powders can include add-ins, blends, and long ingredient lists beyond the protein source. Scanning helps you quickly screen for banned ingredients, high-risk compounds, and suspicious wording.",
          },
        },
        {
          "@type": "Question",
          name: "Does scanning guarantee the protein is safe?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "No. Scanning provides a quick screening signal based on label text, but it cannot guarantee safety or compliance. Contamination and undisclosed ingredients can still occur.",
          },
        },
        {
          "@type": "Question",
          name: "What label photo works best?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "A bright, sharp, straight-on photo of the ingredient panel and supplement facts. Avoid glare and blur for best OCR accuracy.",
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
      name: "CheckPeak Protein Powder Label Scanner",
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
                Common daily use
              </span>
              <span className="px-3 py-1 rounded-full bg-gray-50 border border-gray-200">
                Add-in aware
              </span>
              <span className="px-3 py-1 rounded-full bg-gray-50 border border-gray-200">
                Alias-aware matching
              </span>
              <span className="px-3 py-1 rounded-full bg-gray-50 border border-gray-200">
                No affiliations
              </span>
            </div>

            <h1 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900 leading-[1.05]">
              Protein Powder Label Scanner
            </h1>

            <p className="mt-3 text-sm sm:text-base text-gray-700 leading-relaxed max-w-3xl">
              Protein powders often contain add-ins beyond the protein source.
              Scan the label to screen ingredient wording for banned substances,
              high-risk compounds, and suspicious blends—fast.
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

              <Link href="/supplement-label-scanner">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-white border border-gray-200 text-gray-900 font-semibold shadow-sm hover:shadow-md transition"
                >
                  Supplement label scanner
                </motion.button>
              </Link>
            </div>

            <p className="mt-3 text-[11px] text-gray-500">
              Tip: Include both the ingredients panel and supplement facts for best coverage.
            </p>
          </div>
        </header>

        <section className="max-w-6xl mx-auto px-4 pb-14">
          <div className="bg-white border border-blue-100 rounded-2xl shadow-md p-6 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              Why protein powders still deserve a scan
            </h2>
            <p className="mt-2 text-gray-700 leading-relaxed">
              Protein powders can include sweeteners, flavor systems, blends,
              performance add-ins, and proprietary ingredients beyond the base
              protein. A quick scan helps you surface obvious risks and clarify
              what’s actually listed before you make it part of your daily routine.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                <p className="font-semibold text-gray-900">Add-ins & blends</p>
                <p className="mt-1 text-sm text-gray-600">
                  Many formulas include extras beyond protein.
                </p>
              </div>
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                <p className="font-semibold text-gray-900">Alias wording</p>
                <p className="mt-1 text-sm text-gray-600">
                  Alternate names can obscure what’s listed.
                </p>
              </div>
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                <p className="font-semibold text-gray-900">Daily exposure</p>
                <p className="mt-1 text-sm text-gray-600">
                  Higher frequency makes due diligence more important.
                </p>
              </div>
            </div>

            <h3 className="text-lg sm:text-xl font-bold mt-8 text-gray-900">
              Best practices
            </h3>
            <ol className="mt-3 space-y-2 text-gray-700 list-decimal list-inside">
              <li>Scan ingredients and supplement facts for suspicious wording.</li>
              <li>Confirm flagged items with trusted staff/resources.</li>
              <li>Prefer products with reputable third-party testing.</li>
              <li>Save scans to document what you reviewed.</li>
            </ol>

            <div className="mt-10 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <Link href="/nutrition-label-scanner" className="w-full sm:w-auto">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-gray-900 text-white font-semibold shadow-md hover:shadow-lg transition"
                >
                  Scan a Protein Label →
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
