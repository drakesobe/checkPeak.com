// pages/org/dashboard.js
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";

import { normalizeEmail, toCSV, downloadTextFile, safeJson } from "@/lib/org/dashboard-utils";

import { useBillingStatus }  from "@/hooks/org/useBillingStatus";
import { useOrgOverview }    from "@/hooks/org/useOrgOverview";
import { usePlanTemplates }  from "@/hooks/org/usePlanTemplates";
import { useTodayWorkouts }  from "@/hooks/org/useTodayWorkouts";

import BillingGateScreen     from "@/components/org/dashboard/BillingGateScreen";
import DashboardHeader       from "@/components/org/dashboard/DashboardHeader";
import DashboardSection      from "@/components/org/dashboard/DashboardSection";
import DashboardStatsGrid    from "@/components/org/dashboard/DashboardStatsGrid";

import TodayWorkoutsPanel    from "@/components/org/dashboard/TodayWorkoutsPanel";
import TodayNutritionPanel   from "@/components/org/dashboard/TodayNutritionPanel";

import ActivityTemplatesPanel from "@/components/org/dashboard/ActivityTemplatesPanel";

import EditAthleteModal      from "@/components/org/dashboard/EditAthleteModal";

import { DS }                from "@/components/org/dashboard/DashboardUI";
import { normalizeRole, getOrgName } from "@/components/org/dashboard/format";

