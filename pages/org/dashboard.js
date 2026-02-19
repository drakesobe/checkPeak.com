// pages/org/dashboard.js
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";

import { normalizeEmail, toCSV, downloadTextFile, safeJson } from "@/lib/org/dashboard-utils";

import { useBillingStatus } from "@/hooks/org/useBillingStatus";
import { useOrgOverview } from "@/hooks/org/useOrgOverview";
import { usePlanTemplates } from "@/hooks/org/usePlanTemplates";

import BillingGateScreen from "@/components/org/dashboard/BillingGateScreen";
import DashboardHeader from "@/components/org/dashboard/DashboardHeader";
import DashboardSection from "@/components/org/dashboard/DashboardSection";
import DashboardStatsGrid from "@/components/org/dashboard/DashboardStatsGrid";

import TodayWorkoutsPanel from "@/components/org/dashboard/TodayWorkoutsPanel";
import TodayNutritionPanel from "@/components/org/dashboard/TodayNutritionPanel";

import RosterSection from "@/components/org/dashboard/RosterSection";
import ActivityTemplatesPanel from "@/components/org/dashboard/ActivityTemplatesPanel";

import EditAthleteModal from "@/components/org/dashboard/EditAthleteModal";

import { normalizeRole, getOrgName } from "@/components/org/dashboard/format";

export default function OrgDashboard() {
  const router = useRouter();
  const { user, logout } = useAuthContext();

  /* ---------------- role + org identity ---------------- */

  const role = useMemo(() => normalizeRole(user?.role || user?.Role), [user]);
  const isOrgSide = role === "organization" || role === "admin" || role === "trainer";

  const orgName = useMemo(() => getOrgName(user, role), [user, role]);
  const orgEmail = useMemo(() => String(user?.Email || user?.email || ""), [user]);

  const orgToken = useMemo(
    () => String(user?.Token || user?.token || user?.["Organization Token"] || "").trim(),
    [user]
  );

  const orgId = useMemo(() => String(user?.orgId || user?.OrgId || "").trim(), [user]);

  const origin = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  const inviteLink = useMemo(() => {
    if (!origin || !orgToken) return "";
    return `${origin}/signup?role=athlete&token=${encodeURIComponent(orgToken)}`;
  }, [origin, orgToken]);

  /* ---------------- route gating ---------------- */

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

  /* ---------------- billing gate ---------------- */

  // Pass user/role/isOrgSide so the hook can settle properly and avoid “stuck loading”
  const {
    loading: billingLoading,
    error: billingErr,
    billing,
    isPaidOk,
  } = useBillingStatus({
    user,
    role,
    isOrgSide,
    enabled: Boolean(user && isOrgSide),
  });

  /* ---------------- data hooks ---------------- */

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

  // One-time initial load guard (only after billing ok)
  const didInitialLoadRef = useRef(false);

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

  /* ---------------- local UI state (roster controls) ---------------- */

  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState("all");
  const [sortMode, setSortMode] = useState("priority");
  const [expanded, setExpanded] = useState({});

  /* ---------------- edit modal state ---------------- */

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState("");
  const [editAthlete, setEditAthlete] = useState(null);

  /* ---------------- navigation helpers ---------------- */

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

  /* ---------------- actions ---------------- */

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

  /* ---------------- edit modal handlers ---------------- */

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
  }, [editAthlete, setAthletes, closeEdit]);

  /* ---------------- billing gate rendering ---------------- */

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

  if (billingErr || !isPaidOk) {
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

  /* ---------------- page ---------------- */

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-8">
        {/* Header */}
        <DashboardHeader
          orgName={orgName}
          orgEmail={orgEmail}
          orgToken={orgToken}
          orgId={orgId}
          inviteLink={inviteLink}
          loading={loading}
          error={error}
          onRefresh={refreshOverview}
          onOpenCalendar={openWorkoutsCalendar}
          onExportCSV={exportCSV}
          disableExport={!athletes?.length}
          onLogout={onLogout}
        />

        {/* PROGRAM HEALTH / PULSE (TOP) */}
        <DashboardSection
          title="Program pulse"
          subtitle="Quick confidence check. These numbers are meant to keep you oriented, not overwhelmed."
        >
          <DashboardStatsGrid stats={stats} />

          {/* Optional tiny helper line under the cards (kept short) */}
          <p className="mt-3 text-[12px] text-gray-600">
            If coverage is low, start in the roster (Needs Plan / Needs Update). Today % moves live as athletes submit.
          </p>
        </DashboardSection>

        {/* TODAY COMMAND CENTER (50/50) */}
        <DashboardSection
          title="Today command center"
          subtitle="Fast glance. Workouts + nutrition side-by-side. Refresh if something looks off."
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TodayWorkoutsPanel onOpenCalendar={openWorkoutsCalendar} isOrgSide={isOrgSide} />
            <TodayNutritionPanel
              onGoNutrition={() => router.push("/org/nutrition")}
              onViewAthleteNutrition={(athleteToken) =>
                router.push(`/org/nutrition/athlete/${encodeURIComponent(athleteToken || "")}`)
              }
              onBuildNutritionPlan={(athleteToken) =>
                router.push(`/org/nutrition/athlete/${encodeURIComponent(athleteToken || "")}`)
              }
            />
          </div>
        </DashboardSection>

        {/* ROSTER (FULL WIDTH) */}
        <DashboardSection
          title="Roster"
          subtitle="This is the operating table. Filter, scan, and build plans quickly."
        >
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
            pageSize={25}
          />
        </DashboardSection>

        {/* ACTIVITY + TEMPLATES (NEW SECTION) */}
        <DashboardSection
          title="Reference & speed"
          subtitle="Recent plan actions + templates in one place."
        >
          <ActivityTemplatesPanel
            loading={loading}
            recentActivity={recentActivity}
            templates={templates}
            onRefreshActivity={refreshOverview}
            onRefreshTemplates={refreshTemplates}
            onViewHistory={goHistory}
            onUseTemplate={(id) => goBuildPlan("", id)}
            activityLimit={6}
            templateLimit={6}
          />
        </DashboardSection>

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
