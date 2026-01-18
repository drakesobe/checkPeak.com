// pages/_app.js
import "@/styles/globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { Toaster } from "react-hot-toast";
import Script from "next/script";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import CookieSettings from "@/components/CookieSettings";

/**
 * ✅ Consent-gated analytics (legal + not-creepy)
 * - Essential cookies: always on (site functionality)
 * - Analytics: opt-in (Google Analytics + Microsoft Clarity + your first-party event tracking)
 *
 * This file:
 * ✅ Shows a cookie banner on first visit (Accept / Decline)
 * ✅ Implements Google Consent Mode (default denied; updates on choice)
 * ✅ Denies Clarity by default; grants only on opt-in
 * ✅ Keeps your existing layout + OpenCV.js
 */

const CONSENT_KEY = "cp_consent_v1";

function getConsent() {
  if (typeof window === "undefined") return { analytics: false, decided: false };
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return { analytics: false, decided: false };
    const parsed = JSON.parse(raw);
    return {
      analytics: !!parsed.analytics,
      decided: true,
      updatedAt: parsed.updatedAt || null,
    };
  } catch {
    return { analytics: false, decided: false };
  }
}

function setConsent(next) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    CONSENT_KEY,
    JSON.stringify({
      analytics: !!next.analytics,
      updatedAt: new Date().toISOString(),
    })
  );
}

function CookieBanner({ onChange }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const c = getConsent();
    if (!c.decided) setOpen(true);
  }, []);

  if (!open) return null;

  const accept = () => {
    const next = { analytics: true };
    setConsent(next);
    onChange?.({ analytics: true, decided: true });
    setOpen(false);
  };

  const decline = () => {
    const next = { analytics: false };
    setConsent(next);
    onChange?.({ analytics: false, decided: true });
    setOpen(false);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[150] mx-auto max-w-3xl rounded-3xl border border-blue-100 bg-white p-4 shadow-xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">Cookies & analytics</p>
          <p className="text-xs text-gray-600 mt-1">
            We use analytics to improve CheckPeak and show you helpful activity insights.
            You can change this anytime in cookie settings.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={decline}
            className="px-4 py-2 rounded-2xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition"
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="px-4 py-2 rounded-2xl bg-[#46769B] text-white font-semibold hover:brightness-110 transition"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MyApp({ Component, pageProps }) {
  const router = useRouter();

  // { analytics: boolean, decided: boolean }
  const [consent, setConsentState] = useState({ analytics: false, decided: false });

  // Load saved consent (or undecided)
  useEffect(() => {
    setConsentState(getConsent());
  }, []);

  // GA route change pageviews (Consent Mode will control cookies/collection)
  useEffect(() => {
    const handleRouteChange = (url) => {
      if (typeof window.gtag === "function") {
        window.gtag("config", "G-0HXXN1SJ9K", { page_path: url });
      }
    };
    router.events.on("routeChangeComplete", handleRouteChange);
    return () => router.events.off("routeChangeComplete", handleRouteChange);
  }, [router.events]);

  // When consent changes, update GA + Clarity consent states
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Google Consent Mode update
    if (typeof window.gtag === "function") {
      window.gtag("consent", "update", {
        analytics_storage: consent.analytics ? "granted" : "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
    }

    // Microsoft Clarity: deny until opted in
    if (typeof window.clarity === "function") {
      window.clarity("consent", consent.analytics ? "grant" : "deny");
    }
  }, [consent.analytics]);

  return (
    <>
      {/* 1️⃣ Google Analytics */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-0HXXN1SJ9K"
        strategy="afterInteractive"
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;

          // Consent Mode default: deny until user opts in
          gtag('consent', 'default', {
            'analytics_storage': 'denied',
            'ad_storage': 'denied',
            'ad_user_data': 'denied',
            'ad_personalization': 'denied'
          });

          gtag('js', new Date());

          // GA config. Consent Mode controls cookie behavior.
          gtag('config', 'G-0HXXN1SJ9K', { 'anonymize_ip': true });
        `}
      </Script>

      {/* 2️⃣ Microsoft Clarity (heatmaps + session recordings)
          Load the script, but deny consent by default and grant only on opt-in. */}
      <Script id="microsoft-clarity" strategy="afterInteractive">
        {`
          (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/u244y5muc2";
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "u244y5muc2");

          // Default deny until user opts in
          if (typeof window.clarity === "function") {
            window.clarity('consent', 'deny');
          }
        `}
      </Script>

      {/* 3️⃣ OpenCV.js */}
      <Script
        src="https://docs.opencv.org/4.x/opencv.js"
        strategy="beforeInteractive"
        onLoad={() => console.log("✅ OpenCV.js loaded")}
        onError={(e) => console.error("❌ Failed to load OpenCV.js", e)}
      />

      {/* 4️⃣ App layout */}
      <AuthProvider>
        <div className="flex flex-col min-h-screen">
          {/* Global header */}
          <NavBar />

          {/* Cookie consent prompt (only appears if not decided yet) */}
          <CookieBanner
            onChange={(next) => {
              setConsentState(next);
              setConsent({ analytics: next.analytics });
            }}
          />

          <main className="flex-grow">
            <Component {...pageProps} />
          </main>

          {/* Cookie settings link above footer (so users can change later) */}
          <div className="px-4 pb-4">
            <div className="max-w-6xl mx-auto flex items-center justify-center">
              <CookieSettings
                onChange={(next) => {
                  setConsentState(next);
                  setConsent({ analytics: next.analytics });
                }}
              />
            </div>
          </div>

          <Footer />
        </div>

        <Toaster position="top-right" />
      </AuthProvider>
    </>
  );
}
