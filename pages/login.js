"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/hooks/useAuth";

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuthContext();

  // Role selector: "athlete" | "organization"
  const [authRole, setAuthRole] = useState("athlete");

  // Login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Forgot password UI
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState("");

  const isOrg = authRole === "organization";

  // Normalize role from user (matches your NavBar logic)
  const userRole = useMemo(() => {
    const raw = (user?.Role || user?.role || "").toString().trim().toLowerCase();
    if (raw.includes("org")) return "organization";
    if (raw.includes("ath")) return "athlete";
    return raw || "";
  }, [user]);

  // Prefill login email if you set it elsewhere (optional but helpful)
  useEffect(() => {
    try {
      const v =
        typeof window !== "undefined"
          ? window.localStorage.getItem("cp_prefill_login_email")
          : "";
      if (v && !email) setEmail(String(v));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If already logged in, route to correct dashboard
  useEffect(() => {
    if (!user) return;

    if (userRole === "organization") router.push("/org/dashboard");
    else router.push("/dashboard");
  }, [user, userRole, router]);

  // ---- Error mapping for better UX + consistent messaging ----
  const mapLoginError = (err) => {
    const rawMsg = String(err?.message || err?.error || "");
    const msg = rawMsg.toLowerCase();

    const status =
      err?.status ||
      err?.statusCode ||
      err?.response?.status ||
      err?.data?.statusCode ||
      err?.data?.status;

    const isLookupUserFailure =
      msg.includes("failed to lookup user") ||
      msg.includes("lookupuser") ||
      msg.includes("lookup user");

    if (status >= 500 || isLookupUserFailure) {
      return "Login failed. Please try again.";
    }

    if (status === 401 || msg.includes("invalid credentials")) {
      return "Invalid email or password.";
    }

    if (status === 404 || msg.includes("user not found")) {
      return "User not found.";
    }

    return "Login failed. Check email/password.";
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const cleanEmail = String(email || "").trim();

    if (!cleanEmail.includes("@")) {
      setError("Please enter a valid email.");
      setLoading(false);
      return;
    }
    if (String(password || "").length < 6) {
      setError("Password must be at least 6 characters.");
      setLoading(false);
      return;
    }

    try {
      // ✅ IMPORTANT: pass role into login (matches your modal)
      const userData = await login(cleanEmail, password, authRole);

      // remember me
      if (rememberMe && typeof window !== "undefined") {
        window.localStorage.setItem("user", JSON.stringify(userData));
      }

      // Optional: clear prefill
      try {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("cp_prefill_login_email");
        }
      } catch {}

      // Route based on returned role
      const roleLabel = String(userData?.role || userData?.Role || "").toLowerCase();
      if (roleLabel.includes("org")) router.push("/org/dashboard");
      else router.push("/dashboard");
    } catch (err) {
      console.error(err);
      setError(mapLoginError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotMsg("");
    setForgotLoading(true);

    const cleanEmail = String(forgotEmail || "").trim().toLowerCase();

    // Even if invalid, we keep messaging generic for account enumeration safety.
    try {
      const res = await fetch("/api/auth/forgotPassword", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });

      // Your API may return 200 even on some failures; still show generic.
      // If it returns 500, you still want user to see the generic message.
      const data = await res.json().catch(() => ({}));
      setForgotMsg(
        data?.message || "If your account exists, we’ve sent reset instructions."
      );
    } catch (err) {
      console.error(err);
      setForgotMsg("If your account exists, we’ve sent reset instructions.");
    } finally {
      setForgotLoading(false);
    }
  };

  const inputBase =
    "w-full px-4 py-3 rounded-2xl border border-blue-100 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-200 focus:outline-none";

  const rolePill =
    "px-3 py-2 rounded-xl border text-sm font-semibold transition";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 font-sans">
      <main className="max-w-md mx-auto px-4 py-12">
        <div className="bg-white p-8 rounded-2xl shadow-md border border-blue-100 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-gray-800">Log In</h1>
            <p className="text-gray-500 text-sm">
              Access your dashboard and manage your scans.
            </p>
          </div>

          {/* Role selector (matches modal behavior) */}
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={() => setAuthRole("athlete")}
              className={`${rolePill} ${
                authRole === "athlete"
                  ? "bg-[#46769B] text-white border-[#46769B]"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              }`}
            >
              Athlete
            </button>
            <button
              type="button"
              onClick={() => setAuthRole("organization")}
              className={`${rolePill} ${
                authRole === "organization"
                  ? "bg-[#46769B] text-white border-[#46769B]"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              }`}
            >
              Organization
            </button>
          </div>

          {/* LOGIN */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block font-medium mb-1 text-gray-800">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputBase}
                placeholder={isOrg ? "org@example.com" : "you@example.com"}
                required
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block font-medium mb-1 text-gray-800">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputBase} pr-12`}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-3 text-sm text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-800">Remember me</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setForgotOpen((v) => !v);
                  setForgotMsg("");
                  setForgotEmail(email || "");
                }}
                className="text-sm text-[#46769B] hover:underline"
              >
                Forgot password?
              </button>
            </div>

            {/* Login error */}
            {error && <p className="text-red-500 text-sm">{error}</p>}

            {/* Login button */}
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

          {/* Forgot Password (inline) */}
          {forgotOpen && (
            <div className="border-t border-gray-200 pt-4 space-y-3">
              <div className="text-sm text-gray-700">
                Enter your email and we’ll send reset instructions.
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-3">
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className={inputBase}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className={`w-full px-6 py-3 rounded-2xl border border-gray-200 bg-gray-900 text-white font-medium hover:opacity-95 transition ${
                    forgotLoading ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                >
                  {forgotLoading ? "Sending..." : "Send reset link"}
                </button>
              </form>

              {forgotMsg && (
                <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-xl p-3">
                  {forgotMsg}
                </p>
              )}

              <div className="text-[11px] text-gray-500">
                For security, you’ll always see the same message whether the account exists or not.
              </div>
            </div>
          )}

          {/* Optional: simple link back home */}
          <div className="text-center text-sm text-gray-500">
            <Link href="/" className="text-[#46769B] hover:underline">
            Back to Home{" "}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
