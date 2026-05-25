// lib/commercial/getRequestUser.js
// Reads the HttpOnly `user` cookie set by /api/lookupUser.
// Returns the parsed user object or null — no NextAuth needed.

export function getRequestUser(req) {
  try {
    const cookieHeader = req.headers.cookie || "";
    const match = cookieHeader
      .split(";")
      .find(c => c.trim().startsWith("user="));
    if (!match) return null;
    const raw = match.split("=").slice(1).join("=");
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
}