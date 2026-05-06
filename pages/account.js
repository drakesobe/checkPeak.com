// pages/account.js
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";

import AccountShell      from "@/components/account/AccountShell";
import HeaderBlock       from "@/components/account/HeaderBlock";
import FeedbackBanner    from "@/components/account/FeedbackBanner";
import PersonalInfoSection from "@/components/account/PersonalInfoSection";
import OrganizationSection from "@/components/account/OrganizationSection";
import BillingSection    from "@/components/account/BillingSection";
import ActionsSection    from "@/components/account/ActionsSection";
import ChangePasswordModal from "@/components/account/ChangePasswordModal";
import DeleteAccountModal  from "@/components/account/DeleteAccountModal";

/* ---------------------------- shared helpers ---------------------------- */

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
  if (role === "admin")        return "Admin";
  if (role === "trainer")      return "Trainer";
  if (role === "athlete")      return "Athlete";
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
  if (p.length >= 8)           score += 1;
  if (p.length >= 12)          score += 1;
  if (/[A-Z]/.test(p))        score += 1;
  if (/[0-9]/.test(p))        score += 1;
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
  try   { return await res.json(); }
  catch { return {}; }
}

/* ---------------------------- Wrapper (safe early returns) ---------------------------- */

export default function AccountPage() {
  const router = useRouter();
  const { user } = useAuthContext();

  useEffect(() => {
    if (!user) router.push("/");
  }, [user, router]);

  if (!user) {
    return (
      <AccountShell>
        <div className="text-sm text-gray-600">Loading account…</div>
      </AccountShell>
    );
  }

  return <AccountInner user={user} />;
}

/* ---------------------------- Inner ---------------------------- */

