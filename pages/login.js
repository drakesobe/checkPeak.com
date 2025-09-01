"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import NavBar from "../components/NavBar";
import { useAuthContext } from "@/hooks/useAuth";

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuthContext();

  const [activeTab, setActiveTab] = useState("Login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) router.push("/dashboard");
  }, [user, router]);

  const handleLogin = async (e) => {
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
      const userData = await login(email.trim(), password);

      if (rememberMe) localStorage.setItem("user", JSON.stringify(userData));

      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to login. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 font-sans">
      <NavBar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="max-w-md mx-auto px-4 py-12">
        <div className="bg-white p-8 rounded-2xl shadow-md border border-blue-100 space-y-6">
          <h1 className="text-2xl font-bold text-gray-800 text-center">Log In</h1>
          <p className="text-gray-500 text-center text-sm mb-4">
            Access your dashboard and manage your supplements
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email Field */}
            <div>
              <label className="block font-medium mb-1 text-gray-800">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-blue-100 rounded-2xl px-4 py-2 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                placeholder="you@example.com"
                required
              />
            </div>

            {/* Password Field */}
            <div>
              <label className="block font-medium mb-1 text-gray-800">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-blue-100 rounded-2xl px-4 py-2 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-200 focus:outline-none pr-10"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 text-sm text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-800">Remember me</span>
              </label>
            </div>

            {/* Error Message */}
            {error && <p className="text-red-500 text-sm">{error}</p>}

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              style={{ backgroundColor: "#46769B" }}
              className={`w-full px-6 py-3 rounded-2xl text-white font-medium transition hover:brightness-110 ${
                loading ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {loading ? "Logging in..." : "Log In"}
            </button>
          </form>

          {/* Social Login Buttons */}
          <div className="border-t border-gray-200 pt-4 space-y-2 text-center">
            <button className="w-full px-6 py-3 rounded-2xl bg-gray-50 text-gray-800 font-medium border border-gray-300 hover:bg-gray-100">
              Continue with Google
            </button>
            <button className="w-full px-6 py-3 rounded-2xl bg-gray-50 text-gray-800 font-medium border border-gray-300 hover:bg-gray-100">
              Continue with Apple
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
