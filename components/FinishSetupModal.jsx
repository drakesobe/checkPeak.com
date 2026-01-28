// /components/FinishSetupModal.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthContext } from "@/hooks/useAuth";

function normalizeRole(r) {
  return r === "Organization" ? "Organization" : "Athlete";
}

function roleForApi(displayRole) {
  // API expects: "athlete" | "organization"
  return normalizeRole(displayRole) === "Organization" ? "organization" : "athlete";
}

export default function FinishSetupModal({
  isOpen,
  onClose,
  defaultEmail = "",
  defaultRole = "Athlete",
  // ✅ Organization token (optional)
  defaultOrg = "",
}) {
  // ✅ Use finishSetup (upsert), not signupAthlete (create-only)
  const { finishSetup } = useAuthContext();

  const [name, setName] = useState("");
  const [email, setEmail] = useState(defaultEmail || "");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [role, setRole] = useState(normalizeRole(defaultRole));
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
    // intentionally keep name if reopened quickly
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
    const roleApi = roleForApi(role); // "athlete" | "organization"
    const cleanOrgToken = String(orgToken || "").trim();

    if (!cleanName) return setError("Please enter your name.");
    if (!cleanEmail.includes("@")) return setError("Please enter a valid email.");
    if (cleanPw.length < 6) return setError("Password must be at least 6 characters.");

    setLoading(true);
    try {
      await finishSetup({
        name: cleanName,
        email: cleanEmail,
        password: cleanPw,
        role: roleApi,
        organizationToken: cleanOrgToken || null,
      });

      // cleanup soft-unlock flags
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("cp_unlocked");
        window.localStorage.removeItem("cp_unlocked_email");
        window.localStorage.removeItem("cp_unlocked_role");
        window.localStorage.removeItem("cp_unlocked_org_token");
        window.localStorage.removeItem("cp_unlocked_org_id");
        window.localStorage.removeItem("cp_unlocked_org_name");
        window.localStorage.setItem("cp_finish_setup_completed", "1");
      }

      onClose?.({ completed: true });
    } catch (err) {
      const msg = String(err?.message || "Account setup failed.");
      const lower = msg.toLowerCase();

      // With upsert, "already exists" should be rare, but keep UX fallback
      if (lower.includes("already exists") || lower.includes("exists")) {
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
            <h2 className="text-xl font-bold text-gray-900 mt-1">Create your password</h2>
            <p className="text-sm text-gray-600 mt-2">
              Save scans, unlock history, and access your dashboard.
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

              {/* Athlete / Organization segmented selector */}
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole("Athlete")}
                    aria-pressed={normalizeRole(role) === "Athlete"}
                    className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                      normalizeRole(role) === "Athlete"
                        ? "bg-white text-gray-900 shadow-sm ring-2 ring-[#46769B]/30"
                        : "text-gray-600 hover:bg-white/70"
                    }`}
                  >
                    Athlete
                    <div className="mt-0.5 text-[11px] font-medium text-gray-500">
                      Personal scans & history
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole("Organization")}
                    aria-pressed={normalizeRole(role) === "Organization"}
                    className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                      normalizeRole(role) === "Organization"
                        ? "bg-white text-gray-900 shadow-sm ring-2 ring-[#46769B]/30"
                        : "text-gray-600 hover:bg-white/70"
                    }`}
                  >
                    Organization
                    <div className="mt-0.5 text-[11px] font-medium text-gray-500">
                      Manage athletes, scans, and compliance
                    </div>
                  </button>
                </div>
              </div>

              {/* Token input optional for both roles */}
              <div className="space-y-1">
                <input
                  type="text"
                  value={orgToken}
                  onChange={(e) => setOrgToken(e.target.value)}
                  placeholder="Organization Token (optional)"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#46769B]"
                />
                <p className="text-[11px] text-gray-500 leading-snug">
                  {normalizeRole(role) === "Athlete"
                    ? "If your trainer sent you a token/link, paste the token here to connect to your organization."
                    : "Optional. Paste an org token if you were given one."}
                </p>
              </div>

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
