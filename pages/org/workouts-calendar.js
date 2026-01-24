"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCcw,
  Plus,
  Dumbbell,
  Users,
  ClipboardList,
  Trash2,
} from "lucide-react";
import { useAuthContext } from "@/hooks/useAuth";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toISODateLocal(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function labelForDate(iso) {
  const d = new Date(`${iso}T12:00:00`);
  const todayIso = toISODateLocal(new Date());
  const yIso = toISODateLocal(addDays(new Date(), -1));
  const tIso = toISODateLocal(addDays(new Date(), 1));
  if (iso === todayIso) return "Today";
  if (iso === yIso) return "Yesterday";
  if (iso === tIso) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

function prettyDate(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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

function Button({ children, onClick, variant = "primary", disabled = false, className = "", type = "button" }) {
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
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classNames(base, styles, disabled ? "opacity-70 cursor-not-allowed" : "", className)}
    >
      {children}
    </button>
  );
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

/* -------------------------------------------------------------------------- */
/* Simple MultiSelect (clean + fast)                                          */
/* -------------------------------------------------------------------------- */

function MultiSelect({ label, options = [], valueIds = [], onChange }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = String(q || "").trim().toLowerCase();
    if (!s) return options;
    return options.filter((o) => {
      const name = String(o?.name || "").toLowerCase();
      const email = String(o?.email || "").toLowerCase();
      return name.includes(s) || email.includes(s);
    });
  }, [options, q]);

  const toggle = (id) => {
    const set = new Set(valueIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange?.(Array.from(set));
  };

  const selected = useMemo(() => {
    const map = new Map(options.map((o) => [o.id, o]));
    return valueIds.map((id) => map.get(id)).filter(Boolean);
  }, [options, valueIds]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      {label ? <p className="text-xs font-bold text-gray-700">{label}</p> : null}

      <input
        className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm outline-none focus:ring-2 focus:ring-[#46769B]/30"
        placeholder="Search athletes..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {selected.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {selected.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => toggle(a.id)}
              className="px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-800 text-xs font-semibold hover:brightness-105"
              title="Remove"
            >
              {a.name || "Athlete"} {a.email ? `• ${a.email}` : ""} ✕
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-gray-500">No athletes selected yet.</p>
      )}

      <div className="mt-3 max-h-44 overflow-auto rounded-xl border border-gray-200">
        {filtered.map((a) => {
          const checked = valueIds.includes(a.id);
          return (
            <label
              key={a.id}
              className="flex items-center justify-between gap-3 px-3 py-2 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{a.name || "Athlete"}</p>
                <p className="text-[11px] text-gray-500 truncate">{a.email || ""}</p>
              </div>
              <input type="checkbox" checked={checked} onChange={() => toggle(a.id)} />
            </label>
          );
        })}
        {!filtered.length ? (
          <div className="px-3 py-3 text-sm text-gray-600">No matches.</div>
        ) : null}
      </div>

      <div className="mt-2 text-[11px] text-gray-500">
        Tip: keep selections small at first. You can add groups later.
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function OrgWorkoutsCalendar() {
  const router = useRouter();
  const { user } = useAuthContext();

  const role = useMemo(() => {
    const r = String(user?.role || user?.Role || "").toLowerCase();
    if (r.includes("org")) return "organization";
    if (r.includes("coach")) return "organization";
    if (r.includes("trainer")) return "organization";
    return r;
  }, [user]);

  const orgToken = useMemo(() => {
    return String(user?.Token || user?.token || user?.["Organization Token"] || "").trim();
  }, [user]);

  const orgAuthHeaders = useMemo(() => (orgToken ? { "x-org-token": orgToken } : {}), [orgToken]);

  const [sport, setSport] = useState("Basketball");
  const [selectedDate, setSelectedDate] = useState(() => toISODateLocal(new Date()));

  // data
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [weekWorkouts, setWeekWorkouts] = useState([]); // summarized for the calendar grid
  const [day, setDay] = useState({ workouts: [], itemsByWorkoutId: {}, completionByItemId: {} });

  // athletes (roster)
  const [athletes, setAthletes] = useState([]);
  const [athletesLoading, setAthletesLoading] = useState(false);

  // create workflow
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("assigned");
  const [assignedAthleteIds, setAssignedAthleteIds] = useState([]);

  const [items, setItems] = useState(() => [
    {
      ExerciseName: "",
      Sets: "",
      Reps: "",
      Weight: "",
      Rest: "",
      Instructions: "",
      VideoURL: "",
      EvidenceRequired: "none",
    },
  ]);

  const isOrg = role === "organization";

  useEffect(() => {
    if (!user) return;
    if (!isOrg) router.push("/dashboard");
  }, [user, isOrg, router]);

  const weekStartISO = useMemo(() => {
    // start week on Monday
    const d = new Date(`${selectedDate}T12:00:00`);
    const dayIdx = d.getDay(); // 0 Sun - 6 Sat
    const mondayOffset = dayIdx === 0 ? -6 : 1 - dayIdx;
    return toISODateLocal(addDays(d, mondayOffset));
  }, [selectedDate]);

  const weekDays = useMemo(() => {
    const start = new Date(`${weekStartISO}T12:00:00`);
    return Array.from({ length: 7 }).map((_, i) => {
      const iso = toISODateLocal(addDays(start, i));
      return { iso, label: labelForDate(iso), pretty: prettyDate(iso) };
    });
  }, [weekStartISO]);

  const fetchAthletes = useCallback(async () => {
    setAthletesLoading(true);
    try {
      const res = await fetch("/api/org/getAthletes", {
        method: "GET",
        credentials: "include",
        headers: { ...orgAuthHeaders },
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to load athletes");
      const list = Array.isArray(data?.athletes) ? data.athletes : [];
      setAthletes(list);
    } catch (e) {
      // roster isn't required to load calendar, so don't hard fail
      console.error(e);
    } finally {
      setAthletesLoading(false);
    }
  }, [orgAuthHeaders]);

  const fetchWeek = useCallback(
    async (startISO) => {
      const start = startISO || weekStartISO;
      const end = toISODateLocal(addDays(new Date(`${start}T12:00:00`), 6));
      const res = await fetch(
        `/api/org/workouts/range?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&sport=${encodeURIComponent(
          sport
        )}`,
        { credentials: "include", headers: { ...orgAuthHeaders } }
      );
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to load week");
      setWeekWorkouts(Array.isArray(data?.workouts) ? data.workouts : []);
    },
    [weekStartISO, sport, orgAuthHeaders]
  );

  const fetchDay = useCallback(
    async (iso) => {
      const date = iso || selectedDate;
      const res = await fetch(
        `/api/org/workouts/day?date=${encodeURIComponent(date)}&sport=${encodeURIComponent(sport)}`,
        { credentials: "include", headers: { ...orgAuthHeaders } }
      );
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to load day");
      setDay({
        workouts: Array.isArray(data?.workouts) ? data.workouts : [],
        itemsByWorkoutId: data?.itemsByWorkoutId || {},
        completionByItemId: data?.completionByItemId || {},
      });
    },
    [selectedDate, sport, orgAuthHeaders]
  );

  const refreshAll = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      await Promise.all([fetchWeek(weekStartISO), fetchDay(selectedDate)]);
    } catch (e) {
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [fetchWeek, fetchDay, weekStartISO, selectedDate]);

  useEffect(() => {
    if (!user || !isOrg || !orgToken) return;
    fetchAthletes().catch(() => {});
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isOrg, orgToken]);

  useEffect(() => {
    if (!user || !isOrg || !orgToken) return;
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport, weekStartISO, selectedDate]);

  const workoutsByDate = useMemo(() => {
    const m = new Map();
    for (const w of weekWorkouts) {
      const d = String(w?.Date || w?.date || "").slice(0, 10);
      if (!d) continue;
      if (!m.has(d)) m.set(d, []);
      m.get(d).push(w);
    }
    // stable sort: status then title
    for (const [k, arr] of m.entries()) {
      arr.sort((a, b) => String(a?.Title || "").localeCompare(String(b?.Title || "")));
      m.set(k, arr);
    }
    return m;
  }, [weekWorkouts]);

  const openCreate = () => {
    setCreateOpen(true);
    setTitle("");
    setStatus("assigned");
    setAssignedAthleteIds([]);
    setItems([
      {
        ExerciseName: "",
        Sets: "",
        Reps: "",
        Weight: "",
        Rest: "",
        Instructions: "",
        VideoURL: "",
        EvidenceRequired: "none",
      },
    ]);
  };

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        ExerciseName: "",
        Sets: "",
        Reps: "",
        Weight: "",
        Rest: "",
        Instructions: "",
        VideoURL: "",
        EvidenceRequired: "none",
      },
    ]);
  };

  const removeItemRow = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx, key, val) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: val } : it)));
  };

  const createWorkout = async () => {
    setErr("");
    if (!orgToken) return setErr("Missing org token. Re-login as org.");
    if (!selectedDate) return setErr("Pick a date.");
    const cleanTitle = String(title || "").trim();
    if (!cleanTitle) return setErr("Enter a workout title.");
    const usableItems = items
      .map((it) => ({
        ...it,
        ExerciseName: String(it.ExerciseName || "").trim(),
      }))
      .filter((it) => it.ExerciseName);

    if (!usableItems.length) return setErr("Add at least one WorkoutItem (ExerciseName required).");

    setCreateBusy(true);
    try {
      const res = await fetch("/api/org/workouts/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...orgAuthHeaders },
        body: JSON.stringify({
          date: selectedDate,
          sport,
          title: cleanTitle,
          status,
          athleteIds: assignedAthleteIds, // athlete record ids (AthleteScans)
          items: usableItems,
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to create workout");

      setCreateOpen(false);
      await refreshAll();
    } catch (e) {
      setErr(e?.message || "Failed to create");
    } finally {
      setCreateBusy(false);
    }
  };

  const dayWorkouts = day?.workouts || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-6 h-6 text-[#46769B]" />
                <motion.h1
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-2xl font-extrabold truncate"
                >
                  Workout Calendar
                </motion.h1>
                <Pill>{sport}</Pill>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Click a day → schedule a workout → assign athletes → add items. Clean, fast, non-clutter.
              </p>
              <p className="text-[11px] text-gray-500 mt-2">
                Org token scoped • Athlete proofs flow into WorkoutCompletions.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={refreshAll} disabled={loading}>
                <RefreshCcw className="w-4 h-4" />
                Refresh
              </Button>
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4" />
                Add workout
              </Button>
              <Button variant="secondary" onClick={() => router.push("/org/dashboard")}>
                Back
              </Button>
            </div>
          </div>

          {err ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700 font-semibold">{err}</p>
            </div>
          ) : null}
        </div>

        {/* Top Controls */}
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Sidebar */}
          <aside className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5 space-y-3">
              <p className="text-sm font-extrabold text-gray-900">Sport</p>
              <div className="grid grid-cols-2 gap-2">
                {["Basketball", "Football", "Baseball", "Soccer"].map((s) => {
                  const active = s === sport;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSport(s)}
                      className={classNames(
                        "px-3 py-2 rounded-2xl border text-sm font-semibold transition",
                        active
                          ? "bg-[#46769B] text-white border-[#46769B]"
                          : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
                      )}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-600">
                  Week starts Monday. Click a day to see planner on the right.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
              <p className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Roster
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                This uses your existing <span className="font-semibold">/api/org/getAthletes</span>.
              </p>

              <div className="mt-3">
                {athletesLoading ? (
                  <p className="text-sm text-gray-600">Loading athletes…</p>
                ) : (
                  <p className="text-sm text-gray-700">
                    Athletes loaded: <span className="font-semibold">{athletes.length}</span>
                  </p>
                )}
              </div>
            </div>
          </aside>

          {/* Calendar + Day planner */}
          <section className="lg:col-span-9 space-y-6">
            {/* Week header */}
            <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-500">Week of</p>
                  <p className="text-lg font-extrabold text-gray-900">
                    {prettyDate(weekStartISO)} – {prettyDate(weekDays[6]?.iso)}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const prev = toISODateLocal(addDays(new Date(`${weekStartISO}T12:00:00`), -7));
                      // move selected date to same weekday in previous week
                      setSelectedDate(prev);
                    }}
                    disabled={loading}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Prev
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setSelectedDate(toISODateLocal(new Date()))}
                    disabled={loading}
                  >
                    Today
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const next = toISODateLocal(addDays(new Date(`${weekStartISO}T12:00:00`), 7));
                      setSelectedDate(next);
                    }}
                    disabled={loading}
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Week grid */}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-7 gap-3">
                {weekDays.map((d) => {
                  const active = d.iso === selectedDate;
                  const list = workoutsByDate.get(d.iso) || [];

                  return (
                    <button
                      key={d.iso}
                      type="button"
                      onClick={() => setSelectedDate(d.iso)}
                      className={classNames(
                        "text-left rounded-2xl border p-4 transition min-h-[132px]",
                        active
                          ? "bg-blue-50 border-[#46769B]"
                          : "bg-white border-gray-200 hover:bg-gray-50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className={classNames("text-xs font-extrabold", active ? "text-[#46769B]" : "text-gray-900")}>
                            {d.label}
                          </p>
                          <p className="text-[11px] text-gray-500">{d.pretty}</p>
                        </div>

                        {list.length ? (
                          <Pill tone="warn">{list.length} workout{list.length > 1 ? "s" : ""}</Pill>
                        ) : (
                          <Pill>Empty</Pill>
                        )}
                      </div>

                      <div className="mt-3 space-y-2">
                        {list.slice(0, 2).map((w) => (
                          <div
                            key={w.id}
                            className="rounded-xl border border-gray-200 bg-white px-3 py-2"
                          >
                            <p className="text-sm font-bold text-gray-900 truncate">
                              {w.Title || "Workout"}
                            </p>
                            <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-2">
                              <span className="inline-flex items-center gap-1">
                                <ClipboardList className="w-3.5 h-3.5" />
                                {w.itemCount ?? 0} items
                              </span>
                              <span>•</span>
                              <span>{w.athleteCount ?? 0} athletes</span>
                              {w.Status ? (
                                <>
                                  <span>•</span>
                                  <span className="font-semibold">{w.Status}</span>
                                </>
                              ) : null}
                            </p>
                          </div>
                        ))}

                        {list.length > 2 ? (
                          <p className="text-[11px] text-gray-500">
                            +{list.length - 2} more…
                          </p>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Day planner */}
            <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-500">Day Planner</p>
                  <p className="text-xl font-extrabold text-gray-900">
                    {labelForDate(selectedDate)} <span className="text-gray-400">•</span>{" "}
                    {prettyDate(selectedDate)}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Schedule workouts and build items. Athlete app reads from DailyWorkout + WorkoutItems.
                  </p>
                </div>

                <Button onClick={openCreate}>
                  <Plus className="w-4 h-4" />
                  Add workout
                </Button>
              </div>

              {loading ? (
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <p className="text-sm text-gray-800 font-semibold">Loading day…</p>
                </div>
              ) : null}

              {!loading && !dayWorkouts.length ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <p className="text-sm font-extrabold text-gray-900">No workouts scheduled.</p>
                  <p className="text-[12px] text-gray-600 mt-1">
                    Click <span className="font-semibold">Add workout</span> to schedule one for this day.
                  </p>
                </div>
              ) : null}

              <div className="space-y-3">
                {dayWorkouts.map((w) => {
                  const wid = String(w?.id || "");
                  const list = day?.itemsByWorkoutId?.[wid] || [];

                  return (
                    <div key={wid} className="rounded-2xl border border-gray-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-gray-900 truncate">
                            {w?.Title || "Workout"}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {w?.Status ? <Pill tone="warn">{w.Status}</Pill> : null}
                            <Pill>
                              <Dumbbell className="w-3.5 h-3.5 mr-1.5" />
                              {list.length} items
                            </Pill>
                            <Pill>
                              <Users className="w-3.5 h-3.5 mr-1.5" />
                              {w?.athleteCount ?? 0} athletes
                            </Pill>
                          </div>
                        </div>
                      </div>

                      {list.length ? (
                        <div className="mt-4 space-y-2">
                          {list.slice(0, 6).map((it) => {
                            const itemId = String(it?.id || "");
                            const completion = day?.completionByItemId?.[itemId] || null;
                            const status = String(completion?.Status || "").toLowerCase();

                            return (
                              <div
                                key={itemId}
                                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
                              >
                                <p className="text-sm font-semibold text-gray-900 truncate">
                                  {it?.ExerciseName || it?.ExceciseName || "Item"}
                                </p>
                                <p className="text-[11px] text-gray-600 mt-1">
                                  {it?.Sets ? `${it.Sets} sets` : ""}
                                  {it?.Reps ? ` • ${it.Reps} reps` : ""}
                                  {it?.Weight ? ` • ${it.Weight}` : ""}
                                  {it?.Rest ? ` • Rest: ${it.Rest}` : ""}
                                </p>

                                {completion ? (
                                  <div className="mt-2 flex gap-2 flex-wrap">
                                    <Pill tone={status === "completed" ? "good" : status === "pending_review" ? "warn" : "bad"}>
                                      Completion: {completion.Status}
                                    </Pill>
                                    {completion?.Name ? <Pill>{completion.Name}</Pill> : null}
                                  </div>
                                ) : (
                                  <div className="mt-2">
                                    <Pill tone="warn">No completion yet</Pill>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {list.length > 6 ? (
                            <p className="text-[11px] text-gray-500">+{list.length - 6} more items…</p>
                          ) : null}
                        </div>
                      ) : (
                        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
                          <p className="text-sm text-gray-700 font-semibold">No items attached yet.</p>
                          <p className="text-[11px] text-gray-500 mt-1">
                            Create items in the Add workout flow.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        {/* Create drawer (simple + non-clutter) */}
        {createOpen ? (
          <div className="fixed inset-0 z-[9999]">
            <div className="absolute inset-0 bg-black/40" onClick={() => (createBusy ? null : setCreateOpen(false))} />
            <div className="absolute inset-0 flex items-end md:items-center justify-center p-3">
              <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
                <div className="p-5 border-b flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-extrabold text-gray-900 truncate">
                      Add workout • {prettyDate(selectedDate)} • {sport}
                    </p>
                    <p className="text-[12px] text-gray-500 mt-1">
                      Creates a DailyWorkout record + WorkoutItems. Assign athletes now.
                    </p>
                  </div>
                  <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={createBusy}>
                    Close
                  </Button>
                </div>

                <div className="p-5 grid lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-7 space-y-4">
                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                      <p className="text-xs font-bold text-gray-700">Workout info</p>

                      <div className="mt-2 grid md:grid-cols-2 gap-3">
                        <div>
                          <p className="text-[11px] text-gray-500 mb-1">Title</p>
                          <input
                            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#46769B]/30"
                            placeholder="e.g., Lower Strength + Conditioning"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                          />
                        </div>

                        <div>
                          <p className="text-[11px] text-gray-500 mb-1">Status</p>
                          <select
                            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white outline-none focus:ring-2 focus:ring-[#46769B]/30"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                          >
                            <option value="assigned">assigned</option>
                            <option value="draft">draft</option>
                            <option value="completed">completed</option>
                            <option value="archived">archived</option>
                          </select>
                        </div>
                      </div>

                      <p className="mt-3 text-[11px] text-gray-500">
                        Date: <span className="font-semibold">{selectedDate}</span>
                      </p>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-gray-700">Workout items</p>
                        <Button variant="secondary" onClick={addItemRow} disabled={createBusy}>
                          <Plus className="w-4 h-4" />
                          Add item
                        </Button>
                      </div>

                      <div className="mt-3 space-y-3">
                        {items.map((it, idx) => (
                          <div key={idx} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-extrabold text-gray-900">Item {idx + 1}</p>
                              {items.length > 1 ? (
                                <button
                                  type="button"
                                  onClick={() => removeItemRow(idx)}
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 bg-white text-red-700 text-xs font-semibold hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Remove
                                </button>
                              ) : null}
                            </div>

                            <div className="mt-3 grid md:grid-cols-2 gap-3">
                              <div className="md:col-span-2">
                                <p className="text-[11px] text-gray-500 mb-1">ExerciseName (required)</p>
                                <input
                                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#46769B]/30"
                                  placeholder="e.g., Back Squat"
                                  value={it.ExerciseName}
                                  onChange={(e) => updateItem(idx, "ExerciseName", e.target.value)}
                                />
                              </div>

                              <div>
                                <p className="text-[11px] text-gray-500 mb-1">Sets</p>
                                <input
                                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#46769B]/30"
                                  placeholder="e.g., 4"
                                  value={it.Sets}
                                  onChange={(e) => updateItem(idx, "Sets", e.target.value)}
                                />
                              </div>

                              <div>
                                <p className="text-[11px] text-gray-500 mb-1">Reps</p>
                                <input
                                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#46769B]/30"
                                  placeholder="e.g., 6"
                                  value={it.Reps}
                                  onChange={(e) => updateItem(idx, "Reps", e.target.value)}
                                />
                              </div>

                              <div>
                                <p className="text-[11px] text-gray-500 mb-1">Weight</p>
                                <input
                                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#46769B]/30"
                                  placeholder="e.g., 225"
                                  value={it.Weight}
                                  onChange={(e) => updateItem(idx, "Weight", e.target.value)}
                                />
                              </div>

                              <div>
                                <p className="text-[11px] text-gray-500 mb-1">Rest</p>
                                <input
                                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#46769B]/30"
                                  placeholder="e.g., 90s"
                                  value={it.Rest}
                                  onChange={(e) => updateItem(idx, "Rest", e.target.value)}
                                />
                              </div>

                              <div className="md:col-span-2">
                                <p className="text-[11px] text-gray-500 mb-1">Instructions</p>
                                <textarea
                                  className="w-full min-h-[84px] px-3 py-2 rounded-xl border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#46769B]/30"
                                  placeholder="Technique cues, tempo, etc."
                                  value={it.Instructions}
                                  onChange={(e) => updateItem(idx, "Instructions", e.target.value)}
                                />
                              </div>

                              <div className="md:col-span-1">
                                <p className="text-[11px] text-gray-500 mb-1">VideoURL</p>
                                <input
                                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-[#46769B]/30"
                                  placeholder="https://..."
                                  value={it.VideoURL}
                                  onChange={(e) => updateItem(idx, "VideoURL", e.target.value)}
                                />
                              </div>

                              <div className="md:col-span-1">
                                <p className="text-[11px] text-gray-500 mb-1">EvidenceRequired</p>
                                <select
                                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white outline-none focus:ring-2 focus:ring-[#46769B]/30"
                                  value={it.EvidenceRequired}
                                  onChange={(e) => updateItem(idx, "EvidenceRequired", e.target.value)}
                                >
                                  <option value="none">none</option>
                                  <option value="photo">photo</option>
                                  <option value="video">video</option>
                                  <option value="photo_or_video">photo_or_video</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <p className="mt-3 text-[11px] text-gray-500">
                        Only items with ExerciseName are saved.
                      </p>
                    </div>
                  </div>

                  <div className="lg:col-span-5 space-y-4">
                    <MultiSelect
                      label="Assign athletes (AthleteScans)"
                      options={athletes}
                      valueIds={assignedAthleteIds}
                      onChange={setAssignedAthleteIds}
                    />

                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <p className="text-sm font-extrabold text-gray-900">Ready to publish</p>
                      <p className="text-[12px] text-gray-600 mt-1">
                        This creates a DailyWorkout and links WorkoutItems. Athlete “Today” reads it.
                      </p>

                      <div className="mt-4 flex gap-2">
                        <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={createBusy}>
                          Cancel
                        </Button>
                        <Button onClick={createWorkout} disabled={createBusy}>
                          {createBusy ? "Creating…" : "Create workout"}
                        </Button>
                      </div>

                      <p className="mt-3 text-[11px] text-gray-500">
                        Next: we’ll add edit, clone day, and template apply.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
