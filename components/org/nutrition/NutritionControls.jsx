"use client";

import { useMemo } from "react";
import { Search, X, RotateCcw, SlidersHorizontal } from "lucide-react";

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function safeStr(v) {
  return String(v ?? "").trim();
}

function asNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function isDefaultState({ search, filterMode, sport, team, pageSize }) {
  return (
    !safeStr(search) &&
    (filterMode === "action" || !filterMode) &&
    (sport === "all" || !sport) &&
    (team === "all" || !team) &&
    (String(pageSize || "10") === "10")
  );
}

function Label({ children }) {
  return <label className="block text-[11px] font-semibold text-gray-600 mb-1.5">{children}</label>;
}

function Select({ value, onChange, disabled, children, className = "" }) {
  return (
    <select
      className={cx(
        "w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900",
        "focus:outline-none focus:ring-2 focus:ring-[#46769B]/20",
        disabled ? "opacity-60 cursor-not-allowed" : "",
        className
      )}
      value={value}
      onChange={onChange}
      disabled={disabled}
    >
      {children}
    </select>
  );
}

function Pill({ children, onClear, tone = "neutral" }) {
  const toneCls =
    tone === "blue"
      ? "bg-blue-50 text-blue-900 border-blue-200"
      : tone === "amber"
      ? "bg-amber-50 text-amber-900 border-amber-200"
      : tone === "red"
      ? "bg-red-50 text-red-900 border-red-200"
      : "bg-gray-50 text-gray-800 border-gray-200";

  return (
    <span className={cx("inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold", toneCls)}>
      {children}
      {onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="h-6 w-6 rounded-full border border-gray-200 bg-white hover:bg-gray-50 inline-flex items-center justify-center"
          title="Clear"
        >
          <X className="h-3.5 w-3.5 text-gray-600" />
        </button>
      ) : null}
    </span>
  );
}

function StatChip({ label, value, tone = "neutral" }) {
  const cls =
    tone === "good"
      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-900 border-amber-200"
      : tone === "bad"
      ? "bg-red-50 text-red-900 border-red-200"
      : "bg-gray-50 text-gray-800 border-gray-200";

  return (
    <span className={cx("inline-flex items-center gap-2 px-3 py-2 rounded-2xl border text-xs font-semibold", cls)}>
      <span className="text-gray-500">{label}</span>
      <span className="tabular-nums">{value}</span>
    </span>
  );
}

