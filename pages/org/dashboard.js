// pages/org/dashboard.js
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import {
  RefreshCcw,
  LogOut,
  Users,
  FileText,
  Activity,
  ArrowRight,
  Link as LinkIcon,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Download,
  LayoutDashboard,
  ClipboardList,
  CalendarDays,
  Lock,
} from "lucide-react";

import {
  normalizeEmail,
  classNames,
  toCSV,
  downloadTextFile,
  safeJson,
} from "@/lib/org/dashboard-utils";

import { useOrgOverview } from "@/hooks/org/useOrgOverview";
import { usePlanTemplates } from "@/hooks/org/usePlanTemplates";

import {
  Button,
  Pill,
  StatCard,
  CopyButton,
} from "@/components/org/dashboard/DashboardUI";

import TodayWorkoutsPanel from "@/components/org/dashboard/TodayWorkoutsPanel";
import RosterSection from "@/components/org/dashboard/RosterSection";
import RecentActivityPanel from "@/components/org/dashboard/RecentActivityPanel";
import EditAthleteModal from "@/components/org/dashboard/EditAthleteModal";

/* ---------------------------- helpers ---------------------------- */

function fmtDate(v) {
  if (!v) return "—";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return String(v);
  }
}

/* ---------------------------- Gate UI ---------------------------- */

function BillingGateScreen({ role, billing, error, onLogout, onGoAccount }) {
  const canManageBilling = role === "admin" || role === "organization";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-white rounded-3xl shadow-md border border-blue-100 p-7">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
              <Lock className="w-5 h-5 text-[#46769B]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wide text-[#46769B]">CHECKPEAK</p>
              <h1 className="text-2xl font-extrabold text-gray-900 mt-1">Subscription required</h1>
              <p className="text-sm text-gray-600 mt-2">
                Your organization’s access is currently locked. Start a subscription to continue using the org dashboard.
              </p>
            </div>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-700">{error}</p>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold text-gray-600">Status</div>
                <div className="text-sm font-semibold text-gray-900 mt-1">
                  {billing?.statusRaw || billing?.status || "—"}
                </div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold text-gray-600">Trial ends</div>
                <div className="text-sm font-semibold text-gray-900 mt-1">{fmtDate(billing?.trialEnds)}</div>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-col sm:flex-row gap-2 sm:justify-end">
            {canManageBilling ? (
              <Button variant="dark" onClick={onGoAccount} className="w-full sm:w-auto">
                Manage Billing
                <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <div className="text-sm text-gray-600 py-2">
                Ask your Org Owner/Admin to update billing in <span className="font-semibold">Account → Billing</span>.
              </div>
            )}

            <Button variant="secondary" onClick={onLogout} className="w-full sm:w-auto">
              <LogOut className="w-4 h-4" />
              Log out
            </Button>
          </div>

          <div className="mt-4 text-[11px] text-gray-500">
            Note: Billing IDs (Stripe Customer/Subscription) should never be manually entered by users. They’re set by
            Stripe checkout + webhooks.
          </div>
        </div>
      </main>
    </div>
  );
}

/* ---------------------------- Page ---------------------------- */

