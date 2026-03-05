// pages/nutrition-label-scanner.js
"use client";

import Head    from "next/head";
import OCRPage from "./ocr";

// Canonical is a build-time constant — avoids hydration mismatch
// from typeof window checks during SSR/SSG.
const CANONICAL = "https://checkpeak.com/nutrition-label-scanner";

const TITLE =
  "Nutrition Label Scanner for Supplements | CheckPeak (Banned Substance Screen)";

const DESCRIPTION =
  "Upload a photo of a supplement or nutrition label. CheckPeak extracts ingredients with OCR and flags potential banned or risky substances for athletes.";

// ---------------------------------------------------------------------------
// Structured data — defined at module level so they're never recreated
// ---------------------------------------------------------------------------

const softwareAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "CheckPeak Nutrition Label Scanner",
  applicationCategory: "HealthApplication",
  operatingSystem: "Web",
  url: CANONICAL,
  description: DESCRIPTION,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home",                    item: "https://checkpeak.com/" },
    { "@type": "ListItem", position: 2, name: "Nutrition Label Scanner", item: CANONICAL },
  ],
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How does the nutrition label scanner work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Upload a label photo and CheckPeak uses OCR to extract the ingredient text, then flags potential banned or higher-risk substances based on reference lists.",
      },
    },
    {
      "@type": "Question",
      name: "Does this guarantee a supplement is safe?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. This is a screening tool to surface potential red flags. Supplements can still be contaminated or mislabeled, so confirm with trusted testing and your sport's rules.",
      },
    },
    {
      "@type": "Question",
      name: "What photos work best for scanning?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Use bright lighting, sharp focus, and a straight-on photo of the ingredients or supplement facts panel for best OCR accuracy.",
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NutritionLabelScannerPage() {
  return (
    <>
      <Head>
        <title>{TITLE}</title>

        {/* Basic SEO */}
        <meta name="description" content={DESCRIPTION} />
        <link rel="canonical" href={CANONICAL} />

        {/* Open Graph */}
        <meta property="og:type"        content="website"    />
        <meta property="og:title"       content={TITLE}       />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url"         content={CANONICAL}   />
        {/* <meta property="og:image" content="https://checkpeak.com/og/nutrition-label-scanner.png" /> */}

        {/* Twitter */}
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content={TITLE}                />
        <meta name="twitter:description" content={DESCRIPTION}          />
        {/* <meta name="twitter:image" content="https://checkpeak.com/og/nutrition-label-scanner.png" /> */}

        {/* Misc */}
        <meta name="robots"      content="index, follow" />
        <meta name="theme-color" content="#1E3A5F" />

        {/* JSON-LD */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd)  }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd)         }} />
      </Head>

      <OCRPage />
    </>
  );
}