// components/day-planner/FilterBar.jsx

const FILTERS = [
  { key: "all",       label: "All"       },
  { key: "workout",   label: "Workout"   },
  { key: "nutrition", label: "Nutrition" },
  { key: "class",     label: "Classes"   },
];

export { FILTERS };

export function FilterBar({ active, onChange, counts }) {
  return (
    <div style={{
      display: "flex", gap: 6, marginBottom: 14,
      overflowX: "auto", paddingBottom: 2,
    }}>
      {FILTERS.map(f => {
        const isActive = active === f.key;
        const count    = counts[f.key] ?? 0;
        return (
          <button
            key={f.key}
            onClick={() => onChange(f.key)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 20, flexShrink: 0,
              background: isActive ? "#1E3A5F" : "rgba(255,255,255,0.04)",
              border: `1px solid ${isActive ? "#3B82F6" : "rgba(255,255,255,0.08)"}`,
              color: isActive ? "#7EB8E0" : "#6B7280",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
              transition: "all 0.15s ease",
              letterSpacing: "0.02em",
            }}
            onMouseEnter={e => {
              if (!isActive) {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
                e.currentTarget.style.color = "#9CA3AF";
              }
            }}
            onMouseLeave={e => {
              if (!isActive) {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                e.currentTarget.style.color = "#6B7280";
              }
            }}
          >
            {f.label}
            {count > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 800,
                background: isActive ? "rgba(126,184,224,0.2)" : "rgba(255,255,255,0.07)",
                color: isActive ? "#7EB8E0" : "#9CA3AF",
                borderRadius: 99, padding: "1px 6px",
              }}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}