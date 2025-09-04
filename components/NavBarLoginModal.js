"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMediaQuery } from "react-responsive";
import { useAuthContext } from "@/hooks/useAuth";

export default function NavBarLoginModal({ isOpen, onClose }) {
  const { login } = useAuthContext(); // get login function from context
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const isMobile = useMediaQuery({ maxWidth: 768 });

  useEffect(() => {
    if (isOpen && emailRef.current) {
      emailRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!email.includes("@")) {
      setError("Please enter a valid email.");
      setLoading(false);
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      setLoading(false);
      return;
    }

    try {
      const userData = await login(email.trim(), password); // login updates context

      if (rememberMe && typeof window !== "undefined") {
        localStorage.setItem("user", JSON.stringify(userData));
      }

      setEmail("");
      setPassword("");
      setRememberMe(false);
      onClose(); // close modal
    } catch (err) {
      console.error(err);
      setError(err?.message || "Login failed. Check email/password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-6 bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className={`bg-white rounded-2xl p-6 w-full max-w-sm shadow-lg relative max-h-[90vh] overflow-y-auto ${
              isMobile ? "mt-auto mb-0 rounded-t-3xl" : ""
            }`}
            initial={
              isMobile
                ? { y: "100%", opacity: 0 }
                : { scale: 0.9, opacity: 0, y: -50 }
            }
            animate={
              isMobile
                ? { y: 0, opacity: 1 }
                : { scale: 1, opacity: 1, y: 0 }
            }
            exit={
              isMobile
                ? { y: "100%", opacity: 0 }
                : { scale: 0.9, opacity: 0, y: -50 }
            }
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
          >
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
              onClick={onClose}
            >
              ✕
            </button>

            <h2 className="text-xl font-bold mb-4 text-center text-gray-800">Log In</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block mb-1 font-medium text-gray-800">Email</label>
                <input
                  ref={emailRef}
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-xl text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-200 outline-none"
                  required
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      passwordRef.current?.focus();
                    }
                  }}
                />
              </div>

              <div>
                <label className="block mb-1 font-medium text-gray-800">Password</label>
                <div className="relative">
                  <input
                    ref={passwordRef}
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-xl text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-200 outline-none pr-10"
                    required
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit(e)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-3 text-sm text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <div className="text-right mt-1">
                  <a href="/forgot-password" className="text-sm text-blue-600 hover:underline">
                    Forgot Password?
                  </a>
                </div>
              </div>

              <div className="flex items-center">
                <label className="flex items-center space-x-2 text-gray-700">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Remember me</span>
                </label>
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                style={{ backgroundColor: "#46769B" }}
                className={`w-full py-3 rounded-2xl text-white font-medium transition hover:brightness-110 ${
                  loading ? "opacity-60 cursor-not-allowed" : ""
                }`}
              >
                {loading ? "Logging in..." : "Log In"}
              </button>
            </form>

            <div className="border-t border-gray-200 pt-4 space-y-2 text-center">
              <button className="w-full px-6 py-3 rounded-2xl bg-gray-50 text-gray-600 font-medium border hover:bg-gray-100">
                Continue with Google
              </button>
              <button className="w-full px-6 py-3 rounded-2xl bg-gray-50 text-gray-600 font-medium border hover:bg-gray-100">
                Continue with Apple
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
