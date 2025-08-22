// pages/_app.js
import '../styles/globals.css';
import SpeedInsights from '@vercel/speed-insights';

export default function MyApp({ Component, pageProps }) {
  // Run Speed Insights in the background
  if (typeof window === "undefined") {
    // Only run on the server
    SpeedInsights();
  }

  return <Component {...pageProps} />;
}
