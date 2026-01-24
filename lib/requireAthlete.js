// lib/requireAthlete.js
//
// ✅ Athlete-side auth (cookie session)
// Cookie may contain:
//   role: "Athlete"
//   Email/email
//   athleteId: <AthleteScans record id>   (recommended)
//   id: <legacy athlete id>              (fallback)
//
// Returns:
//   {
//     ok: true,
//     athlete: { id, name, email },
//     user: { ...cookieUser, role, email },
//     auth: { mode: "cookie" }
//   }

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
  if (r === "athlete") return "athlete";
  if (r.includes("ath")) return "athlete";
  return r;
}

export function requireAthlete(req) {
  // 1) Cookie-based auth
  let raw = req?.cookies?.user;

  if (!raw) {
    const header = req?.headers?.cookie || "";
    if (header) {
      const cookies = parseCookieHeader(header);
      raw = cookies.user;
    }
  }

  if (!raw) return { ok: false, error: "Not authenticated" };

  // Handle potential double-encoding like requireOrg
  const decoded =
    typeof raw === "string"
      ? raw.includes("%7B") || raw.includes("%22")
        ? decodeURIComponent(raw)
        : raw
      : "";

  const userRaw = safeJsonParse(decoded);
  if (!userRaw) return { ok: false, error: "Invalid auth cookie" };

  const role = normalizeRole(userRaw.role || userRaw.Role);
  if (role !== "athlete") {
    return { ok: false, error: "Athlete access required" };
  }

  const email = String(userRaw.Email || userRaw.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Athlete email missing" };
  }

  // ✅ prefer athleteId for linked field filtering; fallback to legacy id
  const athleteId = String(
    userRaw.athleteId ||
      userRaw.AthleteId ||
      userRaw.athleteRecordId ||
      userRaw.id || // legacy fallback
      ""
  ).trim();

  const name = String(userRaw.Name || userRaw.name || "").trim() || "Athlete";

  return {
    ok: true,
    athlete: {
      id: athleteId || null,
      name,
      email,
    },
    user: {
      ...userRaw,
      role,
      email,
      Email: userRaw.Email || email,
    },
    auth: { mode: "cookie" },
  };
}
