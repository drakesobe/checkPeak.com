"use client";

import { useMemo } from "react";
import { avgAdherence, badgeForAdherence, fmtDateTime, safeArr, cx } from "./utils";
import { Metric, EmptyState, StatusPill } from "./ui";

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

export function CheckinsCard({ checkins, openIds, onToggle, onExpandAll, onLatestOnly }) {
  const list = useMemo(() => safeArr(checkins), [checkins]);
  const total = list.length;

  // overall summary (nice to show at top)
  const overall = useMemo(() => {
    if (!total) return null;
    const pcts = list.map((c) => avgAdherence(c)).filter((v) => typeof v === "number" && !Number.isNaN(v));
    if (!pcts.length) return null;
    const avg = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
    return { avg };
  }, [list, total]);

  return (
    <section className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold text-gray-900">Nutrition Check-ins</h2>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-sm text-gray-600">{total} total</p>

            {overall?.avg != null ? (
              <StatusPill tone={toneFromPct(overall.avg)} text={`Overall avg ${overall.avg}%`} />
            ) : null}
          </div>
        </div>

        {total > 0 ? (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onExpandAll}
              className={cx(
                "px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold",
                "hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200"
              )}
              type="button"
            >
              Expand all
            </button>
            <button
              onClick={onLatestOnly}
              className={cx(
                "px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold",
                "hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200"
              )}
              type="button"
            >
              Latest only
            </button>
          </div>
        ) : null}
      </div>

      {total === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No check-ins yet"
            body="Once the athlete submits weekly check-ins, you’ll see adherence trends, macros, and notes here."
          />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {list.map((c, idx) => {
            const pct = avgAdherence(c);
            const badge = badgeForAdherence(pct);

            // open behavior: default open latest (idx 0) if openIds isn't set
            const isOpen = Boolean(openIds?.[c.id]) || (!openIds && idx === 0);

            const headerId = `checkin-${c.id}-header`;
            const panelId = `checkin-${c.id}-panel`;

            return (
              <div
                key={c.id}
                className={cx(
                  "rounded-2xl border bg-white overflow-hidden",
                  isOpen ? "border-gray-200" : "border-gray-200"
                )}
              >
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
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {weekLabel(c.weekStartISO)}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        {c.createdAt ? `Submitted ${fmtDateTime(c.createdAt)} ET` : "Submission time unavailable"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={cx("px-2 py-1 rounded-lg text-xs font-semibold border", badge.cls)}>
                        {badge.t}
                        {typeof pct === "number" ? ` • ${pct}%` : ""}
                      </span>

                      <span className="text-xs text-gray-400" aria-hidden="true">
                        {isOpen ? "▲" : "▼"}
                      </span>
                    </div>
                  </div>
                </button>

                {isOpen ? (
                  <div id={panelId} role="region" aria-labelledby={headerId} className="px-4 pb-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Metric label="Calories" value={c.caloriesPct} />
                      <Metric label="Protein" value={c.proteinPct} />
                      <Metric label="Hydration" value={c.hydrationPct} />
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
    </section>
  );
}
