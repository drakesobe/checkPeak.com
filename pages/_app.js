// pages/_app.js
import "@/styles/globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { Toaster } from "react-hot-toast";
import Script from "next/script";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";

/**
 * Consent model:
 * - Essential cookies: always on (auth, app functionality)
 * - Analytics cookies: opt-in only (GA + Clarity + first-party analytics)
 *
 * This file:
 * ✅ Shows cookie banner only if undecided
 * ✅ Uses Google Consent Mode (default denied)
 * ✅ Gates Microsoft Clarity
 * ✅ Keeps layout + auth untouched
 */

const CONSENT_KEY = "cp_consent_v1";

/* ---------------------------------------
   Consent helpers
--------------------------------------- */
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

/* ---------------------------------------
   Cookie Banner (shown once)
--------------------------------------- */
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
            We use optional analytics to improve CheckPeak and provide better insights.
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

/* ---------------------------------------
   App
--------------------------------------- */
export default function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const [consent, setConsentState] = useState({ analytics: false, decided: false });

  // Load consent on mount
  useEffect(() => {
    setConsentState(getConsent());
  }, []);

  // GA pageview tracking (Consent Mode handles cookies)
  useEffect(() => {
    const handleRouteChange = (url) => {
      if (typeof window.gtag === "function") {
        window.gtag("config", "G-0HXXN1SJ9K", { page_path: url });
      }
    };
    router.events.on("routeChangeComplete", handleRouteChange);
    return () => router.events.off("routeChangeComplete", handleRouteChange);
  }, [router.events]);

  // Update consent state for GA + Clarity
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Google Consent Mode
    if (typeof window.gtag === "function") {
      window.gtag("consent", "update", {
        analytics_storage: consent.analytics ? "granted" : "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
    }

    // Microsoft Clarity
    if (typeof window.clarity === "function") {
      window.clarity(consent.analytics ? "consent" : "consent", consent.analytics ? "grant" : "deny");
    }
  }, [consent.analytics]);

  return (
    <>
      {/* Google Analytics */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-0HXXN1SJ9K"
        strategy="afterInteractive"
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;

          // Default deny (Consent Mode)
          gtag('consent', 'default', {
            'analytics_storage': 'denied',
            'ad_storage': 'denied',
            'ad_user_data': 'denied',
            'ad_personalization': 'denied'
          });

          gtag('js', new Date());
          gtag('config', 'G-0HXXN1SJ9K', { anonymize_ip: true });
        `}
      </Script>

      {/* Microsoft Clarity (gated) */}
      <Script id="microsoft-clarity" strategy="afterInteractive">
        {`
          (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/u244y5muc2";
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "u244y5muc2");

          if (typeof window.clarity === "function") {
            window.clarity('consent', 'deny');
          }
        `}
      </Script>

      {/* OpenCV */}
      <Script
        src="https://docs.opencv.org/4.x/opencv.js"
        strategy="beforeInteractive"
        onLoad={() => console.log("✅ OpenCV.js loaded")}
        onError={(e) => console.error("❌ Failed to load OpenCV.js", e)}
      />

      {/* App layout */}
      <AuthProvider>
        <div className="flex flex-col min-h-screen">
          <NavBar />

          <CookieBanner
            onChange={(next) => {
              setConsentState(next);
              setConsent({ analytics: next.analytics });
            }}
          />

          <main className="flex-grow">
            <Component {...pageProps} />
          </main>

          <Footer />
        </div>

        <Toaster position="top-right" />
      </AuthProvider>
    </>
  );
}
