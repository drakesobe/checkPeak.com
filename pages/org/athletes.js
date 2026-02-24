// pages/org/athletes.js
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/hooks/useAuth";
import { Toaster } from "react-hot-toast";

import { cleanString, clamp, normalizeRole, getOrgKey } from "@/lib/org/athletes/utils";

import { useLocalStorageState } from "@/hooks/org/athletes/useLocalStorageState";
import { useOrgAthletes } from "@/hooks/org/athletes/useOrgAthletes";
import { useAthletesShortcuts } from "@/hooks/org/athletes/useAthletesShortcuts";
import { useAthletesRosterActions } from "@/hooks/org/athletes/useAthletesRosterActions";

import AthleteDrawer from "@/components/org/athletes/AthleteDrawer";
import AthletesToolbar from "@/components/org/athletes/AthletesToolbar";
import AthletesList from "@/components/org/athletes/AthletesList";
import AthletesBulkBar from "@/components/org/athletes/AthletesBulkBar";

import AthletesHeader from "@/components/org/athletes/AthletesHeader";
import SavedViewsBar from "@/components/org/athletes/SavedViewsBar";
import AthletesStats from "@/components/org/athletes/AthletesStats";
import BatchProgressCard from "@/components/org/athletes/BatchProgressCard";
import DesktopActionRow from "@/components/org/athletes/DesktopActionRow";