export default function OrgDashboard() {
  const router = useRouter();
  const { user, logout, authReady } = useAuthContext();

  /* ── identity ── */
  const role      = useMemo(() => normalizeRole(user?.role || user?.Role), [user]);
  const isOrgSide = role === "organization" || role === "admin" || role === "trainer";

  const orgName  = useMemo(() => getOrgName(user, role),    [user, role]);
  const orgEmail = useMemo(() => String(user?.Email || user?.email || ""), [user]);
  const orgToken = useMemo(() =>
    String(user?.Token || user?.token || user?.["Organization Token"] || "").trim(), [user]);
  const orgId    = useMemo(() => String(user?.orgId || user?.OrgId || "").trim(), [user]);

  /* ── route gate ── */
  useEffect(() => {
    if (!authReady) return;                              // ← wait for localStorage hydration
    if (!user)              { router.push("/");          return; }
    if (role && !isOrgSide) { router.push("/dashboard"); return; }
  }, [authReady, user, role, isOrgSide, router]);

  /* ── billing ── */
  const { loading: billingLoading, error: billingErr, billing, isPaidOk: isPaidOkRaw } =
    useBillingStatus({ user, role, isOrgSide, enabled: Boolean(user && isOrgSide && role !== "trainer") });

  const isPaidOk = role === "trainer" ? true : isPaidOkRaw;

  /* ── data ── */
  const {
    loading, error, stats, athletes, setAthletes,
    recentActivity, refresh: refreshOverview, abort: abortOverview,
  } = useOrgOverview();

  const { templates, refresh: refreshTemplates, abort: abortTemplates } = usePlanTemplates();

  /* ── today workouts — single source of truth for both the stat card and the panel ── */
  const todayWorkouts = useTodayWorkouts({ isOrgSide });

  /*
   * Merge the live workout numbers from useTodayWorkouts into the stats object
   * so DashboardStatsGrid shows the exact same figures as TodayWorkoutsPanel.
   * getOrgOverview's own workout fields are intentionally overwritten here.
   */
  const mergedStats = useMemo(() => ({
    ...stats,
    workoutsTodayPercent:   todayWorkouts.summary?.completionPct  ?? 0,
    workoutsTodayCompleted: todayWorkouts.summary?.completedCount  ?? 0,
    workoutsTodayTotal:     todayWorkouts.summary?.itemCount       ?? 0,
  }), [stats, todayWorkouts.summary]);

  const didInitialLoadRef = useRef(false);
  useEffect(() => {
    if (!user || !isOrgSide || billingLoading || !isPaidOk) return;
    if (didInitialLoadRef.current) return;
    didInitialLoadRef.current = true;
    refreshOverview();
    refreshTemplates();
    return () => { abortOverview(); abortTemplates(); };
  }, [user, isOrgSide, billingLoading, isPaidOk, refreshOverview, refreshTemplates, abortOverview, abortTemplates]);

  /* ── roster UI ── */
  const [search,     setSearch]     = useState("");
  const [filterMode, setFilterMode] = useState("all");
  const [sortMode,   setSortMode]   = useState("priority");
  const [expanded,   setExpanded]   = useState({});

  /* ── edit modal ── */
  const [editOpen,    setEditOpen]    = useState(false);
  const [editSaving,  setEditSaving]  = useState(false);
  const [editErr,     setEditErr]     = useState("");
  const [editAthlete, setEditAthlete] = useState(null);

  /* ── nav ── */
  const goBuildPlan = useCallback((athleteEmail, templateId = "") => {
    const e  = normalizeEmail(athleteEmail);
    const qs = new URLSearchParams();
    if (e)          qs.set("athleteEmail", e);
    if (templateId) qs.set("template", templateId);
    router.push(`/org/prescriptions${qs.toString() ? `?${qs.toString()}` : ""}`);
  }, [router]);

  const goHistory           = useCallback((email) => {
    const e = normalizeEmail(email); if (!e) return;
    router.push(`/org/prescriptions?athleteEmail=${encodeURIComponent(e)}`);
  }, [router]);

  const openWorkoutsCalendar = useCallback(() => router.push("/org/workouts-calendar"), [router]);
  const goAccount            = useCallback(() => router.push("/account"),               [router]);

  /* ── actions ── */
  const onLogout = useCallback(async () => {
    try { await logout?.(); } finally { router.push("/"); }
  }, [logout, router]);

  const exportCSV = useCallback(() => {
    const rows = [[
      "Athlete Name","Athlete Email","Status","Tags",
      "Plans Count","Last Plan At","Last Plan Title","Needs Plan","Needs Update (Stale)",
    ]];
    (Array.isArray(athletes) ? athletes : []).forEach((a) => {
      rows.push([
        a?.name || "",a?.email || "",a?.status || "",
        Array.isArray(a?.tags) ? a.tags.join(" | ") : "",
        a?.plansCount || 0,a?.lastPlanAt || "",a?.lastPlanTitle || "",
        a?.needsPlan ? "YES" : "NO",a?.stale ? "YES" : "NO",
      ]);
    });
    downloadTextFile(
      `org_roster_${String(orgName || "org").replace(/\s+/g, "_").toLowerCase()}.csv`,
      toCSV(rows), "text/csv"
    );
  }, [athletes, orgName]);

  /* ── edit handlers ── */
  const openEdit = useCallback((athlete) => {
    setEditErr("");
    setEditAthlete({
      email:  normalizeEmail(athlete?.email),
      name:   athlete?.name   || "",
      status: athlete?.status || "Active",
      tags:   Array.isArray(athlete?.tags) ? athlete.tags : [],
      notes:  athlete?.notes  || "",
    });
    setEditOpen(true);
  }, []);

  const closeEdit = useCallback(() => { setEditOpen(false); setEditErr(""); setEditAthlete(null); }, []);

  const saveEdit = useCallback(async () => {
    setEditErr("");
    if (!editAthlete?.email) { setEditErr("Missing athlete email."); return; }
    setEditSaving(true);
    try {
      const res  = await fetch("/api/org/updateAthleteMeta", {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteEmail: editAthlete.email, status: editAthlete.status,
          tags: editAthlete.tags, notes: editAthlete.notes,
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to update athlete");
      setAthletes((prev) => {
        const list = Array.isArray(prev) ? [...prev] : [];
        const idx  = list.findIndex((x) => normalizeEmail(x?.email) === normalizeEmail(editAthlete.email));
        if (idx >= 0) list[idx] = {
          ...list[idx],
          status: data?.athlete?.status || editAthlete.status,
          tags:   data?.athlete?.tags   || editAthlete.tags,
          notes:  data?.athlete?.notes  || editAthlete.notes,
        };
        return list;
      });
      closeEdit();
    } catch (err) {
      setEditErr(err?.message || "Failed to save.");
    } finally {
      setEditSaving(false);
    }
  }, [editAthlete, setAthletes, closeEdit]);

  /* ── billing gate ── */
  if (!authReady || billingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: DS.pageBg }}>
        <p className="text-xs font-bold" style={{ color: DS.dimText }}>Loading…</p>
      </div>
    );
  }

  if (billingErr || !isPaidOk) {
    return (
      <BillingGateScreen
        role={role} billing={billing} error={billingErr}
        onLogout={onLogout} onGoAccount={() => router.push("/account")}
      />
    );
  }

  /* ── page ── */
  return (
    <div className="min-h-screen" style={{ backgroundColor: DS.pageBg, color: DS.bodyText }}>

      {/* Slim nav header */}
      <DashboardHeader
        orgName={orgName}
        orgEmail={orgEmail}
        orgToken={orgToken}
        orgId={orgId}
        loading={loading}
        error={error}
        onRefresh={refreshOverview}
        onOpenCalendar={openWorkoutsCalendar}
        onExportCSV={exportCSV}
        disableExport={!athletes?.length}
        onLogout={onLogout}
        onGoInvite={goAccount}
      />

      <main className="max-w-7xl mx-auto px-4 py-5 space-y-5">

        {/* 1. Program Pulse — stats + urgency directive */}
        <DashboardSection
          title="Program Pulse"
          subtitle="Coverage and today's activity. The directive line tells you what to do first."
        >
          {/* mergedStats overwrites getOrgOverview's workout numbers with the
              live figures from useTodayWorkouts so this card always matches
              the Workouts panel below. */}
          <DashboardStatsGrid stats={mergedStats} />
        </DashboardSection>

        {/* 2. Today — workouts + nutrition side by side */}
        <div>
          <p
            className="text-xs font-black uppercase tracking-wider mb-3"
            style={{ color: DS.labelText }}
          >
            Today
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Pass the already-running hook result down — no second fetch */}
            <TodayWorkoutsPanel
              onOpenCalendar={openWorkoutsCalendar}
              isOrgSide={isOrgSide}
              todayWorkouts={todayWorkouts}
            />
            <TodayNutritionPanel
              onGoNutrition={() => router.push("/org/nutrition")}
              onViewAthleteNutrition={(t) => router.push(`/org/nutrition/athlete/${encodeURIComponent(t || "")}`)}
              onBuildNutritionPlan={(t)   => router.push(`/org/nutrition/athlete/${encodeURIComponent(t || "")}`)}
            />
          </div>
        </div>

        {/* 3. Activity + Templates */}
        <ActivityTemplatesPanel
          loading={loading}
          recentActivity={recentActivity}
          templates={templates}
          onRefreshActivity={refreshOverview}
          onRefreshTemplates={refreshTemplates}
          onViewHistory={goHistory}
          onUseTemplate={(id) => goBuildPlan("", id)}
          activityLimit={8}
          templateLimit={6}
          defaultCollapsed={false}
        />

      </main>

      <EditAthleteModal
        open={editOpen}
        athlete={editAthlete}
        setAthlete={setEditAthlete}
        saving={editSaving}
        error={editErr}
        onClose={closeEdit}
        onSave={saveEdit}
      />
    </div>
  );
}