// pages/api/lookupUser.js
// Login endpoint for athletes, org owners, and org members.
// Reads from Supabase; sets an HttpOnly "user" cookie on success.

import bcrypt from "bcryptjs";
import {
  normalizeEmail,
  getAthleteByEmail,
  getOrgByEmail,
  getMemberByEmail,
  createMemberInvite,
} from "@/lib/supabaseOrg";

function normalizeRole(role) {
  const r = String(role || "").trim().toLowerCase();
  if (r === "organization" || r === "org" || r === "owner") return "organization";
  if (r === "admin") return "admin";
  if (r === "trainer") return "trainer";
  return "athlete";
}

function stripPassword(obj = {}) {
  const out = { ...obj };
  delete out.password_hash;
  delete out.Password;
  delete out.PasswordHash;
  return out;
}

function toSessionUser(user) {
  const rawRole = String(user?.role || "").trim();
  const roleLower = rawRole.toLowerCase();
  const role =
    roleLower === "admin"                                           ? "Admin"
    : roleLower === "trainer"                                       ? "Trainer"
    : roleLower === "organization" || roleLower.includes("org")     ? "Organization"
    : "Athlete";

  const session = {
    id:    user?.id    || "",
    role,
    Email: user?.email || user?.Email || "",
    Name:  user?.name  || user?.Name  || "",
  };

  if (role === "Athlete") {
    session.athleteId    = user?.id || "";
    session.AthleteToken = user?.athlete_token || "";
    if (user?.org_token)  session.Token   = user.org_token;
    if (user?.org_name)   session.OrgName = user.org_name;
  } else {
    session.Token    = user?.org_token  || user?.Token  || "";
    session.orgId    = user?.org_id     || user?.orgId  || "";
    session.memberId = user?.member_id  || user?.memberId || "";
    session.OrgName  = user?.org_name   || user?.OrgName  || "";
  }

  // Strip empty strings
  Object.keys(session).forEach(k => { if (session[k] === "" || session[k] == null) delete session[k]; });
  return session;
}

function setUserCookie(res, sessionUser) {
  const value  = encodeURIComponent(JSON.stringify(sessionUser));
  const isProd = process.env.NODE_ENV === "production";
  const parts  = [`user=${value}`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=604800"];
  if (isProd) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, password, role } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  const roleNorm   = normalizeRole(role);
  const emailLower = normalizeEmail(email);

  try {
    // ── Athlete login ────────────────────────────────────────────
    if (roleNorm === "athlete") {
      const { data: athlete, error } = await getAthleteByEmail(emailLower);
      if (error || !athlete) return res.status(404).json({ error: "User not found" });

      if (!athlete.password_hash) {
        return res.status(500).json({ error: "Athlete account has no password set. Use finish-setup." });
      }

      const match = await bcrypt.compare(String(password), athlete.password_hash);
      if (!match) return res.status(401).json({ error: "Invalid credentials" });

      let org_name = "";
      let org_id   = "";
      if (athlete.org_token) {
        const { supabaseAdmin } = await import("@/lib/supabase");
        const { data: org } = await supabaseAdmin
          .from("organizations")
          .select("id, name")
          .eq("token", athlete.org_token)
          .maybeSingle();
        org_name = org?.name || "";
        org_id   = org?.id   || "";
      }

      const userOut = {
        id:            athlete.id,
        role:          "Athlete",
        email:         athlete.email,
        Email:         athlete.email,
        name:          athlete.name  || "",
        Name:          athlete.name  || "",
        athlete_token: athlete.athlete_token,
        org_token:     athlete.org_token || "",
        org_id,
        org_name,
        sport:         athlete.sport || "",
      };

      setUserCookie(res, toSessionUser(userOut));
      return res.status(200).json({
        user: stripPassword(userOut),
        debug: { athleteTokenPresent: Boolean(athlete.athlete_token) },
      });
    }

    // ── Org owner login ──────────────────────────────────────────
    if (roleNorm !== "admin" && roleNorm !== "trainer") {
      const { data: org, error } = await getOrgByEmail(emailLower);
      if (!error && org) {
        if (!org.password_hash) return res.status(500).json({ error: "Organization missing password." });
        const match = await bcrypt.compare(String(password), org.password_hash);
        if (!match) return res.status(401).json({ error: "Invalid credentials" });

        const { supabaseAdmin } = await import("@/lib/supabase");
        const { generateOrgToken } = await import("@/lib/supabaseOrg");

        // Auto-fix missing/invalid token for migrated orgs (first login after migration)
        let resolvedToken = org.token;
        if (!resolvedToken || !resolvedToken.startsWith("ORG-")) {
          resolvedToken = generateOrgToken();
          await supabaseAdmin.from("organizations").update({ token: resolvedToken }).eq("id", org.id);
          org.token = resolvedToken;
        }

        // Ensure an org_members record exists for the owner
        let ownerMember = null;
        const { data: existing } = await supabaseAdmin
          .from("org_members")
          .select("id")
          .eq("org_token", org.token)
          .eq("email", emailLower)
          .maybeSingle();

        if (existing) {
          ownerMember = existing;
        } else {
          const { data: created } = await createMemberInvite({
            orgId: org.id, orgToken: org.token,
            email: emailLower, name: org.name, role: "admin",
          });
          ownerMember = created;
        }

        const userOut = {
          id:        org.id,
          role:      "Organization",
          email:     org.email,
          Email:     org.email,
          name:      org.name,
          Name:      org.name,
          org_token: org.token,
          Token:     org.token,
          org_id:    org.id,
          member_id: ownerMember?.id || null,
          org_name:  org.name,
        };

        setUserCookie(res, toSessionUser(userOut));
        return res.status(200).json({ user: stripPassword(userOut) });
      }
    }

    // ── Org member login (admin / trainer) ───────────────────────
    const { data: member, error: memErr } = await getMemberByEmail(emailLower);

    if (memErr || !member) return res.status(404).json({ error: "User not found" });
    if (!member.active)    return res.status(403).json({ error: "Account not yet activated. Check your invite email." });
    if (!member.password_hash) return res.status(500).json({ error: "Member account has no password. Use the invite link to set one." });

    const match = await bcrypt.compare(String(password), member.password_hash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    const org = member.organizations;
    const orgToken = org?.token || member.org_token || "";
    const orgName  = org?.name  || "";

    const outRole = member.role === "admin" ? "Admin" : "Trainer";

    const userOut = {
      id:        member.id,
      role:      outRole,
      email:     member.email,
      Email:     member.email,
      name:      member.name || outRole,
      Name:      member.name || outRole,
      org_token: orgToken,
      Token:     orgToken,
      org_id:    member.org_id || org?.id || "",
      member_id: member.id,
      org_name:  orgName,
    };

    setUserCookie(res, toSessionUser(userOut));
    return res.status(200).json({ user: stripPassword(userOut) });

  } catch (err) {
    console.error("[lookupUser]", err);
    return res.status(500).json({ error: "Login failed", details: err?.message });
  }
}
