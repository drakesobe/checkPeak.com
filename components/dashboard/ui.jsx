// /components/dashboard/ui.jsx
"use client";

export function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

export function SidebarLink({ label, icon, active = false, onClick, badge = null }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        "w-full inline-flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-medium transition",
        active ? "bg-blue-600 text-white shadow-sm" : "text-gray-700 hover:bg-gray-100",
      )}
    >
      <span className="inline-flex items-center gap-2 min-w-0">
        <span
          className={classNames(
            "h-5 w-5 rounded-md flex items-center justify-center text-[11px]",
            active ? "bg-white/15" : "bg-gray-100 text-gray-700",
          )}
        >
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </span>

      <span className="inline-flex items-center gap-2">
        {badge ? (
          <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold grid place-items-center">
            {badge}
          </span>
        ) : null}
        {active ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
      </span>
    </button>
  );
}

export function StatCard({ label, value, icon, tone = "neutral", subLabel }) {
  const toneClasses =
    tone === "primary"
      ? "bg-blue-50 border-blue-100"
      : tone === "success"
      ? "bg-emerald-50 border-emerald-100"
      : tone === "warning"
      ? "bg-amber-50 border-amber-100"
      : "bg-white border-gray-100";

  return (
    <div
      className={classNames("rounded-2xl shadow-sm p-4 border flex flex-col justify-between", toneClasses)}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">{label}</p>
        <div className="h-8 w-8 rounded-full bg-white/70 flex items-center justify-center">
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
      {subLabel ? <p className="mt-1 text-[11px] text-gray-500">{subLabel}</p> : null}
    </div>
  );
}
