// lib/requireOrg.js
//
// ✅ Multi-user org-side auth:
// - Organization (primary org account)
// - Admin (OrgMembers)
// - Trainer (OrgMembers)
//
// Cookie may contain:
//   role: "Organization" | "Admin" | "Trainer" | "Athlete"
//   orgId: <Organizations record id>         (org-side only)
//   memberId: <OrgMembers record id>         (trainer/admin/owner only)
//   Token: <Organizations.Token>             (optional legacy)
//
// This helper returns:
//   {
//     ok: true,
//     org: { id, name, email, token },
//     user: { ...cookieUser, role, memberId, orgId },
//     auth: { mode: "cookie" }
//   }
//

function parseCookieHeader(cookieHeader = "") {
  return cookieHeader.split(";").reduce((acc, part) => {
    const [k, ...v] = part.trim().split("=");
    if (!k) return acc;
    acc[k] = decodeURIComponent(v.join("="));
    return acc;
  }, {});
}

function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function normalizeRole(raw) {
  const r = String(raw || "").trim().toLowerCase();
  if (!r) return "";
  if (r === "organization" || r === "org") return "organization";
  if (r === "admin") return "admin";
  if (r === "trainer") return "trainer";
  if (r === "athlete") return "athlete";
  if (r.includes("org")) return "organization";
  if (r.includes("admin")) return "admin";
  if (r.includes("train")) return "trainer";
  if (r.includes("ath")) return "athlete";
  return r;
}

/**
 * requireOrg(req, opts?)
 * opts: unused (kept for call-site compatibility)
 */
export function requireOrg(req, opts = {}) {
  // Team codes are shared with every athlete, so they are never accepted as proof of identity.
  // Sessions come from the signed "user" cookie (web) or _authUser (mobile); middleware rejects
  // any session whose signature does not match.
  let raw = req?.query?._authUser ?? req?.body?._authUser ?? req?.cookies?.user;
  if (!raw) {
    const header = req?.headers?.cookie || "";
    if (header) raw = parseCookieHeader(header).user;
  }
  if (!raw) return { ok: false, error: "Not authenticated" };

  // Robust decode: cookie may already be decoded by Next; may be URI encoded; may double-encode.
  let decoded = typeof raw === "string" ? raw : raw && typeof raw === "object" ? JSON.stringify(raw) : "";
  try {
    // If it looks encoded, decode it
    if (decoded.includes("%7B") || decoded.includes("%22") || decoded.includes("%3A")) {
      decoded = decodeURIComponent(decoded);
    }
  } catch {
    // ignore decode errors
  }

  const userRaw = safeJsonParse(decoded);
  if (!userRaw) return { ok: false, error: "Invalid auth cookie" };

  const role = normalizeRole(userRaw.role || userRaw.Role);
  const isOrgSide = ["organization", "admin", "trainer"].includes(role);
  if (!isOrgSide) return { ok: false, error: "Organization access required" };

  // Preferred org identifier (cookie-auth)
  const orgId = String(userRaw.orgId || userRaw.OrgId || "").trim();

  // Legacy org token
  const orgToken = String(
    userRaw.Token || userRaw.token || userRaw["Organization Token"] || ""
  ).trim();

  // memberId for trainers/admins/owner
  const memberId = String(userRaw.memberId || userRaw.MemberId || "").trim();

  // If neither orgId nor token exists, fail
  if (!orgId && !orgToken) {
    return { ok: false, error: "Organization session missing orgId/token" };
  }

  const email = String(userRaw.Email || userRaw.email || "").trim();
  const name =
    String(
      userRaw.OrgName ||
        userRaw["Organization Name"] ||
        userRaw.Organization ||
        userRaw.Name ||
        ""
    ).trim() || "Organization";

  return {
    ok: true,
    org: {
      id: orgId || "",
      name,
      email,
      token: orgToken || "",
    },
    user: {
      ...userRaw,
      role, // normalized: organization | admin | trainer
      orgId: orgId || "",
      memberId: memberId || "",
      email: email ? email.toLowerCase() : "",
      Email: email || userRaw.Email || "",
    },
    auth: { mode: "cookie" },
  };
}
