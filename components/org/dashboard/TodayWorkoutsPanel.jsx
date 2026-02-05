// /components/org/dashboard/TodayWorkoutsPanel.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ClipboardList,
  RefreshCcw,
  ArrowRight,
  Dumbbell,
  Users,
  ChevronDown,
} from "lucide-react";

import { classNames } from "@/lib/org/dashboard-utils";
import { Button, Pill } from "@/components/org/dashboard/DashboardUI";
import { useTodayWorkouts } from "@/hooks/org/useTodayWorkouts";

function uniqStrings(xs) {
  const out = [];
  const seen = new Set();
  (Array.isArray(xs) ? xs : []).forEach((x) => {
    const s = String(x || "").trim();
    if (!s) return;
    const key = s.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(s);
  });
  return out;
}

function normKey(s) {
  return String(s || "").trim().toLowerCase();
}

function equalsCI(a, b) {
  return normKey(a) === normKey(b);
}

export default function TodayWorkoutsPanel({ onOpenCalendar, isOrgSide, sports }) {
  const {
    sport,
    setSport,
    availableSports,
    loading,
    err,
    day,
    todayISO,
    fetchToday,
    summary,
    list,
  } = useTodayWorkouts({ isOrgSide });

  const defaultSports = useMemo(
    () => [
      "Basketball",
      "Football",
      "Baseball",
      "Soccer",
      "Hockey",
      "Lacrosse",
      "Tennis",
      "Golf",
      "Track",
      "Swimming",
      "Volleyball",
      "Wrestling",
    ],
    []
  );

  // ✅ Merge: prop sports + API sports + defaults
  const allSports = useMemo(() => {
    const merged = uniqStrings([
      ...(sports || []),
      ...(availableSports || []),
      ...defaultSports,
    ]);

    // Ensure current sport is present somewhere
    if (sport && !merged.some((s) => equalsCI(s, sport))) {
      return [String(sport), ...merged];
    }
    return merged;
  }, [sports, availableSports, defaultSports, sport]);

  const CHIP_COUNT = 6;

  // ------------------------------------------------------------------
  // ✅ NEW: track "last chosen" to replace the sport that's not chosen
  // ------------------------------------------------------------------
  const chosenScoreRef = useRef(new Map()); // key -> number (bigger = more recent)
  const chosenTickRef = useRef(1); // monotonically increasing

  // Whenever the chip list changes, seed "never chosen" entries for visible chips
  // (so we can fairly replace ones the coach hasn't touched).
  const seedNeverChosen = (chipList) => {
    const m = chosenScoreRef.current;
    (chipList || []).forEach((s) => {
      const k = normKey(s);
      if (!m.has(k)) m.set(k, 0); // 0 = never chosen
    });
  };

  // Compute chips + more using "least recently chosen" replacement
  const { chipSports, moreSports } = useMemo(() => {
    const base = Array.isArray(allSports) ? [...allSports] : [];
    const selected = String(sport || "").trim();
    const selectedKey = normKey(selected);

    let chips = base.slice(0, CHIP_COUNT);

    // seed scores for initial chips (never chosen)
    seedNeverChosen(chips);

    // If selected isn't in chips, swap it in by replacing the least-chosen chip
    if (selected && !chips.some((s) => equalsCI(s, selected))) {
      const selectedIdx = base.findIndex((s) => equalsCI(s, selected));
      if (selectedIdx >= 0) {
        const selectedValue = base[selectedIdx];

        // pick replacement: the chip with the smallest "last chosen" score
        // (never chosen = 0 -> replaced first)
        const m = chosenScoreRef.current;

        let replaceIdx = chips.length - 1; // fallback
        let bestScore = Number.POSITIVE_INFINITY;

        chips.forEach((c, idx) => {
          const ck = normKey(c);
          if (ck === selectedKey) return;

          const score = Number(m.get(ck) ?? 0);
          if (score < bestScore) {
            bestScore = score;
            replaceIdx = idx;
          }
        });

        const bumped = chips[replaceIdx];
        chips = chips.map((c, idx) => (idx === replaceIdx ? selectedValue : c));

        // Build more: everything not in chips (+ bumped if needed)
        const chipsLower = new Set(chips.map((s) => normKey(s)));
        let more = base.filter((s) => !chipsLower.has(normKey(s)));

        if (bumped && !more.some((s) => equalsCI(s, bumped)) && !chipsLower.has(normKey(bumped))) {
          more = [bumped, ...more];
        }

        more = uniqStrings(more);

        // seed never-chosen for any newly visible chips
        seedNeverChosen(chips);

        return { chipSports: chips, moreSports: more };
      }
    }

    // Default more: all not in chips
    const chipsLower = new Set(chips.map((s) => normKey(s)));
    const more = uniqStrings(base.filter((s) => !chipsLower.has(normKey(s))));

    seedNeverChosen(chips);

    return { chipSports: chips, moreSports: more };
  }, [allSports, sport]);

  // When chipSports changes, seed score entries (in case API list changes)
  useEffect(() => {
    seedNeverChosen(chipSports);
  }, [chipSports]);

  const [moreOpen, setMoreOpen] = useState(false);
  const moreWrapRef = useRef(null);

  // Close dropdown when sport changes
  useEffect(() => {
    setMoreOpen(false);
  }, [sport]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!moreOpen) return;

    const onDown = (e) => {
      const el = moreWrapRef.current;
      if (!el) return;
      if (el.contains(e.target)) return;
      setMoreOpen(false);
    };

    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [moreOpen]);

  const toneForStatus = (s) => {
    const status = String(s || "").toLowerCase();
    if (status.includes("complete")) return "good";
    if (status.includes("assign")) return "warn";
    return "neutral";
  };

  const onSelectSport = (s) => {
    // mark this sport as "most recently chosen"
    const k = normKey(s);
    chosenScoreRef.current.set(k, chosenTickRef.current++);
    setSport(s);
    setMoreOpen(false);
  };

  return (
    <section className="bg-white rounded-2xl shadow-md border border-blue-100 p-5 sm:p-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-[#46769B]" />
            <h2 className="text-lg font-extrabold text-gray-900">Today’s Workouts</h2>
            <Pill>{todayISO}</Pill>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Quick ops view for <span className="font-semibold">{sport}</span>. Jump to
            the calendar to schedule/edit.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="secondary"
            onClick={fetchToday}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            <RefreshCcw className="w-4 h-4" />
            Refresh
          </Button>

          <Button
            onClick={onOpenCalendar}
            className="w-full sm:w-auto"
            title="Open workouts calendar"
          >
            <ClipboardList className="w-4 h-4" />
            Open calendar
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Sports selector (chips + More) */}
      <div className="mt-4">
        <div className="flex flex-wrap gap-2">
          {chipSports.map((s) => {
            const active = equalsCI(s, sport);
            return (
              <button
                key={s}
                type="button"
                onClick={() => onSelectSport(s)}
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

          {moreSports.length > 0 ? (
            <div className="relative" ref={moreWrapRef}>
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
                className={classNames(
                  "px-3 py-2 rounded-2xl border text-sm font-semibold transition inline-flex items-center gap-2",
                  moreOpen
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
                )}
              >
                More
                <ChevronDown
                  className={classNames(
                    "w-4 h-4 transition",
                    moreOpen ? "rotate-180 opacity-90" : "opacity-70"
                  )}
                />
              </button>

              {moreOpen ? (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-gray-200 bg-white shadow-xl p-2 z-50">
                  <div className="max-h-72 overflow-auto">
                    {moreSports.map((s) => {
                      const active = equalsCI(s, sport);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => onSelectSport(s)}
                          className={classNames(
                            "w-full text-left px-3 py-2 rounded-xl text-sm font-semibold transition",
                            active
                              ? "bg-blue-50 text-[#46769B]"
                              : "hover:bg-gray-50 text-gray-800"
                          )}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <p className="mt-2 text-[11px] text-gray-500">
          Showing {chipSports.length}
          {moreSports.length ? ` + ${moreSports.length} more` : ""} sport(s).
        </p>
      </div>

      {err ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700 font-semibold">{err}</p>
          <p className="text-[11px] text-red-600 mt-1">
            If this endpoint still uses x-org-token headers, update the API to rely on
            the org cookie session.
          </p>
        </div>
      ) : null}

      {/* Summary cards */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs text-gray-500">Workouts scheduled</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">
            {loading ? "…" : summary.workoutCount}
          </p>
          <p className="text-[11px] text-gray-500 mt-2">For {sport} today</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs text-gray-500">Total items</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">
            {loading ? "…" : summary.itemCount}
          </p>
          <p className="text-[11px] text-gray-500 mt-2">
            <span className="font-semibold">{loading ? "…" : summary.athleteSum}</span>{" "}
            athlete assignments (sum)
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs text-gray-500">Completed items</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">
            {loading ? "…" : summary.completedCount}
          </p>
          <p className="text-[11px] text-gray-500 mt-2">
            {summary.itemCount > 0 ? `${summary.completionPct}% complete` : "No items yet"}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs text-gray-500">Pending review</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">
            {loading ? "…" : summary.pendingReviewCount}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Pill tone={summary.pendingReviewCount > 0 ? "warn" : "good"}>
              {summary.pendingReviewCount > 0 ? "Coach review needed" : "All clear"}
            </Pill>
            {summary.rejectedCount > 0 ? (
              <Pill tone="bad">{summary.rejectedCount} other</Pill>
            ) : null}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-extrabold text-gray-900">Today list</p>
          <button
            type="button"
            className="text-[11px] font-semibold text-[#46769B] hover:underline"
            onClick={onOpenCalendar}
          >
            View in calendar →
          </button>
        </div>

        {loading ? (
          <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm text-gray-800 font-semibold">Loading today…</p>
          </div>
        ) : list.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-900">
              No workouts scheduled for today.
            </p>
            <p className="text-[11px] text-gray-500 mt-1">
              Click <span className="font-semibold">Open calendar</span> to add a workout.
            </p>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
            {list.slice(0, 6).map((w) => {
              const wid = String(w?.id || "");
              const items = Array.isArray(day?.itemsByWorkoutId?.[wid])
                ? day.itemsByWorkoutId[wid]
                : [];
              return (
                <div key={wid} className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-gray-900 truncate">
                        {w?.Title || "Workout"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {w?.Status ? (
                          <Pill tone={toneForStatus(w.Status)}>{w.Status}</Pill>
                        ) : (
                          <Pill>assigned</Pill>
                        )}
                        <Pill>
                          <Dumbbell className="w-3.5 h-3.5 mr-1.5" />
                          {items.length} items
                        </Pill>
                        <Pill>
                          <Users className="w-3.5 h-3.5 mr-1.5" />
                          {w?.athleteCount ?? 0} athletes
                        </Pill>
                      </div>
                    </div>
                  </div>

                  {items.length ? (
                    <p className="mt-3 text-[11px] text-gray-500">
                      First item:{" "}
                      <span className="font-semibold text-gray-800">
                        {items[0]?.ExerciseName || items[0]?.ExceciseName || "—"}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-3 text-[11px] text-gray-500">No items attached yet.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
