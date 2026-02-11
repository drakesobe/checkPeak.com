// pages/org/trainers.js
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/hooks/useAuth";
import {
  RefreshCcw,
  LogOut,
  Users,
  Search,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  X,
  UserPlus,
  Trash2,
  Mail,
  ArrowRight,
  Edit3,
  Save,
  Ban,
  Copy,
  Send,
  ExternalLink,
} from "lucide-react";

/* -------------------------------- Helpers -------------------------------- */

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(value) {
  const d = safeDate(value);
  if (!d) return value ? String(value) : "";
  return d.toLocaleString();
}

function buildInviteEmail({ orgName, inviterName, inviteeEmail, role, inviteUrl, expiresAt }) {
  const roleLabel = String(role || "trainer").toLowerCase() === "admin" ? "Head Trainer (Admin)" : "Trainer";
  const subject = `${orgName}: Set up your ${roleLabel} access`;

  const expiryLine = expiresAt ? `This link expires: ${expiresAt}\n\n` : "";

  const body =
    `Hi,\n\n` +
    `${inviterName || orgName} has invited you to join ${orgName} as a ${roleLabel}.\n\n` +
    `Set your password and activate your access here:\n` +
    `${inviteUrl}\n\n` +
    expiryLine +
    `If you weren’t expecting this invite, you can ignore this email.\n\n` +
    `Thanks,\n` +
    `${inviterName || orgName}\n`;

  return { to: inviteeEmail, subject, body };
}

function encodeMailto({ to, subject, body }) {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  return `mailto:${encodeURIComponent(to)}?${params.toString()}`;
}

async function copyToClipboard(text) {
  await navigator.clipboard.writeText(String(text || ""));
}

function Pill({ children, tone = "neutral" }) {
  const toneCls =
    tone === "warn"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : tone === "bad"
      ? "bg-red-50 text-red-800 border-red-200"
      : tone === "good"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <span
      className={classNames(
        "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border",
        toneCls
      )}
    >
      {children}
    </span>
  );
}

function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  className = "",
  title = "",
  type = "button",
}) {
  const base =
    "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition";
  const styles =
    variant === "primary"
      ? "bg-[#46769B] text-white hover:brightness-110"
      : variant === "dark"
      ? "bg-gray-900 text-white hover:opacity-90"
      : "bg-white text-gray-800 border border-gray-200 hover:bg-gray-50";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={classNames(
        base,
        styles,
        disabled ? "opacity-70 cursor-not-allowed" : "",
        className
      )}
      type={type}
    >
      {children}
    </button>
  );
}

