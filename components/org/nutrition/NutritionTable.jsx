// components/org/nutrition/NutritionTable.jsx
"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { Mail, ExternalLink, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react";

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
} from "./nutritionTable/helpers";

import { normalizeRow, sortRowsDefault } from "./nutritionTable/normalize";
import { MacroPill, MiniChip, ProgressBar } from "./nutritionTable/ui";
import MobileCards from "./nutritionTable/MobileCards";

/* ---------------- local helpers ---------------- */

function toneForPctLocal(pct) {
  const p = clampPct(pct);
  if (p == null) return "neutral";
  if (p >= 80) return "good";
  if (p >= 65) return "warn";
  return "bad";
}

function pctTextClass(pct) {
  const t = toneForPctLocal(pct);
  if (t === "good") return "text-emerald-700";
  if (t === "warn") return "text-amber-700";
  if (t === "bad") return "text-red-700";
  return "text-gray-900";
}

function hasPlanShape(plan) {
  return Boolean(plan && (plan?.daily || plan?.phase || plan?.createdAt));
}

function hasCompletionShape(comp) {
  return Boolean(comp && (comp?.totalPct != null || comp?.mealPct != null || comp?.hydrationPct != null));
}

function CompactKV({ label, value }) {
  return (
    <div className="text-[11px] leading-5 text-gray-500">
      {label}: <span className="font-semibold text-gray-700">{value || "—"}</span>
    </div>
  );
}

