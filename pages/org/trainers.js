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
} from "lucide-react";

/**
 * Trainers — matches /org/dashboard design language
 * - Uses cookie session (credentials: include)
 * - Endpoint placeholders:
 *   GET  /api/org/trainers/list
 *   POST /api/org/trainers/invite
 *   POST /api/org/trainers/remove
 */

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
            <div>
              <p className="text-lg font-extrabold text-gray-900">{title}</p>
              <p className="text-[12px] text-gray-500 mt-1">
                Manage org-side access (Admin/Trainer).
              </p>
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
  if (r === "owner") return "good";
  if (r === "admin") return "good";
  if (r === "trainer") return "neutral";
  return "neutral";
}

export default function TrainersPage() {
  const router = useRouter();
  const { user, logout } = useAuthContext();

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
  const [inviteRole, setInviteRole] = useState("trainer");
  const [inviteErr, setInviteErr] = useState("");
  const [inviteSending, setInviteSending] = useState(false);

  // UI
  const [search, setSearch] = useState("");
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removeErr, setRemoveErr] = useState("");
  const [removeBusy, setRemoveBusy] = useState(false);

  const refreshTrainers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/org/trainers/list", {
        method: "GET",
        credentials: "include",
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to load trainers");

      setTrainers(Array.isArray(data?.trainers) ? data.trainers : []);
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
        const hay = [t?.name, t?.email, t?.role, t?.status]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    // stable sort: admins first, then trainers
    list.sort((a, b) => {
      const ar = String(a?.role || "").toLowerCase();
      const br = String(b?.role || "").toLowerCase();
      const score = (r) => (r === "admin" ? 2 : r === "trainer" ? 1 : 0);
      return score(br) - score(ar);
    });

    return list;
  }, [trainers, search]);

  const counts = useMemo(() => {
    const list = Array.isArray(trainers) ? trainers : [];
    const admins = list.filter((t) => String(t?.role || "").toLowerCase() === "admin").length;
    const coaches = list.filter((t) => String(t?.role || "").toLowerCase() === "trainer").length;
    const total = list.length;
    return { admins, coaches, total };
  }, [trainers]);

  const onLogout = async () => {
    try {
      await logout?.();
    } finally {
      router.push("/");
    }
  };

  const inputBase =
    "w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]";

  const sendInvite = async () => {
    setInviteErr("");

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
      const res = await fetch("/api/org/trainers/invite", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: r }),
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to send invite.");

      setInviteEmail("");
      setInviteRole("trainer");
      refreshTrainers();
    } catch (err) {
      setInviteErr(err?.message || "Failed to send invite.");
    } finally {
      setInviteSending(false);
    }
  };

  const openRemove = (t) => {
    setRemoveErr("");
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

    setRemoveBusy(true);
    try {
      const res = await fetch("/api/org/trainers/remove", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainerId: removeTarget.id }),
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to remove trainer.");

      // remove in place
      setTrainers((prev) => (Array.isArray(prev) ? prev.filter((x) => x?.id !== removeTarget.id) : prev));
      closeRemove();
    } catch (err) {
      setRemoveErr(err?.message || "Failed to remove.");
    } finally {
      setRemoveBusy(false);
    }
  };

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
                  Team: {counts.total} (Admins: {counts.admins}, Trainers: {counts.coaches})
                </Pill>
              </div>
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

          {error ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700 font-semibold">{error}</p>
              <p className="text-[11px] text-red-600 mt-1">
                If this persists, log out and back in to refresh your session cookie.
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
                <p className="text-sm text-gray-600 mt-1">Add org-side access.</p>
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

            {inviteErr ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-700 font-semibold">{inviteErr}</p>
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
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-600 font-semibold">Role</label>
                <select
                  className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  <option value="trainer">Trainer</option>
                  <option value="admin">Admin</option>
                </select>
                <p className="text-[11px] text-gray-500 mt-2">
                  Admins manage workflow. Trainers build plans.
                </p>
              </div>

              <div className="flex justify-end">
                <Button onClick={sendInvite} disabled={inviteSending}>
                  <UserPlus className="w-4 h-4" />
                  {inviteSending ? "Sending..." : "Send Invite"}
                </Button>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-extrabold text-gray-900">API wiring</p>
                <p className="text-[11px] text-gray-600 mt-1">
                  Implement <span className="font-mono">/api/org/trainers/invite</span> to email an invite
                  (or create a member record in Airtable).
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
                        <div className="text-[11px] text-gray-400 mt-1">
                          Implement <span className="font-mono">/api/org/trainers/list</span> to populate.
                        </div>
                      </td>
                    </tr>
                  )}

                  {filtered.map((t) => {
                    const email = normalizeEmail(t?.email);
                    return (
                      <tr key={t?.id || email || Math.random()} className="border-b">
                        <td className="py-3 pr-4">
                          <div className="font-semibold text-gray-900">{t?.name || "Member"}</div>
                          <div className="text-[11px] text-gray-500">{t?.title || ""}</div>
                        </td>

                        <td className="py-3 pr-4">
                          <div className="text-gray-700 font-medium">{email || "—"}</div>
                        </td>

                        <td className="py-3 pr-4">
                          <Pill tone={roleTone(t?.role)}>{String(t?.role || "trainer")}</Pill>
                        </td>

                        <td className="py-3 pr-4">
                          <Pill>{String(t?.status || "Active")}</Pill>
                        </td>

                        <td className="py-3 pr-4">
                          <div className="text-gray-700 font-medium">
                            {t?.createdAt ? fmtDate(t.createdAt) : "—"}
                          </div>
                        </td>

                        <td className="py-3 pr-2">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="secondary"
                              className="px-3 py-2 text-xs"
                              onClick={() => openRemove(t)}
                              disabled={!t?.id}
                              title="Remove member"
                            >
                              <Trash2 className="w-4 h-4" />
                              Remove
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Remove Modal */}
        <Modal
          open={removeOpen}
          title={removeTarget ? `Remove: ${removeTarget?.name || removeTarget?.email || "Member"}` : "Remove Member"}
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
                This will revoke org access for:
              </p>
              <p className="text-[12px] text-gray-700 mt-2">
                <span className="font-semibold">{removeTarget?.name || "Member"}</span>
                {removeTarget?.email ? (
                  <>
                    {" "}
                    • <span className="font-mono">{normalizeEmail(removeTarget.email)}</span>
                  </>
                ) : null}
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
              Wire <span className="font-mono">/api/org/trainers/remove</span> to persist removal.
            </div>
          </div>
        </Modal>
      </main>
    </div>
  );
}
