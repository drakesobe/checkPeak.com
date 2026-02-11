// components/org/trainers/utils/session.js
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

export function getOrgNameFromUser(user, role) {
  const guess =
    user?.OrgName ||
    user?.["Organization Name"] ||
    user?.OrganizationName ||
    user?.organizationName ||
    user?.Organization ||
    (role === "organization" ? (user?.Name || user?.name) : "") ||
    "Organization";
  return String(guess || "Organization");
}
