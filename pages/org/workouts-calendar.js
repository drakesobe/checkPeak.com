// pages/org/workouts-calendar.js
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCcw,
  LayoutDashboard,
  ArrowRight,
  X,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ClipboardList,
  Dumbbell,
  Users,
  Activity,
  Search,
} from "lucide-react";

/**
 * Workouts Calendar (Org)
 * - Week + Month view toggle
 * - Multi-sport filtering (single-select chips + "More" modal multi-select)
 * - Mobile-friendly month grid (tap day -> bottom sheet)
 * - No fetch spam:
 *   - range endpoint is the source of truth
 *   - in-memory cache keyed by (start,end,sports)
 *   - AbortController for in-flight cancellation
 *
 * Requires:
 *   GET /api/org/workouts/range?start=YYYY-MM-DD&end=YYYY-MM-DD&sport=Basketball
 *   ✅ (Better) Accept multiple sports:
 *      - /api/org/workouts/range?start=...&end=...&sports=basketball,football
 *   This UI will try `sports=` first, then fall back to `sport=` (first selected).
 */

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function safeJson(res) {
  return res.json().catch(() => ({}));
}

function normalizeSport(v) {
  return String(v || "").trim().toLowerCase();
}

function titleSport(v) {
  const s = String(v || "").trim().toLowerCase();
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** YYYY-MM-DD in America/New_York */
function nyDateISO(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

function isoToDate(iso) {
  // iso: YYYY-MM-DD (treat as local date)
  const s = String(iso || "").slice(0, 10);
  const [y, m, d] = s.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d, 12, 0, 0);
}

function dateToISO(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function startOfWeek(date, weekStartsOn = 0) {
  // 0=Sun,1=Mon
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day - weekStartsOn + 7) % 7;
  return addDays(d, -diff);
}

function endOfWeek(date, weekStartsOn = 0) {
  const s = startOfWeek(date, weekStartsOn);
  return addDays(s, 6);
}

function startOfMonth(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), 1, 12, 0, 0);
}

function endOfMonth(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 12, 0, 0);
}

function isSameISO(a, b) {
  return String(a || "").slice(0, 10) === String(b || "").slice(0, 10);
}

function groupByDate(workouts) {
  const map = {};
  (Array.isArray(workouts) ? workouts : []).forEach((w) => {
    const iso = String(w?.Date || "").slice(0, 10);
    if (!iso) return;
    if (!map[iso]) map[iso] = [];
    map[iso].push(w);
  });
  // stable sort each day
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

function Pill({ children, tone = "neutral", className = "" }) {
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
        toneCls,
        className
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
      className={classNames(base, styles, disabled ? "opacity-70 cursor-not-allowed" : "", className)}
      type={type}
    >
      {children}
    </button>
  );
}

function Modal({ open, title, children, onClose, subtitle }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} role="button" tabIndex={0} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-gray-200">
          <div className="p-5 border-b flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-lg font-extrabold text-gray-900 truncate">{title}</p>
              {subtitle ? <p className="text-[12px] text-gray-500 mt-1">{subtitle}</p> : null}
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

function BottomSheet({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} role="button" tabIndex={0} />
      <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
        <div className="mx-auto w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-extrabold text-gray-900 truncate">{title}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Tap a workout to manage it.</p>
            </div>
            <button
              className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50"
              onClick={onClose}
              type="button"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 max-h-[70vh] overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}

function toneForStatus(s) {
  const status = String(s || "").toLowerCase();
  if (status.includes("complete")) return "good";
  if (status.includes("pending")) return "warn";
  if (status.includes("assign")) return "warn";
  if (status.includes("draft")) return "neutral";
  if (status.includes("arch")) return "neutral";
  return "neutral";
}

