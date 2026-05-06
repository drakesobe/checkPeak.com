// components/org/workouts-calendar/TodayWorkoutsPanel.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ClipboardList,
  RefreshCcw,
  ArrowRight,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";
import { DS, Button } from "@/components/org/dashboard/DashboardUI";
import { useTodayWorkouts } from "@/hooks/org/useTodayWorkouts";

function uniqStrings(xs) {
  const out = [];
  const seen = new Set();
  (Array.isArray(xs) ? xs : []).forEach((x) => {
    const s = String(x || "").trim();
    if (!s) return;
    const k = s.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
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

function isAllSportsValue(v) {
  const k = normKey(v);
  return k === "all" || k === "all sports";
}

function toneForPct(p) {
  const n = Number(p || 0);
  return n >= 80 ? "good" : n >= 50 ? "neutral" : "warn";
}

function MetricTile({ label, value, sub, tone = "neutral" }) {
  const bg     = tone === "warn" ? DS.cautionBg : tone === "good" ? DS.safeBg : DS.pageBg;
  const border = tone === "warn" ? DS.cautionBorder : tone === "good" ? DS.safeBorder : DS.border;
  const vc     = tone === "warn" ? DS.caution : tone === "good" ? DS.safe : DS.bodyText;

  return (
    <div className="p-3" style={{ backgroundColor: bg, border: `1px solid ${border}` }}>
      <p className="text-xs font-black uppercase tracking-wider" style={{ color: DS.dimText }}>
        {label}
      </p>
      <p
        className="text-2xl font-black mt-1 tabular-nums"
        style={{ color: vc, fontFamily: "'Barlow Condensed', sans-serif" }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-xs mt-1" style={{ color: DS.dimText }}>
          {sub}
        </p>
      )}
    </div>
  );
}

export default function TodayWorkoutsPanel({ onOpenCalendar, isOrgSide, sports, todayWorkouts }) {
  const { sport, setSport, availableSports, loading, err,
          todayISO, fetchToday, summary } = todayWorkouts;

  const defaultSports = useMemo(
    () => [
      "Football", "Basketball", "Baseball", "Soccer", "Hockey",
      "Lacrosse", "Tennis", "Golf", "Track", "Swimming", "Volleyball", "Wrestling",
    ],
    []
  );

  const allSports = useMemo(() => {
    return uniqStrings([...(sports || []), ...(availableSports || []), ...defaultSports]);
  }, [sports, availableSports, defaultSports]);

  useEffect(() => {
    if (!isOrgSide) return;
    if (sport == null) setSport("");
  }, [sport, setSport, isOrgSide]);

  const displaySport = isAllSportsValue(sport) || !sport ? "All Sports" : String(sport);

  const CHIP_COUNT       = 6;
  const chosenScoreRef   = useRef(new Map());
  const chosenTickRef    = useRef(1);

  const seedNeverChosen = (chipList) => {
    const m = chosenScoreRef.current;
    (chipList || []).forEach((s) => {
      const k = normKey(s);
      if (!m.has(k)) m.set(k, 0);
    });
  };

  const { chipSports, moreSports } = useMemo(() => {
    const allOption  = "All Sports";
    const baseSports = Array.isArray(allSports) ? [...allSports] : [];
    const base       = [allOption, ...baseSports.filter((s) => !isAllSportsValue(s))];

    const selectedValue = isAllSportsValue(sport) || !sport ? allOption : String(sport);
    let chips = base.slice(0, CHIP_COUNT);
    seedNeverChosen(chips);

    if (selectedValue && !chips.some((s) => equalsCI(s, selectedValue))) {
      const idx = base.findIndex((s) => equalsCI(s, selectedValue));
      if (idx >= 0) {
        const sel = base[idx];
        const m   = chosenScoreRef.current;

        let replaceIdx = chips.length - 1;
        let bestScore  = Infinity;

        chips.forEach((c, i) => {
          const ck = normKey(c);
          if (ck === normKey(selectedValue)) return;
          if (isAllSportsValue(c)) return;
          const sc = Number(m.get(ck) ?? 0);
          if (sc < bestScore) { bestScore = sc; replaceIdx = i; }
        });

        if (isAllSportsValue(chips[replaceIdx])) {
          const fallback = chips.findIndex((c) => !isAllSportsValue(c));
          if (fallback >= 0) replaceIdx = fallback;
        }

        const bumped = chips[replaceIdx];
        chips = chips.map((c, i) => (i === replaceIdx ? sel : c));
        const chipSet = new Set(chips.map((s) => normKey(s)));
        let more = base.filter((s) => !chipSet.has(normKey(s)));
        if (bumped && !more.some((s) => equalsCI(s, bumped)) && !chipSet.has(normKey(bumped))) {
          more = [bumped, ...more];
        }
        seedNeverChosen(chips);
        return { chipSports: chips, moreSports: uniqStrings(more) };
      }
    }

    const chipSet = new Set(chips.map((s) => normKey(s)));
    seedNeverChosen(chips);
    return {
      chipSports: chips,
      moreSports: uniqStrings(base.filter((s) => !chipSet.has(normKey(s)))),
    };
  }, [allSports, sport]);

  useEffect(() => { seedNeverChosen(chipSports); }, [chipSports]);

  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);

  useEffect(() => { setMoreOpen(false); }, [sport]);

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e) => {
      if (!moreRef.current?.contains(e.target)) setMoreOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [moreOpen]);

  const onSelectSport = (s) => {
    const nextValue = isAllSportsValue(s) ? "" : s;
    chosenScoreRef.current.set(normKey(s), chosenTickRef.current++);
    setSport(nextValue);
    setMoreOpen(false);
  };

  const workoutCount       = Number(summary?.workoutCount       ?? 0);
  const itemCount          = Number(summary?.itemCount          ?? 0);
  const completedCount     = Number(summary?.completedCount     ?? 0);
  const completionPct      = Number(summary?.completionPct      ?? 0);
  const pendingReviewCount = Number(summary?.pendingReviewCount ?? 0);
  const rejectedCount      = Number(summary?.rejectedCount      ?? 0);

  const allClear =
    !loading && !err && workoutCount > 0 && completionPct >= 100 && pendingReviewCount === 0;

  const scheduledSub =
    isAllSportsValue(sport) || !sport ? "All sports today" : `${displaySport} today`;

  return (
    <section
      style={{
        backgroundColor: DS.cardBg,
        border:    `1px solid ${DS.border}`,
        borderTop: `3px solid ${DS.brand}`,
      }}
    >
      {/* ── Header ── */}
      <div
        className="px-4 py-3 flex items-center justify-between gap-2"
        style={{ borderBottom: `1px solid ${DS.border}` }}
      >
        {/* Title + date badge */}
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays className="w-4 h-4 shrink-0" style={{ color: DS.brand }} />
          <span className="text-xs font-black uppercase tracking-wider" style={{ color: DS.brand }}>
            Workouts
          </span>
          <span
            className="text-xs font-bold px-1.5 py-0.5 shrink-0"
            style={{
              backgroundColor: DS.brandBg,
              color:           DS.labelText,
              border:          `1px solid ${DS.brandBorder}`,
            }}
          >
            {todayISO}
          </span>
        </div>

        {/* Action buttons - hidden on mobile, visible sm+ */}
        <div className="hidden sm:flex gap-1.5 shrink-0">
          <Button variant="secondary" onClick={fetchToday} disabled={loading}>
            <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="secondary" onClick={onOpenCalendar}>
            <ClipboardList className="w-3.5 h-3.5" /> Calendar <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Mobile-only: single icon refresh button */}
        <button
          type="button"
          onClick={fetchToday}
          disabled={loading}
          className="sm:hidden p-1.5 shrink-0"
          style={{
            border:          `1px solid ${DS.border}`,
            backgroundColor: DS.cardBg,
            color:           DS.labelText,
            opacity:         loading ? 0.5 : 1,
          }}
          aria-label="Refresh workouts"
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="p-3 sm:p-4">
        {/* Sport chips */}
        <div className="flex flex-wrap gap-1.5">
          {chipSports.map((s) => {
            const active = isAllSportsValue(sport) ? isAllSportsValue(s) : equalsCI(s, sport);
            return (
              <button
                key={s}
                type="button"
                onClick={() => onSelectSport(s)}
                className="px-2.5 py-1.5 text-xs font-black uppercase tracking-wide transition-all"
                style={{
                  backgroundColor: active ? DS.brand : DS.cardBg,
                  color:           active ? "#fff"  : DS.labelText,
                  border:          `1px solid ${active ? DS.brand : DS.border}`,
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = DS.brandBg;
                    e.currentTarget.style.borderColor     = DS.brandBorder;
                    e.currentTarget.style.color           = DS.brand;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = DS.cardBg;
                    e.currentTarget.style.borderColor     = DS.border;
                    e.currentTarget.style.color           = DS.labelText;
                  }
                }}
              >
                {s}
              </button>
            );
          })}

          {moreSports.length > 0 && (
            <div className="relative" ref={moreRef}>
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                className="px-2.5 py-1.5 text-xs font-black uppercase tracking-wide inline-flex items-center gap-1 transition-all"
                style={{
                  backgroundColor: moreOpen ? DS.bodyText : DS.cardBg,
                  color:           moreOpen ? "#fff"      : DS.labelText,
                  border:          `1px solid ${moreOpen ? DS.bodyText : DS.border}`,
                }}
              >
                More <ChevronDown className={`w-3 h-3 transition ${moreOpen ? "rotate-180" : ""}`} />
              </button>

              {moreOpen && (
                <div
                  className="absolute left-0 mt-1 w-44 z-50 p-1"
                  style={{
                    backgroundColor: DS.cardBg,
                    border:          `1px solid ${DS.border}`,
                    boxShadow:       "0 4px 16px rgba(0,0,0,0.1)",
                  }}
                >
                  <div className="max-h-64 overflow-auto">
                    {moreSports.map((s) => {
                      const active = isAllSportsValue(sport)
                        ? isAllSportsValue(s)
                        : equalsCI(s, sport);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => onSelectSport(s)}
                          className="w-full text-left px-2.5 py-2 text-xs font-bold transition-all"
                          style={{
                            backgroundColor: active ? DS.brandBg : "transparent",
                            color:           active ? DS.brand   : DS.bodyText,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DS.brandBg; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = active ? DS.brandBg : "transparent"; }}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div
            className="mt-3 p-3 text-xs"
            style={{ backgroundColor: DS.pageBg, border: `1px solid ${DS.border}`, color: DS.labelText }}
          >
            Loading workouts…
          </div>
        )}

        {/* Error */}
        {err && (
          <div
            className="mt-3 p-3 text-xs font-bold"
            style={{ backgroundColor: DS.bannedBg, border: `1px solid ${DS.bannedBorder}`, color: DS.banned }}
          >
            {err}
          </div>
        )}

        {/* All clear */}
        {allClear && (
          <div
            className="mt-3 flex items-center gap-2 px-3 py-3"
            style={{
              backgroundColor: DS.safeBg,
              border:          `1px solid ${DS.safeBorder}`,
              borderLeft:      `3px solid ${DS.safe}`,
            }}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: DS.safe }} />
            <p className="text-xs font-black" style={{ color: DS.safe }}>
              All workouts complete - nothing in the review queue.
            </p>
          </div>
        )}

        {/* Metric tiles - 2-col on mobile, 4-col on lg+ */}
        <div
          className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-px"
          style={{ backgroundColor: DS.border }}
        >
          <MetricTile
            label="Scheduled"
            value={loading ? "…" : workoutCount}
            sub={scheduledSub}
          />
          <MetricTile
            label="Items"
            value={loading ? "…" : itemCount}
            sub="Total assigned"
          />
          <MetricTile
            label="Completed"
            value={loading ? "…" : `${completionPct}%`}
            sub={`${completedCount}/${itemCount}`}
            tone={toneForPct(completionPct)}
          />
          <MetricTile
            label="Review Queue"
            value={loading ? "…" : pendingReviewCount}
            sub={rejectedCount > 0 ? `${rejectedCount} rejected` : "All clear"}
            tone={pendingReviewCount > 0 ? "warn" : "good"}
          />
        </div>
      </div>
    </section>
  );
}