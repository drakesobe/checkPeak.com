// pages/reset-password.js
"use client";

import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";

export default function ResetPasswordPage() {
  const router = useRouter();

  const { token, email, role } = useMemo(() => {
    const q = router?.query || {};
    return {
      token: typeof q.token === "string" ? q.token : "",
      email: typeof q.email === "string" ? q.email : "",
      role: typeof q.role === "string" ? q.role : "", // athlete|organization (optional)
    };
  }, [router?.query]);

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    setErr("");
  }, [pw1, pw2]);

  const canSubmit =
    !loading &&
    token &&
    email &&
    email.includes("@") &&
    pw1.length >= 6 &&
    pw1 === pw2;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");

    if (!email || !email.includes("@")) return setErr("Invalid reset link.");
    if (!token) return setErr("Invalid reset link.");
    if (pw1.length < 6) return setErr("Password must be at least 6 characters.");
    if (pw1 !== pw2) return setErr("Passwords do not match.");

    setLoading(true);
    try {
      const res = await fetch("/api/auth/resetPassword", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          token,
          role: role || undefined,
          newPassword: pw1,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Reset failed. Please request a new link.");
      }

      setOk(true);
      setPw1("");
      setPw2("");
    } catch (e2) {
      console.error(e2);
      setErr(e2?.message || "Reset failed. Please request a new link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Reset Password — CheckPeak</title>
        <meta name="description" content="Reset your CheckPeak password." />
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <main className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.35 }}
            className="bg-white rounded-2xl border border-blue-100 shadow-md p-6 sm:p-8"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight">
                  Reset your password
                </h1>
                <p className="mt-2 text-sm text-gray-600">
                  Set a new password for{" "}
                  <span className="font-semibold text-gray-900">
                    {email || "your account"}
                  </span>
                  .
                </p>
              </div>

              <div className="text-[11px] text-gray-500 text-right">
                <div className="font-semibold text-gray-700">CheckPeak</div>
                <div className="mt-1">Secure reset</div>
              </div>
            </div>

            {/* If link is missing token/email, show guidance */}
            {(!token || !email) && !ok && (
              <div className="mt-4 p-3 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
                This reset link is missing required info. Please request a new reset link.
              </div>
            )}

            {ok ? (
              <div className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                <p className="font-semibold">Password updated.</p>
                <p className="mt-1 text-sm">
                  You can log in with your new password now.
                </p>

                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <Link href="/" className="w-full sm:w-auto">
                    <button className="w-full px-5 py-3 rounded-2xl bg-[#46769B] text-white font-semibold shadow-sm hover:brightness-110 transition">
                      Go to Home
                    </button>
                  </Link>

                  <Link href="/" className="w-full sm:w-auto">
                    <button className="w-full px-5 py-3 rounded-2xl bg-white border border-gray-200 text-gray-900 font-semibold shadow-sm hover:shadow-md transition">
                      Open Login
                    </button>
                  </Link>
                </div>

                <p className="mt-3 text-[11px] text-gray-600">
                  If you didn’t initiate this reset, change your password again and contact support.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1">
                    New password
                  </label>
                  <input
                    type="password"
                    value={pw1}
                    onChange={(e) => setPw1(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-xl bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="At least 6 characters"
                    required
                    autoComplete="new-password"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1">
                    Confirm new password
                  </label>
                  <input
                    type="password"
                    value={pw2}
                    onChange={(e) => setPw2(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-xl bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="Re-enter new password"
                    required
                    autoComplete="new-password"
                  />
                </div>

                {err && <p className="text-sm text-red-600">{err}</p>}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={`w-full py-3 rounded-2xl text-white font-semibold transition ${
                    canSubmit ? "bg-[#46769B] hover:brightness-110" : "bg-gray-300 cursor-not-allowed"
                  }`}
                >
                  {loading ? "Resetting..." : "Reset password"}
                </button>

                <div className="flex items-center justify-between text-xs text-gray-600">
                  <Link href="/" className="hover:underline underline-offset-4">
                    Back to home
                  </Link>
                  <Link href="/nutrition-label-scanner" className="hover:underline underline-offset-4">
                    Run a scan
                  </Link>
                </div>

                <p className="text-[11px] text-gray-500">
                  If this link is expired, request a new reset from the login modal.
                </p>
              </form>
            )}
          </motion.div>

          <p className="mt-4 text-center text-[11px] text-gray-500">
            © {new Date().getFullYear()} CheckPeak. Not affiliated or endorsed by any organization.
          </p>
        </div>
      </main>
    </>
  );
}