function SportChips({
  sportsAll,
  selectedSports,
  setSelectedSports,
  onOpenMore,
  compact = false,
}) {
  // show a few common chips; "More" opens multi-select
  const primary = sportsAll.slice(0, 5);
  const isSelected = (s) => selectedSports.includes(normalizeSport(s));

  const toggleSport = (s) => {
    const k = normalizeSport(s);
    if (!k) return;
    setSelectedSports((prev) => {
      const cur = Array.isArray(prev) ? prev : [];
      if (cur.includes(k)) return cur.filter((x) => x !== k);
      return [...cur, k];
    });
  };

  const clearAll = () => setSelectedSports([]);

  const chipBase =
    "px-3 py-2 rounded-2xl border text-sm font-semibold transition whitespace-nowrap";

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className={classNames(
          chipBase,
          selectedSports.length === 0
            ? "bg-[#46769B] text-white border-[#46769B]"
            : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
        )}
        onClick={clearAll}
      >
        All
      </button>

      {primary.map((s) => {
        const active = isSelected(s);
        return (
          <button
            key={s}
            type="button"
            className={classNames(
              chipBase,
              active
                ? "bg-[#46769B] text-white border-[#46769B]"
                : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50",
              compact ? "text-xs px-2.5 py-2" : ""
            )}
            onClick={() => toggleSport(s)}
          >
            {titleSport(s)}
          </button>
        );
      })}

      <button
        type="button"
        className={classNames(
          chipBase,
          "bg-white text-gray-800 border-gray-200 hover:bg-gray-50",
          compact ? "text-xs px-2.5 py-2" : ""
        )}
        onClick={onOpenMore}
      >
        <Filter className="w-4 h-4" />
        More
      </button>
    </div>
  );
}

