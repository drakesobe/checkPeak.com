// pages/_app.js
import "@/styles/globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { Toaster } from "react-hot-toast";
import Script from "next/script";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import CookieBanner from "@/components/CookieBanner";
import { getConsent, setConsent } from "@/lib/consent";

/**
 * Consent model:
 * - Essential cookies: always on (auth, app functionality)
 * - Analytics: opt-in (GA + Clarity + first-party analytics events)
 *
 * Improvements:
 * ✅ Uses Google Consent Mode (default denied)
 * ✅ Only fires GA pageviews after consent
 * ✅ Only loads Microsoft Clarity after consent (true gating)
 * ✅ Keeps layout + auth untouched
 * ✅ Optional DNT respect (auto-deny)
 */

const GA_ID = "G-0HXXN1SJ9K";
const CLARITY_ID = "u244y5muc2";

function isDoNotTrackEnabled() {
  if (typeof navigator === "undefined") return false;
  const dnt =
    navigator.doNotTrack ||
    window.doNotTrack ||
    navigator.msDoNotTrack ||
    "";
  return String(dnt) === "1" || String(dnt).toLowerCase() === "yes";
}

export default function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const [consent, setConsentState] = useState({ analytics: false, decided: false });

  // Load consent on mount (+ optional DNT auto-deny)
  useEffect(() => {
    const c = getConsent();

    // If user hasn't decided and DNT is enabled, auto-deny analytics
    if (!c?.decided && isDoNotTrackEnabled()) {
      setConsent({ analytics: false, decided: true });
      setConsentState({ analytics: false, decided: true });
      return;
    }

    setConsentState(c);
  }, []);

  const analyticsEnabled = !!consent.analytics;

  // Fire GA pageviews only if consented
  useEffect(() => {
    if (!analyticsEnabled) return;

    const handleRouteChange = (url) => {
      if (typeof window.gtag === "function") {
        window.gtag("config", GA_ID, {
          page_path: url,
          anonymize_ip: true,
        });
      }
    };

    router.events.on("routeChangeComplete", handleRouteChange);

    // Track initial page load too (after consent)
    handleRouteChange(window.location.pathname);

    return () => router.events.off("routeChangeComplete", handleRouteChange);
  }, [router.events, analyticsEnabled]);

  // Update Google consent mode whenever consent changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (typeof window.gtag === "function") {
      window.gtag("consent", "update", {
        analytics_storage: analyticsEnabled ? "granted" : "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
    }
  }, [analyticsEnabled]);

  // Conditionally render Clarity script only when consented
  const clarityScript = useMemo(() => {
    if (!analyticsEnabled) return null;

    return (
      <Script id="microsoft-clarity" strategy="afterInteractive">
        {`
          (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/${CLARITY_ID}";
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "${CLARITY_ID}");
        `}
      </Script>
    );
  }, [analyticsEnabled]);

  return (
    <>
      {/* Google Analytics (Consent Mode default denied) */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;

          // Default deny (Consent Mode) until user opts in
          gtag('consent', 'default', {
            'analytics_storage': 'denied',
            'ad_storage': 'denied',
            'ad_user_data': 'denied',
            'ad_personalization': 'denied'
          });

          gtag('js', new Date());

          // NOTE: We intentionally do NOT send pageviews until consent is granted.
          // (routeChange effect handles pageviews after consent)
          gtag('config', '${GA_ID}', { anonymize_ip: true, send_page_view: false });
        `}
      </Script>

      {/* Microsoft Clarity (ONLY loads if analytics consent is granted) */}
      {clarityScript}

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
              // next shape comes from your CookieBanner: { analytics: bool, decided: true }
              const normalized = {
                analytics: !!next.analytics,
                decided: true,
              };

              setConsentState(normalized);
              setConsent(normalized);
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
