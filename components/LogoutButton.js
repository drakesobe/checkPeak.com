// components/LogoutButton.js
"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/router";
import { motion } from "framer-motion";

export default function LogoutButton() {
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login"); // redirect to login page after logout
  };

  return (
    <motion.button
      onClick={handleLogout}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-2xl shadow-lg font-semibold transition"
    >
      Logout
    </motion.button>
  );
}