function AccountInner({ user }) {
  const router = useRouter();
  const { logout, setUser } = useAuthContext();

  const role      = useMemo(() => normalizeRole(user?.role || user?.Role), [user]);
  const roleLabel = useMemo(() => roleLabelOf(role), [role]);

  const isAthlete    = role === "athlete";
  const isOrgPrimary = role === "organization";
  const isOrgMember  = role === "admin" || role === "trainer";
  const isOrgSide    = isOrgPrimary || isOrgMember;

  const orgNameFromSession = useMemo(() => String(
    user?.OrgName || user?.OrganizationName || user?.organizationName ||
    user?.["Organization Name"] || user?.OrganizationDisplay || user?.organizationDisplay || ""
  ).trim(), [user]);

  const orgIdFromSession = useMemo(() =>
    String(user?.orgId || user?.OrgId || user?.OrganizationId || user?.organizationId || "").trim()
  , [user]);

  const memberIdFromSession = useMemo(() =>
    String(user?.memberId || user?.MemberId || "").trim()
  , [user]);

  const orgTokenFromSession = useMemo(() =>
    String(user?.Token || user?.token || user?.["Organization Token"] || "").trim()
  , [user]);

  /* ---------------------------- profile state ---------------------------- */

  const [formData, setFormData] = useState({
    name: "", email: "", phone: "", created: "", organization: "", organizationId: "", title: "",
  });
  const [originalData,  setOriginalData]  = useState({});
  const [profileDirty,  setProfileDirty]  = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [message,       setMessage]       = useState("");
  const [error,         setError]         = useState("");
  const [validation,    setValidation]    = useState({ email: true, phone: true });

  // Athlete connect org
  const [orgCode,           setOrgCode]           = useState("");
  const [orgConnectLoading, setOrgConnectLoading] = useState(false);
  const [orgConnectError,   setOrgConnectError]   = useState("");
  const [orgConnectOk,      setOrgConnectOk]      = useState("");

  // Athlete org hydrate
  const [orgHydrating,   setOrgHydrating]   = useState(false);
  const [orgHydrateError,setOrgHydrateError]= useState("");

  // Change password modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData,      setPasswordData]      = useState({
    currentPassword: "", newPassword: "", confirmPassword: "",
  });
  const [passwordError,   setPasswordError]   = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordSaving,  setPasswordSaving]  = useState(false);

  // ── Delete account modal ────────────────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Billing
  const [billingDirty, setBillingDirty] = useState(false);
  const billingSaveRef = useRef(null);

  // hydrate initial values
  useEffect(() => {
    const createdGuess =
      user?.Created || user?.created || user?.CreatedAt || user?.createdAt ||
      user?.createdTime || user?._createdTime || "";

    const orgName = (isOrgPrimary ? String(user?.Name || user?.name || "Organization") : orgNameFromSession) || "";
    const orgId   = (isOrgPrimary ? String(user?.id || "") : orgIdFromSession) ||
                    String(user?.organizationId || user?.OrganizationId || "").trim();

    const initial = {
      name:           String(user?.Name || user?.name || ""),
      email:          String(user?.Email || user?.email || ""),
      phone:          String(user?.["Phone Number"] || user?.phone || ""),
      created:        String(createdGuess || ""),
      organization:   String(orgName || ""),
      organizationId: String(orgId || ""),
      title:          String(user?.Title || user?.title || roleLabel || ""),
    };

    setFormData(initial);
    setOriginalData(initial);
    setValidation({ email: validateEmail(initial.email), phone: validatePhone(initial.phone) });
    setProfileDirty(false);
  }, [user, isOrgPrimary, roleLabel, orgNameFromSession, orgIdFromSession]);

  // Athlete org hydrate
  useEffect(() => {
    if (!isAthlete) return;
    const missingOrgName = !String(formData.organization || "").trim();
    const missingOrgId   = !String(formData.organizationId || "").trim();
    if (!missingOrgName && !missingOrgId) return;

    let cancelled = false;
    setOrgHydrating(true);
    setOrgHydrateError("");

    (async () => {
      try {
        const res  = await fetch("/api/athlete/account/org", { method: "GET", credentials: "include" });
        const data = await safeJson(res);
        if (cancelled) return;
        if (!res.ok) { setOrgHydrateError("Could not load organization info."); return; }

        const newName  = String(data?.org?.name  || "").trim();
        const newId    = String(data?.org?.id    || "").trim();
        const newToken = String(data?.org?.token || "").trim();

        if (newName || newId) {
          setFormData(prev => ({ ...prev, organization: newName || prev.organization, organizationId: newId || prev.organizationId }));
          setOriginalData(prev => ({ ...prev, organization: newName || prev.organization, organizationId: newId || prev.organizationId }));
          try {
            const nextUser = {
              ...user,
              OrgName: newName || user?.OrgName, OrganizationName: newName || user?.OrganizationName,
              organizationName: newName || user?.organizationName,
              OrganizationDisplay: newName || user?.OrganizationDisplay,
              organizationDisplay: newName || user?.organizationDisplay,
              ...(newId    ? { organizationId: newId, OrganizationId: newId } : {}),
              ...(newToken ? { Token: newToken }                               : {}),
            };
            setUser?.(nextUser);
            if (typeof window !== "undefined") localStorage.setItem("user", JSON.stringify(nextUser));
          } catch {}
        }
      } catch (e) {
        if (!cancelled) { console.warn("[account] org hydrate failed:", e); setOrgHydrateError("Could not load organization info."); }
      } finally {
        if (!cancelled) setOrgHydrating(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAthlete, user?.id]);

  const recomputeHasChanges = (nextData) => {
    for (const k of Object.keys(originalData || {})) {
      if (["name", "email", "phone"].includes(k)) {
        if (String(nextData?.[k] ?? "") !== String(originalData?.[k] ?? "")) return true;
      }
    }
    return false;
  };

  const onChangeField = (name, value) => {
    if (["organization", "organizationId", "title", "created"].includes(name)) return;
    const next = { ...formData, [name]: value };
    setFormData(next);
    if (name === "email") setValidation(prev => ({ ...prev, email: validateEmail(value) }));
    if (name === "phone") setValidation(prev => ({ ...prev, phone: validatePhone(value) }));
    setProfileDirty(recomputeHasChanges(next));
  };

  const canSaveProfile = !saving && profileDirty && validation.email && validation.phone;

  const handleSaveProfile = useCallback(async () => {
    if (!canSaveProfile) return { ok: false, skipped: true };

    const updates = { Name: formData.name, Email: formData.email, "Phone Number": formData.phone };
    let endpoint = "", body = {}, method = "PUT";

    if (isAthlete) {
      endpoint = "/api/update-athlete";
      body = { athleteId: user.id, updates };
    } else if (isOrgPrimary) {
      endpoint = "/api/update-organization";
      body = { organizationId: user.id, updates };
    } else if (isOrgMember) {
      endpoint = "/api/org/members/update"; method = "POST";
      body = { memberId: memberIdFromSession || user.id, name: updates.Name, email: updates.Email,
               role: String(user?.role || user?.Role || "").trim().toLowerCase(), active: true };
    } else {
      throw new Error("Unsupported role for profile updates.");
    }

    const res  = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.error || "Failed to save profile changes");

    setOriginalData(prev => ({ ...prev, name: formData.name, email: formData.email, phone: formData.phone }));
    setProfileDirty(false);

    try {
      const nextUser = { ...user, Name: formData.name, Email: formData.email, "Phone Number": formData.phone };
      setUser?.(nextUser);
      if (typeof window !== "undefined") localStorage.setItem("user", JSON.stringify(nextUser));
    } catch {}

    return { ok: true };
  }, [canSaveProfile, profileDirty, formData, isAthlete, isOrgMember, isOrgPrimary, memberIdFromSession, setUser, user]);

  const canSaveAll = (() => {
    const canSaveBilling   = Boolean(billingSaveRef.current) && billingDirty;
    const canSaveSomething = canSaveProfile || canSaveBilling;
    return !saving && canSaveSomething && validation.email && validation.phone;
  })();

  const saveLabel = (() => {
    const p = canSaveProfile;
    const b = billingDirty && Boolean(billingSaveRef.current);
    if (p && b) return "Save Profile + Billing";
    if (b)      return "Save Billing";
    return "Save Changes";
  })();

  const onSaveAll = async () => {
    if (!canSaveAll || saving) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const prof = await handleSaveProfile();
      let bill = { ok: false, skipped: true };
      if (billingDirty && typeof billingSaveRef.current === "function") bill = await billingSaveRef.current();
      if (prof?.ok || bill?.ok) {
        setMessage("Saved successfully!"); setTimeout(() => setMessage(""), 2500);
      } else {
        setMessage("No changes to save."); setTimeout(() => setMessage(""), 1500);
      }
    } catch (e) {
      console.error("[account] save all error:", e);
      setError(e?.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  /* ---------------------------- athlete connect org ---------------------------- */

  const connectOrganization = async () => {
    if (!isAthlete) return;
    setOrgConnectError(""); setOrgConnectOk(""); setOrgConnectLoading(true);
    try {
      const cleanToken = String(orgCode || "").trim();
      const email      = String(user?.Email || user?.email || "").trim().toLowerCase();
      if (!cleanToken)                      throw new Error("Please enter your organization code.");
      if (!email || !email.includes("@"))   throw new Error("Valid email is required. Please log out and log back in.");

      const res  = await fetch("/api/athlete/connectOrg", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ token: cleanToken, email }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(String(data?.error || data?.message || "Failed to connect organization."));

      const newName     = String(data?.organization?.name  || data?.organization?.Name  || "Organization");
      const newId       = String(data?.organization?.id    || data?.organization?.orgId || data?.organization?.OrgId || "");
      const newOrgToken = String(data?.organization?.token || data?.organization?.Token || "").trim();

      setOrgConnectOk("Organization connected!"); setOrgCode("");
      setFormData(prev => ({ ...prev, organization: newName, organizationId: newId || prev.organizationId }));
      setOriginalData(prev => ({ ...prev, organization: newName, organizationId: newId || prev.organizationId }));

      try {
        const nextUser = {
          ...user, OrgName: newName, OrganizationName: newName, organizationName: newName,
          OrganizationDisplay: newName, organizationDisplay: newName,
          ...(newId       ? { organizationId: newId, OrganizationId: newId } : {}),
          ...(newOrgToken ? { Token: newOrgToken }                           : {}),
        };
        setUser?.(nextUser);
        if (typeof window !== "undefined") localStorage.setItem("user", JSON.stringify(nextUser));
      } catch {}
    } catch (err) {
      console.error("[account] connectOrg error:", err);
      setOrgConnectError(err?.message || "Failed to connect organization.");
    } finally {
      setOrgConnectLoading(false);
      setTimeout(() => setOrgConnectOk(""), 2500);
    }
  };

  /* ---------------------------- org code copy ---------------------------- */

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

  /* ---------------------------- password modal ---------------------------- */

  const onPasswordField = (name, value) => setPasswordData(prev => ({ ...prev, [name]: value }));
  const pwScore = scorePassword(passwordData.newPassword);
  const pwLabel = strengthLabel(pwScore);

  const savePassword = async () => {
    setPasswordError(""); setPasswordMessage("");
    const { currentPassword, newPassword, confirmPassword } = passwordData;
    if (!currentPassword || !newPassword || !confirmPassword) return setPasswordError("All fields are required.");
    if (newPassword.length < 8)    return setPasswordError("New password must be at least 8 characters.");
    if (newPassword !== confirmPassword) return setPasswordError("New passwords do not match.");
    setPasswordSaving(true);
    try {
      const payload = {
        role, currentPassword, newPassword,
        athleteId:      isAthlete    ? user.id                          : undefined,
        organizationId: isOrgPrimary ? user.id                          : undefined,
        memberId:       isOrgMember  ? (memberIdFromSession || user.id) : undefined,
        orgId:          isOrgMember  ? (orgIdFromSession || formData.organizationId || "") : undefined,
      };
      const res  = await fetch("/api/update-password", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(payload),
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

  /* ---------------------------- derived displays ---------------------------- */

  const organizationDisplay = useMemo(() => {
    if (isAthlete)    return formData.organization?.trim() ? formData.organization : "Not connected";
    if (isOrgPrimary) return String(user?.Name || user?.name || "Your organization");
    if (isOrgMember) {
      if (formData.organization?.trim()) return formData.organization;
      if (orgNameFromSession)            return orgNameFromSession;
      if (orgIdFromSession || formData.organizationId) return "Connected organization";
      return "Organization";
    }
    return formData.organization?.trim() ? formData.organization : "Organization";
  }, [isAthlete, isOrgPrimary, isOrgMember, formData.organization, formData.organizationId, user, orgNameFromSession, orgIdFromSession]);

  const dashboardHref  = isOrgSide ? "/org/workouts-calendar" : "/dashboard";
  const canSeeBilling  = role === "admin" || role === "organization";

  /* ---------------------------- render ---------------------------- */

  return (
    <AccountShell>
      <div className="space-y-6">
        <HeaderBlock
          roleLabel={roleLabel}
          email={formData.email}
          isOrgMember={isOrgMember}
          memberId={memberIdFromSession}
          dashboardHref={dashboardHref}
          isOrgSide={isOrgSide}
        />

        <FeedbackBanner message={message} error={error} />

        <PersonalInfoSection
          formData={formData}
          validation={validation}
          isOrgPrimary={isOrgPrimary}
          onChangeField={onChangeField}
        />

        <OrganizationSection
          isAthlete={isAthlete}
          isOrgSide={isOrgSide}
          isOrgMember={isOrgMember}
          organizationDisplay={organizationDisplay}
          orgId={orgIdFromSession || formData.organizationId}
          roleLabel={roleLabel}
          titleValue={formData.title || roleLabel}
          memberId={memberIdFromSession}
          orgToken={orgTokenFromSession}
          copyOk={copyOk}
          onCopyOrgCode={copyOrgCode}
          orgCode={orgCode}
          setOrgCode={setOrgCode}
          orgConnectLoading={orgConnectLoading}
          orgConnectError={orgConnectError}
          orgConnectOk={orgConnectOk}
          onConnectOrganization={connectOrganization}
          orgHydrating={orgHydrating}
          orgHydrateError={orgHydrateError}
        />

        {canSeeBilling ? (
          <BillingSection
            orgId={orgIdFromSession || formData.organizationId || ""}
            memberId={memberIdFromSession || ""}
            role={role}
            onDirtyChange={(dirty) => setBillingDirty(Boolean(dirty))}
            onRegisterSave={(fn) => { billingSaveRef.current = fn; }}
          />
        ) : null}

        <ActionsSection
          canSave={canSaveAll}
          saving={saving}
          saveLabel={saveLabel}
          onSaveAll={onSaveAll}
          onOpenPassword={() => {
            setPasswordError(""); setPasswordMessage(""); setShowPasswordModal(true);
          }}
          onLogout={async () => {
            try { await logout?.(); } finally { router.push("/"); }
          }}
        />

        {/* ── Delete account - athletes only ─────────────────────────────── */}
        {isAthlete && (
          <div style={{ paddingTop: "8px", textAlign: "center" }}>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              style={{
                background:      "transparent",
                border:          "none",
                padding:         "4px 0",
                color:           "rgba(220,38,38,0.65)",
                fontSize:        "13px",
                fontWeight:      600,
                cursor:          "pointer",
                textDecoration:  "underline",
                textUnderlineOffset: "2px",
                fontFamily:      "inherit",
              }}
              onMouseEnter={e => { e.currentTarget.style.color = "#DC2626"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "rgba(220,38,38,0.65)"; }}
            >
              Delete account
            </button>
          </div>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}

      <ChangePasswordModal
        open={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        inputBase="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/25 transition text-gray-900 placeholder:text-gray-400"
        passwordData={passwordData}
        onField={onPasswordField}
        pwScore={pwScore}
        pwLabel={pwLabel}
        saving={passwordSaving}
        error={passwordError}
        message={passwordMessage}
        onSave={savePassword}
      />

      <DeleteAccountModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        athleteId={user?.id}
      />
    </AccountShell>
  );
}