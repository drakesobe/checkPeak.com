// pages/org/workouts-calendar.js
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";

// ✅ Your real Airtable-aligned modal (the one we built)
import CreateWorkoutModal from "@/components/org/CreateWorkoutModal";

// ✅ New modular calendar components
import CalendarHeader from "@/components/org/workoutsCalendar/CalendarHeader";
import SportsMoreModal from "@/components/org/workoutsCalendar/SportsMoreModal";
import WeekView from "@/components/org/workoutsCalendar/WeekView";
import MonthView from "@/components/org/workoutsCalendar/MonthView";
import DaySheet from "@/components/org/workoutsCalendar/DaySheet";

// ✅ Shared utils
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

// ---------- helpers ----------
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

function sumCountsForDay(list) {
  const workouts = Array.isArray(list) ? list : [];
  let workoutsCount = workouts.length;
  let athleteCount = 0;
  let itemCount = 0;
  workouts.forEach((w) => {
    athleteCount += Number(w?.athleteCount || 0);
    itemCount += Number(w?.itemCount || 0);
  });
  return { workoutsCount, athleteCount, itemCount };
}

// Deterministic fallback to avoid SSR/client mismatches
const FALLBACK_ISO = "2000-01-01";
const FALLBACK_DATE = new Date("2000-01-01T12:00:00Z");

