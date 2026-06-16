// lib/requireUser.js
// Reads HttpOnly cookie "user" set by /api/lookupUser and returns parsed user object.
// Normalizes: Email/email, Role/role, plus org/member identity helpers.
//
// ✅ Updates:
// - Strict role normalization (organization | admin | trainer | athlete)
// - Adds org identity normalization: orgId, orgName, orgToken, memberId
// - Adds simple permission helpers (layering: Org > Admin/Head Trainer > Trainer)
// - Adds requireOrgAdminish + requireOrgOwner (optional but useful)

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

// Mobile clients (Expo RN) cannot set HttpOnly cookies, so they pass the
// session as _authUser in the query string (GET) or request body (POST/PUT).
// This helper checks both before falling back to the cookie.
export function readUserFromRequest(req) {
  const raw = req?.query?._authUser ?? req?.body?._authUser;
  if (raw) {
    try { return JSON.parse(decodeURIComponent(String(raw))); } catch {}
  }
  return readUserCookie(req);
}

function normalizeRole(raw) {
  const r = String(raw || "").trim().toLowerCase();
  if (!r) return "";

  // Prefer exact matches first
  if (r === "organization" || r === "org" || r === "owner") return "organization";
  if (r === "admin" || r === "head trainer" || r === "head_trainer") return "admin";
  if (r === "trainer" || r === "coach") return "trainer";
  if (r === "athlete") return "athlete";

  // Then do safe includes-based fallback
  if (r.includes("org")) return "organization";
  if (r.includes("admin")) return "admin";
  if (r.includes("train") || r.includes("coach")) return "trainer";
  if (r.includes("ath")) return "athlete";

  return r;
}

function pickFirst(...vals) {
  for (const v of vals) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return "";
}

function normalizeSessionUser(u) {
  if (!u || typeof u !== "object") return null;

  // Email
  const EmailRaw = pickFirst(u.Email, u.email);
  const email = String(EmailRaw || "").trim().toLowerCase();

  // Role
  const RoleRaw = pickFirst(u.role, u.Role);
  const role = normalizeRole(RoleRaw);

  // Org identity (support multiple cookie shapes)
  const orgId = pickFirst(u.orgId, u.OrgId, u.org?.id, u.org?.Id);
  const orgToken = pickFirst(u.orgToken, u.Token, u.token, u.org?.token, u.org?.Token);
  const orgName = pickFirst(
    u.orgName,
    u.OrgName,
    u.organizationName,
    u.OrganizationName,
    u["Organization Name"],
    u.org?.name,
    u.org?.Name
  );

  // Member identity (OrgMembers record id)
  const memberId = pickFirst(u.memberId, u.MemberId, u.orgMemberId, u.OrgMemberId);

  return {
    ...u,

    // normalized email fields
    Email: EmailRaw,
    email,

    // normalized role fields
    Role: pickFirst(u.Role, u.role),
    role, // athlete | organization | admin | trainer

    // normalized org identity (used by org-side endpoints)
    orgId,
    orgToken,
    orgName,

    // normalized org member id (used for self-protection, auditing)
    memberId,
  };
}

export function requireUser(req, res) {
  const userRaw = readUserFromRequest(req);
  const user = normalizeSessionUser(userRaw);

  if (!user?.email || !user.email.includes("@")) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return user;
}

/** Org-side: organization owner OR org members (admin/head trainer, trainer) */
export function requireOrgSideUser(req, res) {
  const user = requireUser(req, res);
  if (!user) return null;

  if (!["organization", "admin", "trainer"].includes(user.role)) {
    res.status(403).json({ error: "Not authorized" });
    return null;
  }

  // NOTE:
  // - orgId + orgToken SHOULD exist for org-side logins.
  // - But legacy cookies might miss them; endpoints can return helpful 400s.
  return user;
}

/** Org-side "adminish": organization OR admin (head trainer) */
export function requireOrgAdminish(req, res) {
  const user = requireOrgSideUser(req, res);
  if (!user) return null;

  if (!["organization", "admin"].includes(user.role)) {
    res.status(403).json({ error: "Only Organization/Admin allowed" });
    return null;
  }
  return user;
}

/** Org owner only */
export function requireOrgOwner(req, res) {
  const user = requireOrgSideUser(req, res);
  if (!user) return null;

  if (user.role !== "organization") {
    res.status(403).json({ error: "Only Organization allowed" });
    return null;
  }
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

/**
 * Permission helpers (optional sugar)
 * Use these in API handlers to enforce layers:
 * - Organization > Admin (Head Trainer) > Trainer
 */
export function canManageMembers(user) {
  const role = String(user?.role || "").toLowerCase();
  return role === "organization" || role === "admin";
}

// Only org owner can create/promote other admins (recommended safest default)
export function canManageAdmins(user) {
  const role = String(user?.role || "").toLowerCase();
  return role === "organization";
}

export function canInviteRole(user, targetRole) {
  const me = String(user?.role || "").toLowerCase();
  const next = String(targetRole || "").toLowerCase();

  if (!["trainer", "admin"].includes(next)) return false;

  // org owner can invite trainer or admin
  if (me === "organization") return true;

  // admin/head trainer can invite trainers only
  if (me === "admin") return next === "trainer";

  return false;
}