function SportsMoreModal({ open, onClose, sportsAll, selectedSports, setSelectedSports }) {
  const [q, setQ] = useState("");

  useEffect(() => {
    if (open) setQ("");
  }, [open]);

  const list = useMemo(() => {
    const query = String(q || "").trim().toLowerCase();
    const base = Array.isArray(sportsAll) ? sportsAll : [];
    if (!query) return base;
    return base.filter((s) => String(s).toLowerCase().includes(query));
  }, [q, sportsAll]);

  const toggle = (s) => {
    const k = normalizeSport(s);
    setSelectedSports((prev) => {
      const cur = Array.isArray(prev) ? prev : [];
      if (cur.includes(k)) return cur.filter((x) => x !== k);
      return [...cur, k];
    });
  };

  const allSelected = selectedSports.length === sportsAll.length && sportsAll.length > 0;

  const selectAll = () => setSelectedSports(sportsAll.map((s) => normalizeSport(s)));
  const clearAll = () => setSelectedSports([]);

  const inputBase =
    "w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Sports filter"
      subtitle="Select multiple sports to combine them in the calendar."
    >
      <div className="space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className={classNames(inputBase, "pl-10")}
            placeholder="Search sports…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={allSelected ? clearAll : selectAll} className="px-3 py-2 text-xs">
            {allSelected ? "Clear all" : "Select all"}
          </Button>
          <Pill>{selectedSports.length || 0} selected</Pill>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {list.map((s) => {
            const k = normalizeSport(s);
            const active = selectedSports.includes(k);
            return (
              <button
                key={s}
                type="button"
                className={classNames(
                  "px-3 py-2 rounded-2xl border text-sm font-semibold transition",
                  active
                    ? "bg-[#46769B] text-white border-[#46769B]"
                    : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
                )}
                onClick={() => toggle(s)}
              >
                {titleSport(s)}
              </button>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function WorkoutCard({ w, onOpen, compact = false }) {
  const title = w?.Title || "Workout";
  const status = w?.Status || "assigned";
  const sport = titleSport(w?.Sport || "");
  const athletes = Number(w?.athleteCount || 0);
  const items = Number(w?.itemCount || 0);

  return (
    <button
      type="button"
      onClick={() => onOpen?.(w)}
      className={classNames(
        "w-full text-left rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 transition p-3",
        compact ? "p-2" : ""
      )}
      title="Open workout"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={classNames("font-extrabold text-gray-900 truncate", compact ? "text-[12px]" : "text-sm")}>
            {title}
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            <Pill tone={toneForStatus(status)} className={compact ? "text-[10px]" : ""}>
              {status}
            </Pill>
            {sport ? <Pill className={compact ? "text-[10px]" : ""}>{sport}</Pill> : null}
            <Pill className={compact ? "text-[10px]" : ""}>
              <Users className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
              {athletes}
            </Pill>
            <Pill className={compact ? "text-[10px]" : ""}>
              <Dumbbell className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
              {items}
            </Pill>
          </div>
        </div>

        <ArrowRight className={classNames("text-gray-400 shrink-0", compact ? "w-4 h-4" : "w-5 h-5")} />
      </div>
    </button>
  );
}

export default function WorkoutsCalendarPage() {
  const router = useRouter();
  const { user } = useAuthContext();

  // Role gating (matches your org dashboard pattern)
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

  // Redirect if not allowed
  useEffect(() => {
    if (!user) return;
    if (!isOrgSide) router.push("/dashboard");
  }, [user, isOrgSide, router]);

  // Sports list (use your Airtable single-select values)
  const SPORTS_ALL = useMemo(
    () => ["soccer", "football", "track", "swim", "baseball", "softball", "hockey", "tennis", "xc", "basketball", "wrestling"],
    []
  );

  // Persist selected sports
  const LS_KEY = "org_workouts_calendar_sports_v1";
  const LS_VIEW = "org_workouts_calendar_view_v1";

  const [viewMode, setViewMode] = useState("week"); // "week" | "month"
  const [anchorISO, setAnchorISO] = useState(() => nyDateISO()); // YYYY-MM-DD

  const [selectedSports, setSelectedSports] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const parsed = JSON.parse(raw || "[]");
      if (Array.isArray(parsed)) return parsed.map(normalizeSport).filter(Boolean);
    } catch {}
    return []; // empty = All
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(selectedSports));
    } catch {}
  }, [selectedSports]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_VIEW);
      if (raw === "week" || raw === "month") setViewMode(raw);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_VIEW, viewMode);
    } catch {}
  }, [viewMode]);

  const anchorDate = useMemo(() => isoToDate(anchorISO), [anchorISO]);

  // Range calculations
  const weekStartsOn = 0; // Sunday (change to 1 for Monday if you want)
  const range = useMemo(() => {
    if (viewMode === "week") {
      const s = startOfWeek(anchorDate, weekStartsOn);
      const e = endOfWeek(anchorDate, weekStartsOn);
      return { start: dateToISO(s), end: dateToISO(e), gridStart: s, gridEnd: e };
    }

    // Month view: fetch a 6-week grid range so you can render a full calendar grid
    const mStart = startOfMonth(anchorDate);
    const mEnd = endOfMonth(anchorDate);

    const gridStart = startOfWeek(mStart, weekStartsOn);
    const gridEnd = endOfWeek(mEnd, weekStartsOn);

    return { start: dateToISO(gridStart), end: dateToISO(gridEnd), gridStart, gridEnd };
  }, [anchorDate, viewMode]);

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

  // Networking state
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [workouts, setWorkouts] = useState([]);
  const workoutsByDate = useMemo(() => groupByDate(workouts), [workouts]);

  // Cache + abort
  const cacheRef = useRef(new Map());
  const abortRef = useRef(null);

  const sportsKey = useMemo(() => {
    const s = Array.isArray(selectedSports) ? selectedSports : [];
    return s.slice().sort().join(",");
  }, [selectedSports]);

  const cacheKey = useMemo(() => {
    return `range|${range.start}|${range.end}|${sportsKey || "ALL"}`;
  }, [range.start, range.end, sportsKey]);

  const buildRangeURL = useCallback(() => {
    const start = range.start;
    const end = range.end;

    // Prefer multi-sport param `sports=...` if any selected; if none => omit
    const params = new URLSearchParams();
    params.set("start", start);
    params.set("end", end);

    const selected = Array.isArray(selectedSports) ? selectedSports.filter(Boolean) : [];

    if (selected.length === 1) {
      // keep compatibility with existing endpoint
      params.set("sport", titleSport(selected[0]));
      // If your endpoint expects lowercase, you can swap above line to:
      // params.set("sport", selected[0]);
    } else if (selected.length > 1) {
      // best: add sports CSV (lowercase)
      params.set("sports", selected.join(","));
      // also add sport fallback (first) in case your endpoint only supports sport
      params.set("sport", titleSport(selected[0]));
    } else {
      // no sport filter = All
    }

    return `/api/org/workouts/range?${params.toString()}`;
  }, [range.start, range.end, selectedSports]);

  const fetchRange = useCallback(
    async (force = false) => {
      if (!isOrgSide) return;

      setErr("");

      // Cache hit
      if (!force && cacheRef.current.has(cacheKey)) {
        setWorkouts(cacheRef.current.get(cacheKey));
        setLoading(false);
        return;
      }

      // Abort any prior in-flight request
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
    [isOrgSide, cacheKey, buildRangeURL]
  );

  useEffect(() => {
    if (!user || !isOrgSide) return;
    fetchRange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isOrgSide, cacheKey]);

  // Day bottom sheet (mobile)
  const [dayOpen, setDayOpen] = useState(false);
  const [selectedDayISO, setSelectedDayISO] = useState(() => nyDateISO());

  const openDay = (iso) => {
    setSelectedDayISO(String(iso || "").slice(0, 10));
    setDayOpen(true);
  };

  const closeDay = () => setDayOpen(false);

  const todayISO = useMemo(() => nyDateISO(), []);

  // Navigation handlers
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

  // Quick open workout action (you can route to editor page if you have one)
  const openWorkout = (w) => {
    const id = String(w?.id || "").trim();
    const date = String(w?.Date || "").slice(0, 10);
    if (!id) return;

    // If you have an edit page, route there.
    // Otherwise, route to calendar with day open + maybe query param
    // Example:
    // router.push(`/org/workouts/${encodeURIComponent(id)}`);

    // For now: open day bottom sheet on that date
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

  // Summary across current range
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

  // Month grid: 7 columns
  const weekdayLabels = useMemo(() => {
    const base = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    if (weekStartsOn === 1) return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return base;
  }, [weekStartsOn]);

  const monthDays = useMemo(() => {
    // month view uses `days` (gridStart..gridEnd), week view uses the same days but only 7
    return days;
  }, [days]);

  // For week view, we render 7 columns on desktop; on mobile we render day stacks
  const weekDays = useMemo(() => {
    const list = [];
    const s = isoToDate(range.start);
    for (let i = 0; i < 7; i++) list.push(dateToISO(addDays(s, i)));
    return list;
  }, [range.start]);

  // Mobile: day stack list for week view
  const renderWeekMobile = () => {
    return (
      <div className="lg:hidden space-y-3">
        {weekDays.map((iso) => {
          const list = workoutsByDate[iso] || [];
          const isToday = isSameISO(iso, todayISO);
          const counts = sumCountsForDay(list);

          return (
            <div key={iso} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-extrabold text-gray-900">
                      {isoToDate(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                    </p>
                    {isToday ? (
                      <Pill tone="good">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                        Today
                      </Pill>
                    ) : null}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <Pill>
                      <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
                      {counts.workoutsCount} workouts
                    </Pill>
                    <Pill>
                      <Users className="w-3.5 h-3.5 mr-1.5" />
                      {counts.athleteCount} athletes
                    </Pill>
                    <Pill>
                      <Dumbbell className="w-3.5 h-3.5 mr-1.5" />
                      {counts.itemCount} items
                    </Pill>
                  </div>
                </div>

                <Button variant="secondary" className="px-3 py-2 text-xs shrink-0" onClick={() => openDay(iso)}>
                  Open
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>

              <div className="mt-3 space-y-2">
                {loading ? (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3">
                    <p className="text-sm text-gray-800 font-semibold">Loading…</p>
                  </div>
                ) : list.length === 0 ? (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                    <p className="text-[12px] text-gray-600">No workouts scheduled.</p>
                  </div>
                ) : (
                  list.slice(0, 4).map((w) => <WorkoutCard key={w.id} w={w} onOpen={openWorkout} compact />)
                )}

                {list.length > 4 ? (
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-[#46769B] hover:underline"
                    onClick={() => openDay(iso)}
                  >
                    View all ({list.length}) →
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderWeekDesktop = () => {
    return (
      <div className="hidden lg:block">
        <div className="grid grid-cols-7 gap-3">
          {weekDays.map((iso) => {
            const list = workoutsByDate[iso] || [];
            const isToday = isSameISO(iso, todayISO);
            return (
              <div key={iso} className={classNames("rounded-2xl border bg-white overflow-hidden", isToday ? "border-emerald-200" : "border-gray-200")}>
                <div className={classNames("p-3 border-b", isToday ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200")}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[12px] font-extrabold text-gray-900 truncate">
                        {isoToDate(iso).toLocaleString(undefined, { weekday: "short" })}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {isoToDate(iso).toLocaleString(undefined, { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    {isToday ? <Pill tone="good">Today</Pill> : null}
                  </div>
                </div>

                <div className="p-3 space-y-2">
                  {loading ? (
                    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3">
                      <p className="text-sm text-gray-800 font-semibold">Loading…</p>
                    </div>
                  ) : list.length === 0 ? (
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                      <p className="text-[12px] text-gray-600">No workouts.</p>
                      <button
                        type="button"
                        className="mt-2 text-[11px] font-semibold text-[#46769B] hover:underline"
                        onClick={() => openDay(iso)}
                      >
                        Open day →
                      </button>
                    </div>
                  ) : (
                    <>
                      {list.slice(0, 6).map((w) => (
                        <WorkoutCard key={w.id} w={w} onOpen={openWorkout} compact />
                      ))}
                      {list.length > 6 ? (
                        <button
                          type="button"
                          className="text-[11px] font-semibold text-[#46769B] hover:underline"
                          onClick={() => openDay(iso)}
                        >
                          View all ({list.length}) →
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMonth = () => {
    // Desktop + mobile share the grid; mobile uses bottom sheet for detail
    const a = isoToDate(anchorISO);
    const monthIndex = a.getMonth();
    const year = a.getFullYear();

    return (
      <div>
        <div className="grid grid-cols-7 gap-2">
          {weekdayLabels.map((lbl) => (
            <div key={lbl} className="text-xs font-semibold text-gray-500 px-1 py-2">
              {lbl}
            </div>
          ))}

          {monthDays.map((iso) => {
            const d = isoToDate(iso);
            const inMonth = d.getMonth() === monthIndex && d.getFullYear() === year;
            const list = workoutsByDate[iso] || [];
            const isToday = isSameISO(iso, todayISO);

            const counts = sumCountsForDay(list);
            const hasWork = counts.workoutsCount > 0;

            return (
              <button
                key={iso}
                type="button"
                onClick={() => openDay(iso)}
                className={classNames(
                  "rounded-2xl border text-left p-3 transition min-h-[84px] sm:min-h-[100px]",
                  inMonth ? "bg-white border-gray-200 hover:bg-gray-50" : "bg-gray-50 border-gray-200 hover:bg-gray-100",
                  isToday ? "ring-2 ring-emerald-200" : ""
                )}
                title="Open day"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={classNames("text-xs font-extrabold", inMonth ? "text-gray-900" : "text-gray-500")}>
                      {d.getDate()}
                    </p>
                    {isToday ? (
                      <p className="text-[10px] font-semibold text-emerald-700 mt-1">Today</p>
                    ) : null}
                  </div>

                  {hasWork ? <Pill className="shrink-0">{counts.workoutsCount}</Pill> : null}
                </div>

                <div className="mt-2 space-y-1">
                  {loading ? (
                    <p className="text-[11px] text-gray-500">Loading…</p>
                  ) : list.length === 0 ? (
                    <p className="text-[11px] text-gray-400">No workouts</p>
                  ) : (
                    <>
                      <p className="text-[11px] text-gray-600">
                        <span className="font-semibold">{counts.athleteCount}</span> athletes
                      </p>
                      <p className="text-[11px] text-gray-600">
                        <span className="font-semibold">{counts.itemCount}</span> items
                      </p>
                      <p className="text-[10px] text-gray-500 truncate">
                        {list[0]?.Title || "Workout"}{list.length > 1 ? ` +${list.length - 1}` : ""}
                      </p>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const dayList = useMemo(() => {
    const list = workoutsByDate[selectedDayISO] || [];
    // filter by selectedSports if endpoint fallback returned all; (safety)
    if (!selectedSports.length) return list;
    return list.filter((w) => selectedSports.includes(normalizeSport(w?.Sport || "")));
  }, [workoutsByDate, selectedDayISO, selectedSports]);

  const dayCounts = useMemo(() => sumCountsForDay(dayList), [dayList]);

  const dayTitle = useMemo(() => {
    const d = isoToDate(selectedDayISO);
    return d.toLocaleString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
  }, [selectedDayISO]);

  const goDashboard = () => router.push("/org/dashboard");

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-6 h-6 text-[#46769B]" />
                <h1 className="text-2xl font-extrabold truncate">Workouts Calendar</h1>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <Pill>
                  <Activity className="w-3.5 h-3.5 mr-1.5" />
                  {viewMode === "week" ? weekLabel : monthLabel}
                </Pill>
                <Pill>{headerSubtitle}</Pill>

                {err ? (
                  <Pill tone="bad">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                    Error
                  </Pill>
                ) : (
                  <Pill tone="good">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    Ready
                  </Pill>
                )}
              </div>

              {err ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm text-red-700 font-semibold">{err}</p>
                  <p className="text-[11px] text-red-600 mt-1">
                    If you recently changed the API (sports vs sport), confirm the server accepts your query params.
                    Also confirm Airtable field names: <span className="font-semibold">Sport</span> (not Sports).
                  </p>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:justify-end">
              <Button variant="secondary" onClick={goDashboard} className="w-full sm:w-auto">
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Button>

              <Button
                variant="secondary"
                onClick={() => fetchRange(true)}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                <RefreshCcw className="w-4 h-4" />
                Refresh
              </Button>

              <Button variant="secondary" onClick={goToday} className="w-full sm:w-auto" title="Jump to today">
                Today
              </Button>

              <div className="flex gap-2">
                <Button variant="secondary" onClick={prev} className="w-full sm:w-auto" title="Previous">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="secondary" onClick={next} className="w-full sm:w-auto" title="Next">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* View toggle + Sports */}
          <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">View</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode("week")}
                  className={classNames(
                    "px-3 py-2 rounded-2xl border text-sm font-semibold transition w-full",
                    viewMode === "week"
                      ? "bg-[#46769B] text-white border-[#46769B]"
                      : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
                  )}
                >
                  Week
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("month")}
                  className={classNames(
                    "px-3 py-2 rounded-2xl border text-sm font-semibold transition w-full",
                    viewMode === "month"
                      ? "bg-[#46769B] text-white border-[#46769B]"
                      : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
                  )}
                >
                  Month
                </button>
              </div>

              <p className="text-[11px] text-gray-500 mt-3">
                Week is best for daily ops. Month is best for scheduling/planning.
              </p>
            </div>

            <div className="lg:col-span-8 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Sports</p>
              <div className="mt-3">
                <SportChips
                  sportsAll={SPORTS_ALL}
                  selectedSports={selectedSports}
                  setSelectedSports={setSelectedSports}
                  onOpenMore={() => setSportsModal(true)}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2 items-center">
                <Pill>{selectedSports.length ? `${selectedSports.length} selected` : "All sports"}</Pill>
                <Pill>
                  Range: {range.start} → {range.end}
                </Pill>
                {loading ? <Pill tone="warn">Loading…</Pill> : <Pill tone="good">Loaded</Pill>}
              </div>
            </div>
          </div>

          {/* Range summary */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Workouts in range</p>
              <p className="text-2xl font-extrabold text-gray-900 mt-1">
                {loading ? "…" : rangeSummary.workoutsCount}
              </p>
              <p className="text-[11px] text-gray-500 mt-2">
                Across {loading ? "…" : rangeSummary.uniqueDaysCount} day(s)
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Athlete assignments</p>
              <p className="text-2xl font-extrabold text-gray-900 mt-1">
                {loading ? "…" : rangeSummary.athleteCount}
              </p>
              <p className="text-[11px] text-gray-500 mt-2">Sum across workouts</p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Items</p>
              <p className="text-2xl font-extrabold text-gray-900 mt-1">
                {loading ? "…" : rangeSummary.itemCount}
              </p>
              <p className="text-[11px] text-gray-500 mt-2">Sum across workouts</p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Sports in range</p>
              <p className="text-2xl font-extrabold text-gray-900 mt-1">
                {loading ? "…" : Object.keys(rangeSummary.bySport || {}).filter(Boolean).length}
              </p>
              <p className="text-[11px] text-gray-500 mt-2">
                Filtered view: {selectedSports.length ? `${selectedSports.length} sport(s)` : "All"}
              </p>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-extrabold text-gray-900">
                {viewMode === "week" ? "Week View" : "Month View"}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {viewMode === "week"
                  ? "Open a day to see all workouts scheduled. Tap a workout to manage."
                  : "Tap any day to open the day sheet. Month view is optimized for mobile planning."}
              </p>
            </div>

            <Button variant="secondary" onClick={() => openDay(todayISO)} className="px-3 py-2 text-xs">
              Open Today
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="mt-5">
            {viewMode === "week" ? (
              <>
                {renderWeekMobile()}
                {renderWeekDesktop()}
              </>
            ) : (
              renderMonth()
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

        {/* Day Bottom Sheet */}
        <BottomSheet open={dayOpen} onClose={closeDay} title={dayTitle}>
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-wrap gap-2">
                <Pill>
                  <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
                  {loading ? "…" : dayCounts.workoutsCount} workouts
                </Pill>
                <Pill>
                  <Users className="w-3.5 h-3.5 mr-1.5" />
                  {loading ? "…" : dayCounts.athleteCount} athletes
                </Pill>
                <Pill>
                  <Dumbbell className="w-3.5 h-3.5 mr-1.5" />
                  {loading ? "…" : dayCounts.itemCount} items
                </Pill>
                {isSameISO(selectedDayISO, todayISO) ? <Pill tone="good">Today</Pill> : null}
              </div>

              <p className="text-[11px] text-gray-500 mt-2">
                This list comes from the range endpoint (fast). If you want item-level completion + evidence review,
                you can add a “Day Details” endpoint later and load it on-demand.
              </p>
            </div>

            {/* Mini sport chips on day sheet */}
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Sports (filter)</p>
              <div className="mt-3">
                <SportChips
                  sportsAll={SPORTS_ALL}
                  selectedSports={selectedSports}
                  setSelectedSports={setSelectedSports}
                  onOpenMore={() => setSportsModal(true)}
                  compact
                />
              </div>
            </div>

            <div className="space-y-2">
              {loading ? (
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <p className="text-sm text-gray-800 font-semibold">Loading…</p>
                </div>
              ) : dayList.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-semibold text-gray-900">No workouts scheduled.</p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Next step: add “create workout” flow from this sheet.
                  </p>
                </div>
              ) : (
                dayList.map((w) => <WorkoutCard key={w.id} w={w} onOpen={openWorkout} />)
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={closeDay} className="w-full sm:w-auto">
                Close
              </Button>
              <Button
                onClick={() => {
                  // If you have a dedicated day page, route there:
                  // router.push(`/org/workouts-day?date=${encodeURIComponent(selectedDayISO)}`);
                  closeDay();
                }}
                className="w-full sm:w-auto"
              >
                Done
                <CheckCircle2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </BottomSheet>
      </main>
    </div>
  );
}
