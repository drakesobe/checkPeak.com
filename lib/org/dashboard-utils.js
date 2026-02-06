// /lib/org/dashboard-utils.js

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDate(value) {
  const d = safeDate(value);
  if (!d) return value ? String(value) : "";
  return d.toLocaleString();
}

export async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

export function downloadTextFile(filename, text, mime = "text/plain") {
  // ✅ Guard: only run in browser
  if (typeof window === "undefined" || typeof document === "undefined") return;

  try {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {
    // no-op
  }
}

export function toCSV(rows) {
  const escape = (v) => {
    const s = String(v ?? "");
    const needs = /[",\n]/.test(s);
    const escaped = s.replace(/"/g, '""');
    return needs ? `"${escaped}"` : escaped;
  };
  return (Array.isArray(rows) ? rows : []).map((r) => (r || []).map(escape).join(",")).join("\n");
}

/** YYYY-MM-DD in America/New_York */
const NY_DATE_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function nyDateISO() {
  const parts = NY_DATE_FMT.formatToParts(new Date());

  let y = "";
  let m = "";
  let d = "";

  for (const p of parts) {
    if (p.type === "year") y = p.value;
    else if (p.type === "month") m = p.value;
    else if (p.type === "day") d = p.value;
  }

  return `${y}-${m}-${d}`;
}
