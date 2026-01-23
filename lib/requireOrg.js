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
//   memberId: <OrgMembers record id>         (trainer/admin only)
//   Token: <Organizations.Token>             (optional legacy)
//
// This helper returns:
//   {
//     ok: true,
//     org: { id, name, email, token },
//     user: { ...cookieUser, role, memberId, orgId },
//     auth: { mode: "cookie" | "token" }
//   }
//
// org.id is always the Organizations record id (orgId) when cookie-auth is used.
// token is retained for legacy endpoints.
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
 * opts:
 * - allowTokenFallback: boolean (default true) — legacy support for bearer/x-org-token/query token
 */
export function requireOrg(req, opts = {}) {
  const allowTokenFallback = opts?.allowTokenFallback !== false;

  // --- optional token fallback (legacy support) ---
  const authHeader = String(req?.headers?.authorization || "");
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";

  const xOrgToken = String(req?.headers?.["x-org-token"] || "").trim();
  const qToken = String(req?.query?.token || "").trim();

  // 1) Cookie-based auth (preferred)
  let raw = req?.cookies?.user;

  if (!raw) {
    const header = req?.headers?.cookie || "";
    if (header) {
      const cookies = parseCookieHeader(header);
      raw = cookies.user;
    }
  }

  // 2) If cookie missing, optionally fall back to token-based auth
  if (!raw) {
    if (!allowTokenFallback) {
      return { ok: false, error: "Not authenticated" };
    }

    const token = bearer || xOrgToken || qToken;
    if (!token) return { ok: false, error: "Not authenticated" };

    return {
      ok: true,
      org: {
        id: "", // unknown without cookie
        name: "Organization",
        email: "",
        token,
      },
      user: null,
      auth: { mode: "token", legacy: true },
    };
  }

  // Some environments double-encode cookies; handle both.
  const decoded =
    typeof raw === "string"
      ? raw.includes("%7B") || raw.includes("%22")
        ? decodeURIComponent(raw)
        : raw
      : "";

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

  // memberId for trainers/admins
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
      // ✅ Primary scope key for org-side APIs:
      id: orgId || "",
      name,
      email,
      // ✅ token retained for legacy endpoints
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
