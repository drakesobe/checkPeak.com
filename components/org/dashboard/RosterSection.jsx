// components/org/dashboard/RosterSection.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search, Filter, ChevronRight, ChevronDown,
  ChevronLeft, Mail, Pencil, ArrowRight, Users, CheckCircle2,
} from "lucide-react";
import { normalizeEmail, safeDate, fmtDate } from "@/lib/org/dashboard-utils";
import { DS, Button, Pill, TagChip, PlanChip } from "@/components/org/dashboard/DashboardUI";

/* ── Mobile athlete card ─────────────────────────────────────────────────── */
function AthleteCard({ athlete, templates, isExpanded, onToggle, onEdit, onHistory, onBuild }) {
  const email     = normalizeEmail(athlete?.email);
  const status    = String(athlete?.status || "Active");
  const tags      = Array.isArray(athlete?.tags) ? athlete.tags : [];
  const needsPlan = !!athlete?.needsPlan;
  const accent    = needsPlan ? DS.banned : athlete?.stale ? DS.caution : DS.safe;

  return (
    <div style={{ border: `1px solid ${DS.border}`, borderLeft: `3px solid ${accent}`, backgroundColor: DS.cardBg }}>
      <button type="button" onClick={() => onToggle(email)} className="w-full text-left px-3 py-3">
        <div className="flex items-center gap-2">
          {isExpanded
            ? <ChevronDown  className="w-3.5 h-3.5 shrink-0" style={{ color: DS.dimText }} />
            : <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: DS.dimText }} />
          }
          <p className="text-sm font-black truncate flex-1" style={{ color: DS.bodyText }}>
            {athlete?.name || "Athlete"}
          </p>
          <PlanChip needsPlan={needsPlan} stale={!!athlete?.stale} />
        </div>
        <div className="mt-1.5 pl-5 flex flex-wrap gap-1.5">
          <Pill>{status}</Pill>
          <Pill>{athlete?.plansCount || 0} plans</Pill>
        </div>
        <p className="mt-1.5 pl-5 text-xs break-all" style={{ color: DS.labelText }}>{email || "—"}</p>
        {email && (
          <a href={`mailto:${email}`} className="pl-5 inline-flex items-center gap-1 text-xs font-bold mt-0.5 hover:underline" style={{ color: DS.brand }}>
            <Mail className="w-3 h-3" /> Email
          </a>
        )}
        <div className="mt-2 pl-5">
          <p className="text-xs" style={{ color: DS.dimText }}>Last plan: {athlete?.lastPlanAt ? fmtDate(athlete.lastPlanAt) : "—"}</p>
          {athlete?.lastPlanTitle && <p className="text-xs mt-0.5 break-words" style={{ color: DS.dimText }}>{athlete.lastPlanTitle}</p>}
        </div>
      </button>

      <div className="px-3 pb-3 grid grid-cols-3 gap-1.5" style={{ borderTop: `1px solid ${DS.border}`, paddingTop: "10px" }}>
        <Button variant="secondary" className="w-full" onClick={() => onEdit(athlete)} disabled={!email}>
          <Pencil className="w-3.5 h-3.5" /> Edit
        </Button>
        <Button variant="secondary" className="w-full" onClick={() => onHistory(email)} disabled={!email}>
          History
        </Button>
        <Button className="w-full" onClick={() => onBuild(email)} disabled={!email}>
          Build <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-3 gap-1.5" style={{ borderTop: `1px solid ${DS.border}`, paddingTop: "10px" }}>
          <div className="p-3" style={{ backgroundColor: DS.pageBg, border: `1px solid ${DS.border}` }}>
            <p className="text-xs" style={{ color: DS.dimText }}>Plan status</p>
            <p className="text-xs font-black mt-1" style={{ color: DS.bodyText }}>
              {needsPlan ? "Needs first plan" : athlete?.stale ? "Needs update" : "Current"}
            </p>
          </div>
          <div className="p-3" style={{ backgroundColor: DS.pageBg, border: `1px solid ${DS.border}` }}>
            <p className="text-xs mb-2" style={{ color: DS.dimText }}>Quick templates</p>
            <div className="flex flex-wrap gap-1">
              {(templates || []).slice(0, 3).map((t) => (
                <Button key={t.id} variant="secondary" onClick={() => onBuild(email, t.id)} disabled={!email}>
                  {t.name} <ArrowRight className="w-3 h-3" />
                </Button>
              ))}
              {!templates?.length && <span className="text-xs" style={{ color: DS.dimText }}>None yet</span>}
            </div>
          </div>
          <div className="p-3" style={{ backgroundColor: DS.pageBg, border: `1px solid ${DS.border}` }}>
            <p className="text-xs mb-2" style={{ color: DS.dimText }}>Tags</p>
            <div className="flex flex-wrap gap-1">
              {tags.length ? tags.map((t) => <TagChip key={t} text={t} />) : <span className="text-xs" style={{ color: DS.dimText }}>—</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────────────────────── */
function RosterEmptyState({ filterMode, search, counts }) {
  if (search) return (
    <div className="py-10 text-center">
      <p className="text-sm font-black" style={{ color: DS.bodyText }}>No results for "{search}"</p>
      <p className="text-xs mt-1" style={{ color: DS.dimText }}>Try a different name or email.</p>
    </div>
  );

  if (filterMode === "needsPlan") return (
    <div
      className="flex items-center gap-3 px-4 py-5"
      style={{ backgroundColor: DS.safeBg, border: `1px solid ${DS.safeBorder}`, borderLeft: `3px solid ${DS.safe}` }}
    >
      <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: DS.safe }} />
      <div>
        <p className="text-sm font-black" style={{ color: DS.safe }}>Every athlete has a plan.</p>
        <p className="text-xs mt-0.5" style={{ color: DS.safe, opacity: 0.8 }}>
          Nothing to assign right now — check back after the next training block.
        </p>
      </div>
    </div>
  );

  if (filterMode === "stale") return (
    <div
      className="flex items-center gap-3 px-4 py-5"
      style={{ backgroundColor: DS.safeBg, border: `1px solid ${DS.safeBorder}`, borderLeft: `3px solid ${DS.safe}` }}
    >
      <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: DS.safe }} />
      <div>
        <p className="text-sm font-black" style={{ color: DS.safe }}>All plans are current.</p>
        <p className="text-xs mt-0.5" style={{ color: DS.safe, opacity: 0.8 }}>No athletes are overdue for an update.</p>
      </div>
    </div>
  );

  if (filterMode === "current" && counts.current === 0) return (
    <div className="py-10 text-center">
      <p className="text-sm font-black" style={{ color: DS.dimText }}>No athletes are fully current yet.</p>
      <p className="text-xs mt-1" style={{ color: DS.dimText }}>Assign and update plans to move athletes here.</p>
    </div>
  );

  if (counts.total === 0) return (
    <div className="py-10 text-center">
      <p className="text-sm font-black" style={{ color: DS.dimText }}>No athletes loaded.</p>
      <p className="text-xs mt-1" style={{ color: DS.dimText }}>Use the Invite button to add athletes to your roster.</p>
    </div>
  );

  return (
    <div className="py-10 text-center">
      <p className="text-xs" style={{ color: DS.dimText }}>No athletes match.</p>
    </div>
  );
}

