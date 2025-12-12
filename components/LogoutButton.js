// components/LogoutButton.js
"use client";

import { useAuthContext } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function LogoutButton() {
  const { logout } = useAuthContext();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
    router.refresh(); // helps clear any cached server components
  };

  return (
    <motion.button
      type="button"
      onClick={handleLogout}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-2xl shadow-lg font-semibold transition"
    >
      Logout
    </motion.button>
  );
}
