// components/day-planner/ProgressSummary.jsx

export function ProgressSummary({ blocks }) {
  const total = blocks.length;
  const done  = blocks.filter(b => b.done).length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  const stats = [
    {
      label: "Workout",
      done:  blocks.filter(b => b.type === "workout" && b.done).length,
      total: blocks.filter(b => b.type === "workout").length,
      color: "#3B82F6",
    },
    {
      label: "Nutrition",
      done:  blocks.filter(b => b.type === "nutrition" && b.done).length,
      total: blocks.filter(b => b.type === "nutrition").length,
      color: "#10B981",
    },
    {
      label: "Classes",
      done:  blocks.filter(b => b.type === "class" && b.done).length,
      total: blocks.filter(b => b.type === "class").length,
      color: "#F59E0B",
    },
  ].filter(s => s.total > 0);

  const trackColor = pct === 100
    ? "#10B981"
    : "linear-gradient(90deg, #3B82F6, #10B981)";

  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 14, padding: "14px 16px",
      marginBottom: 16,
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: 10,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 26, fontWeight: 900, color: "#F9FAFB", lineHeight: 1 }}>
            {pct}%
          </span>
          <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 500 }}>
            day complete
          </span>
        </div>
        <span style={{ fontSize: 13, color: "#6B7280" }}>
          {done}/{total} done
        </span>
      </div>

      {/* Track */}
      <div style={{
        height: 5, background: "rgba(255,255,255,0.06)",
        borderRadius: 99, overflow: "hidden", marginBottom: 12,
      }}>
        <div style={{
          height: "100%", width: `${pct}%`, borderRadius: 99,
          background: trackColor,
          transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
        }} />
      </div>

      {/* Per-type mini stats */}
      {stats.length > 0 && (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {stats.map(s => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.color }} />
              <span style={{ fontSize: 12, color: "#9CA3AF" }}>
                {s.label}:{" "}
                <span style={{
                  color: s.done === s.total ? s.color : "#F9FAFB",
                  fontWeight: 700,
                }}>
                  {s.done}/{s.total}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}