function Modal({ open, title, children, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        role="button"
        tabIndex={0}
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-gray-200">
          <div className="p-5 border-b flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-lg font-extrabold text-gray-900 truncate">{title}</p>
              <p className="text-[12px] text-gray-500 mt-1">Manage org-side access (Admin/Trainer).</p>
            </div>
            <button
              className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50"
              onClick={onClose}
              type="button"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

function roleTone(role) {
  const r = String(role || "").toLowerCase();
  if (r === "admin") return "good";
  if (r === "trainer") return "neutral";
  return "neutral";
}

function statusTone(active) {
  return active ? "good" : "warn";
}

/* -------------------------------- Page ----------------------------------- */

export default function TrainersPage() {
  const router = useRouter();
  const { user, logout } = useAuthContext();

  // Role normalization: organization | admin | trainer | athlete | ""
  const role = useMemo(() => {
    const r = String(user?.role || user?.Role || "").trim().toLowerCase();
    if (!r) return "";
    if (r === "organization") return "organization";
    if (r === "admin") return "admin";
    if (r === "trainer") return "trainer";
    if (r.includes("org")) return "organization";
    if (r.includes("admin")) return "admin";
    if (r.includes("train")) return "trainer";
    if (r.includes("ath")) return "athlete";
    return r;
  }, [user]);

  const isOrgSide = role === "organization" || role === "admin" || role === "trainer";
  const canManageMembers = role === "organization" || role === "admin"; // trainers view only

  const orgName = useMemo(() => {
    const guess =
      user?.OrgName ||
      user?.["Organization Name"] ||
      user?.OrganizationName ||
      user?.organizationName ||
      user?.Organization ||
      (role === "organization" ? (user?.Name || user?.name) : "") ||
      "Organization";
    return String(guess || "Organization");
  }, [user, role]);

  const orgEmail = useMemo(() => String(user?.Email || user?.email || ""), [user]);

  const orgToken = useMemo(() => {
    return String(user?.Token || user?.token || user?.["Organization Token"] || "").trim();
  }, [user]);

  const orgId = useMemo(() => {
    return String(user?.orgId || user?.OrgId || "").trim();
  }, [user]);

  const inviterName = useMemo(() => {
    return String(user?.Name || user?.name || "").trim();
  }, [user]);

  // Guards
  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    if (role && !isOrgSide) {
      router.push("/dashboard");
      return;
    }
  }, [user, role, isOrgSide, router]);

  // Data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [trainers, setTrainers] = useState([]);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("trainer");
  const [inviteErr, setInviteErr] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteOk, setInviteOk] = useState("");

  // Invite result (setup link + draft)
  const [setupUrl, setSetupUrl] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [setupRole, setSetupRole] = useState("");
  const [setupEmail, setSetupEmail] = useState("");

  // UI
  const [search, setSearch] = useState("");

  // Remove modal
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removeErr, setRemoveErr] = useState("");
  const [removeBusy, setRemoveBusy] = useState(false);

  // Inline edit
  const [editRow, setEditRow] = useState(null); // { id, name, email, role, active }
  const [savingId, setSavingId] = useState("");
  const [saveErr, setSaveErr] = useState("");
  const [saveOk, setSaveOk] = useState("");

  const inputBase =
    "w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]";

  const clearAlerts = () => {
    setError("");
    setInviteErr("");
    setInviteOk("");
    setSaveErr("");
    setSaveOk("");
    setRemoveErr("");
  };

  const refreshTrainers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/org/members/list", {
        method: "GET",
        credentials: "include",
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to load trainers");

      const raw = Array.isArray(data?.trainers) ? data.trainers : [];

      const normalized = raw.map((t) => ({
        ...t,
        id: t?.id,
        Name: t?.Name ?? t?.name ?? "",
        Email: t?.Email ?? t?.email ?? "",
        Role: t?.Role ?? t?.role ?? "trainer",
        Active:
          typeof t?.Active === "boolean"
            ? t.Active
            : typeof t?.active === "boolean"
            ? t.active
            : true,
        createdAt: t?.createdAt || t?.CreatedAt || t?.createdTime || t?._createdTime || "",
      }));

      setTrainers(normalized);
    } catch (err) {
      console.error("[org/trainers] refreshTrainers error:", err);
      setError(err?.message || "Failed to load trainers.");
      setTrainers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!isOrgSide) return;
    refreshTrainers();
  }, [user, isOrgSide, refreshTrainers]);

  const filtered = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    let list = Array.isArray(trainers) ? [...trainers] : [];

    if (q) {
      list = list.filter((t) => {
        const hay = [t?.Name, t?.Email, t?.Role, t?.Active ? "active" : "inactive"]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    list.sort((a, b) => {
      const ar = String(a?.Role || "").toLowerCase();
      const br = String(b?.Role || "").toLowerCase();
      const scoreRole = (r) => (r === "admin" ? 2 : r === "trainer" ? 1 : 0);
      const roleDiff = scoreRole(br) - scoreRole(ar);
      if (roleDiff !== 0) return roleDiff;

      const aActive = !!a?.Active;
      const bActive = !!b?.Active;
      if (aActive !== bActive) return aActive ? -1 : 1;

      const ae = normalizeEmail(a?.Email);
      const be = normalizeEmail(b?.Email);
      return ae.localeCompare(be);
    });

    return list;
  }, [trainers, search]);

  const counts = useMemo(() => {
    const list = Array.isArray(trainers) ? trainers : [];
    const admins = list.filter((t) => String(t?.Role || "").toLowerCase() === "admin").length;
    const coaches = list.filter((t) => String(t?.Role || "").toLowerCase() === "trainer").length;
    const inactive = list.filter((t) => !t?.Active).length;
    const total = list.length;
    return { admins, coaches, inactive, total };
  }, [trainers]);

  const onLogout = async () => {
    try {
      await logout?.();
    } finally {
      router.push("/");
    }
  };

  /* ----------------------------- Invite (creates setup link + opens email) ----------------------------- */

  const openEmailDraftForLastInvite = () => {
    if (!setupUrl || !setupEmail) return;
    const draft = buildInviteEmail({
      orgName,
      inviterName,
      inviteeEmail: setupEmail,
      role: setupRole || "trainer",
      inviteUrl: setupUrl,
      expiresAt,
    });
    const mailto = encodeMailto(draft);
    window.location.href = mailto; // ✅ default mail handler
  };

  const copyEmailDraftForLastInvite = async () => {
    if (!setupUrl || !setupEmail) return;
    const draft = buildInviteEmail({
      orgName,
      inviterName,
      inviteeEmail: setupEmail,
      role: setupRole || "trainer",
      inviteUrl: setupUrl,
      expiresAt,
    });
    await copyToClipboard(`Subject: ${draft.subject}\n\n${draft.body}`);
    setInviteOk("Copied email draft.");
    setTimeout(() => setInviteOk(""), 2500);
  };

  const sendInvite = async () => {
    clearAlerts();
    setSetupUrl("");
    setExpiresAt("");
    setSetupRole("");
    setSetupEmail("");

    if (!canManageMembers) {
      setInviteErr("Only Organization/Admin can invite members.");
      return;
    }

    const email = normalizeEmail(inviteEmail);
    if (!email || !email.includes("@")) {
      setInviteErr("Enter a valid email.");
      return;
    }

    const r = String(inviteRole || "trainer").toLowerCase();
    if (r !== "trainer" && r !== "admin") {
      setInviteErr("Role must be trainer or admin.");
      return;
    }

    setInviteSending(true);
    try {
      const res = await fetch("/api/org/members/invite", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          role: r,
          name: String(inviteName || "").trim() || undefined,
        }),
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to create invite.");

      const url = String(data?.inviteUrl || data?.setupUrl || "");
      const exp = String(data?.expiresAt || data?.inviteExpiresAt || "");

      setInviteEmail("");
      setInviteName("");
      setInviteRole("trainer");

      setSetupUrl(url);
      setExpiresAt(exp);
      setSetupRole(r);
      setSetupEmail(email);

      setInviteOk(url ? "Invite created — opening email draft…" : "Member created/updated.");
      refreshTrainers();

      // ✅ Open default email draft automatically (only if we have a setup url)
      if (url) {
        const draft = buildInviteEmail({
          orgName,
          inviterName,
          inviteeEmail: email,
          role: r,
          inviteUrl: url,
          expiresAt: exp,
        });
        const mailto = encodeMailto(draft);
        window.location.href = mailto;
      }
    } catch (err) {
      setInviteErr(err?.message || "Failed to create invite.");
    } finally {
      setInviteSending(false);
      setTimeout(() => setInviteOk(""), 2500);
    }
  };

  /* ----------------------------- Inline edit ----------------------------- */

  const startEdit = (t) => {
    setSaveErr("");
    setSaveOk("");
    setInviteErr("");
    setInviteOk("");

    if (!canManageMembers) {
      setSaveErr("Only Organization/Admin can edit members.");
      return;
    }

    setEditRow({
      id: t?.id,
      name: t?.Name || "",
      email: t?.Email || "",
      role: String(t?.Role || "trainer").toLowerCase(),
      active: Boolean(t?.Active ?? true),
    });
  };

  const cancelEdit = () => {
    setEditRow(null);
    setSaveErr("");
    setSavingId("");
  };

  const saveEdit = async () => {
    setSaveErr("");
    setSaveOk("");
    if (!editRow?.id) return;

    const payload = {
      memberId: editRow.id,
      name: String(editRow.name || "").trim(),
      email: normalizeEmail(editRow.email),
      role: String(editRow.role || "trainer").toLowerCase(),
      active: Boolean(editRow.active),
    };

    if (!payload.email || !payload.email.includes("@")) {
      setSaveErr("Enter a valid email.");
      return;
    }
    if (!["trainer", "admin"].includes(payload.role)) {
      setSaveErr("Role must be trainer or admin.");
      return;
    }

    setSavingId(editRow.id);
    try {
      const res = await fetch("/api/org/members/update", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to save changes.");

      setTrainers((prev) => {
        const list = Array.isArray(prev) ? [...prev] : [];
        const idx = list.findIndex((x) => String(x?.id) === String(editRow.id));
        if (idx >= 0) {
          list[idx] = {
            ...list[idx],
            Name: payload.name,
            Email: payload.email,
            Role: payload.role,
            Active: payload.active,
          };
        }
        return list;
      });

      setSaveOk("Saved.");
      cancelEdit();
    } catch (err) {
      setSaveErr(err?.message || "Failed to save.");
    } finally {
      setSavingId("");
      setTimeout(() => setSaveOk(""), 2500);
    }
  };

  /* ----------------------------- Remove / Deactivate ----------------------------- */

  const openRemove = (t) => {
    setRemoveErr("");
    setSaveErr("");
    setSaveOk("");
    setInviteErr("");
    setInviteOk("");

    setRemoveTarget(t);
    setRemoveOpen(true);
  };

  const closeRemove = () => {
    setRemoveOpen(false);
    setRemoveTarget(null);
    setRemoveErr("");
    setRemoveBusy(false);
  };

  const confirmRemove = async () => {
    setRemoveErr("");
    if (!removeTarget?.id) {
      setRemoveErr("Missing trainer id.");
      return;
    }

    if (!canManageMembers) {
      setRemoveErr("Only Organization/Admin can remove members.");
      return;
    }

    setRemoveBusy(true);
    try {
      const res = await fetch("/api/org/members/remove", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainerId: removeTarget.id }),
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to remove trainer.");

      setTrainers((prev) => {
        const list = Array.isArray(prev) ? [...prev] : [];
        const idx = list.findIndex((x) => String(x?.id) === String(removeTarget.id));
        if (idx >= 0) list[idx] = { ...list[idx], Active: false };
        return list;
      });

      closeRemove();
    } catch (err) {
      setRemoveErr(err?.message || "Failed to remove.");
    } finally {
      setRemoveBusy(false);
    }
  };

  const isEditing = (id) => editRow?.id && String(editRow.id) === String(id);

  /* -------------------------------- Render -------------------------------- */

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Users className="w-6 h-6 text-[#46769B]" />
                <h1 className="text-2xl font-extrabold truncate">Trainers</h1>
              </div>

              <p className="text-sm text-gray-600 mt-1">
                {orgName} • Logged in as <span className="font-semibold">{orgEmail}</span>
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Pill tone="good">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                  Org Session Active
                </Pill>

                {orgToken ? (
                  <Pill tone="good">
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    Token Loaded
                  </Pill>
                ) : (
                  <Pill tone="bad">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                    Missing Token
                  </Pill>
                )}

                {orgId ? (
                  <Pill tone="good">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    orgId Loaded
                  </Pill>
                ) : (
                  <Pill tone="warn">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                    orgId missing (legacy session)
                  </Pill>
                )}

                <Pill>
                  <Users className="w-3.5 h-3.5 mr-1.5" />
                  Team: {counts.total} (Admins: {counts.admins}, Trainers: {counts.coaches}, Inactive: {counts.inactive})
                </Pill>

                {!canManageMembers ? (
                  <Pill tone="warn">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                    View-only (Trainer role)
                  </Pill>
                ) : null}
              </div>

              {(error || saveErr || inviteErr) && (
                <div className="mt-4 space-y-2">
                  {error ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-3">
                      <p className="text-sm text-red-700 font-semibold">{error}</p>
                      <p className="text-[11px] text-red-600 mt-1">
                        If this persists, log out and back in to refresh your session cookie.
                      </p>
                    </div>
                  ) : null}

                  {saveErr ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-3">
                      <p className="text-sm text-red-700 font-semibold">{saveErr}</p>
                    </div>
                  ) : null}

                  {inviteErr ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-3">
                      <p className="text-sm text-red-700 font-semibold">{inviteErr}</p>
                    </div>
                  ) : null}
                </div>
              )}

              {(saveOk || inviteOk) && (
                <div className="mt-4 space-y-2">
                  {saveOk ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                      <p className="text-sm text-emerald-800 font-semibold">{saveOk}</p>
                    </div>
                  ) : null}
                  {inviteOk ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                      <p className="text-sm text-emerald-800 font-semibold">{inviteOk}</p>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => router.push("/org/dashboard")}>
                <ArrowRight className="w-4 h-4 rotate-180" />
                Back
              </Button>
              <Button variant="secondary" onClick={refreshTrainers} disabled={loading}>
                <RefreshCcw className="w-4 h-4" />
                Refresh
              </Button>
              <Button variant="dark" onClick={onLogout}>
                <LogOut className="w-4 h-4" />
                Log out
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm text-gray-800 font-semibold">Loading trainers…</p>
              <p className="text-[11px] text-gray-600 mt-1">
                Pulling organization members (Admin/Trainer).
              </p>
            </div>
          ) : null}
        </div>

        {/* Invite + Search + Table */}
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Invite */}
          <section className="lg:col-span-4 bg-white rounded-2xl shadow-md border border-blue-100 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold">Invite</h2>
                <p className="text-sm text-gray-600 mt-1">Create a trainer/admin invite + open an email draft.</p>
              </div>
              <Button
                variant="secondary"
                className="px-3 py-2 text-xs"
                onClick={refreshTrainers}
                disabled={loading}
              >
                <RefreshCcw className="w-4 h-4" />
                Refresh
              </Button>
            </div>

            {!canManageMembers ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm text-amber-900 font-semibold">
                  Your role is Trainer. Invites are disabled.
                </p>
                <p className="text-[11px] text-amber-800 mt-1">
                  Ask an Admin/Organization owner to invite new members.
                </p>
              </div>
            ) : null}

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-gray-600 font-semibold">Email</label>
                <div className="relative mt-2">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    className={classNames(inputBase, "pl-10")}
                    placeholder="coach@domain.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    disabled={!canManageMembers}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-600 font-semibold">Name (optional)</label>
                <input
                  className={inputBase}
                  placeholder="Coach name"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  disabled={!canManageMembers}
                />
              </div>

              <div>
                <label className="text-xs text-gray-600 font-semibold">Role</label>
                <select
                  className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  disabled={!canManageMembers}
                >
                  <option value="trainer">Trainer</option>
                  <option value="admin">Admin (Head Trainer)</option>
                </select>
              </div>

              <div className="flex justify-end">
                <Button onClick={sendInvite} disabled={inviteSending || !canManageMembers}>
                  <UserPlus className="w-4 h-4" />
                  {inviteSending ? "Creating..." : "Create Invite"}
                </Button>
              </div>

              {/* Setup link + draft actions */}
              {setupUrl ? (
                <div className="mt-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-emerald-900">Trainer setup link</p>
                      <p className="text-[11px] text-emerald-800 mt-1">
                        Share this link so they can set their password.
                        {expiresAt ? (
                          <>
                            {" "}
                            Expires: <span className="font-mono">{expiresAt}</span>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      className="px-3 py-2 text-xs"
                      onClick={async () => {
                        try {
                          await copyToClipboard(setupUrl);
                          setInviteOk("Copied setup link.");
                          setTimeout(() => setInviteOk(""), 2500);
                        } catch {
                          setInviteErr("Copy failed. Please manually copy the link.");
                        }
                      }}
                    >
                      <Copy className="w-4 h-4" />
                      Copy
                    </Button>
                  </div>

                  <input
                    className={inputBase}
                    value={setupUrl}
                    readOnly
                    onFocus={(e) => e.target.select()}
                  />

                  <div className="flex flex-wrap gap-2 justify-end">
                    <Button
                      variant="secondary"
                      className="px-3 py-2 text-xs"
                      onClick={copyEmailDraftForLastInvite}
                      disabled={!setupEmail}
                      title="Copy full email draft"
                    >
                      <Copy className="w-4 h-4" />
                      Copy email
                    </Button>

                    <Button
                      className="px-3 py-2 text-xs"
                      onClick={openEmailDraftForLastInvite}
                      disabled={!setupEmail}
                      title="Open a pre-filled draft in your default mail app"
                    >
                      <Send className="w-4 h-4" />
                      Open draft
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="text-[11px] text-emerald-800">
                    This uses <span className="font-mono">mailto:</span> — it opens the user’s default email app.
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-extrabold text-gray-900">Inline edit</p>
                <p className="text-[11px] text-gray-600 mt-1">
                  Click <span className="font-semibold">Edit</span> on a member to update Name, Email, Role, or Active.
                  Saving calls <span className="font-mono">/api/org/members/update</span>.
                </p>
              </div>
            </div>
          </section>

          {/* Table */}
          <section className="lg:col-span-8 bg-white rounded-2xl shadow-md border border-blue-100 p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold">Team</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Admins and trainers who can access org tools.
                </p>
                <p className="text-[11px] text-gray-500 mt-1">
                  Tip: inactive members stay listed but show as Inactive (reactivate via Edit).
                </p>
              </div>

              <div className="w-full sm:w-[460px] space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    className={classNames(inputBase, "pl-10")}
                    placeholder="Search by name, email, role…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b">
                    <th className="py-3 pr-4">Member</th>
                    <th className="py-3 pr-4">Email</th>
                    <th className="py-3 pr-4">Role</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Added</th>
                    <th className="py-3 pr-2 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-500">
                        No trainers found.
                      </td>
                    </tr>
                  )}

                  {filtered.map((t) => {
                    const id = t?.id;
                    const email = normalizeEmail(t?.Email);
                    const editing = isEditing(id);

                    const createdAt = t?.createdAt || "";
                    const displayAdded = createdAt ? fmtDate(createdAt) : "—";

                    return (
                      <tr key={id || email} className="border-b align-top">
                        {/* Member */}
                        <td className="py-3 pr-4">
                          {editing ? (
                            <div className="space-y-2">
                              <input
                                className={inputBase}
                                value={editRow.name}
                                onChange={(e) => setEditRow((p) => ({ ...p, name: e.target.value }))}
                                placeholder="Name"
                              />
                              <div className="text-[11px] text-gray-500">Member name</div>
                            </div>
                          ) : (
                            <>
                              <div className="font-semibold text-gray-900">{t?.Name || "Member"}</div>
                              <div className="text-[11px] text-gray-500">
                                {String(t?.Role || "").toLowerCase() === "admin" ? "Admin access" : "Trainer access"}
                              </div>
                            </>
                          )}
                        </td>

                        {/* Email */}
                        <td className="py-3 pr-4">
                          {editing ? (
                            <div className="space-y-2">
                              <input
                                className={inputBase}
                                value={editRow.email}
                                onChange={(e) => setEditRow((p) => ({ ...p, email: e.target.value }))}
                                placeholder="email@domain.com"
                              />
                              <div className="text-[11px] text-gray-500">Login email</div>
                            </div>
                          ) : (
                            <div className="text-gray-700 font-medium">{email || "—"}</div>
                          )}
                        </td>

                        {/* Role */}
                        <td className="py-3 pr-4">
                          {editing ? (
                            <select
                              className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm"
                              value={editRow.role}
                              onChange={(e) => setEditRow((p) => ({ ...p, role: e.target.value }))}
                            >
                              <option value="trainer">Trainer</option>
                              <option value="admin">Admin</option>
                            </select>
                          ) : (
                            <Pill tone={roleTone(t?.Role)}>{String(t?.Role || "trainer")}</Pill>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 pr-4">
                          {editing ? (
                            <div className="space-y-2">
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={!!editRow.active}
                                  onChange={(e) => setEditRow((p) => ({ ...p, active: e.target.checked }))}
                                />
                                <span>{editRow.active ? "Active" : "Inactive"}</span>
                              </label>
                              <div className="text-[11px] text-gray-500">Controls org access</div>
                            </div>
                          ) : (
                            <Pill tone={statusTone(!!t?.Active)}>{t?.Active ? "Active" : "Inactive"}</Pill>
                          )}
                        </td>

                        {/* Added */}
                        <td className="py-3 pr-4">
                          <div className="text-gray-700 font-medium">{displayAdded}</div>
                        </td>

                        {/* Actions */}
                        <td className="py-3 pr-2">
                          <div className="flex justify-end gap-2">
                            {editing ? (
                              <>
                                <Button
                                  variant="secondary"
                                  className="px-3 py-2 text-xs"
                                  onClick={cancelEdit}
                                  disabled={savingId === id}
                                  title="Cancel"
                                >
                                  <Ban className="w-4 h-4" />
                                  Cancel
                                </Button>

                                <Button
                                  className="px-3 py-2 text-xs"
                                  onClick={saveEdit}
                                  disabled={savingId === id}
                                  title="Save"
                                >
                                  <Save className="w-4 h-4" />
                                  {savingId === id ? "Saving..." : "Save"}
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="secondary"
                                  className="px-3 py-2 text-xs"
                                  onClick={() => startEdit(t)}
                                  disabled={!canManageMembers || !id}
                                  title={!canManageMembers ? "Only Admin/Org can edit" : "Edit member"}
                                >
                                  <Edit3 className="w-4 h-4" />
                                  Edit
                                </Button>

                                <Button
                                  variant="secondary"
                                  className="px-3 py-2 text-xs"
                                  onClick={() => openRemove(t)}
                                  disabled={!canManageMembers || !id}
                                  title={!canManageMembers ? "Only Admin/Org can remove" : "Deactivate member"}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Remove
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {editRow?.id ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-extrabold text-amber-900">Editing mode</p>
                  <p className="text-[12px] text-amber-800 mt-1">
                    You’re editing one member. Save to persist changes, or cancel to discard.
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        </div>

        {/* Remove Modal */}
        <Modal
          open={removeOpen}
          title={removeTarget ? `Remove: ${removeTarget?.Name || removeTarget?.Email || "Member"}` : "Remove Member"}
          onClose={closeRemove}
        >
          {removeErr ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 mb-4">
              <p className="text-sm text-red-700 font-semibold">{removeErr}</p>
            </div>
          ) : null}

          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Confirm</p>
              <p className="text-sm font-extrabold text-gray-900 mt-1">
                This will deactivate org access for:
              </p>
              <p className="text-[12px] text-gray-700 mt-2">
                <span className="font-semibold">{removeTarget?.Name || "Member"}</span>
                {removeTarget?.Email ? (
                  <>
                    {" "}
                    • <span className="font-mono">{normalizeEmail(removeTarget.Email)}</span>
                  </>
                ) : null}
              </p>
              <p className="text-[11px] text-gray-500 mt-2">
                Deactivated members can be reactivated later by editing and setting Active=true.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={closeRemove} disabled={removeBusy}>
                Cancel
              </Button>
              <Button
                onClick={confirmRemove}
                disabled={removeBusy}
                className="bg-red-600 hover:brightness-110"
              >
                <Trash2 className="w-4 h-4" />
                {removeBusy ? "Removing..." : "Remove"}
              </Button>
            </div>

            <div className="text-[11px] text-gray-500">
              This calls <span className="font-mono">/api/org/members/remove</span>.
            </div>
          </div>
        </Modal>
      </main>
    </div>
  );
}
