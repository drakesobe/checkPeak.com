"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import { Filter } from "lucide-react";

import CreateWorkoutModal from "@/components/org/CreateWorkoutModal";
import CalendarHeader from "@/components/org/workoutsCalendar/CalendarHeader";
import SportsMoreModal from "@/components/org/workoutsCalendar/SportsMoreModal";
import WeekView from "@/components/org/workoutsCalendar/WeekView";
import MonthView from "@/components/org/workoutsCalendar/MonthView";
import DaySheet from "@/components/org/workoutsCalendar/DaySheet";

import {
  addDays,
  dateToISO,
  endOfMonth,
  endOfWeek,
  isoToDate,
  nyDateISO,
  startOfMonth,
  startOfWeek,
} from "@/lib/org/workoutsCalendar/date";
import { normalizeSport, titleSport } from "@/lib/org/workoutsCalendar/sports";

import { DS } from "@/components/org/dashboard/DashboardUI";

function safeJson(res) {
  return res.json().catch(() => ({}));
}

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
  let wc = ws.length,
    ac = 0,
    ic = 0;
  ws.forEach((w) => {
    ac += Number(w?.athleteCount || 0);
    ic += Number(w?.itemCount || 0);
  });
  return { workoutsCount: wc, athleteCount: ac, itemCount: ic };
}

const FALLBACK_ISO = "2000-01-01";
const FALLBACK_DATE = new Date("2000-01-01T12:00:00Z");

