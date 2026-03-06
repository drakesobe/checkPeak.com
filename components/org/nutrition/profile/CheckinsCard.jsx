// components/org/nutrition/profile/CheckinsCard.jsx
"use client";

import { useMemo } from "react";
import {
  Calendar, ChevronDown, ChevronUp,
  TrendingUp, ListChecks,
  ArrowDownWideNarrow, Expand,
} from "lucide-react";
import { avgAdherence, badgeForAdherence, fmtDateTime, safeArr } from "./utils";
import { Metric, EmptyState, StatusPill, DS } from "./ui";

function weekLabel(weekStartISO) {
  const iso = String(weekStartISO || "").trim();
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return `Week of ${new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York", month: "short", day: "2-digit", year: "numeric",
    }).format(d)}`;
  } catch { return `Week of ${iso}`; }
}

function toneFromPct(pct) {
  if (pct == null) return "neutral";
  if (pct >= 75)   return "good";
  if (pct >= 60)   return "warn";
  return                  "bad";
}

function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function GhostBtn({ onClick, icon: Icon, children, title }) {
  return (
    <button
      onClick={onClick}
      type="button"
      title={title}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-sm transition-all"
      style={{
        border: `1px solid ${DS.border}`,
        backgroundColor: DS.cardBg,
        color: DS.labelText,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = DS.brandBorder;
        e.currentTarget.style.color = DS.brand;
        e.currentTarget.style.backgroundColor = DS.brandBg;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = DS.border;
        e.currentTarget.style.color = DS.labelText;
        e.currentTarget.style.backgroundColor = DS.cardBg;
      }}
    >
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
      {children}
    </button>
  );
}

