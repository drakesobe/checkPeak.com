// pages/_app.js
import '../styles/globals.css';
import SpeedInsights from '@vercel/speed-insights'; // correct import

export default function MyApp({ Component, pageProps }) {
  // run SpeedInsights only on the server
  if (typeof window === "undefined") {
    SpeedInsights();
  }

  return <Component {...pageProps} />;
}
