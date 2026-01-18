// pages/account.js (or pages/account.jsx)
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthContext } from "@/hooks/useAuth";

/**
 * AccountPage
 * - Removes org dropdown (security hole)
 * - Adds Org Code (token) verify/connect flow for athletes
 * - Shows Organization as a locked, non-editable "truth" field
 * - Keeps theming consistent with your CheckPeak style (#46769B)
 * - Keeps your existing profile edit + change password modal flow
 *
 * NOTE:
 * This page assumes you created /api/athlete/connectOrg (provided earlier).
 * That endpoint should:
 *  - Validate org token in Organizations base
 *  - Update athlete record's Organization field (linked record) OR a text field
 *  - Return { organization: { id, name } }
 */

export default function AccountPage() {
  const router = useRouter();
  const { user, logout } = useAuthContext();

  // ---------- Role normalization ----------
  const role = useMemo(() => {
    const raw = (user?.Role || user?.role || "").toString().trim().toLowerCase();
    if (raw.includes("org")) return "organization";
    if (raw.includes("ath")) return "athlete";
    if (raw.includes("admin")) return "admin";
    if (raw.includes("trainer")) return "trainer";
    return raw || "";
  }, [user]);

  const isOrg = role === "organization";
  const isAthlete = role === "athlete";

  // ---------- Form state ----------
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    title: "",
    phone: "",
    created: "",
    // "organization" here is for display only (locked field in UI)
    organization: "",
    // optionally track id if your API returns it
    organizationId: "",
  });

  const [originalData, setOriginalData] = useState({});
  const hasChanges = useRef(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [validation, setValidation] = useState({ email: true, phone: true });

  // ---------- Org connect state (Athletes only) ----------
  const [orgCode, setOrgCode] = useState("");
  const [orgConnectLoading, setOrgConnectLoading] = useState(false);
  const [orgConnectError, setOrgConnectError] = useState("");
  const [orgConnectOk, setOrgConnectOk] = useState("");

  // ---------- Change password modal state ----------
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPw1, setShowPw1] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [showPw3, setShowPw3] = useState(false);

  const [passwordError, setPasswordError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  // ---------- Helpers ----------
  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validatePhone = (phone) => {
    // allow empty, or E.164-ish + digits 7-15
    if (!phone) return true;
    return /^\+?\d{7,15}$/.test(phone);
  };

  // Password strength (same feel as reset-password page)
  const scorePassword = (pw) => {
    const p = String(pw || "");
    let score = 0;
    if (p.length >= 8) score += 1;
    if (p.length >= 12) score += 1;
    if (/[A-Z]/.test(p)) score += 1;
    if (/[0-9]/.test(p)) score += 1;
    if (/[^A-Za-z0-9]/.test(p)) score += 1;
    return Math.min(score, 5);
  };

  const strengthLabel = (score) => {
    if (score <= 1) return "Weak";
    if (score === 2) return "Okay";
    if (score === 3) return "Good";
    if (score === 4) return "Strong";
    return "Very strong";
  };

  // ---------- Initial load ----------
  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    // Prefer denormalized org name field if you have it; fallback to whatever is in user.Organization
    // Common options you might have:
    // - user["Organization Name"] (text)
    // - user.Organization (linked record id or text)
    // - user.OrganizationDisplay (custom)
    const orgNameGuess =
      user?.["Organization Name"] ||
      user?.OrganizationName ||
      user?.organizationName ||
      user?.OrganizationDisplay ||
      user?.organizationDisplay ||
      "";

    const initialData = {
      name: user?.Name || user?.name || "",
      email: user?.Email || user?.email || "",
      title: user?.Title || user?.title || (isOrg ? "Organization" : "Athlete"),
      phone: user?.Phone || user?.phone || "",
      created: user?.Created || user?.created || "",
      organization: orgNameGuess || (typeof user?.Organization === "string" ? user.Organization : "") || "",
      organizationId:
        user?.OrganizationId ||
        user?.organizationId ||
        (Array.isArray(user?.Organization) ? user.Organization?.[0] : ""),
    };

    setFormData(initialData);
    setOriginalData(initialData);

    setValidation({
      email: validateEmail(initialData.email),
      phone: validatePhone(initialData.phone),
    });
  }, [user, router, isOrg]);

  if (!user) return null;

  // ---------- Change detection ----------
  const recomputeHasChanges = (nextData) => {
    const keys = Object.keys(originalData || {});
    for (const k of keys) {
      // Only allow changing editable fields:
      // name/email/phone (and optionally title if you ever allow it)
      if (["name", "email", "phone"].includes(k)) {
        if (String(nextData?.[k] ?? "") !== String(originalData?.[k] ?? "")) return true;
      }
    }
    return false;
  };

  // ---------- Input handlers ----------
  const handleChange = (e) => {
    const { name, value } = e.target;

    // Organization is locked; ignore any attempts to change
    if (name === "organization" || name === "organizationId") return;

    const next = { ...formData, [name]: value };
    setFormData(next);

    if (name === "email") setValidation((prev) => ({ ...prev, email: validateEmail(value) }));
    if (name === "phone") setValidation((prev) => ({ ...prev, phone: validatePhone(value) }));

    hasChanges.current = recomputeHasChanges(next);
  };

  // ---------- Save profile ----------
  const handleSave = async () => {
    if (!validation.email || !validation.phone) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      // Update endpoint by role
      // - athletes: /api/update-athlete
      // - orgs (if you have one): /api/update-organization (fallback to /api/update-athlete if not)
      const endpoint = isOrg ? "/api/update-organization" : "/api/update-athlete";

      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Keep your existing payload shape
          athleteId: user.id,
          organizationId: user.id,
          updates: {
            Name: formData.name,
            Email: formData.email,
            Phone: formData.phone,
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to save changes");

      setMessage("Profile updated successfully!");
      setOriginalData((prev) => ({ ...prev, name: formData.name, email: formData.email, phone: formData.phone }));
      hasChanges.current = false;
    } catch (err) {
      console.error("Update error:", err);
      setError(err?.message || "Error updating profile");
    } finally {
      setSaving(false);
    }
  };

  // ---------- Connect Organization (athletes only) ----------
  const connectOrganization = async () => {
    setOrgConnectError("");
    setOrgConnectOk("");
    setOrgConnectLoading(true);

    try {
      const res = await fetch("/api/athlete/connectOrg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: orgCode }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to connect organization");

      setOrgConnectOk("Organization connected!");
      setOrgCode("");

      const newName = data?.organization?.name || "Organization";
      const newId = data?.organization?.id || "";

      // Update locked display fields
      setFormData((prev) => ({
        ...prev,
        organization: newName,
        organizationId: newId || prev.organizationId,
      }));

      // Keep originalData org display in sync (since it's locked, we don't treat it as editable)
      setOriginalData((prev) => ({
        ...prev,
        organization: newName,
        organizationId: newId || prev.organizationId,
      }));
    } catch (err) {
      console.error("[connectOrganization] error:", err);
      setOrgConnectError(err?.message || "Failed to connect organization.");
    } finally {
      setOrgConnectLoading(false);
    }
  };

  // ---------- Password modal handlers ----------
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
  };

  const pwScore = scorePassword(passwordData.newPassword);
  const pwLabel = strengthLabel(pwScore);

  const savePassword = async () => {
    const { currentPassword, newPassword, confirmPassword } = passwordData;

    setPasswordError("");
    setPasswordMessage("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All fields are required");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    setPasswordSaving(true);

    try {
      const res = await fetch("/api/update-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteId: user.id,
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Password update failed");

      setPasswordMessage("Password updated successfully!");
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });

      // Optional: auto-close after a moment
      // setTimeout(() => setShowPasswordModal(false), 900);
    } catch (err) {
      console.error(err);
      setPasswordError(err?.message || "Failed to update password");
    } finally {
      setPasswordSaving(false);
    }
  };

  // ---------- UI class helpers ----------
  const labelBase = "block text-gray-800 font-medium mb-1";
  const inputBase =
    "w-full border border-gray-200 rounded-2xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30 transition text-gray-900 placeholder:text-gray-400";
  const readOnlyBase =
    "w-full border border-gray-200 rounded-2xl px-4 py-2 bg-gray-50 text-gray-700";
  const sectionCard = "bg-white p-8 rounded-3xl shadow-md border border-blue-100 space-y-6";

  const canSave =
    !saving &&
    hasChanges.current &&
    validation.email &&
    validation.phone;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 font-sans">
      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className={sectionCard}>
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wide text-[#46769B]">
                CHECKPEAK
              </p>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-1">
                Account Settings
              </h1>
              <p className="text-gray-600 text-sm mt-2">
                Manage your profile, security, and organization connection.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[#46769B]">
                  {isOrg ? "Organization" : isAthlete ? "Athlete" : role || "Member"}
                </span>
                {formData.email ? (
                  <span className="inline-flex items-center rounded-full bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700 truncate max-w-[260px]">
                    {formData.email}
                  </span>
                ) : null}
              </div>
            </div>

            <Link
              href="/"
              className="shrink-0 text-sm font-semibold text-[#46769B] hover:underline"
            >
              Home
            </Link>
          </div>

          {/* Feedback */}
          <AnimatePresence>
            {(message || error) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`text-center text-sm font-medium py-3 px-4 rounded-2xl border ${
                  message
                    ? "bg-emerald-50 text-emerald-800 border-emerald-100"
                    : "bg-red-50 text-red-700 border-red-100"
                }`}
              >
                {message || error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Personal Info */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Personal Info</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Name */}
              <div>
                <label className={labelBase}>Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={inputBase}
                  placeholder="Your name"
                />
              </div>

              {/* Email */}
              <div>
                <label className={labelBase}>Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={[
                    inputBase,
                    validation.email ? "" : "border-red-300 focus:ring-red-200",
                  ].join(" ")}
                  placeholder="you@example.com"
                />
                {!validation.email && (
                  <p className="text-red-600 text-xs mt-1">Invalid email format</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className={labelBase}>Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className={[
                    inputBase,
                    validation.phone ? "" : "border-red-300 focus:ring-red-200",
                  ].join(" ")}
                  placeholder="+15551234567 (optional)"
                />
                {!validation.phone && (
                  <p className="text-red-600 text-xs mt-1">
                    Invalid phone number (use digits, optional +, 7–15 chars).
                  </p>
                )}
              </div>

              {/* Created */}
              <div>
                <label className={labelBase}>Created</label>
                <input
                  type="text"
                  value={formData.created || "—"}
                  readOnly
                  className={readOnlyBase}
                />
              </div>
            </div>
          </div>

          {/* Organization & Role */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Organization</h2>

            {/* Locked organization display */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelBase}>Organization (locked)</label>
                <input
                  type="text"
                  value={
                    formData.organization?.trim()
                      ? formData.organization
                      : isOrg
                      ? (user?.Name || user?.name || "Your organization")
                      : "Not connected"
                  }
                  readOnly
                  className={readOnlyBase}
                />
                <p className="text-[11px] text-gray-500 mt-2">
                  *This is your verified organization.
                </p>
              </div>

              <div>
                <label className={labelBase}>Title / Role</label>
                <input
                  type="text"
                  value={formData.title || (isOrg ? "Organization" : "Athlete")}
                  readOnly
                  className={readOnlyBase}
                />
              </div>
            </div>

            {/* Athlete-only connect org code */}
            {isAthlete && (
              <div className="rounded-3xl border border-gray-200 bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Connect an organization
                    </p>
                    <p className="text-[12px] text-gray-500 mt-1">
                      Enter the organization code provided by your coach/team. We’ll verify it and connect your account.
                    </p>
                  </div>

                  <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-[#46769B]">
                    Verified by code
                  </span>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={orgCode}
                    onChange={(e) => setOrgCode(e.target.value)}
                    placeholder="Organization code"
                    className={inputBase}
                  />
                  <button
                    type="button"
                    onClick={connectOrganization}
                    disabled={orgConnectLoading || !orgCode.trim()}
                    className={[
                      "px-5 py-2 rounded-2xl font-semibold shadow-sm transition",
                      orgConnectLoading || !orgCode.trim()
                        ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                        : "bg-[#46769B] text-white hover:brightness-110",
                    ].join(" ")}
                  >
                    {orgConnectLoading ? "Verifying..." : "Verify & Connect"}
                  </button>
                </div>

                <AnimatePresence>
                  {!!orgConnectError && (
                    <motion.p
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="mt-3 text-sm text-red-600"
                    >
                      {orgConnectError}
                    </motion.p>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {!!orgConnectOk && (
                    <motion.p
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="mt-3 text-sm text-emerald-700"
                    >
                      {orgConnectOk}
                    </motion.p>
                  )}
                </AnimatePresence>

                <div className="mt-4 rounded-2xl bg-gray-50 border border-gray-200 p-4">
                  <p className="text-xs font-semibold text-gray-900">Why this matters</p>
                  <ul className="mt-2 text-[12px] text-gray-600 list-disc list-inside space-y-1">
                    <li>Prevents athletes from self-assigning to any organization.</li>
                    <li>Organization membership is verified by a shared code.</li>
                    <li>Your account always displays your true organization.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Org-only help block (optional) */}
            {isOrg && (
              <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
                <p className="text-sm font-semibold text-gray-900">Team invites</p>
                <p className="text-[12px] text-gray-600 mt-1">
                  Share your organization code with athletes to connect them to your team.
                </p>
                <p className="text-[12px] text-gray-600 mt-2">
                  Tip: If you want, we can add a “Copy org code” button here that pulls your token from the session user.
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-2 space-y-3">
            <button
              onClick={handleSave}
              disabled={!canSave}
              className={[
                "w-full py-3 rounded-2xl text-white font-semibold shadow-md transition",
                canSave
                  ? "bg-[#46769B] hover:brightness-110"
                  : "bg-gray-200 text-gray-500 cursor-not-allowed shadow-none",
              ].join(" ")}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>

            <button
              onClick={() => {
                setPasswordError("");
                setPasswordMessage("");
                setShowPasswordModal(true);
              }}
              className="w-full py-3 rounded-2xl bg-blue-50 border border-blue-100 text-[#46769B] font-semibold hover:bg-blue-100 transition"
            >
              Change Password
            </button>

            <button
              onClick={() => logout()}
              className="w-full py-3 rounded-2xl bg-red-50 border border-red-100 text-red-700 font-semibold hover:bg-red-100 transition"
            >
              Log Out
            </button>
          </div>
        </div>
      </main>

      {/* ---------- Change Password Modal ---------- */}
      <AnimatePresence>
        {showPasswordModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
            onClick={() => setShowPasswordModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md relative border border-blue-100 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-[#46769B]">
                    SECURITY
                  </p>
                  <h2 className="text-lg font-extrabold text-gray-900 mt-1">
                    Change Password
                  </h2>
                  <p className="text-[12px] text-gray-600 mt-1">
                    Use a strong password you don’t reuse elsewhere.
                  </p>
                </div>

                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="h-9 w-9 rounded-2xl border border-gray-200 grid place-items-center text-gray-600 hover:bg-gray-50 transition"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <AnimatePresence>
                  {passwordError && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="p-3 rounded-2xl bg-red-50 border border-red-100 text-red-700 text-sm"
                    >
                      {passwordError}
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {passwordMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-sm"
                    >
                      {passwordMessage}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Current password */}
                <div>
                  <label className={labelBase}>Current password</label>
                  <div className="relative">
                    <input
                      type={showPw1 ? "text" : "password"}
                      placeholder="Enter current password"
                      name="currentPassword"
                      value={passwordData.currentPassword}
                      onChange={handlePasswordChange}
                      className={`${inputBase} pr-14`}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw1((v) => !v)}
                      className="absolute inset-y-0 right-3 text-sm font-semibold text-gray-500 hover:text-gray-700"
                    >
                      {showPw1 ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                {/* New password */}
                <div>
                  <label className={labelBase}>New password</label>
                  <div className="relative">
                    <input
                      type={showPw2 ? "text" : "password"}
                      placeholder="At least 8 characters"
                      name="newPassword"
                      value={passwordData.newPassword}
                      onChange={handlePasswordChange}
                      className={`${inputBase} pr-14`}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw2((v) => !v)}
                      className="absolute inset-y-0 right-3 text-sm font-semibold text-gray-500 hover:text-gray-700"
                    >
                      {showPw2 ? "Hide" : "Show"}
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

                {/* Confirm password */}
                <div>
                  <label className={labelBase}>Confirm new password</label>
                  <div className="relative">
                    <input
                      type={showPw3 ? "text" : "password"}
                      placeholder="Re-enter new password"
                      name="confirmPassword"
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordChange}
                      className={`${inputBase} pr-14`}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw3((v) => !v)}
                      className="absolute inset-y-0 right-3 text-sm font-semibold text-gray-500 hover:text-gray-700"
                    >
                      {showPw3 ? "Hide" : "Show"}
                    </button>
                  </div>

                  {passwordData.confirmPassword.length > 0 &&
                    passwordData.newPassword !== passwordData.confirmPassword && (
                      <p className="mt-2 text-xs text-red-600">
                        Passwords don’t match yet.
                      </p>
                    )}

                  {passwordData.confirmPassword.length > 0 &&
                    passwordData.newPassword === passwordData.confirmPassword &&
                    passwordData.newPassword.length >= 8 && (
                      <p className="mt-2 text-xs text-emerald-700">
                        Passwords match ✅
                      </p>
                    )}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 rounded-2xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={savePassword}
                  disabled={passwordSaving}
                  className={[
                    "px-4 py-2 rounded-2xl text-white font-semibold shadow-sm transition",
                    passwordSaving ? "bg-gray-300 cursor-not-allowed" : "bg-[#46769B] hover:brightness-110",
                  ].join(" ")}
                >
                  {passwordSaving ? "Saving..." : "Save"}
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs">
                <Link
                  href="/"
                  className="text-gray-500 hover:underline"
                  onClick={() => setShowPasswordModal(false)}
                >
                  Back to home
                </Link>

                <Link
                  href="/"
                  className="text-[#46769B] font-semibold hover:underline"
                  onClick={() => setShowPasswordModal(false)}
                >
                  Need help?
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