export default function NutritionControls({
  // core filters
  search,
  setSearch,
  filterMode,
  setFilterMode,

  sport = "all",
  setSport,
  team = "all",
  setTeam,

  // dropdown fuel
  sports = [],
  teams = [],
  teamsBySport = {},

  // queue/table counts (optional, but recommended)
  counts = null, // { total, needsAction, missingCheckin, lowAdherence, noPlan }

  // pagination controls (optional)
  pageSize = 10,
  setPageSize,

  // optional: let parent reset page when filters change
  onAnyFilterChange,
}) {
  const sportValue = String(sport || "all");
  const teamValue = String(team || "all");
  const pageSizeValue = String(pageSize || "10");

  const c = useMemo(() => {
    const cc = counts || {};
    return {
      total: asNum(cc.total, 0),
      needsAction: asNum(cc.needsAction, 0),
      missingCheckin: asNum(cc.missingCheckin, 0),
      lowAdherence: asNum(cc.lowAdherence, 0),
      noPlan: asNum(cc.noPlan, 0),
    };
  }, [counts]);

  // Prefer sport-specific teams when sport is selected
  const sportTeams =
    sportValue !== "all" && teamsBySport && typeof teamsBySport === "object"
      ? teamsBySport[sportValue]
      : null;

  const teamOptions = Array.isArray(sportTeams) && sportTeams.length ? sportTeams : Array.isArray(teams) ? teams : [];

  const canReset = !isDefaultState({
    search,
    filterMode,
    sport: sportValue,
    team: teamValue,
    pageSize: pageSizeValue,
  });

  const doReset = () => {
    setSearch?.("");
    setFilterMode?.("action");
    setSport?.("all");
    setTeam?.("all");
    setPageSize?.(10);
    onAnyFilterChange?.();
  };

  const activePills = useMemo(() => {
    const pills = [];
    if (safeStr(search)) pills.push({ key: "search", label: `Search: "${safeStr(search)}"`, tone: "blue" });
    if (String(filterMode || "action") !== "action") {
      const label =
        filterMode === "all"
          ? "Queue: All"
          : filterMode === "missing_checkin"
          ? "Queue: Missing check-in"
          : filterMode === "low_adherence"
          ? "Queue: Low adherence"
          : filterMode === "no_plan"
          ? "Queue: No plan"
          : "Queue: Needs action";
      pills.push({ key: "filterMode", label, tone: filterMode === "all" ? "neutral" : "amber" });
    }
    if (sportValue !== "all") pills.push({ key: "sport", label: `Sport: ${sportValue}`, tone: "blue" });
    if (teamValue !== "all") pills.push({ key: "team", label: `Team: ${teamValue}`, tone: "blue" });
    if (pageSizeValue !== "10") pills.push({ key: "pageSize", label: `Per page: ${pageSizeValue}`, tone: "neutral" });
    return pills;
  }, [search, filterMode, sportValue, teamValue, pageSizeValue]);

  const onChange = (fn) => (eOrValue) => {
    fn?.(eOrValue?.target ? eOrValue.target.value : eOrValue);
    onAnyFilterChange?.();
  };

  const queueOptions = useMemo(() => {
    // These counts map to the fields you added back onto rows: needsAction/noPlan/missingCheckin/lowAdherence
    return [
      { value: "action", label: "Needs Action", count: c.needsAction },
      { value: "missing_checkin", label: "Missing Check-in", count: c.missingCheckin },
      { value: "low_adherence", label: "Low Adherence", count: c.lowAdherence },
      { value: "no_plan", label: "No Plan", count: c.noPlan },
      { value: "all", label: "All", count: c.total },
    ];
  }, [c]);

  return (
    <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
      {/* Top row: Search + Reset + Stats */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        {/* Search */}
        <div className="w-full lg:max-w-xl">
          <Label>
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-gray-400" />
              Search
            </span>
          </Label>

          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className={cx(
                "w-full pl-11 pr-10 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900",
                "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30"
              )}
              placeholder="Search name, email, token…"
              value={search}
              onChange={(e) => {
                setSearch?.(e.target.value);
                onAnyFilterChange?.();
              }}
            />

            {safeStr(search) ? (
              <button
                type="button"
                onClick={() => {
                  setSearch?.("");
                  onAnyFilterChange?.();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600"
                title="Clear search"
              >
                <X className="w-4 h-4 mx-auto" />
              </button>
            ) : null}
          </div>

          {/* Active filters pills */}
          {activePills.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {activePills.map((p) => (
                <Pill
                  key={p.key}
                  tone={p.tone}
                  onClear={
                    p.key === "search"
                      ? () => {
                          setSearch?.("");
                          onAnyFilterChange?.();
                        }
                      : p.key === "filterMode"
                      ? () => {
                          setFilterMode?.("action");
                          onAnyFilterChange?.();
                        }
                      : p.key === "sport"
                      ? () => {
                          setSport?.("all");
                          setTeam?.("all");
                          onAnyFilterChange?.();
                        }
                      : p.key === "team"
                      ? () => {
                          setTeam?.("all");
                          onAnyFilterChange?.();
                        }
                      : p.key === "pageSize"
                      ? () => {
                          setPageSize?.(10);
                          onAnyFilterChange?.();
                        }
                      : null
                  }
                >
                  {p.label}
                </Pill>
              ))}
            </div>
          ) : null}
        </div>

        {/* Right side: quick stats + reset */}
        <div className="w-full lg:w-auto">
          <div className="flex flex-wrap items-center gap-2 justify-start lg:justify-end">
            {counts ? (
              <>
                <StatChip label="Total" value={c.total} />
                <StatChip label="Needs action" value={c.needsAction} tone={c.needsAction ? "warn" : "good"} />
                <StatChip label="Missing" value={c.missingCheckin} tone={c.missingCheckin ? "warn" : "good"} />
                <StatChip label="Low" value={c.lowAdherence} tone={c.lowAdherence ? "bad" : "neutral"} />
                <StatChip label="No plan" value={c.noPlan} tone={c.noPlan ? "warn" : "neutral"} />
              </>
            ) : null}

            <button
              type="button"
              onClick={doReset}
              disabled={!canReset}
              className={cx(
                "inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border transition",
                canReset
                  ? "border-gray-200 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200"
                  : "border-gray-200 bg-white opacity-60 cursor-not-allowed"
              )}
              title={canReset ? "Reset filters" : "No filters to reset"}
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Filters: mobile-friendly grid */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Queue filter */}
        <div>
          <Label>Queue</Label>
          <Select
            value={String(filterMode || "action")}
            onChange={(e) => {
              setFilterMode?.(e.target.value);
              onAnyFilterChange?.();
            }}
          >
            {queueOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
                {counts ? ` (${opt.count})` : ""}
              </option>
            ))}
          </Select>
        </div>

        {/* Sport */}
        <div>
          <Label>Sport</Label>
          <Select
            value={sportValue}
            onChange={(e) => {
              const next = e.target.value;
              setSport?.(next);

              // If sport changes, reset team only if it becomes invalid
              if (next !== "all") {
                const allowed = Array.isArray(teamsBySport?.[next]) ? teamsBySport[next] : [];
                if (teamValue !== "all" && allowed.length && !allowed.includes(teamValue)) {
                  setTeam?.("all");
                }
              } else {
                // sport reset -> keep team as-is unless you want to reset team too
                // setTeam?.("all");
              }

              onAnyFilterChange?.();
            }}
          >
            <option value="all">All sports</option>
            {Array.isArray(sports) &&
              sports.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
          </Select>
        </div>

        {/* Team */}
        <div>
          <Label>Team</Label>
          <Select
            value={teamValue}
            onChange={(e) => {
              setTeam?.(e.target.value);
              onAnyFilterChange?.();
            }}
            disabled={!teamOptions || teamOptions.length === 0}
          >
            <option value="all">All teams</option>
            {teamOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>

          {sportValue !== "all" && (!teamOptions || teamOptions.length === 0) ? (
            <p className="mt-1 text-[11px] text-gray-500 leading-5">
              No teams found for <span className="font-semibold text-gray-700">{sportValue}</span>.
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-gray-500 leading-5">
              Teams available: <span className="font-semibold text-gray-700">{teamOptions.length}</span>
              {sportValue !== "all" ? (
                <>
                  {" "}
                  for <span className="font-semibold text-gray-700">{sportValue}</span>
                </>
              ) : null}
            </p>
          )}
        </div>

        {/* Page size (pairs with your new pagination) */}
        <div>
          <Label>Rows per page</Label>
          <Select
            value={pageSizeValue}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (setPageSize) setPageSize(next);
              onAnyFilterChange?.();
            }}
            disabled={!setPageSize}
          >
            <option value="10">10</option>
            <option value="15">15</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </Select>
          {!setPageSize ? (
            <p className="mt-1 text-[11px] text-gray-500 leading-5">
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-gray-500 leading-5">
              Keep this low for fast scanning. Coaches usually live at{" "}
              <span className="font-semibold text-gray-700">10–15</span>.
            </p>
          )}
        </div>
      </div>

      {/* Tiny helper row */}
      <div className="mt-4 text-[11px] text-gray-500 leading-5">
        Tip: Use <span className="font-semibold text-gray-700">Needs Action</span> to triage, then narrow by{" "}
        <span className="font-semibold text-gray-700">Sport</span>/<span className="font-semibold text-gray-700">Team</span>.
      </div>
    </div>
  );
}