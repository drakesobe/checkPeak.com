"use client";

function fmtWeek(weekStartISO) {
  if (!weekStartISO) return "This week";
  try {
    const d = new Date(String(weekStartISO).slice(0, 10) + "T12:00:00Z");
    return `Week of ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  } catch {
    return "This week";
  }
}

export default function NutritionHeader({
  weekStartISO,
  lastUpdatedLabel,
  loading,
  error,
  onGoDashboard,
  onGoPlans,
  onRefresh,
}) {
  return (
    <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-extrabold">Nutrition Accountability</h1>
          <span className="text-xs font-semibold px-2 py-1 rounded-lg border border-gray-200 bg-gray-50 text-gray-700">
            {fmtWeek(weekStartISO)}
          </span>
        </div>

        <p className="text-sm text-gray-600 mt-1">
          Budget-first adherence: focus on realistic consistency — not “buy everything” expectations.
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
          {lastUpdatedLabel ? <span>{lastUpdatedLabel}</span> : null}
          {loading ? <span className="text-gray-500">Loading…</span> : null}
          {error ? (
            <span className="text-red-700 font-semibold">{error}</span>
          ) : null}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onGoDashboard}
          className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
        >
          Dashboard
        </button>

        <button
          type="button"
          onClick={onGoPlans}
          className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
        >
          Plans
        </button>

        <button
          type="button"
          onClick={onRefresh}
          className="px-4 py-2 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:brightness-110"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
