// pages/_app.js
import '../styles/globals.css';
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function MyApp({ Component, pageProps }) {
  SpeedInsights(); // <-- runs in the background, no UI
  return <Component {...pageProps} />;
}
