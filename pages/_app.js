// pages/_app.js
import "@/styles/globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { Toaster } from "react-hot-toast";
import Head from "next/head";

export default function MyApp({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Head>
        <title>CheckPeak</title>

        {/* Main favicon */}
        <link rel="icon" href="/favicon.ico" />

        {/* PNG favicons */}
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png" />

        {/* Apple/iOS icon */}
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />

        {/* Web App Manifest */}
        <link rel="manifest" href="/site.webmanifest" />

        {/* RealFaviconGenerator icons */}
        <link rel="icon" type="image/png" sizes="192x192" href="/web-app-manifest-192x192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/web-app-manifest-512x512.png" />

        {/* Theme color for mobile browsers */}
        <meta name="theme-color" content="#000000" />
      </Head>

      <Component {...pageProps} />
      <Toaster position="top-right" />
    </AuthProvider>
  );
}