export default function OrgAthletesPage() {
  const router = useRouter();
  const { user } = useAuthContext();

  const searchRef = useRef(null);

  // role gate
  const role = useMemo(() => normalizeRole(user), [user]);
  const isOrgSide = role === "organization" || role === "admin" || role === "trainer";

  // stable org key for localStorage
  const orgKey = useMemo(() => getOrgKey(user), [user]);
  const LS_COACH = useMemo(() => `${orgKey}:athleteCoachState:v2`, [orgKey]);
  const LS_VIEWS = useMemo(() => `${orgKey}:athleteSavedViews:v1`, [orgKey]);

  // persisted local state
  const [coachState, setCoachState] = useLocalStorageState(LS_COACH, { done: {}, starred: {}, notes: {} });
  const [savedViews, setSavedViews] = useLocalStorageState(LS_VIEWS, []);

  // server data
  const { loading, error, athletes, athletesMap, fetchAthletes } = useOrgAthletes({
    enabled: !!user && isOrgSide,
  });

  // UX controls
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all"); // all | ready | incomplete | done | starred
  const [sortKey, setSortKey] = useState("createdAt"); // createdAt | name | email
  const [sortDir, setSortDir] = useState("desc"); // asc | desc
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  // selection + row highlight
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [activeRowId, setActiveRowId] = useState("");

  // drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerAthleteId, setDrawerAthleteId] = useState("");

  // note autosave indicator (drawer)
  const [noteDirty, setNoteDirty] = useState(false);
  const noteSaveTimer = useRef(null);

  // Guard: must be org-side
  useEffect(() => {
    if (!user) return;
    if (!isOrgSide) router.push("/dashboard");
  }, [user, isOrgSide, router]);

  // Refresh: keep UX sane
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

  // derived stats
  const stats = useMemo(() => {
    const total = athletes.length;
    const ready = athletes.filter((a) => !!a.email).length;
    const incomplete = total - ready;

    const doneCount = athletes.reduce((acc, a) => acc + (coachState?.done?.[a.id] ? 1 : 0), 0);
    const starredCount = athletes.reduce((acc, a) => acc + (coachState?.starred?.[a.id] ? 1 : 0), 0);

    let newest = "";
    for (const a of athletes) {
      const t = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const cur = newest ? new Date(newest).getTime() : 0;
      if (t && t > cur) newest = a.createdAt;
    }

    return { total, ready, incomplete, doneCount, starredCount, newest };
  }, [athletes, coachState]);

  // filtered/sorted list
  const filtered = useMemo(() => {
    const q = cleanString(query).toLowerCase();
    let list = athletes;

    if (q) {
      list = list.filter((a) => {
        const name = String(a.name || "").toLowerCase();
        const email = String(a.email || "").toLowerCase();
        const title = String(a.title || "").toLowerCase();
        return name.includes(q) || email.includes(q) || title.includes(q);
      });
    }

    if (filter === "ready") list = list.filter((a) => !!a.email);
    if (filter === "incomplete") list = list.filter((a) => !a.email);
    if (filter === "done") list = list.filter((a) => !!coachState?.done?.[a.id]);
    if (filter === "starred") list = list.filter((a) => !!coachState?.starred?.[a.id]);

    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      if (sortKey === "email")
        return String(a.email || "").localeCompare(String(b.email || "")) * dir;

      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return (ta - tb) * dir;
    });
  }, [athletes, query, filter, sortKey, sortDir, coachState]);

  // paging
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((filtered.length || 1) / pageSize)),
    [filtered.length, pageSize]
  );
  const safePage = useMemo(() => clamp(page, 1, totalPages), [page, totalPages]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safePage]);

  const paged = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    const end = start + pageSize;
    return filtered.slice(start, end);
  }, [filtered, safePage, pageSize]);

  // progress within current filtered list
  const batchProgress = useMemo(() => {
    const total = filtered.length;
    const done = filtered.reduce((acc, a) => acc + (coachState?.done?.[a.id] ? 1 : 0), 0);
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { total, done, pct };
  }, [filtered, coachState]);

  // selection derived
  const selectedList = useMemo(() => {
    if (!selectedIds || selectedIds.size === 0) return [];
    return Array.from(selectedIds)
      .map((id) => athletesMap.get(id))
      .filter(Boolean);
  }, [selectedIds, athletesMap]);

  const selectedEmails = useMemo(
    () => selectedList.map((a) => a.email).filter(Boolean),
    [selectedList]
  );

  const isDone = (id) => !!coachState?.done?.[id];
  const isStarred = (id) => !!coachState?.starred?.[id];

  // drawer athlete
  const drawerAthlete = useMemo(
    () => athletesMap.get(drawerAthleteId) || null,
    [athletesMap, drawerAthleteId]
  );

  const openDrawer = (id) => {
    setDrawerAthleteId(id);
    setDrawerOpen(true);
    setActiveRowId(id);
  };

  const closeDrawer = () => setDrawerOpen(false);

  // queue logic
  const getNextUpId = () => {
    if (!filtered.length) return "";
    for (const a of filtered) if (!coachState?.done?.[a.id]) return a.id;
    return filtered[0]?.id || "";
  };

  const goNextUp = () => {
    const id = getNextUpId();
    if (!id) return;
    openDrawer(id);
  };

  const goNextAfter = (currentId) => {
    if (!filtered.length) return;
    const idx = filtered.findIndex((a) => a.id === currentId);
    if (idx < 0) return;

    for (let step = 1; step <= filtered.length; step++) {
      const a = filtered[(idx + step) % filtered.length];
      if (!coachState?.done?.[a.id]) {
        openDrawer(a.id);
        return;
      }
    }

    const next = filtered[(idx + 1) % filtered.length];
    if (next) openDrawer(next.id);
  };

  // actions hook (exports/copy/bulk/toggles)
  const actions = useAthletesRosterActions({
    router,
    coachState,
    setCoachState,
    selectedIds,
    setSelectedIds,
    paged,
    filtered,
    selectedList,
    selectedEmails,
    openDrawer,
    goNextAfter,
  });

  // note setter (keeps the same debounce/saving UX)
  const setNoteForDrawer = (val) => {
    if (!drawerAthlete) return;

    setNoteDirty(true);
    if (noteSaveTimer.current) clearTimeout(noteSaveTimer.current);
    noteSaveTimer.current = setTimeout(() => setNoteDirty(false), 650);

    setCoachState((prev) => {
      const next = { ...prev, notes: { ...(prev?.notes || {}) } };
      next.notes[drawerAthlete.id] = val;
      return next;
    });
  };

  // keyboard shortcuts
  useAthletesShortcuts({
    enabled: !!user && isOrgSide,
    drawerOpen,
    drawerAthlete,
    filtered,
    paged,
    activeRowId,
    searchRef,
    closeDrawer,
    openDrawer,
    setActiveRowId,
    toggleSelect: actions.toggleSelect,
    openPrescriptions: actions.openPrescriptions,
    toggleDoneAndMaybeAdvance: actions.toggleDoneAndMaybeAdvance,
    toggleStarred: actions.toggleStarred,
    athletesMap,
    goNextUp,
  });

  // keep UX consistent: reset paging/selection when key controls change
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, sortKey, sortDir, pageSize]);

  const onSearchChange = (val) => {
    setQuery(val);
    setPage(1);
    setSelectedIds(new Set());
  };

  const onReset = () => {
    setQuery("");
    setFilter("all");
    setSortKey("createdAt");
    setSortDir("desc");
    setPage(1);
    setSelectedIds(new Set());
  };

  // saved views
  const saveCurrentView = () => {
    const name = window.prompt("Name this view:", "Ready queue");
    if (!name) return;

    const view = {
      id: Math.random().toString(36).slice(2),
      name: String(name).trim(),
      state: { query, filter, sortKey, sortDir, pageSize },
      createdAt: Date.now(),
    };

    setSavedViews((prev) => [view, ...(Array.isArray(prev) ? prev : [])].slice(0, 12));
  };

  const applyView = (view) => {
    const s = view?.state || {};
    setQuery(s.query ?? "");
    setFilter(s.filter ?? "all");
    setSortKey(s.sortKey ?? "createdAt");
    setSortDir(s.sortDir ?? "desc");
    setPageSize(s.pageSize ?? 50);
    setPage(1);
    setSelectedIds(new Set());
  };

  const deleteView = (id) => {
    setSavedViews((prev) => (Array.isArray(prev) ? prev.filter((v) => v.id !== id) : []));
  };

  const cardCls = "bg-white rounded-2xl shadow-md border border-blue-100";
  const inputBase =
    "w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900">
      <Toaster position="top-center" />

      <AthleteDrawer
        open={drawerOpen}
        athlete={drawerAthlete}
        onClose={closeDrawer}
        onNextUp={goNextUp}
        batchProgress={batchProgress}
        isDone={isDone}
        isStarred={isStarred}
        onOpenPrescriptions={actions.openPrescriptions}
        onCopyEmail={(em) => actions.copyText(em, "Email copied")}
        onToggleDoneAuto={(id) => actions.toggleDoneAndMaybeAdvance(id, true)}
        onToggleStar={actions.toggleStarred}
        noteDirty={noteDirty}
        noteValue={
          drawerAthlete ? cleanString(coachState?.notes?.[drawerAthlete.id] || "") : ""
        }
        onNoteChange={setNoteForDrawer}
      />

      <main className="max-w-6xl mx-auto px-4 py-8 pb-28 space-y-6">
        <AthletesHeader
          cardClass={cardCls}
          onDashboard={() => router.push("/org/dashboard")}
          onSaveView={saveCurrentView}
          onNextUp={goNextUp}
          onRefresh={refresh}
          disableNextUp={loading || filtered.length === 0}
          refreshing={loading}
        />

        <SavedViewsBar
          cardClass={cardCls}
          views={savedViews}
          onApply={applyView}
          onDelete={deleteView}
        />

        <AthletesStats stats={stats} />

        <BatchProgressCard cardClass={cardCls} batchProgress={batchProgress} />

        <AthletesToolbar
          cardClass={cardCls}
          inputClass={inputBase}
          error={error}
          query={query}
          setQuery={onSearchChange}
          sortKey={sortKey}
          setSortKey={setSortKey}
          sortDir={sortDir}
          toggleSortDir={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          pageSize={pageSize}
          setPageSize={(n) => {
            setPageSize(n);
            setPage(1);
            setSelectedIds(new Set());
          }}
          onReset={onReset}
          filter={filter}
          setFilter={(k) => {
            setFilter(k);
            setPage(1);
            setSelectedIds(new Set());
          }}
          stats={stats}
          pagedCount={paged.length}
          filteredCount={filtered.length}
          selectedCount={selectedIds.size}
          safePage={safePage}
          totalPages={totalPages}
          onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
          onNextPage={() => setPage((p) => Math.min(totalPages, p + 1))}
          searchRef={searchRef}
        />

        <DesktopActionRow
          onSelectPage={actions.selectAllOnPage}
          onClearSelection={actions.clearSelection}
          onExportFiltered={actions.exportFilteredCsv}
          selectedCount={selectedIds.size}
        />

        {loading ? (
          <div className={`${cardCls} p-6 text-sm text-gray-600`}>Loading athletes…</div>
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
            copyEmail={(em) => actions.copyText(em, "Email copied")}
            activeRowId={activeRowId}
            setActiveRowId={setActiveRowId}
            cardClass={cardCls}
          />
        )}
      </main>

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
      />
    </div>
  );
}