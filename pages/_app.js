// pages/_app.js
import "@/styles/globals.css";
import { AuthProvider } from "@/hooks/useAuth";

export default function MyApp({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );
}