export default function OrgDashboard() {
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

  const origin = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  const inviteLink = useMemo(() => {
    if (!origin || !orgToken) return "";
    return `${origin}/signup?role=athlete&token=${encodeURIComponent(orgToken)}`;
  }, [origin, orgToken]);

  // Data hooks
  const {
    loading,
    error,
    stats,
    athletes,
    setAthletes,
    recentActivity,
    refresh: refreshOverview,
    abort: abortOverview,
  } = useOrgOverview();

  const { templates, refresh: refreshTemplates, abort: abortTemplates } = usePlanTemplates();

  // One-time initial load guard
  const didInitialLoadRef = useRef(false);

  // Local UI state (kept in page so roster section stays controlled)
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState("all");
  const [sortMode, setSortMode] = useState("priority");
  const [expanded, setExpanded] = useState({});

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState("");
  const [editAthlete, setEditAthlete] = useState(null);

  // ---------------- Billing Gate State ----------------
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingErr, setBillingErr] = useState("");
  const [billing, setBilling] = useState(null);

  const isPaidOk = Boolean(billing?.isPaidOk);

  // Role gating
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
   * Billing gate: READ-ONLY status check
   * - Does NOT create or update Billing records
   * - Prevents duplicate/empty Airtable Billing rows
   */
  useEffect(() => {
    let mounted = true;

    async function run() {
      if (!user) return;
      if (!isOrgSide) return;

      setBillingLoading(true);
      setBillingErr("");

      try {
        const res = await fetch("/api/org/billing/status", {
          method: "GET",
          credentials: "include",
        });

        const json = await safeJson(res);
        if (!res.ok) throw new Error(json?.error || "Failed to load billing status.");

        if (mounted) setBilling(json?.billing || null);
      } catch (e) {
        if (mounted) setBillingErr(e?.message || "Failed to load billing status.");
      } finally {
        if (mounted) setBillingLoading(false);
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, [user, isOrgSide]);

  // Initial load (only after billing is OK)
  useEffect(() => {
    if (!user) return;
    if (!isOrgSide) return;
    if (billingLoading) return;
    if (!isPaidOk) return;

    if (didInitialLoadRef.current) return;
    didInitialLoadRef.current = true;

    refreshOverview();
    refreshTemplates();

    return () => {
      abortOverview();
      abortTemplates();
    };
  }, [
    user,
    isOrgSide,
    billingLoading,
    isPaidOk,
    refreshOverview,
    refreshTemplates,
    abortOverview,
    abortTemplates,
  ]);

  // Counts + headline
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

  const goBuildPlan = useCallback(
    (athleteEmail, templateId = "") => {
      const e = normalizeEmail(athleteEmail);
      const qs = new URLSearchParams();
      if (e) qs.set("athleteEmail", e);
      if (templateId) qs.set("template", templateId);
      router.push(`/org/prescriptions${qs.toString() ? `?${qs.toString()}` : ""}`);
    },
    [router]
  );

  const goHistory = useCallback(
    (athleteEmail) => {
      const e = normalizeEmail(athleteEmail);
      if (!e) return;
      router.push(`/org/prescriptions?athleteEmail=${encodeURIComponent(e)}`);
    },
    [router]
  );

  const openWorkoutsCalendar = useCallback(() => {
    router.push("/org/workouts-calendar");
  }, [router]);

  const onLogout = useCallback(async () => {
    try {
      await logout?.();
    } finally {
      router.push("/");
    }
  }, [logout, router]);

  const exportCSV = useCallback(() => {
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
  }, [athletes, orgName]);

  const openEdit = useCallback((athlete) => {
    setEditErr("");
    setEditAthlete({
      email: normalizeEmail(athlete?.email),
      name: athlete?.name || "",
      status: athlete?.status || "Active",
      tags: Array.isArray(athlete?.tags) ? athlete.tags : [],
      notes: athlete?.notes || "",
    });
    setEditOpen(true);
  }, []);

  const closeEdit = useCallback(() => {
    setEditOpen(false);
    setEditErr("");
    setEditAthlete(null);
  }, []);

  const saveEdit = useCallback(async () => {
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

      setAthletes((prev) => {
        const list = Array.isArray(prev) ? [...prev] : [];
        const idx = list.findIndex((x) => normalizeEmail(x?.email) === normalizeEmail(editAthlete.email));
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
  }, [editAthlete, setAthletes, closeEdit]);

  // If billing gate says "not paid", show gate screen (instead of dashboard)
  if (billingLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
        <main className="max-w-3xl mx-auto px-4 py-10">
          <div className="bg-white rounded-3xl shadow-md border border-blue-100 p-7">
            <p className="text-sm text-gray-600">Loading billing status…</p>
          </div>
        </main>
      </div>
    );
  }

  if (!billingErr && !isPaidOk) {
    return (
      <BillingGateScreen
        role={role}
        billing={billing}
        error={billingErr}
        onLogout={onLogout}
        onGoAccount={() => router.push("/account")}
      />
    );
  }

  // If billing check errored, also show gate screen (so it doesn’t leak dashboard)
  if (billingErr) {
    return (
      <BillingGateScreen
        role={role}
        billing={billing}
        error={billingErr}
        onLogout={onLogout}
        onGoAccount={() => router.push("/account")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="w-6 h-6 text-[#46769B]" />
                <h1 className="text-2xl font-extrabold truncate">{orgName}</h1>
              </div>
              <p className="text-sm text-gray-600 mt-1 break-all">
                Logged in as <span className="font-semibold">{orgEmail}</span>
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

                <Pill tone="good">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  Billing OK
                </Pill>

                <Pill>
                  <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
                  {triageHeadline}
                </Pill>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:justify-end">
              <Button
                variant="secondary"
                onClick={refreshOverview}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                <RefreshCcw className="w-4 h-4" />
                Refresh
              </Button>

              <Button
                variant="secondary"
                onClick={openWorkoutsCalendar}
                className="w-full sm:w-auto"
                title="Open workouts calendar"
              >
                <CalendarDays className="w-4 h-4" />
                Workouts calendar
              </Button>

              <Button
                variant="secondary"
                onClick={exportCSV}
                disabled={!athletes?.length}
                className="w-full sm:w-auto"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </Button>

              <Button variant="dark" onClick={onLogout} className="w-full sm:w-auto">
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

        {/* Today */}
        <TodayWorkoutsPanel onOpenCalendar={openWorkoutsCalendar} isOrgSide={isOrgSide} />

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
          icon={Users}
          label="Athletes"
          value={stats.totalAthletes || 0}
          sub="Roster size"
          href="/org/athletes"
        />

        <StatCard
          icon={ClipboardList}
          label="Total Plans"
          value={stats.totalPlans || 0}
          sub="Active prescriptions"
          href="/org/prescriptions"
        />

        <StatCard
          icon={ShieldCheck}
          label="Coverage"
          value={`${stats.coveragePercent || 0}%`}
          sub="Athletes with plans"
          href="/org/prescriptions"
        />

        <StatCard
          icon={AlertTriangle}
          label="Needs Plan"
          value={stats.needsPlan || 0}
          sub="Action required"
          href="/org/prescriptions"
        />
        </div>

        {/* Templates + Invite */}
        <div className="grid lg:grid-cols-12 gap-6">
          <section className="lg:col-span-4 bg-white rounded-2xl shadow-md border border-blue-100 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold">Templates</h2>
                <p className="text-sm text-gray-600 mt-1">
                  One click to preload a plan (then tweak).
                </p>
              </div>
              <Button
                variant="secondary"
                className="px-3 py-2 text-xs shrink-0"
                onClick={refreshTemplates}
              >
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
                    <p className="text-sm font-extrabold text-gray-900 break-words">{t.name}</p>
                    <p className="text-[11px] text-gray-500 mt-1 break-words">{t.description}</p>
                    <div className="mt-3">
                      <Button
                        variant="secondary"
                        className="px-3 py-2 text-xs w-full sm:w-auto"
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

          <section className="lg:col-span-8 bg-white rounded-2xl shadow-md border border-blue-100 p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold">Invite Athletes</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Token + link are always visible for coaching ops.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                <CopyButton text={orgToken} label="Copy token" compact />
                <CopyButton text={inviteLink} label="Copy link" compact />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <div className="lg:col-span-8">
            <RosterSection
              athletes={athletes}
              templates={templates}
              expanded={expanded}
              setExpanded={setExpanded}
              search={search}
              setSearch={setSearch}
              filterMode={filterMode}
              setFilterMode={setFilterMode}
              sortMode={sortMode}
              setSortMode={setSortMode}
              onEdit={openEdit}
              onHistory={goHistory}
              onBuild={goBuildPlan}
            />
          </div>

          <div className="lg:col-span-4">
            <RecentActivityPanel
              loading={loading}
              recentActivity={recentActivity}
              onRefresh={refreshOverview}
              onViewHistory={goHistory}
            />
          </div>
        </div>

        {/* Edit Modal */}
        <EditAthleteModal
          open={editOpen}
          athlete={editAthlete}
          setAthlete={setEditAthlete}
          saving={editSaving}
          error={editErr}
          onClose={closeEdit}
          onSave={saveEdit}
        />
      </main>
    </div>
  );
}
