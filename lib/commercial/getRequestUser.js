// lib/commercial/getRequestUser.js
// Reads from _authUser query param (mobile) or HttpOnly cookie (web).

export function getRequestUser(req) {
  // Mobile: _authUser in query string (Next.js already URL-decodes req.query values)
  // or _authUser in POST body (sent as JSON string, needs decodeURIComponent)
  try {
    const qRaw = req.query?._authUser;
    if (qRaw) return JSON.parse(String(qRaw));
  } catch {}
  try {
    const bRaw = req.body?._authUser;
    if (bRaw) return JSON.parse(decodeURIComponent(String(bRaw)));
  } catch {}

  // Web: HttpOnly cookie
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