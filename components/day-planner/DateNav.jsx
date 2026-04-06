// components/day-planner/DateNav.jsx
import { IconChevronLeft, IconChevronRight } from "./DayPlannerIcons";

const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function formatDateLabel(iso) {
  const d = new Date(iso + "T12:00:00");
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

const btnStyle = {
  width: 36, height: 36, borderRadius: 10,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#9CA3AF", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  transition: "all 0.15s",
};

export function DateNav({ dateISO, todayISO, onPrev, onNext, onToday }) {
  const isToday = dateISO === todayISO;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <button
        onClick={onPrev}
        style={btnStyle}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.09)"}
        onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
      >
        <IconChevronLeft />
      </button>

      <div style={{ flex: 1, textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#F9FAFB" }}>
          {formatDateLabel(dateISO)}
        </div>
        {isToday && (
          <div style={{
            fontSize: 11, fontWeight: 700, color: "#10B981",
            letterSpacing: "0.08em", textTransform: "uppercase",
          }}>
            Today
          </div>
        )}
      </div>

      <button
        onClick={onNext}
        style={btnStyle}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.09)"}
        onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
      >
        <IconChevronRight />
      </button>

      {!isToday && (
        <button
          onClick={onToday}
          style={{
            ...btnStyle,
            fontSize: 11, fontWeight: 700, padding: "0 12px",
            color: "#3B82F6", borderColor: "rgba(59,130,246,0.3)",
            background: "rgba(59,130,246,0.08)",
            width: "auto", letterSpacing: "0.06em",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(59,130,246,0.15)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(59,130,246,0.08)"}
        >
          Today
        </button>
      )}
    </div>
  );
}