function DetailCard({ title, children }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
      <p className="text-xs font-semibold text-gray-700">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Pagination({ page, totalPages, totalItems, pageSize, onPrev, onNext, onPage }) {
  if (totalItems <= pageSize) return null;

  const start = totalItems === 0 ? 0 : page * pageSize + 1;
  const end = Math.min(totalItems, (page + 1) * pageSize);

  // Keep page buttons compact: show up to 5 pages around current
  const maxBtns = 5;
  const half = Math.floor(maxBtns / 2);
  const from = Math.max(0, Math.min(totalPages - maxBtns, page - half));
  const to = Math.min(totalPages, from + maxBtns);
  const pages = Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i);

  return (
    <div className="px-6 py-4 border-t border-gray-100 bg-white/70">
      <div className="flex items-center justify-between gap-4">
        <div className="text-xs text-gray-500">
          Showing <span className="font-semibold text-gray-700 tabular-nums">{start}</span>–
          <span className="font-semibold text-gray-700 tabular-nums">{end}</span> of{" "}
          <span className="font-semibold text-gray-700 tabular-nums">{totalItems}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            disabled={page <= 0}
            className={cx(
              "inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold",
              page <= 0 ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" : "bg-white hover:bg-gray-50 border-gray-200 text-gray-800"
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </button>

          <div className="hidden sm:flex items-center gap-1">
            {from > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => onPage(0)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-white hover:bg-gray-50"
                >
                  1
                </button>
                <span className="px-1 text-gray-400">…</span>
              </>
            ) : null}

            {pages.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPage(p)}
                className={cx(
                  "px-3 py-2 rounded-xl text-xs font-semibold border",
                  p === page
                    ? "border-blue-200 bg-blue-50 text-blue-900"
                    : "border-gray-200 bg-white hover:bg-gray-50 text-gray-800"
                )}
              >
                {p + 1}
              </button>
            ))}

            {to < totalPages ? (
              <>
                <span className="px-1 text-gray-400">…</span>
                <button
                  type="button"
                  onClick={() => onPage(totalPages - 1)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-white hover:bg-gray-50"
                >
                  {totalPages}
                </button>
              </>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onNext}
            disabled={page >= totalPages - 1}
            className={cx(
              "inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold",
              page >= totalPages - 1
                ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                : "bg-white hover:bg-gray-50 border-gray-200 text-gray-800"
            )}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- component ---------------- */

export default function NutritionTable({ loading, rows, onOpenAthlete, sortMode = "default" }) {
  const PAGE_SIZE = 10;

  const list = Array.isArray(rows) ? rows : [];
  const [openId, setOpenId] = useState(null);
  const [page, setPage] = useState(0);

  const safeRows = useMemo(() => {
    const normalized = list.map(normalizeRow);
    return sortMode === "none" ? normalized : sortRowsDefault(normalized);
  }, [list, sortMode]);

  // Pagination derived values
  const totalItems = safeRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  // Clamp page when filters change list size
  useEffect(() => {
    if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages, totalItems]);

  const pageRows = useMemo(() => {
    const start = page * PAGE_SIZE;
    return safeRows.slice(start, start + PAGE_SIZE);
  }, [safeRows, page]);

  const handleOpen = useCallback(
    (r) => {
      if (typeof onOpenAthlete === "function") onOpenAthlete(r);
    },
    [onOpenAthlete]
  );

  const toggleRow = useCallback((key) => {
    setOpenId((prev) => (prev === key ? null : key));
  }, []);

  const headerStats = useMemo(() => {
    const total = safeRows.length;
    let withPlan = 0;
    let withCompletion = 0;

    for (const r of safeRows) {
      if (hasPlanShape(r?.plan)) withPlan += 1;
      if (hasCompletionShape(r?.completion)) withCompletion += 1;
    }
    return { total, withPlan, withCompletion };
  }, [safeRows]);

  const goPrev = useCallback(() => {
    setOpenId(null);
    setPage((p) => Math.max(0, p - 1));
  }, []);

  const goNext = useCallback(() => {
    setOpenId(null);
    setPage((p) => Math.min(totalPages - 1, p + 1));
  }, [totalPages]);

  const goPage = useCallback((p) => {
    setOpenId(null);
    setPage(Math.max(0, Math.min(totalPages - 1, p)));
  }, [totalPages]);

  return (
    <div className="bg-white/80 backdrop-blur rounded-3xl shadow-[0_10px_30px_-18px_rgba(30,58,138,0.35)] border border-blue-100/80 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {loading ? "Loading…" : `${safeRows.length} athlete(s)`}
          </p>
          <p className="text-[11px] leading-5 text-gray-500 mt-1.5">
            Compact roster view. Expand a row for plan targets + meal/hydration breakdown.
          </p>
        </div>

        <div className="hidden lg:flex items-center gap-3">
          <span className="inline-flex items-center px-3.5 py-2 rounded-2xl border border-gray-200 bg-white text-xs font-semibold text-gray-800">
            Plans{" "}
            <span className="ml-2 text-gray-500 font-extrabold tabular-nums">
              {headerStats.withPlan}/{headerStats.total}
            </span>
          </span>
          <span className="inline-flex items-center px-3.5 py-2 rounded-2xl border border-gray-200 bg-white text-xs font-semibold text-gray-800">
            Check-ins{" "}
            <span className="ml-2 text-gray-500 font-extrabold tabular-nums">
              {headerStats.withCompletion}/{headerStats.total}
            </span>
          </span>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
            <tr className="border-b border-gray-200">
              <th className="px-6 py-3.5 font-semibold">Athlete</th>
              <th className="px-6 py-3.5 font-semibold">Status</th>
              <th className="px-6 py-3.5 font-semibold">Latest</th>
              <th className="px-6 py-3.5 font-semibold">Adherence</th>
              <th className="px-6 py-3.5 font-semibold text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {pageRows.map((r, idx) => {
              const globalIdx = page * PAGE_SIZE + idx;
              const key = getRowKey(r, globalIdx);
              const isOpen = openId === key;

              const badge = badgeForRow(r);
              const hasToken = hasAthleteToken(r);
              const plan = r.plan || null;
              const comp = r.completion || null;

              const avg = clampPct(r.adherenceAvg ?? comp?.totalPct);
              const meal = clampPct(comp?.mealPct);
              const hyd = clampPct(comp?.hydrationPct);

              const emailHref = mailtoForAthlete({ email: r.athleteEmail, name: r.athleteName });

              return (
                <>
                  <tr
                    key={key}
                    className={cx(
                      "group transition",
                      globalIdx % 2 === 1 ? "bg-white" : "bg-gray-50/30",
                      hasToken ? "hover:bg-blue-50/40" : ""
                    )}
                  >
                    {/* Athlete */}
                    <td className="px-6 py-5 align-top">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 truncate">{r.athleteName || "Athlete"}</div>
                          <div className="text-xs leading-5 text-gray-500 truncate mt-0.5">{r.athleteEmail || "—"}</div>

                          {(r.team || r.sport || r.position || r.year) ? (
                            <div className="mt-2.5 flex flex-wrap gap-2">
                              {r.team ? <MiniChip tone="blue">{r.team}</MiniChip> : null}
                              {r.sport ? <MiniChip>{r.sport}</MiniChip> : null}
                              {r.position ? <MiniChip tone="amber">{r.position}</MiniChip> : null}
                              {r.year ? <MiniChip tone="emerald">{r.year}</MiniChip> : null}
                            </div>
                          ) : null}

                          {!hasToken ? (
                            <div className="mt-3 text-[11px] text-red-700 bg-red-50 border border-red-200 inline-flex rounded-lg px-2.5 py-1">
                              Missing athleteToken (cannot open)
                            </div>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          className={cx(
                            "shrink-0 inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition",
                            "border-gray-200 bg-white hover:bg-gray-50",
                            !hasToken ? "opacity-60 cursor-not-allowed" : ""
                          )}
                          onClick={() => {
                            if (!hasToken) return;
                            toggleRow(key);
                          }}
                          disabled={!hasToken}
                          title={isOpen ? "Hide details" : "Show details"}
                        >
                          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          Details
                        </button>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-5 align-top">
                      <div className="space-y-2.5">
                        <span className={cx("inline-flex px-2.5 py-1 rounded-lg border text-xs font-semibold", badge.cls)}>
                          {badge.text}
                        </span>
                        {plan?.phase ? <MiniChip tone="emerald">{plan.phase}</MiniChip> : null}
                      </div>
                    </td>

                    {/* Latest */}
                    <td className="px-6 py-5 align-top">
                      {comp ? (
                        <div className="space-y-1.5">
                          <CompactKV label="Date" value={comp.dateISO ? fmtDate(comp.dateISO) : "—"} />
                          <CompactKV label="Updated" value={comp.updatedAt ? fmtDateTime(comp.updatedAt) : "—"} />
                        </div>
                      ) : (
                        <div className="text-sm text-gray-400">—</div>
                      )}
                    </td>

                    {/* Adherence */}
                    <td className="px-6 py-5 align-top">
                      <div className="flex items-center justify-between gap-4">
                        <div className={cx("text-sm font-extrabold tabular-nums", pctTextClass(avg))}>
                          {avg == null ? "—" : `${avg}%`}
                        </div>
                        <div className="w-36">
                          <ProgressBar value={avg} />
                        </div>
                      </div>

                      {comp ? (
                        <div className="mt-2.5 text-[11px] leading-5 text-gray-500">
                          Meal <span className="font-semibold text-gray-700">{pctText(meal)}</span>
                          <span className="text-gray-300"> • </span>
                          Hydration <span className="font-semibold text-gray-700">{pctText(hyd)}</span>
                        </div>
                      ) : null}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-5 align-top text-right">
                      <div className="inline-flex items-center gap-2.5" onClick={(e) => e.stopPropagation()}>
                        {r.athleteEmail ? (
                          <a
                            href={emailHref}
                            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold border border-gray-200 bg-white hover:bg-gray-50"
                            title="Email athlete"
                          >
                            <Mail className="h-4 w-4" />
                            Email
                          </a>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => handleOpen(r)}
                          disabled={!hasToken}
                          className={cx(
                            "inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition",
                            hasToken
                              ? "bg-[#46769B] text-white hover:brightness-110 shadow-sm"
                              : "bg-gray-200 text-gray-500 cursor-not-allowed"
                          )}
                        >
                          Open <ExternalLink className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded details */}
                  {isOpen ? (
                    <tr className={globalIdx % 2 === 1 ? "bg-white" : "bg-gray-50/30"}>
                      <td className="px-6 pb-6 pt-0" colSpan={5}>
                        <div className="mt-4 grid grid-cols-12 gap-4">
                          {/* Plan */}
                          <div className="col-span-12 lg:col-span-7">
                            <DetailCard title="Plan targets">
                              {plan?.daily ? (
                                <>
                                  <div className="flex flex-wrap gap-2.5">
                                    <MacroPill label="Cals" value={plan.daily.calories} />
                                    <MacroPill label="P" value={plan.daily.protein} />
                                    <MacroPill label="C" value={plan.daily.carbs} />
                                    <MacroPill label="F" value={plan.daily.fat} />
                                    <MacroPill label="Hyd" value={plan.daily.hydrationOz} />
                                  </div>

                                  {plan?.createdAt ? (
                                    <div className="mt-3 text-[11px] leading-5 text-gray-500">
                                      Updated{" "}
                                      <span className="font-semibold text-gray-700">{fmtDateTime(plan.createdAt)}</span>
                                      {plan?.createdBy ? <span className="text-gray-300"> • </span> : null}
                                      {plan?.createdBy ? (
                                        <span>
                                          by <span className="font-semibold text-gray-700">{plan.createdBy}</span>
                                        </span>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </>
                              ) : (
                                <div className="text-sm text-gray-500">No plan found for this athlete.</div>
                              )}
                            </DetailCard>
                          </div>

                          {/* Completion */}
                          <div className="col-span-12 lg:col-span-5">
                            <DetailCard title="Latest completion">
                              {comp ? (
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3.5">
                                    <div className="text-[11px] leading-5 text-gray-500">Meal</div>
                                    <div className="mt-1 text-lg font-extrabold text-gray-900 tabular-nums">
                                      {pctText(meal)}
                                    </div>
                                  </div>
                                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3.5">
                                    <div className="text-[11px] leading-5 text-gray-500">Hydration</div>
                                    <div className="mt-1 text-lg font-extrabold text-gray-900 tabular-nums">
                                      {pctText(hyd)}
                                    </div>
                                  </div>

                                  <div className="col-span-2 mt-1 text-[11px] leading-5 text-gray-500">
                                    {comp.dateISO ? (
                                      <>
                                        Date: <span className="font-semibold text-gray-700">{fmtDate(comp.dateISO)}</span>
                                      </>
                                    ) : null}
                                    {comp.updatedAt ? (
                                      <>
                                        <span className="text-gray-300"> • </span>
                                        Updated:{" "}
                                        <span className="font-semibold text-gray-700">{fmtDateTime(comp.updatedAt)}</span>
                                      </>
                                    ) : null}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-sm text-gray-500">No completion found yet.</div>
                              )}
                            </DetailCard>
                          </div>

                          {/* Notes */}
                          <div className="col-span-12">
                            <DetailCard title="Notes">
                              {comp?.notes ? (
                                <div className="text-sm leading-6 text-gray-800">{clampText(comp.notes, 420)}</div>
                              ) : (
                                <div className="text-sm text-gray-500">No notes.</div>
                              )}
                            </DetailCard>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </>
              );
            })}

            {!loading && safeRows.length === 0 ? (
              <tr>
                <td className="px-6 py-12 text-gray-600" colSpan={5}>
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
                    <p className="text-sm font-semibold text-gray-900">No athletes match this filter</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Try switching filters, broadening search, or viewing “All”.
                    </p>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        {/* Pagination controls (desktop) */}
        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={PAGE_SIZE}
          onPrev={goPrev}
          onNext={goNext}
          onPage={goPage}
        />
      </div>

      {/* Mobile (also paged) */}
      <MobileCards rows={pageRows} loading={loading} onOpen={handleOpen} />

      {/* Pagination controls (mobile) */}
      <div className="md:hidden">
        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={PAGE_SIZE}
          onPrev={goPrev}
          onNext={goNext}
          onPage={goPage}
        />
      </div>
    </div>
  );
}