// lib/requireOrg.js

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

export function requireOrg(req) {
  // --- NEW: allow token via headers/query as fallback ---
  const authHeader = String(req?.headers?.authorization || "");
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";

  const xOrgToken = String(req?.headers?.["x-org-token"] || "").trim();
  const qToken = String(req?.query?.token || "").trim();

  // 1) Try cookie-based auth (your current behavior)
  let raw = req?.cookies?.user;

  if (!raw) {
    const header = req?.headers?.cookie || "";
    if (header) {
      const cookies = parseCookieHeader(header);
      raw = cookies.user;
    }
  }

  // If cookie missing, fall back to token-based auth
  if (!raw) {
    const token = bearer || xOrgToken || qToken;
    if (!token) return { ok: false, error: "Not authenticated" };

    return {
      ok: true,
      org: {
        id: "",
        name: "Organization",
        email: "",
        token: token,
      },
    };
  }

  const decoded =
    typeof raw === "string"
      ? raw.includes("%7B") || raw.includes("%22")
        ? decodeURIComponent(raw)
        : raw
      : "";

  const user = safeJsonParse(decoded);
  if (!user) return { ok: false, error: "Invalid auth cookie" };

  const role = String(user.role || user.Role || "").toLowerCase();
  if (!role.includes("org")) {
    return { ok: false, error: "Organization access required" };
  }

  const orgToken =
    user.Token ||
    user.token ||
    user["Organization Token"] ||
    "";

  if (!orgToken) return { ok: false, error: "Organization token missing" };

  return {
    ok: true,
    org: {
      id: user.id,
      name: user.OrgName || user.Organization || user.Name || "Organization",
      email: user.Email || user.email || "",
      token: String(orgToken).trim(),
    },
  };
}