/* ── Main ────────────────────────────────────────────────────────────────── */
export default function RosterSection({
  athletes = [], templates = [], expanded = {}, setExpanded,
  search, setSearch, filterMode, setFilterMode,
  sortMode, setSortMode, onEdit, onHistory, onBuild, pageSize = 25,
}) {
  const [page, setPage] = useState(1);

  const toggleExpanded = (email) => {
    const e = normalizeEmail(email); if (!e) return;
    setExpanded((prev) => ({ ...prev, [e]: !prev[e] }));
  };

  useEffect(() => { setPage(1); }, [search, filterMode, sortMode]);

  const counts = useMemo(() => {
    const list = Array.isArray(athletes) ? athletes : [];
    return {
      needsPlan: list.filter((a) => !!a?.needsPlan).length,
      stale:     list.filter((a) => !!a?.stale && !a?.needsPlan).length,
      current:   list.filter((a) => !a?.stale && !a?.needsPlan).length,
      total:     list.length,
    };
  }, [athletes]);

  const filteredAthletes = useMemo(() => {
    const q    = String(search || "").trim().toLowerCase();
    let   list = Array.isArray(athletes) ? [...athletes] : [];

    if (q) list = list.filter((a) =>
      String(a?.name  || "").toLowerCase().includes(q) ||
      String(a?.email || "").toLowerCase().includes(q)
    );

    if (filterMode === "needsPlan") list = list.filter((a) => !!a?.needsPlan);
    if (filterMode === "stale")     list = list.filter((a) => !!a?.stale && !a?.needsPlan);
    if (filterMode === "current")   list = list.filter((a) => !a?.stale && !a?.needsPlan);

    const byDate     = (a, b) => (safeDate(b?.lastPlanAt)?.getTime?.() || 0) - (safeDate(a?.lastPlanAt)?.getTime?.() || 0);
    const byName     = (a, b) => String(a?.name || "").toLowerCase().localeCompare(String(b?.name || "").toLowerCase());
    const byPriority = (a, b) => {
      const pd = (b?.needsPlan ? 2 : b?.stale ? 1 : 0) - (a?.needsPlan ? 2 : a?.stale ? 1 : 0);
      return pd !== 0 ? pd : byDate(a, b);
    };

    if (sortMode === "name")          list.sort(byName);
    else if (sortMode === "lastPlan") list.sort(byDate);
    else                              list.sort(byPriority);

    return list;
  }, [athletes, search, filterMode, sortMode]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredAthletes.length / pageSize)), [filteredAthletes.length, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    if (page < 1)          setPage(1);
  }, [page, totalPages]);

  const pageItems = useMemo(() =>
    filteredAthletes.slice((page - 1) * pageSize, page * pageSize), [filteredAthletes, page, pageSize]);

  const filterBtns = [
    { key: "all",       label: "All",          badge: counts.total,     tone: "neutral" },
    { key: "needsPlan", label: "Needs Plan",   badge: counts.needsPlan, tone: "bad"     },
    { key: "stale",     label: "Needs Update", badge: counts.stale,     tone: "warn"    },
    { key: "current",   label: "Current",      badge: counts.current,   tone: "good"    },
  ];

  const sortBtns = [
    { key: "priority", label: "Priority" },
    { key: "lastPlan", label: "Last Plan" },
    { key: "name",     label: "Name"     },
  ];

  return (
    <section style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}`, borderTop: `3px solid ${DS.brand}` }}>

      {/* Section header */}
      <div className="px-5 py-3 flex items-center justify-between gap-4" style={{ borderBottom: `1px solid ${DS.border}` }}>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 shrink-0" style={{ color: DS.brand }} />
          <span className="text-xs font-black uppercase tracking-wider" style={{ color: DS.brand }}>Roster</span>
          <span
            className="text-xs font-bold px-1.5 py-0.5"
            style={{ backgroundColor: DS.pageBg, color: DS.labelText, border: `1px solid ${DS.border}` }}
          >
            {counts.total}
          </span>
        </div>

        {/* Status summary — right side */}
        <div className="flex flex-wrap gap-1.5">
          {counts.needsPlan > 0 && (
            <span className="text-xs font-bold px-2 py-0.5" style={{ backgroundColor: DS.bannedBg, color: DS.banned, border: `1px solid ${DS.bannedBorder}` }}>
              {counts.needsPlan} need plan
            </span>
          )}
          {counts.stale > 0 && (
            <span className="text-xs font-bold px-2 py-0.5" style={{ backgroundColor: DS.cautionBg, color: DS.caution, border: `1px solid ${DS.cautionBorder}` }}>
              {counts.stale} stale
            </span>
          )}
          {counts.needsPlan === 0 && counts.stale === 0 && counts.total > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5" style={{ backgroundColor: DS.safeBg, color: DS.safe, border: `1px solid ${DS.safeBorder}` }}>
              <CheckCircle2 className="w-3 h-3" /> All current
            </span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div
        className="px-5 py-3 flex flex-col lg:flex-row lg:items-center gap-3"
        style={{ borderBottom: `1px solid ${DS.border}`, backgroundColor: DS.pageBg }}
      >
        {/* Search */}
        <div className="relative min-w-0 lg:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: DS.dimText }} />
          <input
            className="w-full pl-9 pr-3 py-2 text-xs font-medium"
            style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}`, color: DS.bodyText, outline: "none" }}
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={(e)  => { e.target.style.borderColor = DS.brand; }}
            onBlur={(e)   => { e.target.style.borderColor = DS.border; }}
          />
        </div>

        {/* Filter + sort */}
        <div className="flex flex-wrap gap-1.5 flex-1">
          {filterBtns.map(({ key, label, badge, tone }) => {
            const active = filterMode === key;
            const toneColor = { bad: DS.banned, warn: DS.caution, good: DS.safe, neutral: DS.brand }[tone];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilterMode(key)}
                className="px-2.5 py-1.5 text-xs font-black uppercase tracking-wide transition-all inline-flex items-center gap-1"
                style={{
                  backgroundColor: active ? DS.brand    : DS.cardBg,
                  color:           active ? "#fff"      : DS.labelText,
                  border:          `1px solid ${active ? DS.brand : DS.border}`,
                }}
                onMouseEnter={(e) => { if (!active) { e.currentTarget.style.backgroundColor = DS.brandBg; e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.color = DS.brand; }}}
                onMouseLeave={(e) => { if (!active) { e.currentTarget.style.backgroundColor = DS.cardBg; e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.color = DS.labelText; }}}
              >
                {key === "all" && <Filter className="w-3 h-3" />}
                {label}
                {badge > 0 && key !== "all" && (
                  <span
                    className="ml-0.5 px-1.5 py-0.5 text-xs font-black"
                    style={{
                      backgroundColor: active ? "rgba(255,255,255,0.2)" : (tone === "bad" ? DS.bannedBg : tone === "warn" ? DS.cautionBg : DS.safeBg),
                      color:           active ? "#fff" : toneColor,
                    }}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}

          <span className="w-px self-stretch mx-1" style={{ backgroundColor: DS.border }} />

          {sortBtns.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSortMode(key)}
              className="px-2.5 py-1.5 text-xs font-black uppercase tracking-wide transition-all"
              style={{
                backgroundColor: sortMode === key ? DS.brandBg   : "transparent",
                color:           sortMode === key ? DS.brand     : DS.dimText,
                border:          `1px solid ${sortMode === key ? DS.brandBorder : "transparent"}`,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Pager — far right */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs" style={{ color: DS.dimText }}>
            {filteredAthletes.length} · pg {page}/{totalPages}
          </span>
          <Button variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <Button variant="secondary" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden p-4 space-y-2">
        {pageItems.length === 0
          ? <RosterEmptyState filterMode={filterMode} search={search} counts={counts} />
          : pageItems.map((a) => {
              const email = normalizeEmail(a?.email);
              return (
                <AthleteCard
                  key={a.id || email}
                  athlete={a}
                  templates={templates}
                  isExpanded={!!expanded[email]}
                  onToggle={toggleExpanded}
                  onEdit={onEdit}
                  onHistory={onHistory}
                  onBuild={onBuild}
                />
              );
            })
        }
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block">
        {pageItems.length === 0 ? (
          <div className="px-5 py-4">
            <RosterEmptyState filterMode={filterMode} search={search} counts={counts} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[960px] w-full text-xs table-fixed">
              <thead>
                <tr style={{ backgroundColor: DS.pageBg, borderBottom: `1px solid ${DS.border}` }}>
                  {[
                    { label: "Athlete",   w: "200px" },
                    { label: "Email",     w: "230px" },
                    { label: "Status",    w: "100px" },
                    { label: "Tags",      w: "160px" },
                    { label: "Plans",     w: "70px"  },
                    { label: "Last Plan", w: "185px" },
                    { label: "",          w: "200px" },
                  ].map(({ label, w }, i) => (
                    <th
                      key={i}
                      className={`py-2 px-3 font-black uppercase tracking-wider text-left ${i === 6 ? "text-right" : ""}`}
                      style={{ color: DS.dimText, width: w }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {pageItems.map((a) => {
                  const email     = normalizeEmail(a?.email);
                  const status    = String(a?.status || "Active");
                  const tags      = Array.isArray(a?.tags) ? a.tags : [];
                  const needsPlan = !!a?.needsPlan;
                  const accent    = needsPlan ? DS.banned : a?.stale ? DS.caution : DS.safe;

                  return (
                    <tr
                      key={a.id || email}
                      style={{ borderBottom: `1px solid ${DS.border}`, borderLeft: `3px solid ${accent}` }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DS.brandBg; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ""; }}
                    >
                      <td className="py-2.5 px-3 align-top">
                        <div className="font-bold truncate" style={{ color: DS.bodyText }}>{a?.name || "Athlete"}</div>
                        <div className="mt-1"><PlanChip needsPlan={needsPlan} stale={!!a?.stale} /></div>
                      </td>

                      <td className="py-2.5 px-3 align-top">
                        <div className="break-all line-clamp-2" style={{ color: DS.labelText }}>{email || "—"}</div>
                        {email && (
                          <a href={`mailto:${email}`} className="inline-flex items-center gap-1 mt-0.5 font-bold hover:underline" style={{ color: DS.brand }}>
                            <Mail className="w-3 h-3" /> Email
                          </a>
                        )}
                      </td>

                      <td className="py-2.5 px-3 align-top"><Pill>{status}</Pill></td>

                      <td className="py-2.5 px-3 align-top">
                        <div className="flex flex-wrap gap-1">
                          {tags.length
                            ? <>{tags.slice(0, 3).map((t) => <TagChip key={t} text={t} />)}{tags.length > 3 && <span style={{ color: DS.dimText }}>+{tags.length - 3}</span>}</>
                            : <span style={{ color: DS.dimText }}>—</span>
                          }
                        </div>
                      </td>

                      <td className="py-2.5 px-3 align-top"><Pill>{a?.plansCount || 0}</Pill></td>

                      <td className="py-2.5 px-3 align-top">
                        <div className="font-bold" style={{ color: DS.bodyText }}>{a?.lastPlanAt ? fmtDate(a.lastPlanAt) : "—"}</div>
                        <div className="mt-0.5 truncate" style={{ color: DS.dimText }}>
                          {a?.lastPlanTitle || "No plans yet"}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 align-top">
                        <div className="flex justify-end gap-1.5">
                          <Button variant="secondary" onClick={() => onEdit(a)} disabled={!email}>
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </Button>
                          <Button variant="secondary" onClick={() => onHistory(email)} disabled={!email}>
                            History
                          </Button>
                          <Button onClick={() => onBuild(email)} disabled={!email}>
                            Build <ArrowRight className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}