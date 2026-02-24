"use client";

import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Plus,
  RefreshCcw,
} from "lucide-react";
import Button from "./Button";
import Pill from "./Pill";
import SportChips from "./SportChips";

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function CalendarHeader({
  // labels + state
  viewMode,
  setViewMode,
  weekLabel,
  monthLabel,
  headerSubtitle,
  err,
  loading,

  // range + counts
  rangeStart,
  rangeEnd,
  rangeSummary,

  // sports chips
  SPORTS_ALL,
  selectedSports,
  setSelectedSports,
  onOpenMoreSports,

  // actions
  onGoDashboard,
  onRefresh,
  onGoToday,
  onPrev,
  onNext,
  onCreateToday,
}) {
  const primaryLabel = viewMode === "week" ? weekLabel : monthLabel;

  return (
    <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-4 sm:p-6">
      {/* Top: Title + key pills + actions */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-[#46769B]" />
            <h1 className="text-2xl font-extrabold truncate">Workouts Calendar</h1>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <Pill>
              <Activity className="w-3.5 h-3.5 mr-1.5" />
              {primaryLabel}
            </Pill>
            <Pill>{headerSubtitle}</Pill>

            {err ? (
              <Pill tone="bad">
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                Error
              </Pill>
            ) : (
              <Pill tone="good">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                Ready
              </Pill>
            )}
          </div>

          {err ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700 font-semibold">{err}</p>
              <p className="text-[11px] text-red-600 mt-1">
                If you recently changed the API (sports vs sport), confirm the server accepts your query params. Also
                confirm Airtable field names: <span className="font-semibold">Sport</span> (not Sports).
              </p>
            </div>
          ) : null}
        </div>

        {/* Desktop actions (keeps your original layout, just tighter) */}
        <div className="hidden sm:flex flex-col sm:flex-row flex-wrap gap-2 sm:justify-end">
          <Button variant="secondary" onClick={onGoDashboard} className="w-full sm:w-auto">
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Button>

          <Button variant="secondary" onClick={onRefresh} disabled={loading} className="w-full sm:w-auto">
            <RefreshCcw className="w-4 h-4" />
            Refresh
          </Button>

          <Button variant="secondary" onClick={onGoToday} className="w-full sm:w-auto" title="Jump to today">
            Today
          </Button>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={onPrev} className="w-full sm:w-auto" title="Previous">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="secondary" onClick={onNext} className="w-full sm:w-auto" title="Next">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ✅ Mobile nav row: makes month paging obvious + easy */}
      <div className="mt-4 sm:hidden">
        <div className="grid grid-cols-3 gap-2">
          <Button variant="secondary" onClick={onPrev} title="Previous" className="w-full justify-center">
            <ChevronLeft className="w-4 h-4" />
            <span className="sr-only">Previous</span>
          </Button>

          <Button variant="secondary" onClick={onGoToday} title="Jump to today" className="w-full justify-center">
            Today
          </Button>

          <Button variant="secondary" onClick={onNext} title="Next" className="w-full justify-center">
            <ChevronRight className="w-4 h-4" />
            <span className="sr-only">Next</span>
          </Button>
        </div>

        {/* Small helper text so users understand what Prev/Next does */}
        <p className="text-[11px] text-gray-500 mt-2 text-center">
          {viewMode === "month" ? "Prev/Next changes the month" : "Prev/Next changes the week"}
        </p>
      </div>

      {/* View toggle + Sports */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs text-gray-500">View</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={cx(
                "px-3 py-2 rounded-2xl border text-sm font-semibold transition w-full",
                viewMode === "week"
                  ? "bg-[#46769B] text-white border-[#46769B]"
                  : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
              )}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className={cx(
                "px-3 py-2 rounded-2xl border text-sm font-semibold transition w-full",
                viewMode === "month"
                  ? "bg-[#46769B] text-white border-[#46769B]"
                  : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
              )}
            >
              Month
            </button>
          </div>

          <p className="text-[11px] text-gray-500 mt-3">Week is best for daily ops. Month is best for scheduling/planning.</p>

          {/* ✅ Mobile quick action: Create (keeps it close to the view toggle) */}
          <div className="mt-3 sm:hidden">
            <Button className="w-full justify-center" onClick={onCreateToday}>
              <Plus className="w-4 h-4" />
              Create
            </Button>
          </div>
        </div>

        <div className="lg:col-span-8 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Sports</p>
              <div className="mt-3">
                <SportChips
                  sportsAll={SPORTS_ALL}
                  selectedSports={selectedSports}
                  setSelectedSports={setSelectedSports}
                  onOpenMore={onOpenMoreSports}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2 items-center">
                <Pill>{selectedSports.length ? `${selectedSports.length} selected` : "All sports"}</Pill>
                <Pill>
                  Range: {rangeStart} → {rangeEnd}
                </Pill>
                {loading ? <Pill tone="warn">Loading…</Pill> : <Pill tone="good">Loaded</Pill>}
              </div>
            </div>

            {/* Keep desktop Create button where it is */}
            <div className="hidden sm:block">
              <Button className="px-3 py-2 text-xs shrink-0" onClick={onCreateToday}>
                <Plus className="w-4 h-4" />
                Create
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Range summary */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Workouts in range</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">{loading ? "…" : rangeSummary.workoutsCount}</p>
          <p className="text-[11px] text-gray-500 mt-2">Across {loading ? "…" : rangeSummary.uniqueDaysCount} day(s)</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Athlete assignments</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">{loading ? "…" : rangeSummary.athleteCount}</p>
          <p className="text-[11px] text-gray-500 mt-2">Sum across workouts</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Items</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">{loading ? "…" : rangeSummary.itemCount}</p>
          <p className="text-[11px] text-gray-500 mt-2">Sum across workouts</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Sports in range</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">
            {loading ? "…" : Object.keys(rangeSummary.bySport || {}).filter(Boolean).length}
          </p>
          <p className="text-[11px] text-gray-500 mt-2">
            Filtered view: {selectedSports.length ? `${selectedSports.length} sport(s)` : "All"}
          </p>
        </div>
      </div>
    </div>
  );
}