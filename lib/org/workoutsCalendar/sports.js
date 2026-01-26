// lib/org/workoutsCalendar/sports.js
export function normalizeSport(v) {
  return String(v || "").trim().toLowerCase();
}

export function titleSport(v) {
  const s = String(v || "").trim().toLowerCase();
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
