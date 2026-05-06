// components/org/nutrition/nutritionTable/MobileCards.jsx
"use client";

import { useState } from "react";
import { Mail, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";

import {
  cx,
  badgeForRow,
  clampPct,
  clampText,
  fmtDate,
  fmtDateTime,
  getRowKey,
  hasAthleteToken,
  mailtoForAthlete,
  pctText,
} from "./helpers";

import { MacroPill, MiniChip, ProgressBar } from "./ui";

export default function MobileCards({ rows, loading, onOpen }) {
  const [openId, setOpenId] = useState(null);

  return (
    <div className="md:hidden p-4 space-y-3">
      {rows.map((r, idx) => {
        const badge = badgeForRow(r);
        const hasToken = hasAthleteToken(r);
        const plan = r.plan || null;
        const comp = r.completion || null;

        const avg = clampPct(r.adherenceAvg);
        const cal = clampPct(comp?.caloriesPct);
        const pro = clampPct(comp?.proteinPct);
        const carb = clampPct(comp?.carbsPct);
        const hyd = clampPct(comp?.hydrationPct);

        const key = getRowKey(r, idx);
        const isOpen = openId === key;

        const emailHref = mailtoForAthlete({ email: r.athleteEmail, name: r.athleteName });

        return (
          <div key={key} className="rounded-3xl border border-gray-200 bg-white/80 backdrop-blur p-4 shadow-sm">
            {/* Top */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">{r.athleteName || "Athlete"}</p>
                <p className="text-xs text-gray-500 truncate">{r.athleteEmail || "-"}</p>

                {(r.team || r.sport) ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.team ? <MiniChip tone="blue">{r.team}</MiniChip> : null}
                    {r.sport ? <MiniChip>{r.sport}</MiniChip> : null}
                  </div>
                ) : null}
              </div>

              <span className={cx("shrink-0 inline-flex px-2 py-1 rounded-lg border text-xs font-semibold", badge.cls)}>
                {badge.text}
              </span>
            </div>

            {/* Compact metrics */}
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                <p className="text-gray-500">Adherence</p>
                <p className="mt-1 text-gray-900 font-extrabold tabular-nums">{avg == null ? "-" : `${avg}%`}</p>
                <div className="mt-2">
                  <ProgressBar value={avg} />
                </div>
                {r.rollup?.streakDays != null ? (
                  <p className="mt-2 text-[11px] text-gray-500">
                    Streak: <span className="font-semibold text-gray-700">{r.rollup.streakDays}d</span>
                  </p>
                ) : null}
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                <p className="text-gray-500">Latest completion</p>
                <p className="mt-1 text-gray-900 font-semibold">{comp?.updatedAt ? fmtDateTime(comp.updatedAt) : "-"}</p>
                <p className="mt-1 text-[11px] text-gray-500">{comp?.dateISO ? `Date: ${fmtDate(comp.dateISO)}` : ""}</p>
                <p className="mt-1 text-[11px] text-gray-500">
                  {comp?.weekStartISO
                    ? `Week: ${comp.weekStartISO}`
                    : r.rollup?.missedThisWeek
                    ? "Missing this week"
                    : ""}
                </p>
              </div>
            </div>

            {/* Toggle details */}
            <button
              type="button"
              onClick={() => setOpenId((prev) => (prev === key ? null : key))}
              className="mt-3 w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50 inline-flex items-center justify-center gap-2"
            >
              {isOpen ? (
                <>
                  <ChevronUp className="h-4 w-4" /> Hide details
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" /> Show details
                </>
              )}
            </button>

            {isOpen ? (
              <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                {/* Plan */}
                <div>
                  <p className="text-xs font-semibold text-gray-700">Plan</p>
                  {plan ? (
                    <div className="mt-2 space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {plan.phase ? <MiniChip tone="emerald">{plan.phase}</MiniChip> : null}
                        {plan.effectiveDate ? <MiniChip tone="amber">Effective: {plan.effectiveDate}</MiniChip> : null}
                      </div>

                      {plan.daily ? (
                        <div className="flex flex-wrap gap-2">
                          <MacroPill label="Cals" value={plan.daily.calories} />
                          <MacroPill label="P" value={plan.daily.protein} />
                          <MacroPill label="C" value={plan.daily.carbs} />
                          <MacroPill label="F" value={plan.daily.fat} />
                          <MacroPill label="Hyd" value={plan.daily.hydrationOz} />
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No daily targets.</p>
                      )}

                      {plan.createdAt ? (
                        <p className="text-[11px] text-gray-500">
                          Updated <span className="font-semibold text-gray-700">{fmtDateTime(plan.createdAt)}</span>
                          {plan.createdBy ? (
                            <>
                              <span className="text-gray-300"> • </span>
                              <span>
                                by <span className="font-semibold text-gray-700">{plan.createdBy}</span>
                              </span>
                            </>
                          ) : null}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-gray-500">No plan details.</p>
                  )}
                </div>

                {/* Completion breakdown */}
                <div>
                  <p className="text-xs font-semibold text-gray-700">Completion breakdown</p>
                  {comp ? (
                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                      <div className="rounded-xl border border-gray-200 bg-white p-3">
                        <p className="text-gray-500">Calories</p>
                        <p className="font-extrabold text-gray-900 mt-1">{pctText(cal)}</p>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-white p-3">
                        <p className="text-gray-500">Protein</p>
                        <p className="font-extrabold text-gray-900 mt-1">{pctText(pro)}</p>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-white p-3">
                        <p className="text-gray-500">Carbs</p>
                        <p className="font-extrabold text-gray-900 mt-1">{pctText(carb)}</p>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-white p-3">
                        <p className="text-gray-500">Hydration</p>
                        <p className="font-extrabold text-gray-900 mt-1">{pctText(hyd)}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-gray-500">No completion found.</p>
                  )}
                </div>

                {/* Notes */}
                {comp?.notes ? (
                  <div>
                    <p className="text-xs font-semibold text-gray-700">Notes</p>
                    <p className="mt-2 text-sm text-gray-800">{clampText(comp.notes, 260)}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Missing token warning */}
            {!hasToken ? (
              <div className="mt-3 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                Missing athleteToken (cannot open this athlete)
              </div>
            ) : null}

            {/* Actions */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a
                href={r.athleteEmail ? emailHref : "#"}
                onClick={(e) => {
                  if (!r.athleteEmail) e.preventDefault();
                }}
                className={cx(
                  "w-full px-4 py-3 rounded-2xl text-sm font-semibold transition inline-flex items-center justify-center gap-2",
                  r.athleteEmail
                    ? "border border-gray-200 bg-white hover:bg-gray-50"
                    : "bg-gray-200 text-gray-500 cursor-not-allowed"
                )}
              >
                <Mail className="h-4 w-4" />
                Email
              </a>

              <button
                type="button"
                onClick={() => onOpen(r)}
                disabled={!hasToken}
                className={cx(
                  "w-full px-4 py-3 rounded-2xl text-sm font-semibold transition inline-flex items-center justify-center gap-2",
                  hasToken ? "bg-[#46769B] text-white hover:brightness-110" : "bg-gray-200 text-gray-500 cursor-not-allowed"
                )}
              >
                Open <ExternalLink className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}

      {!loading && rows.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm">
          <p className="font-semibold text-gray-900">No athletes match this view</p>
          <p className="text-gray-600 mt-1">Try “All” or clear the search.</p>
        </div>
      ) : null}
    </div>
  );
}