// ---------- page ----------
export default function WorkoutsCalendarPage() {
  const router = useRouter();
  const { user } = useAuthContext();

  // ✅ Always run hooks in the same order (no early return before hooks)
  const [mounted, setMounted] = useState(false);

  // Persist view + selected sports
  const LS_KEY = "org_workouts_calendar_sports_v1";
  const LS_VIEW = "org_workouts_calendar_view_v1";

  const [viewMode, setViewMode] = useState("week"); // "week" | "month"

  // ✅ Start with deterministic values to prevent hydration mismatch
  const [todayISO, setTodayISO] = useState(FALLBACK_ISO);
  const [anchorISO, setAnchorISO] = useState(FALLBACK_ISO);
  const [selectedSports, setSelectedSports] = useState([]); // start empty on SSR + first client render

  // Networking state
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [workouts, setWorkouts] = useState([]);

  // Cache + abort
  const cacheRef = useRef(new Map());
  const abortRef = useRef(null);

  // Role gating
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

  // Sports list
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

  // ✅ After mount: compute today + restore localStorage (client only)
  useEffect(() => {
    if (!mounted) return;

    try {
      const t = nyDateISO();
      setTodayISO(t);
      setAnchorISO((prev) => (prev && prev !== FALLBACK_ISO ? prev : t));
    } catch {
      // keep fallbacks
    }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // ✅ Persist changes (client only)
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
    // Use deterministic fallback until mounted + real dates load
    if (!anchorISO) return FALLBACK_DATE;
    try {
      return isoToDate(anchorISO);
    } catch {
      return FALLBACK_DATE;
    }
  }, [anchorISO]);

  // Range calc
  const weekStartsOn = 0; // Sunday
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
    const start = new Date(range.gridStart);
    const end = new Date(range.gridEnd);
    let cur = new Date(start);
    while (cur <= end) {
      out.push(dateToISO(cur));
      cur = addDays(cur, 1);
    }
    return out;
  }, [range]);

  const weekdayLabels = useMemo(() => {
    const base = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    if (weekStartsOn === 1) return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return base;
  }, [weekStartsOn]);

  const weekDays = useMemo(() => {
    const list = [];
    const s = isoToDate(range.start);
    for (let i = 0; i < 7; i++) list.push(dateToISO(addDays(s, i)));
    return list;
  }, [range.start]);

  const monthDays = useMemo(() => days, [days]);

  const workoutsByDate = useMemo(() => groupByDate(workouts), [workouts]);

  const sportsKey = useMemo(() => {
    const s = Array.isArray(selectedSports) ? selectedSports : [];
    return s.slice().sort().join(",");
  }, [selectedSports]);

  const cacheKey = useMemo(() => {
    return `range|${range.start}|${range.end}|${sportsKey || "ALL"}`;
  }, [range.start, range.end, sportsKey]);

  const buildRangeURL = useCallback(() => {
    const params = new URLSearchParams();
    params.set("start", range.start);
    params.set("end", range.end);

    const selected = Array.isArray(selectedSports) ? selectedSports.filter(Boolean) : [];

    if (selected.length === 1) {
      params.set("sport", titleSport(selected[0])); // server lowercases it
    } else if (selected.length > 1) {
      params.set("sports", selected.join(","));
      params.set("sport", titleSport(selected[0])); // fallback
    }

    return `/api/org/workouts/range?${params.toString()}`;
  }, [range.start, range.end, selectedSports]);

  const fetchRange = useCallback(
    async (force = false) => {
      if (!isOrgSide) return;

      // Don’t fetch until mounted so SSR placeholder doesn’t cause mismatch-y UI states
      if (!mounted) return;

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
        const url = buildRangeURL();
        const res = await fetch(url, { method: "GET", credentials: "include", signal: ctrl.signal });
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
    if (!user || !isOrgSide) return;
    if (!mounted) return;
    fetchRange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isOrgSide, mounted, cacheKey]);

  // Day bottom sheet
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

  // Create workout modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createDayISO, setCreateDayISO] = useState(FALLBACK_ISO);

  useEffect(() => {
    if (!mounted) return;
    setCreateDayISO((prev) => (prev && prev !== FALLBACK_ISO ? prev : todayISO));
  }, [mounted, todayISO]);

  const openCreateForDay = (iso) => {
    const d = String(iso || "").slice(0, 10) || todayISO;
    setCreateDayISO(d);
    setCreateOpen(true);
  };

  const closeCreate = () => setCreateOpen(false);

  // Navigation actions
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

  // Labels (safe during SSR because we start deterministic)
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

  const openWorkout = (w) => {
    const id = String(w?.id || "").trim();
    const date = String(w?.Date || "").slice(0, 10);
    if (!id) return;
    if (date) {
      setSelectedDayISO(date);
      setDayOpen(true);
    }
  };

  const headerSubtitle = useMemo(() => {
    const sports = Array.isArray(selectedSports) ? selectedSports : [];
    if (!sports.length) return "All sports";
    if (sports.length === 1) return `${titleSport(sports[0])}`;
    return `${sports.length} sports`;
  }, [selectedSports]);

  const rangeSummary = useMemo(() => {
    const list = Array.isArray(workouts) ? workouts : [];
    const bySport = {};
    list.forEach((w) => {
      const s = normalizeSport(w?.Sport || "");
      if (!bySport[s]) bySport[s] = 0;
      bySport[s] += 1;
    });

    const totals = sumCountsForDay(list);
    const uniqueDays = new Set(list.map((w) => String(w?.Date || "").slice(0, 10)).filter(Boolean));

    return {
      workoutsCount: totals.workoutsCount,
      athleteCount: totals.athleteCount,
      itemCount: totals.itemCount,
      uniqueDaysCount: uniqueDays.size,
      bySport,
    };
  }, [workouts]);

  const defaultSportForCreate = useMemo(() => {
    if (selectedSports.length === 1) return titleSport(selectedSports[0]);
    return "";
  }, [selectedSports]);

  const goDashboard = () => router.push("/org/dashboard");

  // ✅ Optional: show a stable “client boot” state so UI doesn’t flicker weirdly
  const clientReady = mounted && todayISO && anchorISO;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <CalendarHeader
          viewMode={viewMode}
          setViewMode={setViewMode}
          weekLabel={clientReady ? weekLabel : "—"}
          monthLabel={clientReady ? monthLabel : "—"}
          headerSubtitle={headerSubtitle}
          err={err}
          loading={loading || !clientReady}
          rangeStart={range.start}
          rangeEnd={range.end}
          rangeSummary={rangeSummary}
          SPORTS_ALL={SPORTS_ALL}
          selectedSports={selectedSports}
          setSelectedSports={setSelectedSports}
          onOpenMoreSports={() => setSportsModal(true)}
          onGoDashboard={goDashboard}
          onRefresh={() => fetchRange(true)}
          onGoToday={goToday}
          onPrev={prev}
          onNext={next}
          onCreateToday={() => openCreateForDay(todayISO)}
        />

        {/* Calendar */}
        <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-extrabold text-gray-900">
                {viewMode === "week" ? "Week View" : "Month View"}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {viewMode === "week"
                  ? "Open a day to see all workouts scheduled. Create new workouts directly from any day."
                  : "Tap any day to open the day sheet. Month view is great for planning."}
              </p>
              {!clientReady && (
                <p className="text-xs text-gray-500 mt-2">
                  Loading calendar…
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => openDay(todayISO)}
                className="px-3 py-2 rounded-2xl border text-xs font-semibold transition bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
                disabled={!clientReady}
              >
                Open Today →
              </button>
              <button
                type="button"
                onClick={() => openCreateForDay(todayISO)}
                className="px-3 py-2 rounded-2xl text-xs font-semibold transition bg-[#46769B] text-white hover:brightness-110 disabled:opacity-60"
                disabled={!clientReady}
              >
                + Create
              </button>
            </div>
          </div>

          <div className="mt-5">
            {viewMode === "week" ? (
              <WeekView
                weekDays={weekDays}
                todayISO={todayISO}
                loading={loading || !clientReady}
                workoutsByDate={workoutsByDate}
                onOpenDay={openDay}
                onOpenWorkout={openWorkout}
                onCreateForDay={openCreateForDay}
              />
            ) : (
              <MonthView
                monthDays={monthDays}
                anchorISO={anchorISO}
                todayISO={todayISO}
                loading={loading || !clientReady}
                workoutsByDate={workoutsByDate}
                weekdayLabels={weekdayLabels}
                onOpenDay={openDay}
              />
            )}
          </div>
        </div>

        {/* Sports More Modal */}
        <SportsMoreModal
          open={sportsModal}
          onClose={() => setSportsModal(false)}
          sportsAll={SPORTS_ALL}
          selectedSports={selectedSports}
          setSelectedSports={setSelectedSports}
        />

        {/* ✅ Real Create Workout Modal (Airtable aligned) */}
        <CreateWorkoutModal
          open={createOpen}
          onClose={closeCreate}
          dateISO={createDayISO}
          sport={defaultSportForCreate}
          onCreated={() => {
            fetchRange(true);
            setSelectedDayISO(createDayISO);
            setDayOpen(true);
          }}
        />

        {/* Day Bottom Sheet */}
        <DaySheet
          open={dayOpen}
          onClose={closeDay}
          titleISO={selectedDayISO}
          todayISO={todayISO}
          loading={loading || !clientReady}
          workoutsByDate={workoutsByDate}
          selectedSports={selectedSports}
          setSelectedSports={setSelectedSports}
          SPORTS_ALL={SPORTS_ALL}
          onOpenMoreSports={() => setSportsModal(true)}
          onCreateForDay={openCreateForDay}
          onOpenWorkout={openWorkout}
        />
      </main>
    </div>
  );
}
