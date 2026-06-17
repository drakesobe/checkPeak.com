// pages/api/athlete/connectOrg.js
// POST { token, email? } - athlete connects to org by entering the org token code.
// Updates athlete.org_token in Supabase.

import { supabaseAdmin as db } from "@/lib/supabase";

function escapeRegex(str = "") { return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function normalizeEmail(email) { return String(email || "").trim().toLowerCase(); }
function normalizeToken(token) { return String(token || "").trim(); }

function parseCookieHeader(cookieHeader = "") {
  return cookieHeader.split(";").reduce((acc, part) => {
    const [k, ...v] = part.trim().split("=");
    if (!k) return acc;
    acc[k] = decodeURIComponent(v.join("="));
    return acc;
  }, {});
}

function safeJsonParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}

function readUserCookie(req) {
  let raw = req?.cookies?.user;
  if (!raw) {
    const header = req?.headers?.cookie || "";
    if (header) raw = parseCookieHeader(header).user;
  }
  if (!raw || typeof raw !== "string") return null;
  const decoded = raw.includes("%7B") || raw.includes("%22") ? decodeURIComponent(raw) : raw;
  return safeJsonParse(decoded);
}

function setUserCookie(res, sessionUser) {
  const value = encodeURIComponent(JSON.stringify(sessionUser));
  const isProd = process.env.NODE_ENV === "production";
  const parts = [`user=${value}`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=604800"];
  if (isProd) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const sessionUser = readUserCookie(req);
    const { token, email } = req.body || {};
    const cleanToken = normalizeToken(token);

    const cookieEmail = normalizeEmail(sessionUser?.Email || sessionUser?.email || "");
    const cleanEmail  = cookieEmail || normalizeEmail(email);

    if (!cleanToken) {
      return res.status(400).json({ error: "Organization code is required." });
    }
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return res.status(400).json({
        error: "Valid email is required. Please log out and log back in, then try again.",
      });
    }

    if (sessionUser?.role || sessionUser?.Role) {
      const r = String(sessionUser.role || sessionUser.Role || "").trim().toLowerCase();
      if (r && r !== "athlete" && !r.includes("ath")) {
        return res.status(403).json({ error: "Only athletes can connect an organization." });
      }
    }

    // 1) Find org by token (case-insensitive)
    const { data: org, error: orgErr } = await db
      .from("organizations")
      .select("id, name, token")
      .ilike("token", cleanToken)
      .maybeSingle();

    if (orgErr) throw orgErr;
    if (!org) return res.status(404).json({ error: "Invalid organization code." });

    // 2) Find athlete by email
    const { data: athlete, error: athErr } = await db
      .from("athletes")
      .select("id, email, athlete_token")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (athErr) throw athErr;
    if (!athlete) return res.status(404).json({ error: "Athlete not found." });

    // 3) Update athlete's org_token
    const { error: updateErr } = await db
      .from("athletes")
      .update({ org_token: org.token })
      .eq("id", athlete.id);

    if (updateErr) throw updateErr;

    // 4) Update cookie to include org info (best-effort)
    try {
      if (sessionUser && cleanEmail === cookieEmail) {
        const nextSession = {
          ...sessionUser,
          OrgName:          org.name,
          OrganizationName: org.name,
          organizationName: org.name,
          Token:            org.token,
          token:            org.token,
        };
        Object.keys(nextSession).forEach(k => {
          if (nextSession[k] === "" || nextSession[k] == null) delete nextSession[k];
        });
        setUserCookie(res, nextSession);
      }
    } catch (e) {
      console.warn("[connectOrg] cookie update failed (non-fatal):", e?.message || e);
    }

    return res.status(200).json({
      ok: true,
      athlete:      { id: athlete.id, email: cleanEmail },
      organization: { id: org.id, name: org.name, token: org.token },
    });
  } catch (err) {
    console.error("[connectOrg] error:", err);
    return res.status(500).json({ error: "Failed to connect organization", detail: err?.message });
  }
}
