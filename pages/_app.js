// pages/_app.js
import '../styles/globals.css';
import SpeedInsights from '@vercel/speed-insights'; // <- note: NO /next

export default function MyApp({ Component, pageProps }) {
  if (typeof window === "undefined") {
    // run only on the server
    SpeedInsights();
  }

  return <Component {...pageProps} />;
}
