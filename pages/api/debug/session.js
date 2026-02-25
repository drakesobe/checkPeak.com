// pages/api/debug/session.js
import { readUserCookie } from "@/lib/requireUser";
import { requireUser } from "@/lib/requireUser";

function mask(v, keepStart = 4, keepEnd = 4) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (s.length <= keepStart + keepEnd) return "*".repeat(s.length);
  return `${s.slice(0, keepStart)}…${s.slice(-keepEnd)}`;
}

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  // ✅ raw cookie object (pre-normalization)
  const raw = readUserCookie(req);

  // ✅ normalized user object (post-normalization)
  const user = requireUser(req, res);
  if (!user) return;

  const rawKeys = raw && typeof raw === "object" ? Object.keys(raw).sort() : [];

  return res.status(200).json({
    ok: true,
    now: new Date().toISOString(),

    // Minimal identity
    role: user.role || null,
    email: user.email || null,

    // Org-side identity (masked)
    orgToken: user.orgToken ? mask(user.orgToken, 3, 6) : null,
    orgId: user.orgId ? mask(user.orgId, 3, 6) : null,
    memberId: user.memberId ? mask(user.memberId, 3, 6) : null,
    orgName: user.orgName || null,

    // Helpful diagnostics
    has: {
      orgToken: Boolean(user.orgToken),
      orgId: Boolean(user.orgId),
      memberId: Boolean(user.memberId),
    },

    // What the cookie looked like (keys only)
    rawCookieKeys: rawKeys,

    // Optional: show a *masked* snapshot of raw values you might care about
    rawCookieMasked: raw
      ? {
          Role: raw.Role ?? raw.role ?? null,
          Email: raw.Email ?? raw.email ?? null,
          orgToken: raw.orgToken ? mask(raw.orgToken, 3, 6) : null,
          Token: raw.Token ? mask(raw.Token, 3, 6) : null,
          token: raw.token ? mask(raw.token, 3, 6) : null,
          orgId: raw.orgId ? mask(raw.orgId, 3, 6) : null,
          OrgId: raw.OrgId ? mask(raw.OrgId, 3, 6) : null,
          memberId: raw.memberId ? mask(raw.memberId, 3, 6) : null,
        }
      : null,
  });
}