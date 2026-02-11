// pages/account.js (or pages/account.jsx)
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthContext } from "@/hooks/useAuth";

/**
 * AccountPage
 * ✅ Athlete: can connect org via code (token)
 * ✅ Org-side: supports Organization / Admin / Trainer (OrgMembers)
 * ✅ Uses orgId/memberId from session cookie payload (new auth model)
 * ✅ Keeps organization display locked + non-editable
 *
 * Notes:
 * - Your auth model now stores role/orgId/memberId/OrgName/Token in cookie session.
 * - This page is designed to READ from that session user and show “locked” org details.
 */

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function normalizeRole(rawRole) {
  const raw = String(rawRole || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "organization" || raw === "org" || raw.includes("organization")) return "organization";
  if (raw === "admin" || raw.includes("admin") || raw.includes("head")) return "admin";
  if (raw === "trainer" || raw.includes("train")) return "trainer";
  if (raw === "athlete" || raw.includes("ath")) return "athlete";
  return raw;
}

function roleLabelOf(role) {
  if (role === "organization") return "Organization";
  if (role === "admin") return "Admin";
  if (role === "trainer") return "Trainer";
  if (role === "athlete") return "Athlete";
  return role ? role[0].toUpperCase() + role.slice(1) : "Member";
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}

function validatePhone(phone) {
  if (!phone) return true;
  return /^\+?\d{7,15}$/.test(String(phone || ""));
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

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export default function AccountPage() {
  const router = useRouter();
  const { user, logout, setUser } = useAuthContext();

  /* ------------------------------------------------------------------ */
  /* Role + session-derived org context                                  */
  /* ------------------------------------------------------------------ */

  const role = useMemo(() => normalizeRole(user?.role || user?.Role), [user]);
  const roleLabel = useMemo(() => roleLabelOf(role), [role]);

  const isAthlete = role === "athlete";
  const isOrgPrimary = role === "organization";
  const isOrgMember = role === "admin" || role === "trainer";
  const isOrgSide = isOrgPrimary || isOrgMember;

  // Prefer cookie/session values (new model)
  const orgNameFromSession = useMemo(() => {
    return String(
      user?.OrgName ||
        user?.OrganizationName ||
        user?.organizationName ||
        user?.["Organization Name"] ||
        user?.OrganizationDisplay ||
        user?.organizationDisplay ||
        ""
    ).trim();
  }, [user]);

  const orgIdFromSession = useMemo(() => {
    // org-side should have orgId; athletes may have org linkage depending on your connectOrg behavior
    return String(user?.orgId || user?.OrgId || user?.OrganizationId || user?.organizationId || "").trim();
  }, [user]);

  const memberIdFromSession = useMemo(() => {
    // admin/trainer should have memberId, org owner may also have memberId (your lookupUser ensures owner member record)
    return String(user?.memberId || user?.MemberId || "").trim();
  }, [user]);

  const orgTokenFromSession = useMemo(() => {
    return String(user?.Token || user?.token || user?.["Organization Token"] || "").trim();
  }, [user]);

  /* ------------------------------------------------------------------ */
  /* Initial load + guards                                               */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (!user) {
      // You’re using modal login, so default to home (not /login)
      router.push("/");
    }
  }, [user, router]);

  if (!user) return null;

  /* ------------------------------------------------------------------ */
  /* Form state                                                          */
  /* ------------------------------------------------------------------ */

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    created: "",
    organization: "",
    organizationId: "",
    title: "",
  });

  const [originalData, setOriginalData] = useState({});
  const hasChanges = useRef(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [validation, setValidation] = useState({ email: true, phone: true });

  // Athlete-only: connect org code
  const [orgCode, setOrgCode] = useState("");
  const [orgConnectLoading, setOrgConnectLoading] = useState(false);
  const [orgConnectError, setOrgConnectError] = useState("");
  const [orgConnectOk, setOrgConnectOk] = useState("");

  // Change password modal
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

  // Hydrate initial form data from session user
  useEffect(() => {
    // Created fields vary by table; keep best-effort
    const createdGuess =
      user?.Created ||
      user?.created ||
      user?.CreatedAt ||
      user?.createdAt ||
      user?.createdTime ||
      user?._createdTime ||
      "";

    // Organization display:
    // - Athlete: shows connected org name if present
    // - Org owner: their org name is user.Name (Organizations table)
    // - Staff: orgName from session (OrgName)
    const orgName =
      (isOrgPrimary ? String(user?.Name || user?.name || "Organization") : orgNameFromSession) || "";

    // Organization id:
    // - Org owner: user.id (Organizations record)
    // - Staff: orgId from session
    // - Athlete: org linkage might be stored in user.organizationId / OrganizationId if connectOrg sets it
    const orgId =
      (isOrgPrimary ? String(user?.id || "") : orgIdFromSession) ||
      String(user?.organizationId || user?.OrganizationId || "").trim();

    const initial = {
      name: String(user?.Name || user?.name || ""),
      email: String(user?.Email || user?.email || ""),
      phone: String(user?.["Phone Number"] || user?.phone || ""),
      created: String(createdGuess || ""),
      organization: String(orgName || ""),
      organizationId: String(orgId || ""),
      title: String(user?.Title || user?.title || roleLabel || ""),
    };

    setFormData(initial);
    setOriginalData(initial);

    setValidation({
      email: validateEmail(initial.email),
      phone: validatePhone(initial.phone),
    });

    hasChanges.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isOrgPrimary, roleLabel, orgNameFromSession, orgIdFromSession]);

  const recomputeHasChanges = (nextData) => {
    const keys = Object.keys(originalData || {});
    for (const k of keys) {
      if (["name", "email", "phone"].includes(k)) {
        if (String(nextData?.[k] ?? "") !== String(originalData?.[k] ?? "")) return true;
      }
    }
    return false;
  };

  const onChangeField = (e) => {
    const { name, value } = e.target;

    // Locked fields (org + role)
    if (["organization", "organizationId", "title", "created"].includes(name)) return;

    const next = { ...formData, [name]: value };
    setFormData(next);

    if (name === "email") setValidation((prev) => ({ ...prev, email: validateEmail(value) }));
    if (name === "phone") setValidation((prev) => ({ ...prev, phone: validatePhone(value) }));

    hasChanges.current = recomputeHasChanges(next);
  };

  /* ------------------------------------------------------------------ */
  /* Save profile (Athlete vs Org owner vs Org member)                    */
  /* ------------------------------------------------------------------ */

  const canSave = !saving && hasChanges.current && validation.email && validation.phone;

  const handleSave = async () => {
    if (!canSave) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const updates = {
        Name: formData.name,
        Email: formData.email,
        "Phone Number": formData.phone,
      };

      // Choose endpoint by role (match your current backend)
      let endpoint = "";
      let body = {};
      let method = "PUT";

      if (isAthlete) {
        endpoint = "/api/update-athlete";
        body = { athleteId: user.id, updates };
      } else if (isOrgPrimary) {
        endpoint = "/api/update-organization";
        body = { organizationId: user.id, updates };
      } else if (isOrgMember) {
        // Your org-side update endpoint in this project history varies.
        // The trainers page uses /api/org/members/update (POST).
        endpoint = "/api/org/members/update";
        method = "POST";
        body = {
          memberId: memberIdFromSession || user.id,
          name: updates.Name,
          email: updates.Email,
          role: String(user?.role || user?.Role || "").trim().toLowerCase(), // keep same role
          active: true, // no change here; keeps it explicit
        };
      } else {
        throw new Error("Unsupported role for profile updates.");
      }

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to save changes");

      setMessage("Profile updated successfully!");
      setOriginalData((prev) => ({
        ...prev,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
      }));
      hasChanges.current = false;

      // Keep AuthContext + localStorage in sync for instant UI
      try {
        const nextUser = {
          ...user,
          Name: formData.name,
          Email: formData.email,
          "Phone Number": formData.phone,
        };
        setUser?.(nextUser);
        if (typeof window !== "undefined") localStorage.setItem("user", JSON.stringify(nextUser));
      } catch {}
    } catch (err) {
      console.error("[account] update error:", err);
      setError(err?.message || "Error updating profile");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 2500);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Athlete: connect organization by token                              */
  /* ------------------------------------------------------------------ */

  const connectOrganization = async () => {
    if (!isAthlete) return;

    setOrgConnectError("");
    setOrgConnectOk("");
    setOrgConnectLoading(true);

    try {
      const cleanToken = String(orgCode || "").trim();
      const email = String(user?.Email || user?.email || "").trim().toLowerCase();

      if (!cleanToken) throw new Error("Please enter your organization code.");
      if (!email || !email.includes("@")) throw new Error("Valid email is required. Please log out and log back in.");

      const res = await fetch("/api/athlete/connectOrg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: cleanToken, email }),
      });

      const data = await safeJson(res);

      if (!res.ok) {
        const raw = String(data?.error || data?.message || "Failed to connect organization.");
        const lower = raw.toLowerCase();

        if (lower.includes("invalid") && (lower.includes("code") || lower.includes("token") || lower.includes("organization"))) {
          throw new Error("That organization code doesn’t look right. Double-check and try again.");
        }
        if (lower.includes("not found")) throw new Error("We couldn’t find an organization for that code.");
        if (lower.includes("email")) throw new Error("Valid email is required. Please log out and log back in.");

        throw new Error(raw);
      }

      const newName = String(data?.organization?.name || data?.organization?.Name || "Organization");
      const newId = String(data?.organization?.id || data?.organization?.orgId || data?.organization?.OrgId || "");
      const newOrgToken = String(data?.organization?.token || data?.organization?.Token || "").trim();

      setOrgConnectOk("Organization connected!");
      setOrgCode("");

      setFormData((prev) => ({
        ...prev,
        organization: newName,
        organizationId: newId || prev.organizationId,
      }));
      setOriginalData((prev) => ({
        ...prev,
        organization: newName,
        organizationId: newId || prev.organizationId,
      }));

      // Persist into AuthContext + localStorage so it survives returning to /account
      try {
        const nextUser = {
          ...user,
          OrgName: newName,
          OrganizationName: newName,
          organizationName: newName,
          OrganizationDisplay: newName,
          organizationDisplay: newName,
          ...(newId ? { organizationId: newId, OrganizationId: newId } : {}),
          ...(newOrgToken ? { Token: newOrgToken } : {}),
        };

        setUser?.(nextUser);
        if (typeof window !== "undefined") localStorage.setItem("user", JSON.stringify(nextUser));
      } catch (e) {
        console.warn("[account] failed to persist org info:", e?.message || e);
      }
    } catch (err) {
      console.error("[account] connectOrg error:", err);
      setOrgConnectError(err?.message || "Failed to connect organization.");
    } finally {
      setOrgConnectLoading(false);
      setTimeout(() => setOrgConnectOk(""), 2500);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Password modal                                                      */
  /* ------------------------------------------------------------------ */

  const onPasswordField = (e) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
  };

  const pwScore = scorePassword(passwordData.newPassword);
  const pwLabel = strengthLabel(pwScore);

  const savePassword = async () => {
    setPasswordError("");
    setPasswordMessage("");

    const { currentPassword, newPassword, confirmPassword } = passwordData;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All fields are required.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setPasswordSaving(true);

    try {
      /**
       * Your existing endpoint is /api/update-password and your old payload was athleteId.
       * To support staff/org in the same endpoint, we pass role + id. If your endpoint
       * currently only supports athletes, you can either:
       *  - extend it to handle org/staff by role, OR
       *  - add /api/org/update-password for staff and switch here.
       *
       * This payload is the “future-proof” version:
       */
      const payload = {
        role, // "athlete" | "organization" | "admin" | "trainer"
        currentPassword,
        newPassword,
        athleteId: isAthlete ? user.id : undefined,
        organizationId: isOrgPrimary ? user.id : undefined,
        memberId: isOrgMember ? (memberIdFromSession || user.id) : undefined,
        orgId: isOrgMember ? (orgIdFromSession || formData.organizationId || "") : undefined,
      };

      const res = await fetch("/api/update-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Password update failed");

      setPasswordMessage("Password updated successfully!");
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });

      setTimeout(() => setPasswordMessage(""), 2500);
    } catch (err) {
      console.error("[account] password error:", err);
      setPasswordError(err?.message || "Failed to update password");
    } finally {
      setPasswordSaving(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Locked organization display                                         */
  /* ------------------------------------------------------------------ */

  const organizationDisplay = useMemo(() => {
    if (isAthlete) return formData.organization?.trim() ? formData.organization : "Not connected";
    if (isOrgPrimary) return String(user?.Name || user?.name || "Your organization");
    if (isOrgMember) {
      if (formData.organization?.trim()) return formData.organization;
      if (orgNameFromSession) return orgNameFromSession;
      if (orgIdFromSession || formData.organizationId) return "Connected organization";
      return "Organization";
    }
    return formData.organization?.trim() ? formData.organization : "Organization";
  }, [
    isAthlete,
    isOrgPrimary,
    isOrgMember,
    formData.organization,
    formData.organizationId,
    user,
    orgNameFromSession,
    orgIdFromSession,
  ]);

  const dashboardHref = isOrgSide ? "/org/dashboard" : "/dashboard";

  /* ------------------------------------------------------------------ */
  /* Org-side: copy code UX                                              */
  /* ------------------------------------------------------------------ */

  const [copyOk, setCopyOk] = useState("");

  const copyOrgCode = async () => {
    setCopyOk("");
    try {
      const token = String(orgTokenFromSession || "").trim();
      if (!token) throw new Error("No organization code found in session.");
      await navigator.clipboard.writeText(token);
      setCopyOk("Copied organization code.");
      setTimeout(() => setCopyOk(""), 2500);
    } catch (e) {
      setCopyOk(e?.message || "Unable to copy.");
      setTimeout(() => setCopyOk(""), 2500);
    }
  };

  /* ------------------------------------------------------------------ */
  /* UI classes                                                          */
  /* ------------------------------------------------------------------ */

  const labelBase = "block text-gray-800 font-medium mb-1";
  const inputBase =
    "w-full border border-gray-200 rounded-2xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30 transition text-gray-900 placeholder:text-gray-400";
  const readOnlyBase = "w-full border border-gray-200 rounded-2xl px-4 py-2 bg-gray-50 text-gray-700";
  const sectionCard = "bg-white p-8 rounded-3xl shadow-md border border-blue-100 space-y-6";
  const pill = "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold";

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
                <span className={classNames(pill, "bg-blue-50 text-[#46769B]")}>{roleLabel}</span>
                {formData.email ? (
                  <span className={classNames(pill, "bg-gray-50 text-gray-700 truncate max-w-[260px]")}>
                    {formData.email}
                  </span>
                ) : null}
                {isOrgMember && memberIdFromSession ? (
                  <span className={classNames(pill, "bg-gray-50 text-gray-700")}>Member</span>
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
              {isOrgSide ? (
                <Link href="/org/trainers" className="text-sm font-semibold text-gray-600 hover:underline">
                  Trainers
                </Link>
              ) : null}
            </div>
          </div>

          {/* Feedback */}
          <AnimatePresence>
            {(message || error) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={classNames(
                  "text-center text-sm font-medium py-3 px-4 rounded-2xl border",
                  message
                    ? "bg-emerald-50 text-emerald-800 border-emerald-100"
                    : "bg-red-50 text-red-700 border-red-100"
                )}
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
                  onChange={onChangeField}
                  className={inputBase}
                  placeholder="Your name"
                />
                {isOrgPrimary ? (
                  <p className="text-[11px] text-gray-500 mt-2">
                    Organization owners may see this as the organization name (depending on your Organizations table).
                  </p>
                ) : null}
              </div>

              {/* Email */}
              <div>
                <label className={labelBase}>Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={onChangeField}
                  className={classNames(inputBase, validation.email ? "" : "border-red-300 focus:ring-red-200")}
                  placeholder="you@example.com"
                />
                {!validation.email ? <p className="text-red-600 text-xs mt-1">Invalid email format</p> : null}
              </div>

              {/* Phone */}
              <div>
                <label className={labelBase}>Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={onChangeField}
                  className={classNames(inputBase, validation.phone ? "" : "border-red-300 focus:ring-red-200")}
                  placeholder="+15551234567 (optional)"
                />
                {!validation.phone ? (
                  <p className="text-red-600 text-xs mt-1">Invalid phone number (digits, optional +, 7–15 chars).</p>
                ) : null}
              </div>

              {/* Created */}
              <div>
                <label className={labelBase}>Created</label>
                <input type="text" name="created" value={formData.created || "—"} readOnly className={readOnlyBase} />
              </div>
            </div>
          </div>

          {/* Organization & Role */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Organization</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelBase}>Organization (locked)</label>
                <input type="text" name="organization" value={organizationDisplay} readOnly className={readOnlyBase} />
                <p className="text-[11px] text-gray-500 mt-2">
                  This field is verified. Athletes can only connect via an organization code.
                </p>

                {isOrgSide && (orgIdFromSession || formData.organizationId) ? (
                  <p className="text-[11px] text-gray-400 mt-1 truncate">
                    Org ID: {String(orgIdFromSession || formData.organizationId)}
                  </p>
                ) : null}
              </div>

              <div>
                <label className={labelBase}>Title / Role</label>
                <input type="text" name="title" value={formData.title || roleLabel} readOnly className={readOnlyBase} />
                <p className="text-[11px] text-gray-500 mt-2">Role is set by your account type and can’t be edited here.</p>

                {isOrgMember && memberIdFromSession ? (
                  <p className="text-[11px] text-gray-400 mt-1 truncate">Member ID: {String(memberIdFromSession)}</p>
                ) : null}
              </div>
            </div>

            {/* Athlete-only: connect org code */}
            {isAthlete ? (
              <div className="rounded-3xl border border-gray-200 bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Connect to an organization</p>
                    <p className="text-[12px] text-gray-500 mt-1">
                      Enter the organization code provided by your coach/team. We’ll verify it and connect your account.
                    </p>
                  </div>

                  <span className={classNames(pill, "bg-blue-50 text-[#46769B] text-[11px]")}>Verified by code</span>
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
                    className={classNames(
                      "px-5 py-2 rounded-2xl font-semibold shadow-sm transition",
                      orgConnectLoading || !orgCode.trim()
                        ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                        : "bg-[#46769B] text-white hover:brightness-110"
                    )}
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
            ) : null}

            {/* Org-side: show org code + copy button */}
            {isOrgSide ? (
              <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">Organization code</p>
                    <p className="text-[12px] text-gray-600 mt-1">
                      Share this code with athletes so they can connect to your team.
                    </p>

                    <div className="mt-3">
                      <label className="text-[11px] font-semibold text-gray-600">Code (from session)</label>
                      <input
                        type="text"
                        value={orgTokenFromSession ? orgTokenFromSession : "—"}
                        readOnly
                        className={classNames(readOnlyBase, "mt-2 font-mono")}
                        onFocus={(e) => e.target.select()}
                      />
                      <p className="text-[11px] text-gray-500 mt-2">
                        If this is “—”, your session cookie may be missing Token. Log out & log back in.
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={copyOrgCode}
                      disabled={!orgTokenFromSession}
                      className={classNames(
                        "px-4 py-2 rounded-2xl font-semibold transition",
                        orgTokenFromSession ? "bg-[#46769B] text-white hover:brightness-110" : "bg-gray-200 text-gray-500"
                      )}
                    >
                      Copy
                    </button>

                    {copyOk ? (
                      <div className="text-[11px] text-gray-600 text-right">{copyOk}</div>
                    ) : (
                      <div className="text-[11px] text-gray-400 text-right"> </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href="/org/trainers"
                    className="inline-flex items-center rounded-2xl px-4 py-2 bg-white border border-gray-200 text-gray-800 font-semibold hover:bg-gray-50 transition"
                  >
                    Manage team (Trainers)
                  </Link>
                  <Link
                    href="/org/dashboard"
                    className="inline-flex items-center rounded-2xl px-4 py-2 bg-white border border-gray-200 text-gray-800 font-semibold hover:bg-gray-50 transition"
                  >
                    Back to Org Dashboard
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          {/* Actions */}
          <div className="mt-2 space-y-3">
            <button
              onClick={handleSave}
              disabled={!canSave}
              className={classNames(
                "w-full py-3 rounded-2xl text-white font-semibold shadow-md transition",
                canSave ? "bg-[#46769B] hover:brightness-110" : "bg-gray-200 text-gray-500 cursor-not-allowed shadow-none"
              )}
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
              onClick={async () => {
                try {
                  await logout?.();
                } finally {
                  router.push("/");
                }
              }}
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
                  <p className="text-[12px] text-gray-600 mt-1">Use a strong password you don’t reuse elsewhere.</p>
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
                      onChange={onPasswordField}
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
                      onChange={onPasswordField}
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
                    <p className="mt-2 text-[11px] text-gray-500">Tip: Use 12+ characters and mix letters, numbers, and symbols.</p>
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
                      onChange={onPasswordField}
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

                  {passwordData.confirmPassword.length > 0 && passwordData.newPassword !== passwordData.confirmPassword ? (
                    <p className="mt-2 text-xs text-red-600">Passwords don’t match yet.</p>
                  ) : null}

                  {passwordData.confirmPassword.length > 0 &&
                  passwordData.newPassword === passwordData.confirmPassword &&
                  passwordData.newPassword.length >= 8 ? (
                    <p className="mt-2 text-xs text-emerald-700">Passwords match ✅</p>
                  ) : null}
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
                  className={classNames(
                    "px-4 py-2 rounded-2xl text-white font-semibold shadow-sm transition",
                    passwordSaving ? "bg-gray-300 cursor-not-allowed" : "bg-[#46769B] hover:brightness-110"
                  )}
                >
                  {passwordSaving ? "Saving..." : "Save"}
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs">
                <Link href="/" className="text-gray-500 hover:underline" onClick={() => setShowPasswordModal(false)}>
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