export function CheckinsCard({ checkins, openIds, onToggle, onExpandAll, onLatestOnly }) {
  const list  = useMemo(() => safeArr(checkins), [checkins]);
  const total = list.length;

  const overall = useMemo(() => {
    if (!total) return null;
    const pcts = list
      .map((c) => avgAdherence(c))
      .filter((v) => typeof v === "number" && !Number.isNaN(v));
    if (!pcts.length) return null;
    const avg = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
    return { avg, min: Math.round(Math.min(...pcts)), max: Math.round(Math.max(...pcts)) };
  }, [list, total]);

  return (
    <section style={{ border: `1px solid ${DS.border}`, borderTop: `3px solid ${DS.brand}`, backgroundColor: DS.cardBg }}>
      <div className="p-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span
                className="hidden sm:inline-flex h-9 w-9 items-center justify-center shrink-0"
                style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.pageBg }}
              >
                <ListChecks className="h-4 w-4" style={{ color: DS.labelText }} />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-black uppercase tracking-wide" style={{ color: DS.bodyText }}>
                  Completions
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-xs" style={{ color: DS.labelText }}>{total} total</span>
                  {overall?.avg != null ? (
                    <>
                      <StatusPill tone={toneFromPct(overall.avg)} text={`Overall avg ${overall.avg}%`} />
                      <span className="text-xs hidden sm:inline" style={{ color: DS.dimText }}>
                        Range {overall.min}%–{overall.max}%
                      </span>
                    </>
                  ) : (
                    <span className="text-xs" style={{ color: DS.dimText }}>No adherence data yet</span>
                  )}
                </div>
              </div>
            </div>
            <p className="mt-1.5 text-xs" style={{ color: DS.dimText }}>
              Each row is derived from daily swipes. Open a row to see macro + hydration breakdown.
            </p>
          </div>

          {total > 0 && (
            <div className="flex flex-wrap gap-2">
              <GhostBtn onClick={onLatestOnly} icon={ArrowDownWideNarrow} title="Open the newest only">
                Latest only
              </GhostBtn>
              <GhostBtn onClick={onExpandAll} icon={Expand} title="Open all rows">
                Expand all
              </GhostBtn>
            </div>
          )}
        </div>

        {/* Body */}
        {total === 0 ? (
          <EmptyState
            title="No completions yet"
            body="Once the athlete starts swiping meals + hydration, you'll see trends and notes here."
          />
        ) : (
          <div className="mt-4 space-y-2">
            {list.map((c, idx) => {
              const pct     = avgAdherence(c);
              const badge   = badgeForAdherence(pct);
              const isOpen  = Boolean(openIds?.[c.id]) || (!openIds && idx === 0);

              const caloriesPct  = numOrNull(c.caloriesPct);
              const proteinPct   = numOrNull(c.proteinPct);
              const carbsPct     = numOrNull(c.carbsPct);
              const hydrationPct = numOrNull(c.hydrationPct);

              const adherenceColor =
                typeof pct === "number"
                  ? pct >= 80 ? DS.safe : pct >= 60 ? DS.caution : DS.banned
                  : DS.dimText;

              const adherenceBg =
                typeof pct === "number"
                  ? pct >= 80 ? DS.safeBg : pct >= 60 ? DS.cautionBg : DS.bannedBg
                  : DS.pageBg;

              const adherenceBorder =
                typeof pct === "number"
                  ? pct >= 80 ? DS.safeBorder : pct >= 60 ? DS.cautionBorder : DS.bannedBorder
                  : DS.border;

              return (
                <div
                  key={c.id}
                  style={{ border: `1px solid ${isOpen ? adherenceBorder : DS.border}`, backgroundColor: DS.cardBg }}
                >
                  {/* Row header */}
                  <button
                    type="button"
                    onClick={() => onToggle?.(c.id)}
                    className="w-full text-left p-4 transition-colors"
                    style={{ backgroundColor: "transparent" }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DS.pageBg; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                    aria-expanded={isOpen}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 shrink-0" style={{ color: DS.dimText }} />
                          <p className="text-sm font-bold truncate" style={{ color: DS.bodyText }}>
                            {weekLabel(c.weekStartISO)}
                          </p>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: DS.dimText }}>
                          {c.createdAt ? `Updated ${fmtDateTime(c.createdAt)} ET` : "Update time unavailable"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className="px-2 py-0.5 text-xs font-bold rounded-sm"
                          style={{ backgroundColor: adherenceBg, color: adherenceColor, border: `1px solid ${adherenceBorder}` }}
                        >
                          {badge.t}{typeof pct === "number" ? ` · ${pct}%` : ""}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs" style={{ color: DS.dimText }}>
                          {isOpen
                            ? <><ChevronUp className="h-4 w-4" /><span className="hidden sm:inline">Hide</span></>
                            : <><ChevronDown className="h-4 w-4" /><span className="hidden sm:inline">View</span></>
                          }
                        </span>
                      </div>
                    </div>

                    {/* Mini summary */}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs" style={{ color: DS.labelText }}>
                      <span className="inline-flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" style={{ color: DS.dimText }} />
                        {typeof pct === "number" ? `${pct}% avg` : "No avg yet"}
                      </span>
                      <span style={{ color: DS.border }}>·</span>
                      <span style={{ color: DS.dimText }}>
                        Calories {caloriesPct ?? "—"}% · Protein {proteinPct ?? "—"}% · Hydration {hydrationPct ?? "—"}%
                      </span>
                    </div>
                  </button>

                  {/* Expanded panel */}
                  {isOpen && (
                    <div className="px-4 pb-4" style={{ borderTop: `1px solid ${DS.border}` }}>
                      <div className="grid gap-2 sm:grid-cols-4 mt-3">
                        <Metric label="Calories"  value={caloriesPct}  />
                        <Metric label="Protein"   value={proteinPct}   />
                        <Metric label="Carbs"     value={carbsPct}     />
                        <Metric label="Hydration" value={hydrationPct} />
                      </div>
                      <div className="mt-3">
                        {c.notes ? (
                          <div
                            className="p-3"
                            style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.pageBg }}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words" style={{ color: DS.bodyText }}>
                              {String(c.notes)}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs" style={{ color: DS.dimText }}>No notes provided.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 h-px w-full" style={{ backgroundColor: DS.border }} />
      </div>
    </section>
  );
}