// lib/requireAthlete.js

export function requireAthlete(req) {
  const raw = req.cookies?.user;
  if (!raw) return { ok: false, error: "Not authenticated" };

  let user;
  try {
    user = JSON.parse(decodeURIComponent(raw));
  } catch {
    return { ok: false, error: "Invalid auth cookie" };
  }

  const role = String(user?.role || user?.Role || "").toLowerCase();
  if (!role.includes("athlete")) {
    return { ok: false, error: "Athlete access required" };
  }

  const email = (user?.Email || user?.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Athlete email missing" };
  }

  return {
    ok: true,
    athlete: {
      id: user?.id || null,
      name: user?.Name || user?.name || "Athlete",
      email,
    },
  };
}
