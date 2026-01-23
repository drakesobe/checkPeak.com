// pages/org/dashboard.js
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/hooks/useAuth";
import {
  RefreshCcw,
  LogOut,
  Copy,
  Users,
  FileText,
  Activity,
  ArrowRight,
  Search,
  Link as LinkIcon,
  Mail,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  Filter,
  CheckCircle2,
  Download,
  LayoutDashboard,
  ChevronRight,
  ChevronDown,
  X,
  Pencil,
  Tag,
  ClipboardList,
} from "lucide-react";

/**
 * ✅ ORG ISSUE FIXES APPLIED HERE
 *
 * 1) Role gating supports Organization + Admin + Trainer (OrgMembers)
 *    - Admin/Trainer are org-side and should access /org/*
 *
 * 2) Remove x-org-token header usage and STOP putting orgToken in URLs.
 *    - Org APIs should rely on HttpOnly session cookie + requireOrg(req)
 *    - All fetches use credentials: "include"
 *
 * 3) Invite link: keep token-based invite working, but read token from session cookie payload.
 *    - If token is missing, we still render the UI but show "Missing Token".
 *
 * 4) Keep everything else UI/UX identical.
 */

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
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

function downloadTextFile(filename, text, mime = "text/plain") {
  try {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {}
}

function toCSV(rows) {
  const escape = (v) => {
    const s = String(v ?? "");
    const needs = /[",\n]/.test(s);
    const escaped = s.replace(/"/g, '""');
    return needs ? `"${escaped}"` : escaped;
  };
  return rows.map((r) => r.map(escape).join(",")).join("\n");
}

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">{value}</p>
          {sub ? <p className="text-[11px] text-gray-500 mt-2">{sub}</p> : null}
        </div>
        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
          <Icon className="w-5 h-5 text-[#46769B]" />
        </div>
      </div>
    </div>
  );
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

function TagChip({ text }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold border border-gray-200 bg-white text-gray-700">
      <Tag className="w-3.5 h-3.5 text-gray-400" />
      {text}
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
      type="button"
    >
      {children}
    </button>
  );
}

function CopyButton({ text, label = "Copy", compact = false }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(String(text || ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 900);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Button
      variant="secondary"
      onClick={onCopy}
      disabled={!text}
      className={compact ? "px-3 py-2 text-xs" : ""}
    >
      <Copy className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
      {copied ? "Copied" : label}
    </Button>
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
                Update status/tags to power filtering and workflow.
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

export default function OrgDashboard() {
  const router = useRouter();
  const { user, logout } = useAuthContext();

  // ✅ Role normalization: allow Organization + Admin + Trainer (org-side)
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

  // ✅ If org login, Name is org name. If trainer/admin, Name is member name.
  // Prefer Organization Name fields when present.
  const orgName = useMemo(() => {
    const guess =
      user?.OrgName ||
      user?.["Organization Name"] ||
      user?.OrganizationName ||
      user?.organizationName ||
      user?.Organization ||
      // fallback: org account name
      (role === "organization" ? (user?.Name || user?.name) : "") ||
      "Organization";
    return String(guess || "Organization");
  }, [user, role]);

  const orgEmail = useMemo(() => String(user?.Email || user?.email || ""), [user]);

  // ✅ Legacy token still supported for invite links
  const orgToken = useMemo(() => {
    return String(
      user?.Token || user?.token || user?.["Organization Token"] || ""
    ).trim();
  }, [user]);

  // ✅ Canonical org record id (for trainer/admin sessions, lookupUser sets orgId)
  const orgId = useMemo(() => {
    return String(user?.orgId || user?.OrgId || "").trim();
  }, [user]);

  const origin = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  const inviteLink = useMemo(() => {
    if (!origin || !orgToken) return "";
    return `${origin}/signup?role=athlete&token=${encodeURIComponent(orgToken)}`;
  }, [origin, orgToken]);

  // Overview payload
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [stats, setStats] = useState({
    totalAthletes: 0,
    totalPlans: 0,
    athletesWithPlans: 0,
    coveragePct: 0,
    activeLast30: 0,
    staleCount: 0,
  });

  const [athletes, setAthletes] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [templates, setTemplates] = useState([]);

  // UI controls
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState("all"); // all | needsPlan | stale | current
  const [sortMode, setSortMode] = useState("priority"); // priority | lastPlan | name
  const [expanded, setExpanded] = useState({});
  const toggleExpanded = (email) => {
    const e = normalizeEmail(email);
    if (!e) return;
    setExpanded((prev) => ({ ...prev, [e]: !prev[e] }));
  };

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState("");
  const [editAthlete, setEditAthlete] = useState(null);

  const openEdit = (athlete) => {
    setEditErr("");
    setEditAthlete({
      email: normalizeEmail(athlete?.email),
      name: athlete?.name || "",
      status: athlete?.status || "Active",
      tags: Array.isArray(athlete?.tags) ? athlete.tags : [],
      notes: athlete?.notes || "",
    });
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditErr("");
    setEditAthlete(null);
  };

  // ✅ Guards
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

  /**
   * ✅ ORG ISSUE FIX: do NOT send x-org-token headers.
   * Org endpoints should use HttpOnly cookie session + requireOrg(req).
   */
  const refreshOverview = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/org/getOrgOverview`, {
        method: "GET",
        credentials: "include",
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to load org overview");

      setStats(data?.stats || {});
      setAthletes(Array.isArray(data?.athletes) ? data.athletes : []);
      setRecentActivity(Array.isArray(data?.recentActivity) ? data.recentActivity : []);
    } catch (err) {
      console.error("[org/dashboard] refreshOverview error:", err);
      setError(err?.message || "Failed to load organization overview.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshTemplates = useCallback(async () => {
    try {
      const res = await fetch(`/api/org/getPlanTemplates`, {
        method: "GET",
        credentials: "include",
      });
      const data = await safeJson(res);
      if (!res.ok) return;
      setTemplates(Array.isArray(data?.templates) ? data.templates : []);
    } catch {}
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!isOrgSide) return;
    refreshOverview();
    refreshTemplates();
  }, [user, isOrgSide, refreshOverview, refreshTemplates]);

  // Derived: counts + triage
  const counts = useMemo(() => {
    const list = Array.isArray(athletes) ? athletes : [];
    const needsPlan = list.filter((a) => !!a?.needsPlan).length;
    const stale = list.filter((a) => !!a?.stale && !a?.needsPlan).length;
    const current = list.filter((a) => !a?.stale && !a?.needsPlan).length;
    return { needsPlan, stale, current, total: list.length };
  }, [athletes]);

  const triageHeadline = useMemo(() => {
    if (!counts.total) return "No athletes yet — invite athletes to begin.";
    if (counts.needsPlan > 0) return `Start here: ${counts.needsPlan} athlete(s) need their first plan`;
    if (counts.stale > 0) return `Next: ${counts.stale} athlete(s) need an update`;
    return "All athletes are current — keep it up.";
  }, [counts]);

  // Filtered athletes
  const filteredAthletes = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    let list = Array.isArray(athletes) ? [...athletes] : [];

    if (q) {
      list = list.filter((a) => {
        const name = String(a?.name || "").toLowerCase();
        const email = String(a?.email || "").toLowerCase();
        return name.includes(q) || email.includes(q);
      });
    }

    if (filterMode === "needsPlan") list = list.filter((a) => !!a?.needsPlan);
    if (filterMode === "stale") list = list.filter((a) => !!a?.stale && !a?.needsPlan);
    if (filterMode === "current") list = list.filter((a) => !a?.stale && !a?.needsPlan);

    const byLastPlanDesc = (a, b) => {
      const ad = safeDate(a?.lastPlanAt)?.getTime?.() || 0;
      const bd = safeDate(b?.lastPlanAt)?.getTime?.() || 0;
      return bd - ad;
    };

    const byNameAsc = (a, b) => {
      const an = String(a?.name || "").toLowerCase();
      const bn = String(b?.name || "").toLowerCase();
      return an.localeCompare(bn);
    };

    const byPriority = (a, b) => {
      const ap = a?.needsPlan ? 1 : 0;
      const bp = b?.needsPlan ? 1 : 0;
      if (bp !== ap) return bp - ap;

      const as = a?.stale ? 1 : 0;
      const bs = b?.stale ? 1 : 0;
      if (bs !== as) return bs - as;

      return byLastPlanDesc(a, b);
    };

    if (sortMode === "name") list.sort(byNameAsc);
    else if (sortMode === "lastPlan") list.sort(byLastPlanDesc);
    else list.sort(byPriority);

    return list;
  }, [athletes, search, filterMode, sortMode]);

  // Actions
  const goBuildPlan = (athleteEmail, templateId = "") => {
    const e = normalizeEmail(athleteEmail);
    const qs = new URLSearchParams();
    if (e) qs.set("athleteEmail", e);
    if (templateId) qs.set("template", templateId);
    router.push(`/org/prescriptions${qs.toString() ? `?${qs.toString()}` : ""}`);
  };

  const goHistory = (athleteEmail) => {
    const e = normalizeEmail(athleteEmail);
    if (!e) return;
    router.push(`/org/prescriptions?athleteEmail=${encodeURIComponent(e)}`);
  };

  const onLogout = async () => {
    try {
      await logout?.();
    } finally {
      router.push("/");
    }
  };

  const exportCSV = () => {
    const rows = [
      [
        "Athlete Name",
        "Athlete Email",
        "Status",
        "Tags",
        "Plans Count",
        "Last Plan At",
        "Last Plan Title",
        "Needs Plan",
        "Needs Update (Stale)",
      ],
    ];

    (Array.isArray(athletes) ? athletes : []).forEach((a) => {
      rows.push([
        a?.name || "",
        a?.email || "",
        a?.status || "",
        Array.isArray(a?.tags) ? a.tags.join(" | ") : "",
        a?.plansCount || 0,
        a?.lastPlanAt || "",
        a?.lastPlanTitle || "",
        a?.needsPlan ? "YES" : "NO",
        a?.stale ? "YES" : "NO",
      ]);
    });

    const csv = toCSV(rows);
    downloadTextFile(
      `org_roster_${String(orgName || "org").replace(/\s+/g, "_").toLowerCase()}.csv`,
      csv,
      "text/csv"
    );
  };

  // Save edit modal
  const saveEdit = async () => {
    setEditErr("");
    if (!editAthlete?.email) {
      setEditErr("Missing athlete email.");
      return;
    }
    setEditSaving(true);

    try {
      const res = await fetch("/api/org/updateAthleteMeta", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteEmail: editAthlete.email,
          status: editAthlete.status,
          tags: editAthlete.tags,
          notes: editAthlete.notes,
        }),
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to update athlete");

      // Update roster in-place (so you see changes instantly)
      setAthletes((prev) => {
        const list = Array.isArray(prev) ? [...prev] : [];
        const idx = list.findIndex(
          (x) => normalizeEmail(x?.email) === normalizeEmail(editAthlete.email)
        );
        if (idx >= 0) {
          list[idx] = {
            ...list[idx],
            status: data?.athlete?.status || editAthlete.status,
            tags: data?.athlete?.tags || editAthlete.tags,
            notes: data?.athlete?.notes || editAthlete.notes,
          };
        }
        return list;
      });

      closeEdit();
    } catch (err) {
      setEditErr(err?.message || "Failed to save.");
    } finally {
      setEditSaving(false);
    }
  };

  const inputBase =
    "w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="w-6 h-6 text-[#46769B]" />
                <h1 className="text-2xl font-extrabold truncate">{orgName}</h1>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Logged in as <span className="font-semibold">{orgEmail}</span>
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Pill tone="good">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                  Org Session Active
                </Pill>

                {/* Token visibility: still useful for invites */}
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

                {/* orgId visibility: useful for debugging trainer/admin sessions */}
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
                  <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
                  {triageHeadline}
                </Pill>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={refreshOverview} disabled={loading}>
                <RefreshCcw className="w-4 h-4" />
                Refresh
              </Button>
              <Button variant="secondary" onClick={exportCSV} disabled={!athletes?.length}>
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
              <Button variant="dark" onClick={onLogout}>
                <LogOut className="w-4 h-4" />
                Log out
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm text-gray-800 font-semibold">
                Loading organization overview…
              </p>
              <p className="text-[11px] text-gray-600 mt-1">
                Pulling roster + plan status in one request.
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

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Athletes" value={stats.totalAthletes || 0} sub="Roster size" />
          <StatCard icon={FileText} label="Total Plans" value={stats.totalPlans || 0} sub="All-time plans created" />
          <StatCard
            icon={CheckCircle2}
            label="Coverage"
            value={`${stats.coveragePct || 0}%`}
            sub={`${stats.athletesWithPlans || 0} of ${stats.totalAthletes || 0} have at least 1 plan`}
          />
          <StatCard icon={Activity} label="Needs Attention" value={stats.staleCount || 0} sub="Missing plan or stale plan" />
        </div>

        {/* Templates + Invite */}
        <div className="grid lg:grid-cols-12 gap-6">
          <section className="lg:col-span-4 bg-white rounded-2xl shadow-md border border-blue-100 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold">Templates</h2>
                <p className="text-sm text-gray-600 mt-1">
                  One click to preload a plan (then tweak).
                </p>
              </div>
              <Button variant="secondary" className="px-3 py-2 text-xs" onClick={refreshTemplates}>
                <RefreshCcw className="w-4 h-4" />
                Refresh
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {templates.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-extrabold text-gray-900">No templates loaded</p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Make sure /api/org/getPlanTemplates is added.
                  </p>
                </div>
              ) : (
                templates.slice(0, 4).map((t) => (
                  <div key={t.id} className="rounded-2xl border border-gray-200 p-4">
                    <p className="text-sm font-extrabold text-gray-900">{t.name}</p>
                    <p className="text-[11px] text-gray-500 mt-1">{t.description}</p>
                    <div className="mt-3">
                      <Button
                        variant="secondary"
                        className="px-3 py-2 text-xs"
                        onClick={() => goBuildPlan("", t.id)}
                      >
                        Use template
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
              <p className="text-[11px] text-gray-500">
                Pro move: from roster → “Build” can pass template too.
              </p>
            </div>
          </section>

          <section className="lg:col-span-8 bg-white rounded-2xl shadow-md border border-blue-100 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold">Invite Athletes</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Token + link are always visible for coaching ops.
                </p>
              </div>
              <div className="flex gap-2">
                <CopyButton text={orgToken} label="Copy token" compact />
                <CopyButton text={inviteLink} label="Copy link" compact />
              </div>
            </div>

            <div className="mt-4 grid md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs text-gray-500">Organization Token</p>
                <p className="font-mono text-sm font-semibold break-all mt-1">
                  {orgToken || "— missing Token on session user —"}
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-gray-500">Signup Link</p>
                  <LinkIcon className="w-4 h-4 text-gray-400" />
                </div>
                <p className="font-mono text-[12px] font-semibold break-all mt-1">
                  {inviteLink || "—"}
                </p>
              </div>
            </div>

            {!orgToken ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">
                  Token missing from session
                </p>
                <p className="text-[12px] text-amber-800 mt-1">
                  Invite links require the org token. Log out and back in to refresh your session cookie.
                  If you’re a trainer/admin, make sure lookupUser sets Token from the linked Organization record.
                </p>
              </div>
            ) : null}
          </section>
        </div>

        {/* Roster + Activity */}
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Roster */}
          <section className="lg:col-span-8 bg-white rounded-2xl shadow-md border border-blue-100 p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold">Roster</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Status + tags make filtering & coaching workflow real.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill tone="bad">Needs plan: {counts.needsPlan}</Pill>
                  <Pill tone="warn">Needs update: {counts.stale}</Pill>
                  <Pill tone="good">Current: {counts.current}</Pill>
                </div>
              </div>

              <div className="w-full sm:w-[460px] space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    className={classNames(inputBase, "pl-10")}
                    placeholder="Search by name or email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={filterMode === "all" ? "primary" : "secondary"}
                    className="px-3 py-2 text-xs"
                    onClick={() => setFilterMode("all")}
                  >
                    <Filter className="w-4 h-4" />
                    All
                  </Button>
                  <Button
                    variant={filterMode === "needsPlan" ? "primary" : "secondary"}
                    className="px-3 py-2 text-xs"
                    onClick={() => setFilterMode("needsPlan")}
                  >
                    Needs Plan
                  </Button>
                  <Button
                    variant={filterMode === "stale" ? "primary" : "secondary"}
                    className="px-3 py-2 text-xs"
                    onClick={() => setFilterMode("stale")}
                  >
                    Needs Update
                  </Button>
                  <Button
                    variant={filterMode === "current" ? "primary" : "secondary"}
                    className="px-3 py-2 text-xs"
                    onClick={() => setFilterMode("current")}
                  >
                    Current
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={sortMode === "priority" ? "primary" : "secondary"}
                    className="px-3 py-2 text-xs"
                    onClick={() => setSortMode("priority")}
                  >
                    Priority
                  </Button>
                  <Button
                    variant={sortMode === "lastPlan" ? "primary" : "secondary"}
                    className="px-3 py-2 text-xs"
                    onClick={() => setSortMode("lastPlan")}
                  >
                    Last Plan
                  </Button>
                  <Button
                    variant={sortMode === "name" ? "primary" : "secondary"}
                    className="px-3 py-2 text-xs"
                    onClick={() => setSortMode("name")}
                  >
                    Name
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b">
                    <th className="py-3 pr-4">Athlete</th>
                    <th className="py-3 pr-4">Email</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Tags</th>
                    <th className="py-3 pr-4">Plans</th>
                    <th className="py-3 pr-4">Last Plan</th>
                    <th className="py-3 pr-2 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAthletes.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-gray-500">
                        No athletes found.
                      </td>
                    </tr>
                  )}

                  {filteredAthletes.map((a) => {
                    const email = normalizeEmail(a?.email);
                    const isExpanded = !!expanded[email];

                    const planChip = a?.needsPlan ? (
                      <Pill tone="bad">
                        <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                        Needs plan
                      </Pill>
                    ) : a?.stale ? (
                      <Pill tone="warn">
                        <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                        Needs update
                      </Pill>
                    ) : (
                      <Pill tone="good">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                        Current
                      </Pill>
                    );

                    const status = String(a?.status || "Active");
                    const tags = Array.isArray(a?.tags) ? a.tags : [];

                    return (
                      <>
                        <tr key={a.id} className="border-b">
                          <td className="py-3 pr-4">
                            <button
                              type="button"
                              onClick={() => toggleExpanded(email)}
                              className="text-left w-full"
                              title="Expand"
                            >
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-gray-400" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-gray-400" />
                                )}
                                <div className="min-w-0">
                                  <div className="font-semibold text-gray-900 truncate">
                                    {a?.name || "Athlete"}
                                  </div>
                                  <div className="mt-1">{planChip}</div>
                                </div>
                              </div>
                            </button>
                          </td>

                          <td className="py-3 pr-4">
                            <div className="text-gray-700 font-medium">{email}</div>
                            {email ? (
                              <a
                                href={`mailto:${email}`}
                                className="inline-flex items-center gap-1 text-[11px] text-[#46769B] font-semibold hover:underline mt-1"
                              >
                                <Mail className="w-3.5 h-3.5" />
                                Email
                              </a>
                            ) : null}
                          </td>

                          <td className="py-3 pr-4">
                            <Pill>{status}</Pill>
                          </td>

                          <td className="py-3 pr-4">
                            <div className="flex flex-wrap gap-2">
                              {tags.length ? (
                                tags.slice(0, 3).map((t) => <TagChip key={t} text={t} />)
                              ) : (
                                <span className="text-[11px] text-gray-400">—</span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 pr-4">
                            <Pill>{a?.plansCount || 0}</Pill>
                          </td>

                          <td className="py-3 pr-4">
                            <div className="text-gray-700 font-medium">
                              {a?.lastPlanAt ? fmtDate(a.lastPlanAt) : "—"}
                            </div>
                            {a?.lastPlanTitle ? (
                              <div className="text-[11px] text-gray-500 mt-0.5 truncate max-w-[240px]">
                                {a.lastPlanTitle}
                              </div>
                            ) : (
                              <div className="text-[11px] text-gray-400 mt-0.5">
                                No plans yet
                              </div>
                            )}
                          </td>

                          <td className="py-3 pr-2">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="secondary"
                                className="px-3 py-2 text-xs"
                                onClick={() => openEdit(a)}
                                disabled={!email}
                              >
                                <Pencil className="w-4 h-4" />
                                Edit
                              </Button>

                              <Button
                                variant="secondary"
                                className="px-3 py-2 text-xs"
                                onClick={() => goHistory(email)}
                                disabled={!email}
                              >
                                History
                              </Button>

                              <Button
                                className="px-3 py-2 text-xs"
                                onClick={() => goBuildPlan(email)}
                                disabled={!email}
                              >
                                Build
                                <ArrowRight className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>

                        {isExpanded ? (
                          <tr className="border-b bg-gray-50">
                            <td colSpan={7} className="py-4 px-4">
                              <div className="grid md:grid-cols-3 gap-4">
                                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                                  <p className="text-xs text-gray-500">Plan status</p>
                                  <p className="text-sm font-extrabold text-gray-900 mt-1">
                                    {a?.needsPlan
                                      ? "Needs first plan"
                                      : a?.stale
                                      ? "Needs update"
                                      : "Current"}
                                  </p>
                                  <p className="text-[11px] text-gray-500 mt-2">
                                    Coach workflow: handle needs-plan first, then stale.
                                  </p>
                                </div>

                                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                                  <p className="text-xs text-gray-500">Quick templates</p>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {templates.slice(0, 3).map((t) => (
                                      <Button
                                        key={t.id}
                                        variant="secondary"
                                        className="px-3 py-2 text-xs"
                                        onClick={() => goBuildPlan(email, t.id)}
                                      >
                                        {t.name}
                                        <ArrowRight className="w-4 h-4" />
                                      </Button>
                                    ))}
                                  </div>
                                  <p className="text-[11px] text-gray-500 mt-3">
                                    These open the builder pre-filled (fast).
                                  </p>
                                </div>

                                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                                  <p className="text-xs text-gray-500">Shortcuts</p>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <Button
                                      className="px-3 py-2 text-xs"
                                      onClick={() => goBuildPlan(email)}
                                      disabled={!email}
                                    >
                                      <FileText className="w-4 h-4" />
                                      Build / Edit
                                    </Button>
                                    <Button
                                      variant="secondary"
                                      className="px-3 py-2 text-xs"
                                      onClick={() => openEdit(a)}
                                      disabled={!email}
                                    >
                                      <Pencil className="w-4 h-4" />
                                      Update status/tags
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Activity */}
          <section className="lg:col-span-4 bg-white rounded-2xl shadow-md border border-blue-100 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold">Recent Activity</h2>
                <p className="text-sm text-gray-600 mt-1">Latest plan events.</p>
              </div>
              <Button
                variant="secondary"
                className="px-3 py-2 text-xs"
                onClick={refreshOverview}
                disabled={loading}
              >
                <RefreshCcw className="w-4 h-4" />
                Refresh
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {recentActivity.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-extrabold text-gray-900">No activity yet</p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Create a plan to start tracking actions here.
                  </p>
                </div>
              ) : (
                recentActivity.map((it, idx) => (
                  <div
                    key={`${it.athleteEmail}-${idx}`}
                    className="rounded-2xl border border-gray-200 p-4"
                  >
                    <p className="text-sm font-extrabold text-gray-900">{it.title || "Plan"}</p>
                    <p className="text-[12px] text-gray-700 mt-1">
                      <span className="font-semibold">{it.athleteEmail}</span>
                    </p>
                    <p className="text-[11px] text-gray-500 mt-2">
                      {it.createdAt ? `Created: ${fmtDate(it.createdAt)}` : "—"}
                      {it.createdBy ? ` • By: ${it.createdBy}` : ""}
                    </p>
                    <div className="mt-3">
                      <Button
                        variant="secondary"
                        className="px-3 py-2 text-xs"
                        onClick={() => goHistory(it.athleteEmail)}
                      >
                        View History
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Edit Modal */}
        <Modal
          open={editOpen}
          title={editAthlete ? `Edit: ${editAthlete.name || editAthlete.email}` : "Edit Athlete"}
          onClose={closeEdit}
        >
          {editErr ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 mb-4">
              <p className="text-sm text-red-700 font-semibold">{editErr}</p>
            </div>
          ) : null}

          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Athlete</p>
              <p className="text-sm font-extrabold text-gray-900 mt-1">
                {editAthlete?.name || "Athlete"}
              </p>
              <p className="text-[12px] text-gray-600 mt-1">{editAthlete?.email || ""}</p>
            </div>

            <div>
              <label className="text-xs text-gray-600 font-semibold">Status</label>
              <select
                className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm"
                value={editAthlete?.status || "Active"}
                onChange={(e) =>
                  setEditAthlete((prev) => ({ ...prev, status: e.target.value }))
                }
              >
                <option value="Active">Active</option>
                <option value="Injured">Injured</option>
                <option value="Offseason">Offseason</option>
                <option value="Inactive">Inactive</option>
              </select>
              <p className="text-[11px] text-gray-500 mt-2">
                This becomes a filter later (and can trigger reminders).
              </p>
            </div>

            <div>
              <label className="text-xs text-gray-600 font-semibold">Tags</label>
              <input
                className={classNames(inputBase, "mt-2")}
                placeholder="Comma separated tags (e.g. Cut, High Sweat, Two-a-days)"
                value={(editAthlete?.tags || []).join(", ")}
                onChange={(e) => {
                  const raw = e.target.value;
                  const parts = raw
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean);
                  setEditAthlete((prev) => ({ ...prev, tags: parts }));
                }}
              />
              <p className="text-[11px] text-gray-500 mt-2">
                Stored as Airtable multi-select (Tags).
              </p>
            </div>

            <div>
              <label className="text-xs text-gray-600 font-semibold">Notes (optional)</label>
              <textarea
                className="mt-2 w-full min-h-[90px] px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm"
                placeholder="Anything the coach should remember..."
                value={editAthlete?.notes || ""}
                onChange={(e) =>
                  setEditAthlete((prev) => ({ ...prev, notes: e.target.value }))
                }
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={closeEdit}>
                Cancel
              </Button>
              <Button onClick={saveEdit} disabled={editSaving}>
                {editSaving ? "Saving..." : "Save"}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Modal>
      </main>
    </div>
  );
}
