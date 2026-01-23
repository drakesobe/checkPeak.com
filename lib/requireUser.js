// lib/requireUser.js
// Reads HttpOnly cookie "user" set by /api/lookupUser and returns parsed user object.
// Normalizes: Email/email, Role/role, and role casing.

export function getCookie(req, name) {
  const cookieHeader = req?.headers?.cookie || "";
  const parts = cookieHeader.split(";").map((p) => p.trim());
  const found = parts.find((p) => p.startsWith(`${name}=`));
  if (!found) return null;
  const raw = found.slice(name.length + 1);
  return decodeURIComponent(raw);
}

export function readUserCookie(req) {
  const raw = getCookie(req, "user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeRole(raw) {
  const r = String(raw || "").trim().toLowerCase();
  if (!r) return "";
  if (r.includes("org")) return "organization";
  if (r === "trainer") return "trainer";
  if (r === "admin") return "admin";
  if (r.includes("ath")) return "athlete";
  return r;
}

function normalizeSessionUser(u) {
  if (!u || typeof u !== "object") return null;

  const Email = u.Email || u.email || "";
  const RoleRaw = u.role || u.Role || "";
  const role = normalizeRole(RoleRaw);

  return {
    ...u,
    Email,
    email: String(Email || "").trim().toLowerCase(), // helper for server checks
    Role: u.Role || u.role || "",
    role, // normalized role: athlete | organization | trainer | admin
  };
}

export function requireUser(req, res) {
  const userRaw = readUserCookie(req);
  const user = normalizeSessionUser(userRaw);

  if (!user?.email || !user.email.includes("@")) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return user;
}

export function requireOrgSideUser(req, res) {
  const user = requireUser(req, res);
  if (!user) return null;

  // organization (primary org account), admin, trainer
  if (!["organization", "admin", "trainer"].includes(user.role)) {
    res.status(403).json({ error: "Not authorized" });
    return null;
  }

  // Note:
  // - orgId + Token should exist for org-side logins (org owner or orgMember).
  // - memberId should exist for trainers/admins and (after our lookupUser update) org owners too.
  return user;
}

export function requireAthleteUser(req, res) {
  const user = requireUser(req, res);
  if (!user) return null;

  if (user.role !== "athlete") {
    res.status(403).json({ error: "Not authorized" });
    return null;
  }
  return user;
}
