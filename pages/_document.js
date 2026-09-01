import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* ✅ Required for responsive breakpoints + correct mobile sizing */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />

        {/* Preconnect to Sentry (used globally for error reporting) */}
        <link rel="preconnect" href="https://o4511531175706624.ingest.us.sentry.io" crossOrigin="anonymous" />

        {/* Self-hosted fonts — eliminates external Google Fonts request chain entirely */}
        <style dangerouslySetInnerHTML={{ __html: `
          @font-face { font-family: 'Barlow'; font-style: normal; font-weight: 400; font-display: swap; src: url('/fonts/barlow-400.woff2') format('woff2'); }
          @font-face { font-family: 'Barlow'; font-style: normal; font-weight: 500; font-display: swap; src: url('/fonts/barlow-500.woff2') format('woff2'); }
          @font-face { font-family: 'Barlow'; font-style: normal; font-weight: 600; font-display: swap; src: url('/fonts/barlow-600.woff2') format('woff2'); }
          @font-face { font-family: 'Barlow Condensed'; font-style: normal; font-weight: 400; font-display: swap; src: url('/fonts/barlow-condensed-400.woff2') format('woff2'); }
          @font-face { font-family: 'Barlow Condensed'; font-style: normal; font-weight: 700; font-display: swap; src: url('/fonts/barlow-condensed-700.woff2') format('woff2'); }
          @font-face { font-family: 'Barlow Condensed'; font-style: normal; font-weight: 900; font-display: swap; src: url('/fonts/barlow-condensed-900.woff2') format('woff2'); }
          @font-face { font-family: 'Barlow Condensed'; font-style: italic; font-weight: 900; font-display: swap; src: url('/fonts/barlow-condensed-900i.woff2') format('woff2'); }
        ` }} />

        {/* Standard favicon */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />

        {/* Web App Manifest */}
        <link rel="manifest" href="/site.webmanifest" />

        {/* Theme color for browser */}
        <meta name="theme-color" content="#46769B" />

        {/* Optional: iOS specific meta tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />

        {/* Optional: Microsoft Tiles */}
        <meta name="msapplication-TileColor" content="#46769B" />
        <meta name="msapplication-TileImage" content="/favicon-192x192.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}