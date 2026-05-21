"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";

import CreateWorkoutModal  from "@/components/org/CreateWorkoutModal";
import CalendarHeader      from "@/components/org/workoutsCalendar/CalendarHeader";
import SportsMoreModal     from "@/components/org/workoutsCalendar/SportsMoreModal";
import WeekView            from "@/components/org/workoutsCalendar/WeekView";
import MonthView           from "@/components/org/workoutsCalendar/MonthView";
import DaySheet            from "@/components/org/workoutsCalendar/DaySheet";
import ComplianceDrawer    from "@/components/org/workoutsCalendar/ComplianceDrawer";
import SeasonCalendarModal from "@/components/org/workoutsCalendar/SeasonCalendarModal";
import CoachDaySchedule    from "@/components/org/workoutsCalendar/CoachDaySchedule";

import {
  addDays, dateToISO, endOfMonth, endOfWeek,
  isoToDate, nyDateISO, startOfMonth, startOfWeek,
} from "@/lib/org/workoutsCalendar/date";
import { normalizeSport, titleSport } from "@/lib/org/workoutsCalendar/sports";
import { DS } from "@/components/org/dashboard/DashboardUI";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeJson(res) { return res.json().catch(() => ({})); }

function groupByDate(workouts) {
  const map = {};
  (Array.isArray(workouts) ? workouts : []).forEach((w) => {
    const iso = String(w?.Date || "").slice(0, 10);
    if (!iso) return;
    if (!map[iso]) map[iso] = [];
    map[iso].push(w);
  });
  Object.keys(map).forEach((k) => {
    map[k].sort((a, b) => String(a?.Title || "").localeCompare(String(b?.Title || "")));
  });
  return map;
}

