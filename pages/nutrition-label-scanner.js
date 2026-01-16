// pages/nutrition-label-scanner.js
"use client";

import Head from "next/head";
import OCRPage from "./ocr";

export default function NutritionLabelScannerPage() {
  const title =
    "Nutrition Label Scanner | Scan Supplement Labels for Banned Substances – CheckPeak";
  const description =
    "Scan any nutrition or supplement label with CheckPeak’s AI-powered nutrition label scanner to detect flagged ingredients and banned substances for athletes.";

  const canonical =
    typeof window !== "undefined"
      ? `${window.location.origin}/nutrition-label-scanner`
      : "https://checkpeak.com/nutrition-label-scanner";

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is a nutrition label scanner?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "A nutrition label scanner extracts text from a nutrition or supplement facts panel and ingredient list, then helps identify what’s inside. CheckPeak adds athlete-focused risk detection by flagging ingredients that may be banned or higher risk.",
        },
      },
      {
        "@type": "Question",
        name: "Can I scan supplement ingredient labels?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Yes. Use the Nutrition Label mode to upload a label image, or use Barcode mode when available. CheckPeak checks the extracted text against known ingredient and banned-substance reference lists.",
        },
      },
      {
        "@type": "Question",
        name: "Does scanning guarantee a product is safe?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "No tool can guarantee safety. Scanning helps identify obvious red flags and risky ingredients, but contamination and undisclosed compounds can still occur. Always confirm with trusted testing and guidance for your sport’s rules.",
        },
      },
      {
        "@type": "Question",
        name: "Who should use CheckPeak?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Athletes, coaches, trainers, compliance staff, and sports organizations who want faster screening of labels to reduce the risk of banned-substance exposure.",
        },
      },
    ],
  };

  const appJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "CheckPeak Nutrition Label Scanner",
    applicationCategory: "HealthApplication",
    operatingSystem: "Web",
    url: "https://checkpeak.com/nutrition-label-scanner",
    description,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
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

      {/* Your existing scanner UI */}
      <OCRPage />

      {/* Crawlable content block for SEO (below tool) */}
      <section className="max-w-6xl mx-auto px-4 pb-12">
        <div className="bg-white border border-blue-100 rounded-2xl shadow-md p-6 sm:p-8 mt-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Nutrition Label Scanner for Supplements
          </h1>
          <p className="mt-3 text-gray-700 leading-relaxed">
            CheckPeak is an AI-powered nutrition label scanner designed to help
            athletes and coaches scan supplement labels and identify flagged or
            risky ingredients faster. Upload a photo of a nutrition facts panel
            or ingredient list, and CheckPeak extracts the text and checks it
            against reference lists for ingredients and banned substances.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="p-4 rounded-xl border border-gray-200">
              <p className="font-semibold text-gray-900">Scan in seconds</p>
              <p className="text-sm text-gray-600 mt-1">
                Upload a label image and get an ingredient + flag summary fast.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-gray-200">
              <p className="font-semibold text-gray-900">Athlete-focused risk</p>
              <p className="text-sm text-gray-600 mt-1">
                Built around banned-substance awareness for competitive sport.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-gray-200">
              <p className="font-semibold text-gray-900">Save scan history</p>
              <p className="text-sm text-gray-600 mt-1">
                Unlock to store results and build a personal scan record.
              </p>
            </div>
          </div>

          <h2 className="text-xl font-bold text-gray-900 mt-8">
            How the scanner works
          </h2>
          <ol className="mt-3 space-y-2 text-gray-700 list-decimal list-inside">
            <li>Upload a clear photo of the ingredients / supplement facts.</li>
            <li>CheckPeak extracts text using OCR.</li>
            <li>
              We compare detected text against reference lists for ingredients
              and flagged/banned substances.
            </li>
            <li>
              You get a summary (flagged count + matched ingredients) and can
              save the scan for later.
            </li>
          </ol>

          <h2 className="text-xl font-bold text-gray-900 mt-8">
            FAQ
          </h2>
          <div className="mt-3 space-y-4">
            <div>
              <p className="font-semibold text-gray-900">
                Does this replace medical or compliance guidance?
              </p>
              <p className="text-gray-700">
                No. It’s a fast screening tool to surface obvious red flags and
                reduce risk. For high-stakes decisions, confirm with your sport’s
                rules and trusted resources.
              </p>
            </div>
            <div>
              <p className="font-semibold text-gray-900">
                What labels work best?
              </p>
              <p className="text-gray-700">
                Bright lighting, sharp focus, and a straight-on photo of the
                ingredient panel produces the best OCR results.
              </p>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-8">
            Note: CheckPeak helps identify potential risks based on text found on labels.
            It cannot guarantee a product is safe or compliant for every organization.
          </p>
        </div>
      </section>
    </>
  );
}
