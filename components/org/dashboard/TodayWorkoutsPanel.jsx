// components/org/dashboard/TodayWorkoutsPanel.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ClipboardList,
  RefreshCcw,
  ArrowRight,
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

function MetricTile({ label, value, sub, tone = "neutral" }) {
  const toneCls =
    tone === "warn"
      ? "border-amber-200 bg-amber-50"
      : tone === "good"
      ? "border-emerald-200 bg-emerald-50"
      : "border-gray-200 bg-gray-50";

  return (
    <div className={classNames("rounded-2xl border p-4 sm:p-5", toneCls)}>
      <p className="text-[11px] sm:text-xs text-gray-600">{label}</p>
      <p className="text-2xl sm:text-[28px] leading-tight font-extrabold text-gray-900 mt-1">
        {value}
      </p>
      {sub ? (
        <p className="text-[11px] sm:text-xs text-gray-600 mt-2 line-clamp-2">
          {sub}
        </p>
      ) : null}
    </div>
  );
}

function toneForPct(pct) {
  const p = Number(pct || 0);
  if (p >= 80) return "good";
  if (p >= 50) return "neutral";
  return "warn";
}

export default function TodayWorkoutsPanel({ onOpenCalendar, isOrgSide, sports }) {
  const { sport, setSport, availableSports, loading, err, todayISO, fetchToday, summary } =
    useTodayWorkouts({ isOrgSide });

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

  const allSports = useMemo(() => {
    const merged = uniqStrings([...(sports || []), ...(availableSports || []), ...defaultSports]);
    if (sport && !merged.some((s) => equalsCI(s, sport))) return [String(sport), ...merged];
    return merged;
  }, [sports, availableSports, defaultSports, sport]);

  const CHIP_COUNT = 6;
  const chosenScoreRef = useRef(new Map());
  const chosenTickRef = useRef(1);

  const seedNeverChosen = (chipList) => {
    const m = chosenScoreRef.current;
    (chipList || []).forEach((s) => {
      const k = normKey(s);
      if (!m.has(k)) m.set(k, 0);
    });
  };

  const { chipSports, moreSports } = useMemo(() => {
    const base = Array.isArray(allSports) ? [...allSports] : [];
    const selected = String(sport || "").trim();
    const selectedKey = normKey(selected);

    let chips = base.slice(0, CHIP_COUNT);
    seedNeverChosen(chips);

    if (selected && !chips.some((s) => equalsCI(s, selected))) {
      const selectedIdx = base.findIndex((s) => equalsCI(s, selected));
      if (selectedIdx >= 0) {
        const selectedValue = base[selectedIdx];
        const m = chosenScoreRef.current;

        let replaceIdx = chips.length - 1;
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

        const chipsLower = new Set(chips.map((s) => normKey(s)));
        let more = base.filter((s) => !chipsLower.has(normKey(s)));

        if (bumped && !more.some((s) => equalsCI(s, bumped)) && !chipsLower.has(normKey(bumped))) {
          more = [bumped, ...more];
        }

        more = uniqStrings(more);
        seedNeverChosen(chips);

        return { chipSports: chips, moreSports: more };
      }
    }

    const chipsLower = new Set(chips.map((s) => normKey(s)));
    const more = uniqStrings(base.filter((s) => !chipsLower.has(normKey(s))));
    seedNeverChosen(chips);

    return { chipSports: chips, moreSports: more };
  }, [allSports, sport]);

  useEffect(() => seedNeverChosen(chipSports), [chipSports]);

  const [moreOpen, setMoreOpen] = useState(false);
  const moreWrapRef = useRef(null);

  useEffect(() => setMoreOpen(false), [sport]);

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

  const onSelectSport = (s) => {
    const k = normKey(s);
    chosenScoreRef.current.set(k, chosenTickRef.current++);
    setSport(s);
    setMoreOpen(false);
  };

  const workoutCount = Number(summary?.workoutCount ?? 0);
  const itemCount = Number(summary?.itemCount ?? 0);
  const completedCount = Number(summary?.completedCount ?? 0);

  const completionPct = Number(summary?.completionPct ?? 0);
  const pendingReviewCount = Number(summary?.pendingReviewCount ?? 0);
  const rejectedCount = Number(summary?.rejectedCount ?? 0);

  const completionTone = toneForPct(completionPct);

  return (
    <section className="bg-white rounded-2xl shadow-md border border-blue-100 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarDays className="w-5 h-5 text-[#46769B] shrink-0" />
            <h2 className="text-lg font-extrabold text-gray-900 truncate">
              Today • Workouts
            </h2>
            <Pill className="shrink-0">{todayISO}</Pill>
          </div>

          <p className="text-sm text-gray-600 mt-1">
            Topline schedule + completion for{" "}
            <span className="font-semibold">{sport}</span>. Use Calendar for details.
          </p>
        </div>

        {/* Actions (full width on mobile) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:flex lg:justify-end">
          <Button
            variant="secondary"
            className="w-full px-3 py-2 text-xs"
            onClick={fetchToday}
            disabled={loading}
            title="Refresh workouts summary"
          >
            <RefreshCcw className={classNames("w-4 h-4", loading ? "animate-spin" : "")} />
            Refresh
          </Button>

          <Button
            variant="secondary"
            className="w-full px-3 py-2 text-xs"
            onClick={onOpenCalendar}
            title="Open workouts calendar"
          >
            Calendar
            <ClipboardList className="w-4 h-4" />
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Sport chips */}
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
                  "min-h-[40px] leading-none", // ✅ tap target
                  active
                    ? "bg-[#46769B] text-white border-[#46769B]"
                    : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
                )}
              >
                <span className="truncate">{s}</span>
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
                  "min-h-[40px]",
                  moreOpen
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
                )}
              >
                More
                <ChevronDown
                  className={classNames("w-4 h-4 transition", moreOpen ? "rotate-180 opacity-90" : "opacity-70")}
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
                            active ? "bg-blue-50 text-[#46769B]" : "hover:bg-gray-50 text-gray-800"
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
      </div>

      {/* Loading / error */}
      {loading ? (
        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-semibold text-gray-900">Loading workouts…</p>
          <p className="text-[11px] text-gray-500 mt-1">
            Pulling today’s schedule, completion, and review counts.
          </p>
        </div>
      ) : null}

      {err ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">{err}</p>
          <p className="text-[11px] text-red-600 mt-1">
            If this persists, confirm the endpoint uses cookie auth (credentials include).
          </p>
        </div>
      ) : null}

      {/* Topline stats */}
      <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricTile label="Scheduled" value={loading ? "…" : workoutCount} sub={`For ${sport} today`} />
        <MetricTile label="Items" value={loading ? "…" : itemCount} sub="Assigned items (total)" />
        <MetricTile
          label="Completed"
          value={loading ? "…" : `${completionPct}%`}
          sub={loading ? "" : `${completedCount}/${itemCount} items`}
          tone={completionTone}
        />
        <MetricTile
          label="Review queue"
          value={loading ? "…" : pendingReviewCount}
          sub={rejectedCount > 0 ? `${rejectedCount} rejected` : "All clear if 0"}
          tone={pendingReviewCount > 0 ? "warn" : "good"}
        />
      </div>

      <div className="mt-3 text-[11px] text-gray-500">
        Need to inspect assignments? Open <span className="font-semibold">Calendar</span>.
      </div>
    </section>
  );
}
