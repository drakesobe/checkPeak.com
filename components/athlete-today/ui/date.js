// components/athlete-today/ui/date.js

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function toISODateLocal(d) {
  // local YYYY-MM-DD (no timezone shift)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function labelForDate(iso) {
  const d = new Date(`${iso}T12:00:00`);
  const today = new Date();
  const todayIso = toISODateLocal(today);

  if (iso === todayIso) return "Today";

  const yesterdayIso = toISODateLocal(addDays(today, -1));
  if (iso === yesterdayIso) return "Yesterday";

  const tomorrowIso = toISODateLocal(addDays(today, 1));
  if (iso === tomorrowIso) return "Tomorrow";

  return d.toLocaleDateString(undefined, { weekday: "short" });
}

export function prettyDate(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
