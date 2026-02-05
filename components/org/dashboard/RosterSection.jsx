// /components/org/dashboard/RosterSection.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Filter,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Mail,
  Pencil,
  ArrowRight,
} from "lucide-react";

import {
  normalizeEmail,
  safeDate,
  fmtDate,
  classNames,
} from "@/lib/org/dashboard-utils";

import { Button, Pill, TagChip, PlanChip } from "@/components/org/dashboard/DashboardUI";

function AthleteCard({
  athlete,
  templates,
  isExpanded,
  onToggle,
  onEdit,
  onHistory,
  onBuild,
}) {
  const email = normalizeEmail(athlete?.email);
  const status = String(athlete?.status || "Active");
  const tags = Array.isArray(athlete?.tags) ? athlete.tags : [];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={() => onToggle(email)}
        className="w-full text-left"
        title="Expand"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
              )}
              <p className="font-extrabold text-gray-900 truncate">
                {athlete?.name || "Athlete"}
              </p>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <PlanChip needsPlan={!!athlete?.needsPlan} stale={!!athlete?.stale} />
              <Pill>{status}</Pill>
              <Pill>{athlete?.plansCount || 0} plans</Pill>
            </div>

            <p className="mt-2 text-[12px] text-gray-700 break-all">{email || "—"}</p>
            {email ? (
              <a
                href={`mailto:${email}`}
                className="inline-flex items-center gap-1 text-[11px] text-[#46769B] font-semibold hover:underline mt-1"
              >
                <Mail className="w-3.5 h-3.5" />
                Email
              </a>
            ) : null}

            <div className="mt-3">
              <p className="text-[11px] text-gray-500">Last plan</p>
              <p className="text-[12px] text-gray-800 font-semibold">
                {athlete?.lastPlanAt ? fmtDate(athlete.lastPlanAt) : "—"}
              </p>
              {athlete?.lastPlanTitle ? (
                <p className="text-[11px] text-gray-500 mt-0.5 break-words">
                  {athlete.lastPlanTitle}
                </p>
              ) : (
                <p className="text-[11px] text-gray-400 mt-0.5">No plans yet</p>
              )}
            </div>
          </div>
        </div>
      </button>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Button
          variant="secondary"
          className="px-3 py-2 text-xs w-full"
          onClick={() => onEdit(athlete)}
          disabled={!email}
        >
          <Pencil className="w-4 h-4" />
          Edit
        </Button>

        <Button
          variant="secondary"
          className="px-3 py-2 text-xs w-full"
          onClick={() => onHistory(email)}
          disabled={!email}
        >
          History
        </Button>

        <Button
          className="px-3 py-2 text-xs w-full"
          onClick={() => onBuild(email)}
          disabled={!email}
        >
          Build
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      {isExpanded ? (
        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Plan status</p>
              <p className="text-sm font-extrabold text-gray-900 mt-1">
                {athlete?.needsPlan
                  ? "Needs first plan"
                  : athlete?.stale
                  ? "Needs update"
                  : "Current"}
              </p>
              <p className="text-[11px] text-gray-500 mt-2">
                Handle needs-plan first, then stale.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Quick templates</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {templates.slice(0, 3).map((t) => (
                  <Button
                    key={t.id}
                    variant="secondary"
                    className="px-3 py-2 text-xs"
                    onClick={() => onBuild(email, t.id)}
                  >
                    {t.name}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                ))}
              </div>
              <p className="text-[11px] text-gray-500 mt-3">
                Opens builder pre-filled.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Tags</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.length ? (
                  tags.map((t) => <TagChip key={t} text={t} />)
                ) : (
                  <span className="text-[11px] text-gray-400">—</span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function RosterSection({
  athletes = [],
  templates = [],
  expanded = {},
  setExpanded,
  search,
  setSearch,
  filterMode,
  setFilterMode,
  sortMode,
  setSortMode,
  onEdit,
  onHistory,
  onBuild,
  pageSize = 25, // <- change default here
}) {
  const [page, setPage] = useState(1);

  const toggleExpanded = (email) => {
    const e = normalizeEmail(email);
    if (!e) return;
    setExpanded((prev) => ({ ...prev, [e]: !prev[e] }));
  };

  // Reset to page 1 whenever controls change (search/filter/sort)
  useEffect(() => {
    setPage(1);
  }, [search, filterMode, sortMode]);

  const counts = useMemo(() => {
    const list = Array.isArray(athletes) ? athletes : [];
    const needsPlan = list.filter((a) => !!a?.needsPlan).length;
    const stale = list.filter((a) => !!a?.stale && !a?.needsPlan).length;
    const current = list.filter((a) => !a?.stale && !a?.needsPlan).length;
    return { needsPlan, stale, current, total: list.length };
  }, [athletes]);

  const filteredAthletes = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    let list = Array.isArray(athletes) ? [...athletes] : [];

    if (q) {
      list = list.filter((a) => {
        const name = String(a?.name || "").toLowerCase();
        const email = String(a?.email || "").toLowerCase();
        return name.includes(q) || email.includes(q);
      });
    }

    if (filterMode === "needsPlan") list = list.filter((a) => !!a?.needsPlan);
    if (filterMode === "stale") list = list.filter((a) => !!a?.stale && !a?.needsPlan);
    if (filterMode === "current") list = list.filter((a) => !a?.stale && !a?.needsPlan);

    const byLastPlanDesc = (a, b) => {
      const ad = safeDate(a?.lastPlanAt)?.getTime?.() || 0;
      const bd = safeDate(b?.lastPlanAt)?.getTime?.() || 0;
      return bd - ad;
    };

    const byNameAsc = (a, b) => {
      const an = String(a?.name || "").toLowerCase();
      const bn = String(b?.name || "").toLowerCase();
      return an.localeCompare(bn);
    };

    const byPriority = (a, b) => {
      const ap = a?.needsPlan ? 1 : 0;
      const bp = b?.needsPlan ? 1 : 0;
      if (bp !== ap) return bp - ap;

      const as = a?.stale ? 1 : 0;
      const bs = b?.stale ? 1 : 0;
      if (bs !== as) return bs - as;

      return byLastPlanDesc(a, b);
    };

    if (sortMode === "name") list.sort(byNameAsc);
    else if (sortMode === "lastPlan") list.sort(byLastPlanDesc);
    else list.sort(byPriority);

    return list;
  }, [athletes, search, filterMode, sortMode]);

  const totalPages = useMemo(() => {
    const n = filteredAthletes.length;
    return Math.max(1, Math.ceil(n / pageSize));
  }, [filteredAthletes.length, pageSize]);

  // Keep page in bounds if list shrinks
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAthletes.slice(start, start + pageSize);
  }, [filteredAthletes, page, pageSize]);

  const canPrev = page > 1;
  const canNext = page < totalPages;

  const inputBase =
    "w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]";

  return (
    <section className="bg-white rounded-2xl shadow-md border border-blue-100 p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold">Roster</h2>
          <p className="text-sm text-gray-600 mt-1">
            Status + tags make filtering & coaching workflow real.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Pill tone="bad">Needs plan: {counts.needsPlan}</Pill>
            <Pill tone="warn">Needs update: {counts.stale}</Pill>
            <Pill tone="good">Current: {counts.current}</Pill>
          </div>
        </div>

        <div className="w-full sm:w-[460px] space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className={classNames(inputBase, "pl-10")}
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={filterMode === "all" ? "primary" : "secondary"}
              className="px-3 py-2 text-xs"
              onClick={() => setFilterMode("all")}
            >
              <Filter className="w-4 h-4" />
              All
            </Button>
            <Button
              variant={filterMode === "needsPlan" ? "primary" : "secondary"}
              className="px-3 py-2 text-xs"
              onClick={() => setFilterMode("needsPlan")}
            >
              Needs Plan
            </Button>
            <Button
              variant={filterMode === "stale" ? "primary" : "secondary"}
              className="px-3 py-2 text-xs"
              onClick={() => setFilterMode("stale")}
            >
              Needs Update
            </Button>
            <Button
              variant={filterMode === "current" ? "primary" : "secondary"}
              className="px-3 py-2 text-xs"
              onClick={() => setFilterMode("current")}
            >
              Current
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={sortMode === "priority" ? "primary" : "secondary"}
              className="px-3 py-2 text-xs"
              onClick={() => setSortMode("priority")}
            >
              Priority
            </Button>
            <Button
              variant={sortMode === "lastPlan" ? "primary" : "secondary"}
              className="px-3 py-2 text-xs"
              onClick={() => setSortMode("lastPlan")}
            >
              Last Plan
            </Button>
            <Button
              variant={sortMode === "name" ? "primary" : "secondary"}
              className="px-3 py-2 text-xs"
              onClick={() => setSortMode("name")}
            >
              Name
            </Button>
          </div>
        </div>
      </div>

      {/* Pager */}
      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Pill>
            {filteredAthletes.length} athlete{filteredAthletes.length === 1 ? "" : "s"}
          </Pill>
          <Pill>
            Page {page} / {totalPages}
          </Pill>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="px-3 py-2 text-xs"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!canPrev}
            title="Previous"
          >
            <ChevronLeft className="w-4 h-4" />
            Prev
          </Button>

          <Button
            variant="secondary"
            className="px-3 py-2 text-xs"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={!canNext}
            title="Next"
          >
            Next
            <ChevronRightIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* MOBILE */}
      <div className="mt-5 space-y-3 lg:hidden">
        {pageItems.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-center text-gray-500">
            No athletes found.
          </div>
        ) : (
          pageItems.map((a) => {
            const email = normalizeEmail(a?.email);
            const isExpanded = !!expanded[email];
            return (
              <AthleteCard
                key={a.id || email}
                athlete={a}
                templates={templates}
                isExpanded={isExpanded}
                onToggle={toggleExpanded}
                onEdit={onEdit}
                onHistory={onHistory}
                onBuild={onBuild}
              />
            );
          })
        )}
      </div>

      {/* DESKTOP */}
      <div className="mt-5 hidden lg:block overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="py-3 pr-4">Athlete</th>
              <th className="py-3 pr-4">Email</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3 pr-4">Tags</th>
              <th className="py-3 pr-4">Plans</th>
              <th className="py-3 pr-4">Last Plan</th>
              <th className="py-3 pr-2 text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-gray-500">
                  No athletes found.
                </td>
              </tr>
            )}

            {pageItems.map((a) => {
              const email = normalizeEmail(a?.email);
              const isExpanded = !!expanded[email];
              const status = String(a?.status || "Active");
              const tags = Array.isArray(a?.tags) ? a.tags : [];

              return (
                <tr key={a.id || email} className="border-b">
                  <td className="py-3 pr-4">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(email)}
                      className="text-left w-full"
                      title="Expand"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 truncate">
                            {a?.name || "Athlete"}
                          </div>
                          <div className="mt-1">
                            <PlanChip needsPlan={!!a?.needsPlan} stale={!!a?.stale} />
                          </div>
                        </div>
                      </div>
                    </button>
                  </td>

                  <td className="py-3 pr-4">
                    <div className="text-gray-700 font-medium break-all">{email}</div>
                    {email ? (
                      <a
                        href={`mailto:${email}`}
                        className="inline-flex items-center gap-1 text-[11px] text-[#46769B] font-semibold hover:underline mt-1"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        Email
                      </a>
                    ) : null}
                  </td>

                  <td className="py-3 pr-4">
                    <Pill>{status}</Pill>
                  </td>

                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-2">
                      {tags.length ? (
                        tags.slice(0, 3).map((t) => <TagChip key={t} text={t} />)
                      ) : (
                        <span className="text-[11px] text-gray-400">—</span>
                      )}
                    </div>
                  </td>

                  <td className="py-3 pr-4">
                    <Pill>{a?.plansCount || 0}</Pill>
                  </td>

                  <td className="py-3 pr-4">
                    <div className="text-gray-700 font-medium">
                      {a?.lastPlanAt ? fmtDate(a.lastPlanAt) : "—"}
                    </div>
                    {a?.lastPlanTitle ? (
                      <div className="text-[11px] text-gray-500 mt-0.5 truncate max-w-[240px]">
                        {a.lastPlanTitle}
                      </div>
                    ) : (
                      <div className="text-[11px] text-gray-400 mt-0.5">No plans yet</div>
                    )}
                  </td>

                  <td className="py-3 pr-2">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        className="px-3 py-2 text-xs"
                        onClick={() => onEdit(a)}
                        disabled={!email}
                      >
                        <Pencil className="w-4 h-4" />
                        Edit
                      </Button>

                      <Button
                        variant="secondary"
                        className="px-3 py-2 text-xs"
                        onClick={() => onHistory(email)}
                        disabled={!email}
                      >
                        History
                      </Button>

                      <Button
                        className="px-3 py-2 text-xs"
                        onClick={() => onBuild(email)}
                        disabled={!email}
                      >
                        Build
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
