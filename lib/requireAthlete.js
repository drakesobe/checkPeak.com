// lib/requireAthlete.js
//
// ✅ Athlete-side auth (cookie session)
//
// Cookie may contain:
//   role: "Athlete"
//   Email/email
//   athleteId: <AthleteScans record id>   (recommended)
//   AthleteToken: ATH-XXXX                (REQUIRED for token-based matching)
//
// Returns:
//   {
//     ok: true,
//     athlete: { id, name, email, AthleteToken },
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

function asEmail(v) {
  const email = String(v || "").trim().toLowerCase();
  return email.includes("@") ? email : "";
}

function asAthleteToken(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  // Reject ORG- tokens (org session accidentally used as athlete)
  if (/^ORG-/i.test(s)) return "";
  return s;
}

export function requireAthlete(req) {
  // 1) Cookie-based auth
  let raw = req?.query?._authUser || req?.cookies?.user;

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

  const email = asEmail(userRaw.Email || userRaw.email);
  if (!email) return { ok: false, error: "Athlete email missing" };

  // ✅ prefer athleteId for linked field filtering; fallback to legacy id
  const athleteId = String(
    userRaw.athleteId ||
      userRaw.AthleteId ||
      userRaw.athleteRecordId ||
      userRaw.id || // legacy fallback
      ""
  ).trim();

  const name = String(userRaw.Name || userRaw.name || "").trim() || "Athlete";

  // Mobile stores athlete_token (snake_case from login response body);
  // web cookie uses AthleteToken (PascalCase from toSessionUser). Accept all.
  const athleteToken = asAthleteToken(
    userRaw.AthleteToken || userRaw.athleteToken || userRaw.athlete_token
  );

  return {
    ok: true,
    athlete: {
      id: athleteId || null,
      name,
      email,
      AthleteToken: athleteToken || null,
    },
    user: {
      ...userRaw,
      role,
      email,
      Email: userRaw.Email || email,
      // ✅ normalize AthleteToken in returned user too
      AthleteToken: athleteToken || undefined,
    },
    auth: { mode: "cookie" },
  };
}
