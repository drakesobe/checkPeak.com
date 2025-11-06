// pages/_app.js
import "@/styles/globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { Toaster } from "react-hot-toast";
import Script from "next/script";
import { useEffect } from "react";
import { useRouter } from "next/router";
import { SpeedInsights } from "@vercel/speed-insights/next"; // ✅ Add this line

export default function MyApp({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    const handleRouteChange = (url) => {
      if (typeof window.gtag === "function") {
        window.gtag("config", "G-0HXXN1SJ9K", { page_path: url });
      }
    };
    router.events.on("routeChangeComplete", handleRouteChange);
    return () => router.events.off("routeChangeComplete", handleRouteChange);
  }, [router.events]);

  return (
    <>
      {/* 1️⃣ Load GA script */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-0HXXN1SJ9K"
        strategy="afterInteractive"
      />

      {/* 2️⃣ Initialize GA */}
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-0HXXN1SJ9K');
        `}
      </Script>

      {/* 3️⃣ Load OpenCV.js */}
      <Script
        src="https://docs.opencv.org/4.x/opencv.js"
        strategy="beforeInteractive"
        onLoad={() => {
          console.log("✅ OpenCV.js loaded");
        }}
        onError={(e) => {
          console.error("❌ Failed to load OpenCV.js", e);
        }}
      />

      {/* 4️⃣ Your app */}
      <AuthProvider>
        <Component {...pageProps} />
        <Toaster position="top-right" />
        <SpeedInsights /> {/* ✅ Add this inside the app wrapper */}
      </AuthProvider>
    </>
  );
}
