// pages/account.js (or pages/account.jsx)
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthContext } from "@/hooks/useAuth";

/**
 * AccountPage
 * ✅ Removes org dropdown (security hole)
 * ✅ Adds Org Code (token) verify/connect flow for athletes
 * ✅ Shows Organization as a locked, non-editable "truth" field
 * ✅ Keeps CheckPeak theming consistent (#46769B, rounded corners, soft cards)
 * ✅ Keeps profile edit + change password modal flow
 *
 * IMPORTANT:
 * This page expects /api/athlete/connectOrg to update the Athletes table's
 * linked-record field {Organization} with [orgRecordId] and return:
 *   { ok: true, organization: { id, name } }
 *
 * SECURITY NOTE:
 * The connectOrg API should NOT trust "email" sent from client.
 * Ideally it reads the logged-in user from your HttpOnly cookie session.
 * This UI does not send email by default; it assumes the API uses session.
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
    // Locked display fields (truth from server)
    organization: "",
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

    // Try to populate org display from any denormalized fields you may already have.
    // If the auth cookie payload doesn't have org name yet, the user may see "Not connected"
    // until they connect or until you enrich the user payload from server later.
    const orgNameGuess =
      user?.["Organization Name"] ||
      user?.OrganizationName ||
      user?.organizationName ||
      user?.OrganizationDisplay ||
      user?.organizationDisplay ||
      "";

    const orgIdGuess =
      user?.OrganizationId ||
      user?.organizationId ||
      (Array.isArray(user?.Organization) ? user.Organization?.[0] : "") ||
      "";

    const initialData = {
      name: user?.Name || user?.name || "",
      email: user?.Email || user?.email || "",
      title: user?.Title || user?.title || (isOrg ? "Organization" : "Athlete"),
      phone: user?.Phone || user?.phone || "",
      created: user?.Created || user?.created || "",
      organization:
        orgNameGuess ||
        (typeof user?.Organization === "string" ? user.Organization : "") ||
        "",
      organizationId: orgIdGuess,
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
      // Only allow changing editable fields
      if (["name", "email", "phone"].includes(k)) {
        if (String(nextData?.[k] ?? "") !== String(originalData?.[k] ?? "")) return true;
      }
    }
    return false;
  };

  // ---------- Input handlers ----------
  const handleChange = (e) => {
    const { name, value } = e.target;

    // Organization is locked; ignore any attempts to change it
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
      // If you don't have /api/update-organization, create it or route org updates through your org API.
      const endpoint = isOrg ? "/api/update-organization" : "/api/update-athlete";

      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
      setOriginalData((prev) => ({
        ...prev,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
      }));
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
    const cleanToken = String(orgCode || "").trim();
    const email =
      String(user?.Email || user?.email || "").trim().toLowerCase();

    if (!cleanToken) {
      throw new Error("Please enter your organization code.");
    }
    if (!email || !email.includes("@")) {
      throw new Error(
        "Valid email is required. Please log out and log back in, then try again."
      );
    }

    const res = await fetch("/api/athlete/connectOrg", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: cleanToken,
        email, // ✅ send email because your API requires it
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // map common error messages so the UI feels clean
      const raw = String(data?.error || data?.message || "Failed to connect organization.");
      const lower = raw.toLowerCase();

      if (lower.includes("invalid token") || lower.includes("token")) {
        throw new Error("That organization code doesn’t look right. Double-check and try again.");
      }
      if (lower.includes("not found")) {
        throw new Error("We couldn’t find an organization for that code.");
      }
      if (lower.includes("email")) {
        throw new Error("Valid email is required. Please log out and log back in, then try again.");
      }

      throw new Error(raw);
    }

    // success shape expected: { organization: { id, name } }
    const newName = data?.organization?.name || "Organization";
    const newId = data?.organization?.id || "";

    setOrgConnectOk("Organization connected!");
    setOrgCode("");

    // Update locked display fields
    setFormData((prev) => ({
      ...prev,
      organization: newName,
      organizationId: newId || prev.organizationId,
    }));

    // Keep originalData in sync (org is locked anyway)
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

  const canSave = !saving && hasChanges.current && validation.email && validation.phone;

  // Helpful link destinations by role
  const dashboardHref = isOrg ? "/org/dashboard" : "/dashboard";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 font-sans">
      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className={sectionCard}>
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wide text-[#46769B]">CHECKPEAK</p>
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

            <div className="shrink-0 flex flex-col items-end gap-2">
              <Link href="/" className="text-sm font-semibold text-[#46769B] hover:underline">
                Home
              </Link>
              <Link href={dashboardHref} className="text-sm font-semibold text-gray-600 hover:underline">
                Dashboard
              </Link>
            </div>
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
                <input type="text" value={formData.created || "—"} readOnly className={readOnlyBase} />
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
                  This field is verified. Athletes can only connect via an organization code.
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
                <p className="text-[11px] text-gray-500 mt-2">
                  Role is set by your account type and can’t be edited here.
                </p>
              </div>
            </div>

            {/* Athlete-only connect org code */}
            {isAthlete && (
              <div className="rounded-3xl border border-gray-200 bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Connect an organization</p>
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
                    <li>Prevents athletes from selecting any organization.</li>
                    <li>Organization membership is verified by a shared code.</li>
                    <li>Your account always displays the verified organization.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Org-only help block */}
            {isOrg && (
              <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
                <p className="text-sm font-semibold text-gray-900">Team invites</p>
                <p className="text-[12px] text-gray-600 mt-1">
                  Share your organization code with athletes to connect them to your team.
                </p>
                <p className="text-[12px] text-gray-600 mt-2">
                  If you want, we can add a “Copy org code” button here that reads your Token from the session.
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
                  <p className="text-xs font-semibold tracking-wide text-[#46769B]">SECURITY</p>
                  <h2 className="text-lg font-extrabold text-gray-900 mt-1">Change Password</h2>
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
                  <label className="block text-gray-800 font-medium mb-1">Current password</label>
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
                  <label className="block text-gray-800 font-medium mb-1">New password</label>
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
                  <label className="block text-gray-800 font-medium mb-1">Confirm new password</label>
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
                      <p className="mt-2 text-xs text-red-600">Passwords don’t match yet.</p>
                    )}

                  {passwordData.confirmPassword.length > 0 &&
                    passwordData.newPassword === passwordData.confirmPassword &&
                    passwordData.newPassword.length >= 8 && (
                      <p className="mt-2 text-xs text-emerald-700">Passwords match ✅</p>
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
                  href="/forgot-password"
                  className="text-[#46769B] font-semibold hover:underline"
                  onClick={() => setShowPasswordModal(false)}
                >
                  Forgot password?
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
