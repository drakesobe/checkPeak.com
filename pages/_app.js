// pages/_app.js
import "@/styles/globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { Toaster } from "react-hot-toast";
import Script from "next/script";
import { useEffect } from "react";
import { useRouter } from "next/router";
import NavBar from "@/components/NavBar";     // ⬅️ ADD THIS
import Footer from "@/components/Footer";

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
      {/* 1️⃣ Google Analytics */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-0HXXN1SJ9K"
        strategy="afterInteractive"
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-0HXXN1SJ9K');
        `}
      </Script>

      {/* 2️⃣ Microsoft Clarity (heatmaps + session recordings) */}
      <Script id="microsoft-clarity" strategy="afterInteractive">
        {`
          (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/u244y5muc2";
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "u244y5muc2");
        `}
      </Script>

      {/* 3️⃣ OpenCV.js */}
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

      {/* 4️⃣ App layout: NavBar + page + Footer */}
      <AuthProvider>
        <div className="flex flex-col min-h-screen">
          {/* Global PEAK header + tabs */}
          <NavBar />

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
