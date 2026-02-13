"use client";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function NutritionStats({ counts, activeFilter, onSelectFilter }) {
  const cards = [
    { key: "action", label: "Needs Action", value: counts.needsAction },
    { key: "missing_checkin", label: "Missing Check-in", value: counts.missingCheckin },
    { key: "low_adherence", label: "Low Adherence", value: counts.lowAdherence },
    { key: "no_plan", label: "No Plan", value: counts.noPlan },
  ];

  return (
    <div className="grid sm:grid-cols-4 gap-4">
      {cards.map((c) => {
        const active = activeFilter === c.key;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onSelectFilter?.(c.key)}
            className={classNames(
              "text-left bg-white rounded-2xl shadow-md border p-5 transition",
              active ? "border-[#46769B] ring-2 ring-[#46769B]/20" : "border-blue-100 hover:bg-gray-50"
            )}
          >
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className="text-2xl font-extrabold text-gray-900 mt-1">{c.value ?? 0}</p>
            <p className="text-[11px] text-gray-500 mt-2">Tap to filter</p>
          </button>
        );
      })}
    </div>
  );
}
