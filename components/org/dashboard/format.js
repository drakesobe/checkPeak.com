// components/org/workouts-calendar/format.js
export function fmtDate(v) {
  if (!v) return "—";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return String(v);
  }
}

export function normalizeRole(rawRole) {
  const r = String(rawRole || "").trim().toLowerCase();
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

export function getOrgName(user, role) {
  const guess =
    user?.OrgName ||
    user?.["Organization Name"] ||
    user?.OrganizationName ||
    user?.organizationName ||
    user?.Organization ||
    (role === "organization" ? user?.Name || user?.name : "") ||
    "Organization";

  return String(guess || "Organization");
}
