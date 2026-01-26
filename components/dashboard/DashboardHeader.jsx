// /components/dashboard/DashboardHeader.jsx
"use client";

export default function DashboardHeader({ user, stats }) {
  const accountCompletion = Math.min(
    100,
    Math.max(0, stats?.accountCompletion || 0),
  );

  return (
    <header className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-blue-700/80 font-semibold mb-1">
            Dashboard
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Hey {user?.Name || user?.name || "there"},
            <span className="text-blue-700 font-semibold">
              {" "}
              you’re in control.
            </span>
          </h1>

          {user?.Organization && (
            <p className="mt-1 text-xs sm:text-sm text-gray-600">
              Viewing activity for{" "}
              <span className="font-medium text-gray-900">
                {user.Organization}
              </span>.
            </p>
          )}
        </div>

        <div className="flex flex-col items-start sm:items-end gap-1 text-xs text-gray-500">
          <span>Account completion</span>
          <div className="w-44 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all"
              style={{ width: `${accountCompletion}%` }}
            />
          </div>
          <span className="text-[11px] text-gray-500">
            {accountCompletion}% complete
          </span>
        </div>
      </div>
    </header>
  );
}
