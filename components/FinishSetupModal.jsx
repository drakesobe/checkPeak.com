// /components/FinishSetupModal.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthContext } from "@/hooks/useAuth";

function normalizeRole(r) {
  return r === "Organization" ? "Organization" : "Athlete";
}

export default function FinishSetupModal({
  isOpen,
  onClose,
  defaultEmail = "",
  defaultRole = "Athlete",
  // ✅ this is now the Org Token (optional) coming from cp_unlocked_org_token
  defaultOrg = "",
}) {
  const { signupAthlete } = useAuthContext();

  const [name, setName] = useState("");
  const [email, setEmail] = useState(defaultEmail || "");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  // ✅ Only two roles supported
  const [role, setRole] = useState(normalizeRole(defaultRole));
  // ✅ Token (optional)
  const [orgToken, setOrgToken] = useState(defaultOrg || "");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [accountExists, setAccountExists] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setEmail(defaultEmail || "");
    setRole(normalizeRole(defaultRole));
    setOrgToken(defaultOrg || "");

    setError("");
    setPassword("");
    setAccountExists(false);
    // leave name as-is so they don’t lose typing if they reopen quickly
  }, [isOpen, defaultEmail, defaultRole, defaultOrg]);

  const emailLocked = Boolean(defaultEmail);

  const canSubmit = useMemo(() => {
    return (
      String(name || "").trim().length >= 2 &&
      String(email || "").includes("@") &&
      String(password || "").length >= 6
    );
  }, [name, email, password]);

  const openLoginModal = () => {
    // 🔥 Global event your NavBar can listen for
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("cp:open-auth-modal", {
          detail: { defaultTab: "login", email: String(email || "").trim() },
        })
      );
    }
    onClose?.({ completed: false, action: "open_login" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setAccountExists(false);

    const cleanName = String(name || "").trim();
    const cleanEmail = String(email || defaultEmail || "").trim().toLowerCase();
    const cleanPw = String(password || "");
    const cleanRole = normalizeRole(role);
    const cleanOrgToken = String(orgToken || "").trim();

    if (!cleanName) return setError("Please enter your name.");
    if (!cleanEmail.includes("@")) return setError("Please enter a valid email.");
    if (cleanPw.length < 6) return setError("Password must be at least 6 characters.");

    setLoading(true);
    try {
      /**
       * ✅ IMPORTANT:
       * Your server-side signup endpoint should route to:
       * - Athlete table when role === "Athlete"
       * - Organizations table when role === "Organization"
       *
       * and (optionally) resolve cleanOrgToken against the Organizations Airtable {Token}.
       */
      await signupAthlete({
        token: "",
        name: cleanName,
        email: cleanEmail,
        password: cleanPw,
        role: cleanRole,              // "Athlete" | "Organization"
        organizationToken: cleanOrgToken || null, // ✅ optional
      });

      // cleanup soft-unlock flags (now a real user)
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("cp_unlocked");
        window.localStorage.removeItem("cp_unlocked_email");
        window.localStorage.removeItem("cp_unlocked_role");

        // ✅ updated keys
        window.localStorage.removeItem("cp_unlocked_org_token");
        window.localStorage.removeItem("cp_unlocked_org_id");
        window.localStorage.removeItem("cp_unlocked_org_name");

        window.localStorage.setItem("cp_finish_setup_completed", "1");
      }

      onClose?.({ completed: true });
    } catch (err) {
      const msg = String(err?.message || "Account setup failed.");
      const lower = msg.toLowerCase();

      if (lower.includes("already exists")) {
        setAccountExists(true);
        setError("You already have an account. Log in to continue.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => onClose?.({ completed: false })}
        >
          <motion.div
            className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 relative"
            initial={{ scale: 0.94, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 10 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
              onClick={() => onClose?.({ completed: false })}
              aria-label="Close"
              type="button"
            >
              ✕
            </button>

            <p className="text-xs font-semibold text-[#46769B]">Finish setup</p>
            <h2 className="text-xl font-bold text-gray-900 mt-1">
              Create your password to save scans
            </h2>
            <p className="text-sm text-gray-600 mt-2">
              This unlocks scan history, alerts, and your dashboard.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <input
                type="text"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#46769B]"
                autoComplete="name"
                required
              />

              <input
                type="email"
                placeholder="Email"
                value={email}
                readOnly={emailLocked}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#46769B] ${
                  emailLocked ? "bg-gray-50 text-gray-600" : ""
                }`}
                autoComplete="email"
                required
              />

              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="Create password (min 6 chars)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#46769B] pr-16"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700"
                  onClick={() => setShowPw((v) => !v)}
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>

              {/* ✅ Minimal friction: only two roles */}
              <div className="flex items-center justify-between rounded-xl border border-gray-300 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">Account type</p>
                  <p className="text-xs text-gray-500">Most users choose Athlete</p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setRole((r) => (normalizeRole(r) === "Organization" ? "Athlete" : "Organization"))
                  }
                  className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold hover:bg-gray-50"
                >
                  {normalizeRole(role)}
                </button>
              </div>

              {/* ✅ Optional token field (matches OCR gate wording) */}
              <input
                type="text"
                value={orgToken}
                onChange={(e) => setOrgToken(e.target.value)}
                placeholder="Team / Organization Token (optional)"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#46769B]"
              />

              {error && <p className="text-xs text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={loading || !canSubmit}
                className={`w-full px-4 py-3 rounded-xl bg-[#46769B] text-white font-semibold text-sm shadow-sm hover:brightness-110 transition ${
                  loading || !canSubmit ? "opacity-70 cursor-not-allowed" : ""
                }`}
              >
                {loading ? "Creating account..." : "Finish Setup"}
              </button>

              {accountExists && (
                <button
                  type="button"
                  onClick={openLoginModal}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-800 font-semibold text-sm hover:bg-gray-50 transition"
                >
                  Log in instead
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem("cp_finish_setup_dismissed", "1");
                  }
                  onClose?.({ completed: false, action: "dismiss" });
                }}
                className="w-full text-xs text-gray-500 underline underline-offset-4"
              >
                I’ll do this later
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
