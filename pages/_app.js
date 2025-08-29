// pages/_app.js
import "@/styles/globals.css"; // your global styles
import { AuthProvider } from "@/hooks/useAuth";

export default function MyApp({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );
}
