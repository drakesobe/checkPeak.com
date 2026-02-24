"use client";

import { useMemo } from "react";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  ListChecks,
  ArrowDownWideNarrow,
  Expand,
} from "lucide-react";
import { avgAdherence, badgeForAdherence, fmtDateTime, safeArr, cx } from "./utils";
import { Metric, EmptyState, StatusPill } from "./ui";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function weekLabel(weekStartISO) {
  const iso = String(weekStartISO || "").trim();
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  try {
    const nice = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "2-digit",
      year: "numeric",
    }).format(d);
    return `Week of ${nice}`;
  } catch {
    return `Week of ${iso}`;
  }
}

function toneFromPct(pct) {
  if (pct == null) return "neutral";
  if (pct >= 75) return "good";
  if (pct >= 60) return "warn";
  return "bad";
}

function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* -------------------------------------------------------------------------- */
/* UI atoms                                                                    */
/* -------------------------------------------------------------------------- */

function IconBadge({ children }) {
  return (
    <span className="hidden sm:inline-flex h-9 w-9 rounded-2xl border border-gray-200 bg-gray-50 items-center justify-center shrink-0">
      {children}
    </span>
  );
}

function ActionButton({ onClick, children, icon: Icon, title }) {
  return (
    <button
      onClick={onClick}
      type="button"
      title={title}
      className={cx(
        "inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2",
        "text-sm font-semibold text-gray-900 hover:bg-gray-50 transition",
        "focus:outline-none focus:ring-2 focus:ring-gray-200"
      )}
    >
      {Icon ? <Icon className="h-4 w-4 text-gray-700" /> : null}
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export function CheckinsCard({ checkins, openIds, onToggle, onExpandAll, onLatestOnly }) {
  const list = useMemo(() => safeArr(checkins), [checkins]);
  const total = list.length;

  const overall = useMemo(() => {
    if (!total) return null;

    const pcts = list
      .map((c) => avgAdherence(c))
      .filter((v) => typeof v === "number" && !Number.isNaN(v));

    if (!pcts.length) return null;

    const avg = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);

    // Optional: show a quick “spread” to help coaches see consistency variability
    const min = Math.round(Math.min(...pcts));
    const max = Math.round(Math.max(...pcts));

    return { avg, min, max };
  }, [list, total]);

  return (
    <section
      className={cx(
        "rounded-3xl border border-blue-100/70 bg-white/80 backdrop-blur-xl",
        "shadow-[0_10px_30px_-18px_rgba(30,58,138,0.35)]"
      )}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <IconBadge>
                <ListChecks className="h-4 w-4 text-gray-700" />
              </IconBadge>

              <div className="min-w-0">
                <h2 className="text-lg font-extrabold text-gray-900">Completions</h2>

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="text-sm text-gray-600">{total} total</p>

                  {overall?.avg != null ? (
                    <>
                      <StatusPill tone={toneFromPct(overall.avg)} text={`Overall avg ${overall.avg}%`} />
                      <span className="text-[11px] text-gray-500 hidden sm:inline">
                        Range {overall.min}%–{overall.max}%
                      </span>
                    </>
                  ) : (
                    <span className="text-[11px] text-gray-500">No adherence data yet</span>
                  )}
                </div>
              </div>
            </div>

            <p className="mt-2 text-[11px] text-gray-500">
              Each item below is derived from daily swipes. Open a row to see macro + hydration completion.
            </p>
          </div>

          {/* Controls */}
          {total > 0 ? (
            <div className="flex flex-wrap gap-2">
              <ActionButton onClick={onLatestOnly} icon={ArrowDownWideNarrow} title="Open the newest only">
                Latest only
              </ActionButton>
              <ActionButton onClick={onExpandAll} icon={Expand} title="Open all rows">
                Expand all
              </ActionButton>
            </div>
          ) : null}
        </div>

        {/* Empty */}
        {total === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No completions yet"
              body="Once the athlete starts swiping meals + hydration, you’ll see trends and notes here."
            />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {list.map((c, idx) => {
              const pct = avgAdherence(c);
              const badge = badgeForAdherence(pct);

              // open behavior: allow parent-controlled openIds; otherwise keep latest open by default
              const isOpen = Boolean(openIds?.[c.id]) || (!openIds && idx === 0);

              const headerId = `checkin-${c.id}-header`;
              const panelId = `checkin-${c.id}-panel`;

              const caloriesPct = numOrNull(c.caloriesPct);
              const proteinPct = numOrNull(c.proteinPct);
              const carbsPct = numOrNull(c.carbsPct);
              const hydrationPct = numOrNull(c.hydrationPct);

              const submittedLine = c.createdAt
                ? `Updated ${fmtDateTime(c.createdAt)} ET`
                : "Update time unavailable";

              return (
                <div
                  key={c.id}
                  className={cx(
                    "rounded-2xl border overflow-hidden bg-white",
                    isOpen ? "border-gray-200" : "border-gray-200"
                  )}
                >
                  {/* Row header */}
                  <button
                    id={headerId}
                    type="button"
                    onClick={() => onToggle?.(c.id)}
                    className={cx(
                      "w-full text-left p-4",
                      "transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#46769B]/25"
                    )}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <p className="text-sm font-extrabold text-gray-900 truncate">
                            {weekLabel(c.weekStartISO)}
                          </p>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1">{submittedLine}</p>
                      </div>

                      <div className="flex items-center gap-2 sm:justify-end">
                        <span className={cx("px-2 py-1 rounded-lg text-xs font-semibold border", badge.cls)}>
                          {badge.t}
                          {typeof pct === "number" ? ` • ${pct}%` : ""}
                        </span>

                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                          {isOpen ? (
                            <>
                              <ChevronUp className="h-4 w-4" />
                              <span className="hidden sm:inline">Hide</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4" />
                              <span className="hidden sm:inline">View</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Mini summary line (helps scanning without opening) */}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <TrendingUp className="h-3.5 w-3.5 text-gray-500" />
                        {typeof pct === "number" ? `${pct}% avg` : "No avg yet"}
                      </span>
                      <span className="text-gray-300">•</span>
                      <span className="text-gray-500">
                        Calories {caloriesPct ?? "—"}% · Protein {proteinPct ?? "—"}% · Hydration {hydrationPct ?? "—"}%
                      </span>
                    </div>
                  </button>

                  {/* Panel */}
                  {isOpen ? (
                    <div id={panelId} role="region" aria-labelledby={headerId} className="px-4 pb-4">
                      <div className="grid gap-3 sm:grid-cols-4">
                        <Metric label="Calories" value={caloriesPct} />
                        <Metric label="Protein" value={proteinPct} />
                        {/* Carbs is optional, show when present; otherwise still show a placeholder */}
                        <Metric label="Carbs" value={carbsPct} />
                        <Metric label="Hydration" value={hydrationPct} />
                      </div>

                      <div className="mt-3">
                        {c.notes ? (
                          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                            <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                              {String(c.notes)}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No notes provided.</p>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5 h-px w-full bg-gradient-to-r from-transparent via-blue-100 to-transparent" />
      </div>
    </section>
  );
}