export default function WorkoutsCalendarPage() {
  const router = useRouter();
  const { user } = useAuthContext();
  const [mounted, setMounted] = useState(false);

  const LS_KEY = "org_workouts_calendar_sports_v1";
  const LS_VIEW = "org_workouts_calendar_view_v1";

  const [viewMode, setViewMode] = useState("week");
  const [todayISO, setTodayISO] = useState(FALLBACK_ISO);
  const [anchorISO, setAnchorISO] = useState(FALLBACK_ISO);
  const [selectedSports, setSelectedSports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [workouts, setWorkouts] = useState([]);

  const cacheRef = useRef(new Map());
  const abortRef = useRef(null);

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

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!isOrgSide) router.push("/dashboard");
  }, [user, isOrgSide, router]);

  const SPORTS_ALL = useMemo(
    () => [
      "soccer",
      "football",
      "track",
      "swim",
      "baseball",
      "softball",
      "hockey",
      "tennis",
      "xc",
      "basketball",
      "wrestling",
    ],
    []
  );

  useEffect(() => {
    if (!mounted) return;
    try {
      const t = nyDateISO();
      setTodayISO(t);
      setAnchorISO((prev) => (prev && prev !== FALLBACK_ISO ? prev : t));
    } catch {}
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      const parsed = JSON.parse(raw || "[]");
      if (Array.isArray(parsed)) {
        setSelectedSports(parsed.map(normalizeSport).filter(Boolean));
      }
    } catch {}
    try {
      const raw = window.localStorage.getItem(LS_VIEW);
      if (raw === "week" || raw === "month") setViewMode(raw);
    } catch {}
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(selectedSports));
    } catch {}
  }, [selectedSports, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      window.localStorage.setItem(LS_VIEW, viewMode);
    } catch {}
  }, [viewMode, mounted]);

  const anchorDate = useMemo(() => {
    if (!anchorISO) return FALLBACK_DATE;
    try {
      return isoToDate(anchorISO);
    } catch {
      return FALLBACK_DATE;
    }
  }, [anchorISO]);

  const weekStartsOn = 0;

  const range = useMemo(() => {
    if (viewMode === "week") {
      const s = startOfWeek(anchorDate, weekStartsOn);
      const e = endOfWeek(anchorDate, weekStartsOn);
      return { start: dateToISO(s), end: dateToISO(e), gridStart: s, gridEnd: e };
    }
    const mStart = startOfMonth(anchorDate);
    const mEnd = endOfMonth(anchorDate);
    const gridStart = startOfWeek(mStart, weekStartsOn);
    const gridEnd = endOfWeek(mEnd, weekStartsOn);
    return { start: dateToISO(gridStart), end: dateToISO(gridEnd), gridStart, gridEnd };
  }, [anchorDate, viewMode, weekStartsOn]);

  const days = useMemo(() => {
    const out = [];
    let cur = new Date(range.gridStart);
    const end = new Date(range.gridEnd);
    while (cur <= end) {
      out.push(dateToISO(cur));
      cur = addDays(cur, 1);
    }
    return out;
  }, [range]);

  const weekdayLabels = useMemo(() => {
    const base = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return weekStartsOn === 1 ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : base;
  }, [weekStartsOn]);

  const weekDays = useMemo(() => {
    const list = [];
    const s = isoToDate(range.start);
    for (let i = 0; i < 7; i++) list.push(dateToISO(addDays(s, i)));
    return list;
  }, [range.start]);

  const workoutsByDate = useMemo(() => groupByDate(workouts), [workouts]);

  const sportsKey = useMemo(() => {
    const s = Array.isArray(selectedSports) ? selectedSports : [];
    return s.slice().sort().join(",");
  }, [selectedSports]);

  const cacheKey = useMemo(
    () => `range|${range.start}|${range.end}|${sportsKey || "ALL"}`,
    [range.start, range.end, sportsKey]
  );

  const buildRangeURL = useCallback(() => {
    const params = new URLSearchParams();
    params.set("start", range.start);
    params.set("end", range.end);

    const selected = Array.isArray(selectedSports) ? selectedSports.filter(Boolean) : [];
    if (selected.length === 1) {
      params.set("sport", titleSport(selected[0]));
    } else if (selected.length > 1) {
      params.set("sports", selected.join(","));
      params.set("sport", titleSport(selected[0]));
    }

    return `/api/org/workouts/range?${params.toString()}`;
  }, [range.start, range.end, selectedSports]);

  const fetchRange = useCallback(
    async (force = false) => {
      if (!isOrgSide || !mounted) return;

      setErr("");

      if (!force && cacheRef.current.has(cacheKey)) {
        setWorkouts(cacheRef.current.get(cacheKey));
        setLoading(false);
        return;
      }

      if (abortRef.current) {
        try {
          abortRef.current.abort();
        } catch {}
      }

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);

      try {
        const res = await fetch(buildRangeURL(), {
          credentials: "include",
          signal: ctrl.signal,
        });
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
    },
    [isOrgSide, mounted, cacheKey, buildRangeURL]
  );

  useEffect(() => {
    if (!user || !isOrgSide || !mounted) return;
    fetchRange(false);
  }, [user, isOrgSide, mounted, cacheKey, fetchRange]);

  // Day sheet
  const [dayOpen, setDayOpen] = useState(false);
  const [selectedDayISO, setSelectedDayISO] = useState(FALLBACK_ISO);

  useEffect(() => {
    if (!mounted) return;
    setSelectedDayISO((prev) => (prev && prev !== FALLBACK_ISO ? prev : todayISO));
  }, [mounted, todayISO]);

  const openDay = (iso) => {
    setSelectedDayISO(String(iso || "").slice(0, 10));
    setDayOpen(true);
  };

  const closeDay = () => setDayOpen(false);

  // Create / Edit modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createDayISO, setCreateDayISO] = useState(FALLBACK_ISO);
  const [editWorkout, setEditWorkout] = useState(null);

  useEffect(() => {
    if (!mounted) return;
    setCreateDayISO((prev) => (prev && prev !== FALLBACK_ISO ? prev : todayISO));
  }, [mounted, todayISO]);

  const openCreateForDay = (iso) => {
    setEditWorkout(null);
    setCreateDayISO(String(iso || "").slice(0, 10) || todayISO);
    setCreateOpen(true);
  };

  const handleEditWorkout = useCallback(
    (editData) => {
      setEditWorkout(editData || null);
      setCreateDayISO(String(editData?.dateISO || todayISO).slice(0, 10) || todayISO);
      setCreateOpen(true);
    },
    [todayISO]
  );

  // Navigation
  const goToday = () => setAnchorISO(todayISO);

  const prev = () => {
    const d = isoToDate(anchorISO);
    if (viewMode === "week") setAnchorISO(dateToISO(addDays(d, -7)));
    else setAnchorISO(dateToISO(new Date(d.getFullYear(), d.getMonth() - 1, 1, 12, 0, 0)));
  };

  const next = () => {
    const d = isoToDate(anchorISO);
    if (viewMode === "week") setAnchorISO(dateToISO(addDays(d, 7)));
    else setAnchorISO(dateToISO(new Date(d.getFullYear(), d.getMonth() + 1, 1, 12, 0, 0)));
  };

  const monthLabel = useMemo(() => {
    const d = isoToDate(anchorISO);
    return d.toLocaleString(undefined, { month: "long", year: "numeric" });
  }, [anchorISO]);

  const weekLabel = useMemo(() => {
    const s = isoToDate(range.start);
    const e = isoToDate(range.end);
    const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
    const left = s.toLocaleString(undefined, { month: "short", day: "numeric" });
    const right = e.toLocaleString(undefined, {
      month: sameMonth ? undefined : "short",
      day: "numeric",
      year: "numeric",
    });
    return `${left} – ${right}`;
  }, [range.start, range.end]);

  const [sportsModal, setSportsModal] = useState(false);

  const statStrip = useMemo(() => {
    const list = Array.isArray(workouts) ? workouts : [];

    const todayList = list.filter((w) => String(w?.Date || "").slice(0, 10) === todayISO);
    const todayCount = todayList.length;

    const pendingCount = list.filter((w) => {
      const s = String(w?.Status || w?.status || "").toLowerCase();
      return !s.includes("complete") && !s.includes("archive") && !s.includes("reject");
    }).length;

    const completeCount = list.filter((w) =>
      String(w?.Status || w?.status || "").toLowerCase().includes("complete")
    ).length;

    const total = list.length;

    let urgencyLine = "";
    if (todayCount > 0 && pendingCount > 0) {
      urgencyLine = `${todayCount} workout${todayCount !== 1 ? "s" : ""} today · ${pendingCount} pending completion`;
    } else if (todayCount > 0) {
      urgencyLine = `${todayCount} workout${todayCount !== 1 ? "s" : ""} today · all complete`;
    } else if (pendingCount > 0) {
      urgencyLine = `${pendingCount} pending completion${pendingCount !== 1 ? "s" : ""} this ${viewMode}`;
    } else if (total > 0) {
      urgencyLine = `${total} workout${total !== 1 ? "s" : ""} · all complete`;
    } else {
      urgencyLine = `No workouts scheduled`;
    }

    return { todayCount, pendingCount, completeCount, total, urgencyLine };
  }, [workouts, todayISO, viewMode]);

  const rangeSummary = useMemo(() => {
    const list = Array.isArray(workouts) ? workouts : [];
    const totals = sumCounts(list);
    const uniqueDs = new Set(list.map((w) => String(w?.Date || "").slice(0, 10)).filter(Boolean));
    const bySport = {};

    list.forEach((w) => {
      const s = normalizeSport(w?.Sport || "");
      if (!s) return;
      bySport[s] = (bySport[s] || 0) + 1;
    });

    return { ...totals, uniqueDaysCount: uniqueDs.size, bySport };
  }, [workouts]);

  const defaultSportForCreate = useMemo(
    () => (selectedSports.length === 1 ? titleSport(selectedSports[0]) : ""),
    [selectedSports]
  );

  const filterLabel = useMemo(() => {
    if (!selectedSports.length) return "";
    const names = selectedSports.map((s) => titleSport(s)).filter(Boolean);
    return names.length <= 3 ? names.join(", ") : `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
  }, [selectedSports]);

  const clientReady = mounted && todayISO && anchorISO;

  return (
    <div className="min-h-screen" style={{ backgroundColor: DS.pageBg, color: DS.bodyText }}>
      <CalendarHeader
        viewMode={viewMode}
        setViewMode={setViewMode}
        weekLabel={clientReady ? weekLabel : "—"}
        monthLabel={clientReady ? monthLabel : "—"}
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
      />

      <main className="max-w-7xl mx-auto px-4 py-5">
        <div
          style={{
            backgroundColor: DS.cardBg,
            border: `1px solid ${DS.border}`,
            borderTop: `3px solid ${DS.brand}`,
          }}
        >
          {!loading && (
            <div
              className="px-5 py-2.5 flex flex-wrap items-center justify-between gap-3"
              style={{ borderBottom: `1px solid ${DS.border}`, backgroundColor: DS.pageBg }}
            >
              <span
                className="text-xs font-bold"
                style={{
                  color:
                    statStrip.pendingCount > 0
                      ? DS.caution
                      : statStrip.total > 0
                      ? DS.safe
                      : DS.dimText,
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: "14px",
                  fontWeight: 900,
                  letterSpacing: "0.02em",
                }}
              >
                {statStrip.urgencyLine}
              </span>

              <span className="text-xs" style={{ color: DS.dimText }}>
                {viewMode === "week" ? weekLabel : monthLabel}
              </span>
            </div>
          )}

          {!loading && filterLabel && (
            <div
              className="px-5 py-2 flex items-center gap-2"
              style={{ borderBottom: `1px solid ${DS.border}`, backgroundColor: DS.brandBg }}
            >
              <Filter className="w-3 h-3 shrink-0" style={{ color: DS.brand }} />
              <span className="text-xs font-bold" style={{ color: DS.brand }}>
                Filtered: {filterLabel}
              </span>
              <button
                type="button"
                onClick={() => setSelectedSports([])}
                className="text-xs font-black uppercase tracking-wide hover:underline ml-2"
                style={{
                  color: DS.brand,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Clear
              </button>
            </div>
          )}

          <div className="p-4 sm:p-5">
            {viewMode === "week" ? (
              <WeekView
                weekDays={weekDays}
                todayISO={todayISO}
                loading={loading || !clientReady}
                workoutsByDate={workoutsByDate}
                onOpenDay={openDay}
                onCreateForDay={openCreateForDay}
              />
            ) : (
              <MonthView
                monthDays={days}
                anchorISO={anchorISO}
                todayISO={todayISO}
                loading={loading || !clientReady}
                workoutsByDate={workoutsByDate}
                weekdayLabels={weekdayLabels}
                onOpenDay={openDay}
                onJumpToMonth={(iso) => setAnchorISO(iso)}
              />
            )}
          </div>
        </div>
      </main>

      <SportsMoreModal
        open={sportsModal}
        onClose={() => setSportsModal(false)}
        sportsAll={SPORTS_ALL}
        selectedSports={selectedSports}
        setSelectedSports={setSelectedSports}
      />

      <CreateWorkoutModal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setEditWorkout(null);
        }}
        editWorkout={editWorkout}
        dateISO={createDayISO}
        sport={defaultSportForCreate}
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
    </div>
  );
}