function sumCounts(list) {
  const ws = Array.isArray(list) ? list : [];
  let wc = ws.length, ac = 0, ic = 0;
  ws.forEach((w) => { ac += Number(w?.athleteCount || 0); ic += Number(w?.itemCount || 0); });
  return { workoutsCount: wc, athleteCount: ac, itemCount: ic };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkoutsCalendarPage() {
  const router = useRouter();
  const { user } = useAuthContext();
  const [mounted, setMounted] = useState(false);

  const LS_KEY  = "org_workouts_calendar_sports_v1";
  const LS_VIEW = "org_workouts_calendar_view_v1";

  // ── Calendar state ──
  const [viewMode,       setViewMode]       = useState("week");
  const [todayISO,       setTodayISO]       = useState("2000-01-01");
  const [anchorISO,      setAnchorISO]      = useState("2000-01-01");
  const [selectedSports, setSelectedSports] = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [err,            setErr]            = useState("");
  const [workouts,       setWorkouts]       = useState([]);

  // ── Modals ──
  const [complianceOpen,     setComplianceOpen]     = useState(false);
  const [seasonCalendarOpen, setSeasonCalendarOpen] = useState(false);
  const [sportsModal,        setSportsModal]        = useState(false);
  const [dayOpen,            setDayOpen]            = useState(false);
  const [selectedDayISO,     setSelectedDayISO]     = useState("2000-01-01");
  const [availableSports,    setAvailableSports]    = useState([]);
  const [createOpen,         setCreateOpen]         = useState(false);
  const [createDayISO,       setCreateDayISO]       = useState("2000-01-01");
  const [editWorkout,        setEditWorkout]        = useState(null);

  // ── Season calendar periods ──
  const [periods, setPeriods] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("org_season_calendar_v1");
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  });

  const cacheRef = useRef(new Map());
  const abortRef = useRef(null);

  // ── Role check ──
  const role = useMemo(() => {
    const r = String(user?.role || user?.Role || "").trim().toLowerCase();
    if (r === "organization" || r.includes("org"))   return "organization";
    if (r === "admin"        || r.includes("admin")) return "admin";
    if (r === "trainer"      || r.includes("train")) return "trainer";
    if (r.includes("ath"))                           return "athlete";
    return r;
  }, [user]);

  const isOrgSide = role === "organization" || role === "admin" || role === "trainer";

  const memberId = useMemo(() =>
    String(user?.memberId || user?.orgId || "default"),
  [user]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!user) return;
    if (!isOrgSide) router.push("/dashboard");
  }, [user, isOrgSide, router]);

  // ── Sports list ──
  const SPORTS_ALL = useMemo(() => [
    "soccer","football","track","swim","baseball","softball",
    "hockey","tennis","xc","basketball","wrestling",
  ], []);

  // ── Hydrate from localStorage ──
  useEffect(() => {
    if (!mounted) return;
    try {
      const t = nyDateISO();
      setTodayISO(t);
      setAnchorISO((prev) => (prev && prev !== "2000-01-01" ? prev : t));
      setSelectedDayISO((prev) => (prev === "2000-01-01" ? t : prev));
    } catch {}
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      const parsed = JSON.parse(raw || "[]");
      if (Array.isArray(parsed)) setSelectedSports(parsed.map(normalizeSport).filter(Boolean));
    } catch {}
    try {
      const raw = window.localStorage.getItem(LS_VIEW);
      if (raw === "week" || raw === "month") setViewMode(raw);
    } catch {}
  }, [mounted]);

  // ── Persist prefs ──
  useEffect(() => {
    if (!mounted) return;
    try { window.localStorage.setItem(LS_KEY, JSON.stringify(selectedSports)); } catch {}
  }, [selectedSports, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try { window.localStorage.setItem(LS_VIEW, viewMode); } catch {}
  }, [viewMode, mounted]);

  // ── Fetch season calendar ──
  useEffect(() => {
    if (!mounted) return;
    fetch("/api/org/season-calendar/get", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data?.periods)) {
          setPeriods(data.periods);
          try { window.localStorage.setItem("org_season_calendar_v1", JSON.stringify(data.periods)); } catch {}
        }
      })
      .catch(e => console.warn("[workouts-calendar] season calendar fetch:", e?.message));
  }, [mounted]);

  // ── Date math ──
  const anchorDate = useMemo(() => {
    try { return isoToDate(anchorISO); } catch { return new Date(); }
  }, [anchorISO]);

  const weekStartsOn = 0;

  const range = useMemo(() => {
    if (viewMode === "week") {
      const s = startOfWeek(anchorDate, weekStartsOn);
      const e = endOfWeek(anchorDate, weekStartsOn);
      return { start: dateToISO(s), end: dateToISO(e), gridStart: s, gridEnd: e };
    }
    const mStart    = startOfMonth(anchorDate);
    const mEnd      = endOfMonth(anchorDate);
    const gridStart = startOfWeek(mStart, weekStartsOn);
    const gridEnd   = endOfWeek(mEnd, weekStartsOn);
    return { start: dateToISO(gridStart), end: dateToISO(gridEnd), gridStart, gridEnd };
  }, [anchorDate, viewMode, weekStartsOn]);

  const days = useMemo(() => {
    const out = [];
    let cur   = new Date(range.gridStart);
    const end = new Date(range.gridEnd);
    while (cur <= end) { out.push(dateToISO(cur)); cur = addDays(cur, 1); }
    return out;
  }, [range]);

  const weekDays = useMemo(() => {
    const list = [];
    const s    = isoToDate(range.start);
    for (let i = 0; i < 7; i++) list.push(dateToISO(addDays(s, i)));
    return list;
  }, [range.start]);

  const workoutsByDate = useMemo(() => groupByDate(workouts), [workouts]);

  const sportsKey = useMemo(() => {
    return (Array.isArray(selectedSports) ? selectedSports : []).slice().sort().join(",");
  }, [selectedSports]);

  const cacheKey = useMemo(
    () => `range|${range.start}|${range.end}|${sportsKey || "ALL"}`,
    [range.start, range.end, sportsKey]
  );

  const buildRangeURL = useCallback(() => {
    const params   = new URLSearchParams();
    params.set("start", range.start);
    params.set("end",   range.end);
    const selected = Array.isArray(selectedSports) ? selectedSports.filter(Boolean) : [];
    if (selected.length === 1) {
      params.set("sport", titleSport(selected[0]));
    } else if (selected.length > 1) {
      params.set("sports", selected.join(","));
      params.set("sport",  titleSport(selected[0]));
    }
    return `/api/org/workouts/range?${params.toString()}`;
  }, [range.start, range.end, selectedSports]);

  const fetchRange = useCallback(async (force = false) => {
    if (!isOrgSide || !mounted) return;
    setErr("");
    if (!force && cacheRef.current.has(cacheKey)) {
      setWorkouts(cacheRef.current.get(cacheKey));
      setLoading(false);
      return;
    }
    if (abortRef.current) { try { abortRef.current.abort(); } catch {} }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const res  = await fetch(buildRangeURL(), { credentials: "include", signal: ctrl.signal });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to load workouts range");
      const list = Array.isArray(data?.workouts) ? data.workouts : [];
      cacheRef.current.set(cacheKey, list);
      setWorkouts(list);
    } catch (e) {
      if (String(e?.name || "").toLowerCase().includes("abort")) return;
      setErr(e?.message || "Failed to load workouts.");
      setWorkouts([]);
    } finally {
      setLoading(false);
    }
  }, [isOrgSide, mounted, cacheKey, buildRangeURL]);

  useEffect(() => {
    if (!user || !isOrgSide || !mounted) return;
    fetchRange(false);
  }, [user, isOrgSide, mounted, cacheKey, fetchRange]);

  useEffect(() => {
    const date = selectedDayISO === "2000-01-01" ? todayISO : selectedDayISO;
    if (!date || !isOrgSide || !mounted) return;
    fetch(`/api/org/workouts/day?date=${date}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : {})
      .then(data => {
        if (Array.isArray(data?.availableSports)) setAvailableSports(data.availableSports);
      })
      .catch(() => {});
  }, [selectedDayISO, todayISO, isOrgSide, mounted]);

  // ── Navigation ──
  const goToday = () => setAnchorISO(todayISO);

  const prev = () => {
    const d = isoToDate(anchorISO);
    if (viewMode === "week") setAnchorISO(dateToISO(addDays(d, -7)));
    else setAnchorISO(dateToISO(new Date(d.getFullYear(), d.getMonth() - 1, 1, 12)));
  };

  const next = () => {
    const d = isoToDate(anchorISO);
    if (viewMode === "week") setAnchorISO(dateToISO(addDays(d, 7)));
    else setAnchorISO(dateToISO(new Date(d.getFullYear(), d.getMonth() + 1, 1, 12)));
  };

  const monthLabel = useMemo(() => {
    const d = isoToDate(anchorISO);
    return d.toLocaleString(undefined, { month: "long", year: "numeric" });
  }, [anchorISO]);

  const weekLabel = useMemo(() => {
    const s = isoToDate(range.start);
    const e = isoToDate(range.end);
    const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
    const left  = s.toLocaleString(undefined, { month: "short", day: "numeric" });
    const right = e.toLocaleString(undefined, { month: sameMonth ? undefined : "short", day: "numeric", year: "numeric" });
    return `${left} – ${right}`;
  }, [range.start, range.end]);

  // ── Day sheet ──
  const openDay  = (iso) => {
    const clean = String(iso || "").slice(0, 10);
    setSelectedDayISO(clean);
    setDayOpen(true);
  };
  const closeDay = () => setDayOpen(false);

  // ── Create / Edit ──
  const openCreateForDay = (iso) => {
    setEditWorkout(null);
    setCreateDayISO(String(iso || "").slice(0, 10) || todayISO);
    setCreateOpen(true);
  };

  const handleEditWorkout = useCallback((editData) => {
    setEditWorkout(editData || null);
    setCreateDayISO(String(editData?.dateISO || todayISO).slice(0, 10) || todayISO);
    setCreateOpen(true);
  }, [todayISO]);

  // ── Derived labels ──
  const defaultSportForCreate = useMemo(
    () => (selectedSports.length === 1 ? titleSport(selectedSports[0]) : ""),
    [selectedSports]
  );

  const filterLabel = useMemo(() => {
    if (!selectedSports.length) return "";
    const names = selectedSports.map((s) => titleSport(s)).filter(Boolean);
    return names.length <= 3 ? names.join(", ") : `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
  }, [selectedSports]);

  const rangeSummary = useMemo(() => {
    const list    = Array.isArray(workouts) ? workouts : [];
    const totals  = sumCounts(list);
    const uniqueDs = new Set(list.map((w) => String(w?.Date || "").slice(0, 10)).filter(Boolean));
    const bySport = {};
    list.forEach((w) => {
      const s = normalizeSport(w?.Sport || "");
      if (!s) return;
      bySport[s] = (bySport[s] || 0) + 1;
    });
    return { ...totals, uniqueDaysCount: uniqueDs.size, bySport };
  }, [workouts]);

  const clientReady = mounted && todayISO && anchorISO;
  const sidebarDate = selectedDayISO === "2000-01-01" ? todayISO : selectedDayISO;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{
      backgroundColor: DS.pageBg,
      minHeight: "100vh",
      color: DS.bodyText,
      fontFamily: "-apple-system, 'Helvetica Neue', Arial, sans-serif",
    }}>

      {/* ── Responsive layout CSS ── */}
      <style>{`
        .cal-layout {
          display: flex;
          flex-direction: column;
          align-items: stretch;
        }
        .cal-main {
          width: 100%;
          min-width: 0;
          padding: 16px 14px;
        }
        .cal-sidebar {
          width: 100%;
          border-top: 1px solid ${DS.border};
          min-height: 420px;
        }
        @media (min-width: 900px) {
          .cal-layout { flex-direction: row; }
          .cal-main {
            flex: 0 0 75%;
            padding: 16px 20px;
          }
          .cal-sidebar {
            flex: 0 0 25%;
            min-width: 260px;
            max-width: 360px;
            border-top: none;
            border-left: 1px solid ${DS.border};
            position: sticky;
            top: 0;
            height: 100vh;
            overflow-y: auto;
            min-height: unset;
          }
        }
      `}</style>

      {/* ── Header ── */}
      <CalendarHeader
        viewMode={viewMode}
        setViewMode={setViewMode}
        weekLabel={clientReady ? weekLabel : "-"}
        monthLabel={clientReady ? monthLabel : "-"}
        selectedSports={selectedSports}
        setSelectedSports={setSelectedSports}
        SPORTS_ALL={SPORTS_ALL}
        onOpenMoreSports={() => setSportsModal(true)}
        err={err}
        loading={loading || !clientReady}
        rangeSummary={rangeSummary}
        onGoDashboard={() => router.push("/org/dashboard")}
        onRefresh={() => fetchRange(true)}
        onGoToday={goToday}
        onPrev={prev}
        onNext={next}
        onCreateToday={() => openCreateForDay(todayISO)}
        onOpenCompliance={() => setComplianceOpen(true)}
        onOpenSeasonCalendar={() => setSeasonCalendarOpen(true)}
      />

      {/* ── Main: calendar + coach schedule ── */}
      <div className="cal-layout">

        {/* Calendar */}
        <div className="cal-main">

          {/* Filter strip */}
          {!loading && filterLabel && (
            <div style={{
              marginBottom: 8, padding: "8px 14px",
              backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}`,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: DS.brand }}>
                Filtered: {filterLabel}
              </span>
              <button
                type="button"
                onClick={() => setSelectedSports([])}
                style={{
                  fontSize: 10, fontWeight: 900, color: DS.brand,
                  background: "none", border: "none", cursor: "pointer",
                  textTransform: "uppercase", letterSpacing: "0.06em", marginLeft: 4,
                }}
              >
                Clear
              </button>
            </div>
          )}

          {/* Calendar card */}
          <div style={{
            backgroundColor: DS.cardBg,
            border: `1px solid ${DS.border}`,
            borderTop: `3px solid ${DS.brand}`,
            overflow: "hidden",
          }}>
            {!mounted ? (
              <div style={{ minHeight: 320 }} />
            ) : viewMode === "week" ? (
              <WeekView
                weekDays={weekDays}
                todayISO={todayISO}
                loading={loading}
                workoutsByDate={workoutsByDate}
                onOpenDay={openDay}
                onCreateForDay={openCreateForDay}
              />
            ) : (
              <MonthView
                monthDays={days}
                anchorISO={anchorISO}
                todayISO={todayISO}
                loading={loading}
                workoutsByDate={workoutsByDate}
                onOpenDay={openDay}
                onJumpToMonth={(iso) => setAnchorISO(iso)}
              />
            )}
          </div>
        </div>

        {/* Coach schedule */}
        <div className="cal-sidebar">
          <CoachDaySchedule
            selectedDate={sidebarDate}
            workoutsByDate={workoutsByDate}
            sports={availableSports.length ? availableSports : SPORTS_ALL}
            memberId={memberId}
          />
        </div>

      </div>

      {/* ── Modals + drawers ── */}
      <SportsMoreModal
        open={sportsModal}
        onClose={() => setSportsModal(false)}
        sportsAll={SPORTS_ALL}
        selectedSports={selectedSports}
        setSelectedSports={setSelectedSports}
      />

      <CreateWorkoutModal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setEditWorkout(null); }}
        editWorkout={editWorkout}
        dateISO={createDayISO}
        sport={defaultSportForCreate}
        periods={periods}
        onCreated={() => {
          setCreateOpen(false);
          setEditWorkout(null);
          fetchRange(true);
          setSelectedDayISO(createDayISO);
          setDayOpen(true);
        }}
        onUpdated={() => {
          const reopenISO = String(editWorkout?.dateISO || createDayISO).slice(0, 10);
          setCreateOpen(false);
          setEditWorkout(null);
          fetchRange(true);
          setSelectedDayISO(reopenISO);
          setDayOpen(true);
        }}
      />

      <DaySheet
        open={dayOpen}
        onClose={closeDay}
        titleISO={selectedDayISO}
        todayISO={todayISO}
        loading={loading || !clientReady}
        workoutsByDate={workoutsByDate}
        selectedSports={selectedSports}
        onCreateForDay={openCreateForDay}
        onEditWorkout={handleEditWorkout}
        onRefresh={() => fetchRange(true)}
      />

      <ComplianceDrawer
        open={complianceOpen}
        onClose={() => setComplianceOpen(false)}
      />

      <SeasonCalendarModal
        open={seasonCalendarOpen}
        onClose={() => setSeasonCalendarOpen(false)}
        onSaved={(savedPeriods) => setPeriods(savedPeriods)}
      />
    </div>
  );
}