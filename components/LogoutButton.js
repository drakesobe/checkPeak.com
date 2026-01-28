// components/LogoutButton.js
"use client";

import { useState } from "react";
import { useAuthContext } from "@/hooks/useAuth";
import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";

// Routes that are allowed to remain visible after logout
const PUBLIC_PATH_PREFIXES = [
  "/smartstack",
  "/search",
  "/scans",
  "/ocr",
  "/supplement-label-scanner",
  "/", // landing page
];

function isPublicPath(pathname = "") {
  return PUBLIC_PATH_PREFIXES.some((p) =>
    pathname === p || pathname.startsWith(`${p}/`)
  );
}

export default function LogoutButton() {
  const { logout } = useAuthContext();
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);

    try {
      // Clears user state + HttpOnly cookie via /api/logout
      await logout?.();
    } catch (e) {
      console.warn("[LogoutButton] logout failed:", e);
    } finally {
      const stayOnPage = isPublicPath(pathname);

      if (!stayOnPage) {
        // 🔒 Protected page → force login
        router.replace("/login");
      } else {
        // 🌍 Public page → just refresh auth state
        router.refresh();
      }

      setLoading(false);
    }
  };

  return (
    <motion.button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      whileHover={{ scale: loading ? 1 : 1.05 }}
      whileTap={{ scale: loading ? 1 : 0.95 }}
      className={`px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-2xl shadow-lg font-semibold transition ${
        loading ? "opacity-70 cursor-not-allowed" : ""
      }`}
    >
      {loading ? "Logging out..." : "Logout"}
    </motion.button>
  );
}
