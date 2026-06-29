// pages/_app.js
import "@/styles/globals.css";
import Head from "next/head";
import { AuthProvider, useAuthContext } from "@/hooks/useAuth";
import { Toaster } from "react-hot-toast";
import Script from "next/script";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import NavBar        from "@/components/NavBar";
import MarketingNav  from "@/components/MarketingNav";
import Footer        from "@/components/Footer";
import CookieBanner  from "@/components/CookieBanner";
import { getConsent, setConsent } from "@/lib/consent";
import { usePageView } from "@/hooks/usePageView";

const GA_ID      = "G-0HXXN1SJ9K";
const ADS_ID     = "AW-17990566633";
const CLARITY_ID = "u244y5muc2";

function isDoNotTrackEnabled() {
  if (typeof navigator === "undefined") return false;
  const dnt = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack || "";
  return String(dnt) === "1" || String(dnt).toLowerCase() === "yes";
}

// ── Route → nav type ──────────────────────────────────────────────────────────
// "marketing" → transparent-to-dark frosted (MarketingNav)
// "app"       → white professional (NavBar)
// "none"      → no nav rendered (auth / onboarding pages)

const MARKETING_ROUTES = [
  "/",
  "/pricing",
  "/book",
  "/contact",
  "/info",
  "/smartstack-compare",
  "/compliance/ncaa",
  "/nutrition-label-scanner",
  "/search",
  "/trainers",
];

const NO_NAV_ROUTES = [
  "/login",
  "/signup",
  "/onboarding",
  "/trainer",
];

function getNavType(pathname) {
  if (!pathname) return "app";
  if (NO_NAV_ROUTES.some(r => pathname === r || pathname.startsWith(r + "/"))) return "none";
  if (MARKETING_ROUTES.some(r => pathname === r)) return "marketing";
  return "app";
}

/* ─────────────────────────────────────────────────────────────────────────────
   AppCore
   Inner component so hooks that need AuthContext (useAuthContext, usePageView)
   can run inside the AuthProvider tree. This is the right pattern - hooks
   that depend on context must be children of that context's provider.
───────────────────────────────────────────────────────────────────────────── */
function AppCore({ Component, pageProps, analyticsEnabled }) {
  const { user } = useAuthContext();
  const router   = useRouter();
  const navType  = getNavType(router.pathname);

  // ── Fire page_view + scroll/time milestones on every route change ───────
  usePageView({
    userEmail: user?.Email || user?.email || "",
  });

  return (
    <div className="flex flex-col min-h-screen">
      {/* Route-aware nav:
          marketing pages → transparent hero nav that frosts on scroll
          app/org pages   → white professional nav
          auth pages      → no nav                                     */}
      {navType === "marketing" && <MarketingNav />}
      {navType === "app"       && <NavBar />}

      <main className="flex-grow" style={navType === "marketing" && router.pathname !== "/" ? { paddingTop: 72 } : {}}>
        <Component {...pageProps} />
      </main>

      <Footer />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MyApp
───────────────────────────────────────────────────────────────────────────── */
export default function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const [consent, setConsentState] = useState({
    analytics: false,
    decided:   false,
  });

  // Load consent on mount (+ optional DNT auto-deny)
  useEffect(() => {
    const c = getConsent();

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
          page_path:    url,
          anonymize_ip: true,
        });
      }
    };

    router.events.on("routeChangeComplete", handleRouteChange);
    handleRouteChange(window.location.pathname);
    return () => router.events.off("routeChangeComplete", handleRouteChange);
  }, [router.events, analyticsEnabled]);

  // Update Google Consent Mode whenever consent changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.gtag === "function") {
      window.gtag("consent", "update", {
        analytics_storage:  analyticsEnabled ? "granted" : "denied",
        ad_storage:         analyticsEnabled ? "granted" : "denied",
        ad_user_data:       analyticsEnabled ? "granted" : "denied",
        ad_personalization: "denied",
      });
    }
  }, [analyticsEnabled]);

  // Clarity - only loads after consent
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
      <Head>
        <meta name="mobile-web-app-capable"       content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </Head>

      {/* Google tag */}
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;

          gtag('consent', 'default', {
            'analytics_storage': 'denied',
            'ad_storage': 'denied',
            'ad_user_data': 'denied',
            'ad_personalization': 'denied'
          });

          gtag('js', new Date());
          gtag('config', '${GA_ID}', { anonymize_ip: true, send_page_view: false });
          gtag('config', '${ADS_ID}');
        `}
      </Script>

      {/* Clarity (consent-gated) */}
      {clarityScript}

      {/* OpenCV */}
      <Script
        src="https://docs.opencv.org/4.x/opencv.js"
        strategy="beforeInteractive"
        onLoad={() => console.log("✅ OpenCV.js loaded")}
        onError={(e) => console.error("❌ Failed to load OpenCV.js", e)}
      />

      <AuthProvider>
        {/* CookieBanner lives outside AppCore so consent state stays
            at the MyApp level and drives GA/Clarity gating */}
        <CookieBanner
          onChange={(next) => {
            const normalized = { analytics: !!next.analytics, decided: true };
            setConsentState(normalized);
            setConsent(normalized);
          }}
        />

        {/* AppCore has access to AuthContext + fires usePageView */}
        <AppCore
          Component={Component}
          pageProps={pageProps}
          analyticsEnabled={analyticsEnabled}
        />

        <Toaster position="top-right" />
      </AuthProvider>
    </>
  );
}