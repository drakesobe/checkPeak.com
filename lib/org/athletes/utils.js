// lib/org/athletes/utils.js

export function cleanString(v) {
  return v == null ? "" : String(v).trim();
}

export function normalizeEmail(v) {
  const s = cleanString(v).toLowerCase();
  if (!s || !s.includes("@")) return "";
  return s;
}

export function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function safeJsonParse(s, fallback) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

export function safeCsvCell(v) {
  const s = cleanString(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function downloadTextFile(filename, content, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

export async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export function normalizeRole(user) {
  const r = String(user?.role || user?.Role || "").trim().toLowerCase();
  if (!r) return "";
  if (r === "organization") return "organization";
  if (r === "admin") return "admin";
  if (r === "trainer") return "trainer";
  if (r.includes("org")) return "organization";
  if (r.includes("admin")) return "admin";
  if (r.includes("train")) return "trainer";
  if (r.includes("ath")) return "athlete";
  return r;
}

export function getOrgKey(user) {
  const orgId = String(user?.orgId || user?.OrgId || "").trim();
  const orgToken = String(user?.Token || user?.token || user?.["Organization Token"] || "").trim();

  if (orgId) return `orgid:${orgId}`;
  if (orgToken) return `orgtoken:${orgToken.slice(0, 12)}`;
  return "org:unknown";
}

export function normalizeAthleteRecord(a) {
  const email = normalizeEmail(a?.email || a?.Email);
  const name = cleanString(a?.name || a?.Name) || "-";
  const createdAt =
    a?.createdAt ||
    a?.CreatedAt ||
    a?.created ||
    a?.Created ||
    a?.created_time ||
    a?.["Created time"] ||
    "";
  const title = cleanString(a?.title || a?.Title) || "Athlete";
  const id = String(
    a?.id || a?.Id || a?.recordId || email || name || Math.random().toString(36).slice(2)
  );

  return { id, raw: a, name, email, title, createdAt };
}

export function statusPillClass(athlete) {
  if (athlete?.email) return "bg-emerald-100 text-emerald-700 border-emerald-200";
  return "bg-gray-100 text-gray-600 border-gray-200";
}