"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuthContext } from "@/hooks/useAuth";

export default function LoginPage() {
  const { login } = useAuthContext();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // send both email and password
      const userData = await login(email.trim(), password);
      router.push("/dashboard");
    } catch (err) {
      setError(err?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const particles = [
    { cx: 50, cy: 80, r: 2.3, dur: 10, delay: 0 },
    { cx: 300, cy: 150, r: 2, dur: 12, delay: 0.3 },
    { cx: 600, cy: 200, r: 2.5, dur: 11, delay: 0.6 },
    { cx: 150, cy: 350, r: 1.8, dur: 14, delay: 0.4 },
    { cx: 500, cy: 450, r: 2.1, dur: 13, delay: 0.7 },
    { cx: 800, cy: 550, r: 2.2, dur: 12, delay: 0.2 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans flex items-center justify-center relative overflow-hidden">
      {/* Background particles */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid slice" aria-hidden>
        {particles.map((p, i) => (
          <motion.circle
            key={i}
            cx={p.cx}
            cy={p.cy}
            r={p.r}
            fill="rgba(70,118,155,0.15)"
            initial={{ opacity: 0 }}
            animate={{
              cx: [p.cx, p.cx + 30, p.cx - 20, p.cx],
              cy: [p.cy, p.cy + 20, p.cy - 15, p.cy],
              opacity: [0, 0.4, 0.4],
            }}
            transition={{ duration: p.dur, repeat: Infinity, ease: "linear", delay: p.delay }}
          />
        ))}
      </svg>

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md z-10"
      >
        <h2 className="text-3xl font-bold text-gray-800 text-center mb-6">Welcome Back</h2>
        <p className="text-gray-500 text-center mb-6">Log in to continue to your dashboard.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-600 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full p-3 rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="block text-gray-600 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full p-3 rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <motion.button
            type="submit"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className={`w-full py-3 rounded-xl text-white font-semibold ${
              loading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-500"
            }`}
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </motion.button>
        </form>

        <p className="text-gray-400 text-sm text-center mt-4">
          Need an invite? Contact your coach or organization admin.
        </p>
      </motion.div>
    </div>
  );
}
