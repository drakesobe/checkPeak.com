// pages/org/athletes.js
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/hooks/useAuth";
import { Toaster, toast } from "react-hot-toast";

import { useBillingGate }   from "@/hooks/org/useBillingGate";
import BillingGateScreen    from "@/components/org/reviewQueue/BillingGateScreen";
import BillingLoadingScreen from "@/components/org/reviewQueue/BillingLoadingScreen";

import { cleanString, clamp, normalizeRole, getOrgKey } from "@/lib/org/athletes/utils";

import { useLocalStorageState }      from "@/hooks/org/athletes/useLocalStorageState";
import { useOrgAthletes }            from "@/hooks/org/athletes/useOrgAthletes";
import { useAthletesShortcuts }      from "@/hooks/org/athletes/useAthletesShortcuts";
import { useAthletesRosterActions }  from "@/hooks/org/athletes/useAthletesRosterActions";

import AthleteDrawer       from "@/components/org/athletes/AthleteDrawer";
import AthletesToolbar     from "@/components/org/athletes/AthletesToolbar";
import AthletesList        from "@/components/org/athletes/AthletesList";
import AthletesBulkBar     from "@/components/org/athletes/AthletesBulkBar";
import AthletesHeader      from "@/components/org/athletes/AthletesHeader";
import AthletesStats       from "@/components/org/athletes/AthletesStats";
import AthleteImportModal  from "@/components/org/athletes/AthleteImportModal"; // ← NEW

// Absorbed stubs
import BatchProgressCard from "@/components/org/athletes/BatchProgressCard";
import DesktopActionRow  from "@/components/org/athletes/DesktopActionRow";
import SavedViewsBar     from "@/components/org/athletes/SavedViewsBar";

