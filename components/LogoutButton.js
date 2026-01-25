// components/LogoutButton.js
"use client";

import { useState } from "react";
import { useAuthContext } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function LogoutButton() {
  const { logout } = useAuthContext();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);

    try {
      await logout?.(); // ✅ clears local user + hits /api/logout to clear HttpOnly cookie
    } catch (e) {
      console.warn("[LogoutButton] logout failed:", e);
    } finally {
      // ✅ keep user in-app, but show the login page
      // replace prevents Back from returning to the protected page
      router.replace("/login");
      router.refresh(); // optional but fine
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
