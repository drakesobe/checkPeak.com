// lib/requireBillingAdmin.js
import { requireOrgSideUser } from "@/lib/requireUser";

function normalizeRole(rawRole) {
  const r = String(rawRole || "").trim().toLowerCase();
  if (r.includes("organization") || r === "org") return "organization";
  if (r.includes("admin")) return "admin";
  if (r.includes("trainer")) return "trainer";
  return r;
}

export function requireBillingAdmin(req, res) {
  const user = requireOrgSideUser(req, res);
  if (!user) return null;

  const role = normalizeRole(user?.role || user?.Role);
  const ok = role === "admin" || role === "organization";
  if (!ok) {
    res.status(403).json({ error: "Billing is restricted to Admins and Organization owners." });
    return null;
  }
  return user;
}