export default function OrgAthletesPage() {
  const router = useRouter();
  const { user, logout } = useAuthContext();

  const searchRef = useRef(null);

  const role      = useMemo(() => normalizeRole(user), [user]);
  const isOrgSide = role === "organization" || role === "admin" || role === "trainer";

  const { billingLoading, billingErr, billing, isPaidOk, rawIsPaidOk, isAdminBypass } = useBillingGate({ user, role, isOrgSide });
  const showBillingWarning = isAdminBypass && !rawIsPaidOk;
  const onLogout = useCallback(async () => {
    try { await logout?.(); } finally { router.push("/"); }
  }, [logout, router]);

  // Plan-based athlete cap
  const athleteLimit = useMemo(() => {
    const p = String(billing?.plan || "").trim().toLowerCase();
    if (p === "starter") return 10;
    if (p === "growth")  return 59;
    return Infinity; // Pro, sandbox, trial — unrestricted
  }, [billing?.plan]);

  const orgKey  = useMemo(() => getOrgKey(user), [user]);
  const LS_COACH = useMemo(() => `${orgKey}:athleteCoachState:v2`, [orgKey]);
  const LS_VIEWS = useMemo(() => `${orgKey}:athleteSavedViews:v1`,  [orgKey]);

  const [coachState, setCoachState] = useLocalStorageState(LS_COACH, { done: {}, starred: {}, notes: {} });
  const [savedViews, setSavedViews] = useLocalStorageState(LS_VIEWS, []);

  const { loading, error, athletes, athletesMap, fetchAthletes, setAthletesRaw } = useOrgAthletes({
    enabled: !!user && isOrgSide,
  });

  const [query,       setQuery]       = useState("");
  const [filter,      setFilter]      = useState("all");
  const [sortKey,     setSortKey]     = useState("createdAt");
  const [sortDir,     setSortDir]     = useState("desc");
  const [pageSize,    setPageSize]    = useState(50);
  const [page,        setPage]        = useState(1);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [activeRowId, setActiveRowId] = useState("");
  const [drawerOpen,       setDrawerOpen]       = useState(false);
  const [drawerAthleteId,  setDrawerAthleteId]  = useState("");
  const [noteDirty,        setNoteDirty]        = useState(false);
  const [importOpen,       setImportOpen]       = useState(false); // ← NEW
  const noteSaveTimer = useRef(null);

  useEffect(() => {
    if (!user) return;
    if (!isOrgSide) router.push("/dashboard");
  }, [user, isOrgSide, router]);

  const refresh = useCallback(async () => {
    const res = await fetchAthletes();
    if (res?.ok) {
      setSelectedIds(new Set());
      setPage(1);
      setActiveRowId("");
      setDrawerOpen(false);
      setDrawerAthleteId("");
    }
  }, [fetchAthletes]);

  // Derived stats
  const stats = useMemo(() => {
    const total        = athletes.length;
    const ready        = athletes.filter(a => !!a.email).length;
    const incomplete   = total - ready;
    const doneCount    = athletes.reduce((acc, a) => acc + (coachState?.done?.[a.id]    ? 1 : 0), 0);
    const starredCount = athletes.reduce((acc, a) => acc + (coachState?.starred?.[a.id] ? 1 : 0), 0);
    let newest = "";
    for (const a of athletes) {
      const t   = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const cur = newest ? new Date(newest).getTime() : 0;
      if (t && t > cur) newest = a.createdAt;
    }
    return { total, ready, incomplete, doneCount, starredCount, newest };
  }, [athletes, coachState]);

  // Filtered / sorted list
  const filtered = useMemo(() => {
    const q = cleanString(query).toLowerCase();
    let list = athletes;
    if (q) {
      list = list.filter(a => {
        const name  = String(a.name  || "").toLowerCase();
        const email = String(a.email || "").toLowerCase();
        const title = String(a.title || "").toLowerCase();
        const sport = String(a.sport || "").toLowerCase();
        const team  = String(a.team  || "").toLowerCase();
        return name.includes(q) || email.includes(q) || title.includes(q) || sport.includes(q) || team.includes(q);
      });
    }
    if (filter === "ready")      list = list.filter(a =>  !!a.email);
    if (filter === "incomplete") list = list.filter(a => !a.email);
    if (filter === "done")       list = list.filter(a =>  !!coachState?.done?.[a.id]);
    if (filter === "starred")    list = list.filter(a =>  !!coachState?.starred?.[a.id]);
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === "name")  return a.name.localeCompare(b.name) * dir;
      if (sortKey === "email") return String(a.email || "").localeCompare(String(b.email || "")) * dir;
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return (ta - tb) * dir;
    });
  }, [athletes, query, filter, sortKey, sortDir, coachState]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil((filtered.length || 1) / pageSize)), [filtered.length, pageSize]);
  const safePage   = useMemo(() => clamp(page, 1, totalPages), [page, totalPages]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safePage]);

  const paged = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const selectedList = useMemo(() => {
    if (!selectedIds || selectedIds.size === 0) return [];
    return Array.from(selectedIds).map(id => athletesMap.get(id)).filter(Boolean);
  }, [selectedIds, athletesMap]);

  const selectedEmails = useMemo(() => selectedList.map(a => a.email).filter(Boolean), [selectedList]);

  const isDone    = id => !!coachState?.done?.[id];
  const isStarred = id => !!coachState?.starred?.[id];

  const drawerAthlete = useMemo(() => athletesMap.get(drawerAthleteId) || null, [athletesMap, drawerAthleteId]);

  const openDrawer  = id => { setDrawerAthleteId(id); setDrawerOpen(true); setActiveRowId(id); };
  const closeDrawer = ()  => setDrawerOpen(false);

  const goNextAfter = currentId => {
    if (!filtered.length) return;
    const idx = filtered.findIndex(a => a.id === currentId);
    if (idx < 0) return;
    for (let step = 1; step <= filtered.length; step++) {
      const a = filtered[(idx + step) % filtered.length];
      if (!coachState?.done?.[a.id]) { openDrawer(a.id); return; }
    }
    const next = filtered[(idx + 1) % filtered.length];
    if (next) openDrawer(next.id);
  };

  const actions = useAthletesRosterActions({
    router, coachState, setCoachState, selectedIds, setSelectedIds,
    paged, filtered, selectedList, selectedEmails, openDrawer, goNextAfter, setAthletesRaw,
  });

  // Stats derived from the currently filtered list
  const filteredStats = useMemo(() => {
    const total        = filtered.length;
    const ready        = filtered.filter(a => !!a.email).length;
    const incomplete   = total - ready;
    const doneCount    = filtered.reduce((acc, a) => acc + (coachState?.done?.[a.id]    ? 1 : 0), 0);
    const starredCount = filtered.reduce((acc, a) => acc + (coachState?.starred?.[a.id] ? 1 : 0), 0);
    return { total, ready, incomplete, doneCount, starredCount };
  }, [filtered, coachState]);

  const setNoteForDrawer = val => {
    if (!drawerAthlete) return;
    setNoteDirty(true);
    if (noteSaveTimer.current) clearTimeout(noteSaveTimer.current);
    noteSaveTimer.current = setTimeout(() => setNoteDirty(false), 650);
    setCoachState(prev => {
      const next = { ...prev, notes: { ...(prev?.notes || {}) } };
      next.notes[drawerAthlete.id] = val;
      return next;
    });
  };

  useAthletesShortcuts({
    enabled: !!user && isOrgSide,
    drawerOpen, drawerAthlete, filtered, paged, activeRowId, searchRef,
    closeDrawer, openDrawer, setActiveRowId,
    toggleSelect: actions.toggleSelect,
    openPrescriptions: actions.openPrescriptions,
    toggleDoneAndMaybeAdvance: actions.toggleDoneAndMaybeAdvance,
    toggleStarred: actions.toggleStarred,
    athletesMap,
  });

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, sortKey, sortDir, pageSize]);

  const onSearchChange = val => { setQuery(val); setPage(1); setSelectedIds(new Set()); };
  const onReset = () => {
    setQuery(""); setFilter("all"); setSortKey("createdAt"); setSortDir("desc");
    setPage(1); setSelectedIds(new Set());
  };

  // Saved views
  const saveCurrentView = () => {
    const name = window.prompt("Name this view:", "Ready queue");
    if (!name) return;
    const view = {
      id: Math.random().toString(36).slice(2),
      name: String(name).trim(),
      state: { query, filter, sortKey, sortDir, pageSize },
      createdAt: Date.now(),
    };
    setSavedViews(prev => [view, ...(Array.isArray(prev) ? prev : [])].slice(0, 12));
  };

  const applyView = view => {
    const s = view?.state || {};
    setQuery(s.query ?? ""); setFilter(s.filter ?? "all");
    setSortKey(s.sortKey ?? "createdAt"); setSortDir(s.sortDir ?? "desc");
    setPageSize(s.pageSize ?? 50); setPage(1); setSelectedIds(new Set());
  };

  const deleteView = id => setSavedViews(prev => Array.isArray(prev) ? prev.filter(v => v.id !== id) : []);

  const atAthleteLimit = athleteLimit !== Infinity && athletes.length >= athleteLimit;
  const handleImport = useCallback(() => {
    if (atAthleteLimit) {
      toast.error(
        `You've reached the ${athleteLimit}-athlete limit on the ${billing?.plan || "current"} plan. Upgrade to add more.`,
        { duration: 5000 }
      );
      return;
    }
    setImportOpen(true);
  }, [atAthleteLimit, athleteLimit, billing?.plan]);

  if (billingLoading) return <BillingLoadingScreen />;
  if (billingErr || !isPaidOk) {
    return (
      <BillingGateScreen
        role={role} billing={billing} error={billingErr}
        onLogout={onLogout} onGoAccount={() => router.push("/account")}
      />
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#F4F7FB", color: "#1A2535" }}>
      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: "#1E3A5F", color: "#fff", border: "1px solid #4A7FA5" },
        }}
      />

      <AthleteDrawer
        open={drawerOpen}
        athlete={drawerAthlete}
        onClose={closeDrawer}
        isDone={isDone}
        isStarred={isStarred}
        onOpenPrescriptions={actions.openPrescriptions}
        onCopyEmail={em => actions.copyText(em, "Email copied")}
        onToggleDoneAuto={id => actions.toggleDoneAndMaybeAdvance(id, true)}
        onToggleStar={actions.toggleStarred}
        noteDirty={noteDirty}
        noteValue={drawerAthlete ? cleanString(coachState?.notes?.[drawerAthlete.id] || "") : ""}
        onNoteChange={setNoteForDrawer}
        onDeleteAthlete={async (id) => {
          await actions.deleteAthlete(id);
          setDrawerOpen(false);
          setDrawerAthleteId("");
          await fetchAthletes();
        }}
        onSportSaved={(athleteId, newSport) => {
          setAthletesRaw(prev =>
            prev.map(a => a.id === athleteId ? { ...a, sport: newSport } : a)
          );
        }}
      />

      <main className="max-w-6xl mx-auto px-4 py-6 pb-28 space-y-4">

        {showBillingWarning && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs font-bold"
            style={{ backgroundColor: "#FFFBF0", border: "1px solid #FFE0A8", color: "#7A4A0A" }}>
            <span>⚠ Billing requires attention — your organization's subscription is not active.</span>
            <button type="button" onClick={() => router.push("/account")}
              className="shrink-0 px-3 py-1 font-black uppercase tracking-wider"
              style={{ backgroundColor: "#E87722", color: "#fff", border: "none", cursor: "pointer" }}
              onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}>
              Fix billing
            </button>
          </div>
        )}

        {/* ── Header ── */}
        <AthletesHeader
          onDashboard={() => router.push("/org/workouts-calendar")}
          onSaveView={saveCurrentView}
          onRefresh={refresh}
          refreshing={loading}
          savedViews={savedViews}
          onApplyView={applyView}
          onDeleteView={deleteView}
          onImport={handleImport}
        />

        {/* ── Plan limit indicator ── */}
        {athleteLimit !== Infinity && (
          <div
            className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs"
            style={{
              backgroundColor: atAthleteLimit ? "#FFF0F0" : "#F4F7FB",
              border: `1px solid ${atAthleteLimit ? "#FFC8C8" : "#E8ECF0"}`,
            }}
          >
            <div className="flex items-center gap-3">
              <span style={{ color: atAthleteLimit ? "#C8102E" : "#5A6A7D", fontWeight: 600 }}>
                {athletes.length} / {athleteLimit} athletes · {billing?.plan || "Starter"} plan
              </span>
              <div style={{ width: 72, height: 4, background: "#E8ECF0", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${Math.min(100, (athletes.length / athleteLimit) * 100)}%`,
                  background: atAthleteLimit ? "#C8102E" : athletes.length >= athleteLimit * 0.8 ? "#E87722" : "#00873E",
                  borderRadius: 2,
                  transition: "width 0.3s",
                }} />
              </div>
            </div>
            {atAthleteLimit && (
              <button
                type="button"
                onClick={() => router.push("/account")}
                className="shrink-0 px-3 py-1 text-xs font-black uppercase tracking-wider"
                style={{ backgroundColor: "#1E3A5F", color: "#fff", border: "none", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.opacity = "0.85"; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
              >
                Upgrade plan
              </button>
            )}
          </div>
        )}

        {/* ── Toolbar ── */}
        <AthletesToolbar
          error={error}
          query={query}
          setQuery={onSearchChange}
          sortKey={sortKey}
          setSortKey={setSortKey}
          sortDir={sortDir}
          toggleSortDir={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
          pageSize={pageSize}
          setPageSize={n => { setPageSize(n); setPage(1); setSelectedIds(new Set()); }}
          onReset={onReset}
          filter={filter}
          setFilter={k => { setFilter(k); setPage(1); setSelectedIds(new Set()); }}
          stats={stats}
          pagedCount={paged.length}
          filteredCount={filtered.length}
          selectedCount={selectedIds.size}
          safePage={safePage}
          totalPages={totalPages}
          onPrevPage={() => setPage(p => Math.max(1, p - 1))}
          onNextPage={() => setPage(p => Math.min(totalPages, p + 1))}
          searchRef={searchRef}
          onSelectPage={actions.selectAllOnPage}
          onClearSelection={actions.clearSelection}
          onExportFiltered={actions.exportFilteredCsv}
        />

        {/* ── Stats ── */}
        {!loading && <AthletesStats stats={stats} filteredStats={filteredStats} />}

        {/* ── Athlete list ── */}
        {loading ? (
          <div
            className="rounded-2xl px-5 py-8 text-center text-sm"
            style={{ background: "#FFFFFF", border: "1px solid #E8ECF0", color: "#9BA8B4" }}
          >
            Loading athletes…
          </div>
        ) : (
          <AthletesList
            paged={paged}
            selectedIds={selectedIds}
            toggleSelect={actions.toggleSelect}
            openDrawer={openDrawer}
            isDone={isDone}
            isStarred={isStarred}
            toggleStarred={actions.toggleStarred}
            toggleDone={actions.toggleDoneAndMaybeAdvance}
            openPrescriptions={actions.openPrescriptions}
            copyEmail={em => actions.copyText(em, "Email copied")}
            activeRowId={activeRowId}
            setActiveRowId={setActiveRowId}
          />
        )}

      </main>

      {/* ── Sticky bulk action bar ── */}
      <AthletesBulkBar
        selectedCount={selectedIds.size}
        selectedEmailsCount={selectedEmails.length}
        canCopyEmails={selectedEmails.length > 0}
        onCopyEmails={actions.copySelectedEmails}
        onExportSelected={actions.exportSelectedCsv}
        onOpenTabs={actions.bulkOpenPrescriptions}
        onMarkDone={() => actions.bulkMarkDone(true)}
        onClearDone={() => actions.bulkMarkDone(false)}
        onStar={() => actions.bulkStar(true)}
        onUnstar={() => actions.bulkStar(false)}
        onClear={actions.clearSelection}
        onBulkSetSport={actions.bulkSetSport}
      />

      {/* ── Import modal ── */}
      <AthleteImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={refresh}
      />
    </div>
  );
}