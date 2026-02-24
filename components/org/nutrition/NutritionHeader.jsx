// components/org/nutrition/NutritionHeader.jsx
"use client";

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function fmtWeekRange(weekStartISO) {
  if (!weekStartISO) return "This week";
  try {
    // weekStartISO is expected YYYY-MM-DD (Sunday start)
    const start = new Date(String(weekStartISO).slice(0, 10) + "T12:00:00Z");
    if (Number.isNaN(start.getTime())) return "This week";

    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    const startLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const endLabel = end.toLocaleDateString(undefined, { month: "short", day: "numeric" });

    return `Week of ${startLabel} – ${endLabel}`;
  } catch {
    return "This week";
  }
}

function StatusPill({ loading, error, lastUpdatedLabel }) {
  if (error) {
    return (
      <span className="inline-flex items-center gap-2 text-xs font-semibold px-2 py-1 rounded-lg border border-red-200 bg-red-50 text-red-800">
        <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
        Error
      </span>
    );
  }

  if (loading) {
    return (
      <span className="inline-flex items-center gap-2 text-xs font-semibold px-2 py-1 rounded-lg border border-blue-200 bg-blue-50 text-blue-900">
        <span className="inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
        Loading
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 text-xs font-semibold px-2 py-1 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900">
      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
      Live
      {lastUpdatedLabel ? <span className="text-emerald-900/70 font-medium">• {lastUpdatedLabel}</span> : null}
    </span>
  );
}

function IconButton({ children, onClick, disabled, tone = "neutral", title }) {
  const toneCls =
    tone === "primary"
      ? "bg-[#46769B] text-white hover:brightness-110 focus:ring-[#46769B]/35"
      : "bg-white text-gray-800 hover:bg-gray-50 border border-gray-200 focus:ring-gray-200";

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "px-4 py-2 rounded-xl text-sm font-semibold transition",
        "focus:outline-none focus:ring-2",
        toneCls,
        disabled ? "opacity-60 cursor-not-allowed" : ""
      )}
    >
      {children}
    </button>
  );
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
  const weekLabel = fmtWeekRange(weekStartISO);

  return (
    <section className="bg-white rounded-2xl shadow-md border border-blue-100 overflow-hidden">
      {/* Accent line */}
      <div className="h-1 w-full bg-[#46769B]" />

      <div className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Left: Title + week + status */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                Nutrition Accountability
              </h1>

              <span className="text-xs font-semibold px-2 py-1 rounded-lg border border-gray-200 bg-gray-50 text-gray-700">
                {weekLabel}
              </span>

              <StatusPill loading={loading} error={error} lastUpdatedLabel={lastUpdatedLabel} />
            </div>

            <p className="text-sm text-gray-600 mt-2 max-w-2xl">
              Monitor and manage athlete nutrition check-ins, plan adherence, and SmartStack recommendations.
            </p>

            {/* Error detail (kept small but clear) */}
            {error ? (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                <span className="font-semibold">Queue error:</span> {error}
              </div>
            ) : null}
          </div>

          {/* Right: Actions */}
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <IconButton onClick={onGoDashboard} title="Back to org dashboard">
              Dashboard
            </IconButton>

            <IconButton onClick={onGoPlans} title="Open plans & prescriptions">
              Plans
            </IconButton>

            <IconButton
              onClick={onRefresh}
              tone="primary"
              disabled={Boolean(loading)}
              title={loading ? "Refreshing…" : "Refresh nutrition queue"}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </IconButton>
          </div>
        </div>

        {/* Subtle footer row for micro-info (optional, minimalist) */}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-gray-400" />
            Token-first navigation (AthleteToken)
          </span>

          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-gray-400" />
            Plans require <span className="font-semibold text-gray-700">Status = Active</span>
          </span>

          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-gray-400" />
            Check-ins matched by <span className="font-semibold text-gray-700">WeekStartISO</span>
          </span>
        </div>
      </div>
    </section>
  );
}