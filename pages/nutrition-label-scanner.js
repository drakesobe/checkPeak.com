// pages/nutrition-label-scanner.js
"use client";

import Head from "next/head";
import OCRPage from "./ocr";

export default function NutritionLabelScannerPage() {
  // Strong but not keyword-stuffed
  const title =
    "Nutrition Label Scanner for Supplements | CheckPeak (Banned Substance Screen)";
  const description =
    "Upload a photo of a supplement or nutrition label. CheckPeak extracts ingredients with OCR and flags potential banned or risky substances for athletes.";

  const canonical =
    typeof window !== "undefined"
      ? `${window.location.origin}/nutrition-label-scanner`
      : "https://checkpeak.com/nutrition-label-scanner";

  // Optional: if you have a share image
  // const ogImage =
  //   typeof window !== "undefined"
  //     ? `${window.location.origin}/og/nutrition-label-scanner.png`
  //     : "https://checkpeak.com/og/nutrition-label-scanner.png";

  // Structured data: SoftwareApplication (tool page)
  const softwareAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
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

  // Structured data: Breadcrumbs
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://checkpeak.com/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Nutrition Label Scanner",
        item: "https://checkpeak.com/nutrition-label-scanner",
      },
    ],
  };

  // Optional (keep minimal): FAQ schema without adding visible page copy
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How does the nutrition label scanner work?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Upload a label photo and CheckPeak uses OCR to extract the ingredient text, then flags potential banned or higher-risk substances based on reference lists.",
        },
      },
      {
        "@type": "Question",
        name: "Does this guarantee a supplement is safe?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "No. This is a screening tool to surface potential red flags. Supplements can still be contaminated or mislabeled, so confirm with trusted testing and your sport’s rules.",
        },
      },
      {
        "@type": "Question",
        name: "What photos work best for scanning?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Use bright lighting, sharp focus, and a straight-on photo of the ingredients or supplement facts panel for best OCR accuracy.",
        },
      },
    ],
  };

  return (
    <>
      <Head>
        <title>{title}</title>

        {/* Basic SEO */}
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />
        {/* <meta property="og:image" content={ogImage} /> */}

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        {/* <meta name="twitter:image" content={ogImage} /> */}

        {/* Optional extras */}
        <meta name="robots" content="index, follow" />
        <meta name="theme-color" content="#46769B" />

        {/* JSON-LD (no visible marketing block needed) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      </Head>

      {/* Tool UI only */}
      <OCRPage />
    </>
  );
}
