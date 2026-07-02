// pages/reset-password.js
"use client";

import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getQueryParam(name) {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return params.get(name) || "";
}

function scorePassword(pw) {
  const p = String(pw || "");
  let score = 0;
  if (p.length >= 8) score += 1;
  if (p.length >= 12) score += 1;
  if (/[A-Z]/.test(p)) score += 1;
  if (/[0-9]/.test(p)) score += 1;
  if (/[^A-Za-z0-9]/.test(p)) score += 1;
  return Math.min(score, 5);
}

function strengthLabel(score) {
  if (score <= 1) return "Weak";
  if (score === 2) return "Okay";
  if (score === 3) return "Good";
  if (score === 4) return "Strong";
  return "Very strong";
}

export default function ResetPasswordPage() {
  const router = useRouter();

  // Pull token/email from query string
  const tokenRaw = useMemo(() => getQueryParam("token"), []);
  const emailRaw = useMemo(() => getQueryParam("email"), []);

  const token = useMemo(() => String(tokenRaw || "").trim(), [tokenRaw]);
  const email = useMemo(() => normalizeEmail(emailRaw), [emailRaw]);

  // Build helpful links
  const loginUrl = useMemo(() => "/login", []);
  const requestNewLinkUrl = useMemo(() => {
    // Opens forgot-password UI on /login and prefills email
    const q = new URLSearchParams();
    q.set("forgot", "1");
    if (email) q.set("email", email);
    return `/login?${q.toString()}`;
  }, [email]);

  // UI state
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");

  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);

  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState(false);

  // Validate query
  useEffect(() => {
    if (!token || token.length < 10) {
      setPageError("This reset link is invalid. Please request a new one.");
      return;
    }
    if (!email || !email.includes("@")) {
      setPageError("This reset link is missing information. Please request a new one.");
      return;
    }
    setPageError("");
  }, [token, email]);

  const pwScore = scorePassword(pw1);
  const pwLabel = strengthLabel(pwScore);

  const canSubmit =
    !pageError &&
    pw1.length >= 8 &&
    pw2.length >= 8 &&
    pw1 === pw2 &&
    !loading;

  const callReset = async () => {
    setFormError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/resetPassword", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          token,
          newPassword: pw1,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = String(data?.error || "Reset failed. Please request a new link.");

        const lower = msg.toLowerCase();
        if (lower.includes("expired")) {
          throw new Error("This reset link expired. Please request a new one.");
        }
        if (lower.includes("invalid")) {
          throw new Error("This reset link is invalid. Please request a new one.");
        }
        throw new Error(msg);
      }

      setSuccess(true);
      setPw1("");
      setPw2("");
    } catch (err) {
      setFormError(err?.message || "Reset failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (pageError) return;

    if (!pw1 || pw1.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    if (pw1 !== pw2) {
      setFormError("Passwords do not match.");
      return;
    }

    await callReset();
  };

  return (
    <>
      <Head>
        <title>Reset Password - CheckPeak</title>
        <meta name="description" content="Reset your CheckPeak password securely." />
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <main className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900">
        <div className="max-w-xl mx-auto px-4 py-14">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white border border-blue-100 rounded-3xl shadow-lg p-6 sm:p-8"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-wide text-[#46769B]">
                  CHECKPEAK
                </p>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
                  Reset your password
                </h1>
                <p className="text-sm text-gray-600 mt-2">
                  Choose a new password for{" "}
                  <span className="font-semibold text-gray-900">
                    {email || "your account"}
                  </span>
                </p>
              </div>

              <Link
                href="/"
                className="text-sm font-semibold text-[#46769B] hover:underline"
              >
                Home
              </Link>
            </div>

            {/* Error state if query is broken */}
            {pageError && (
              <div className="mt-6 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-700 text-sm">
                <p className="font-semibold">Link issue</p>
                <p className="mt-1">{pageError}</p>

                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                  <Link
                    href={loginUrl}
                    className="px-5 py-3 rounded-2xl bg-gray-900 text-white font-semibold text-sm text-center"
                  >
                    Go to login
                  </Link>

                  <Link
                    href={requestNewLinkUrl}
                    className="px-5 py-3 rounded-2xl bg-white border border-gray-200 text-gray-900 font-semibold text-sm text-center hover:bg-gray-50"
                  >
                    Request a new reset link
                  </Link>
                </div>
              </div>
            )}

            {/* Success */}
            {!pageError && success && (
              <div className="mt-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-800">
                <p className="font-semibold">Password updated</p>
                <p className="mt-1 text-sm">You can now log in with your new password.</p>

                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => router.push(loginUrl)}
                    className="px-5 py-3 rounded-2xl bg-[#46769B] text-white font-semibold text-sm shadow-md hover:brightness-110 transition"
                  >
                    Go to login
                  </button>

                  <Link
                    href="/"
                    className="px-5 py-3 rounded-2xl bg-white border border-gray-200 text-gray-900 font-semibold text-sm text-center hover:bg-gray-50"
                  >
                    Back to home
                  </Link>
                </div>
              </div>
            )}

            {/* Form */}
            {!pageError && !success && (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {/* New password */}
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      type={show1 ? "text" : "password"}
                      value={pw1}
                      onChange={(e) => setPw1(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full p-3 pr-14 border border-gray-300 rounded-2xl bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShow1((v) => !v)}
                      className="absolute inset-y-0 right-3 text-sm font-semibold text-gray-500 hover:text-gray-700"
                    >
                      {show1 ? "Hide" : "Show"}
                    </button>
                  </div>

                  {/* Strength meter */}
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Strength</span>
                      <span className="font-semibold text-gray-700">{pwLabel}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#46769B] transition-all"
                        style={{ width: `${(pwScore / 5) * 100}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-gray-500">
                      Tip: Use 12+ characters and mix letters, numbers, and symbols.
                    </p>
                  </div>
                </div>

                {/* Confirm */}
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1">
                    Confirm password
                  </label>
                  <div className="relative">
                    <input
                      type={show2 ? "text" : "password"}
                      value={pw2}
                      onChange={(e) => setPw2(e.target.value)}
                      placeholder="Re-enter your new password"
                      className="w-full p-3 pr-14 border border-gray-300 rounded-2xl bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShow2((v) => !v)}
                      className="absolute inset-y-0 right-3 text-sm font-semibold text-gray-500 hover:text-gray-700"
                    >
                      {show2 ? "Hide" : "Show"}
                    </button>
                  </div>

                  {/* Match hint */}
                  {pw2.length > 0 && pw1 !== pw2 && (
                    <p className="mt-2 text-xs text-red-600">Passwords don’t match yet.</p>
                  )}
                  {pw2.length > 0 && pw1 === pw2 && pw1.length >= 8 && (
                    <p className="mt-2 text-xs text-emerald-700">Passwords match</p>
                  )}
                </div>

                {/* Errors */}
                {formError && (
                  <div className="p-3 rounded-2xl bg-red-50 border border-red-100 text-red-700 text-sm">
                    {formError}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={`w-full py-3 rounded-2xl font-semibold shadow-md transition ${
                    canSubmit
                      ? "bg-[#46769B] text-white hover:brightness-110"
                      : "bg-gray-200 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {loading ? "Updating..." : "Update password"}
                </button>

                {/* Footer actions */}
                <div className="flex items-center justify-between text-sm pt-2">
                  <Link href={loginUrl} className="text-gray-600 hover:underline">
                    Back to login
                  </Link>

                  <Link
                    href={requestNewLinkUrl}
                    className="text-[#46769B] font-semibold hover:underline"
                  >
                    Request a new reset link
                  </Link>
                </div>

                <p className="text-[11px] text-gray-500 pt-2">
                  For security, password reset links expire. If yours doesn’t work, request a new link.
                </p>
              </form>
            )}
          </motion.div>
        </div>
      </main>
    </>
  );
}
