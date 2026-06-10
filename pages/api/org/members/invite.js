// pages/api/org/members/invite.js
// Invites a new team member (trainer/admin) to the org.

import crypto from "crypto";
import { requireOrgSideUser } from "@/lib/requireUser";
import { createMemberInvite, normalizeEmail } from "@/lib/supabaseOrg";
import { supabaseAdmin as db } from "@/lib/supabase";

function roleOf(user) { return String(user?.role || "").trim().toLowerCase(); }
function canInvite(role) { return role === "organization" || role === "admin"; }

function originFromReq(req) {
  const proto = req.headers["x-forwarded-proto"];
  const host  = req.headers["x-forwarded-host"] || req.headers.host;
  if (proto && host) return `${proto}://${host}`;
  return `http://${host}`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  if (!canInvite(roleOf(user))) {
    return res.status(403).json({ error: "Only Organization or Admin can invite members." });
  }

  const { email, name, role = "trainer" } = req.body || {};
  if (!email) return res.status(400).json({ error: "email is required" });

  const normalRole = String(role).toLowerCase() === "admin" ? "admin" : "trainer";
  const emailNorm  = normalizeEmail(email);
  const orgToken   = String(user.orgToken || user.Token || "").trim();

  if (!orgToken) return res.status(400).json({ error: "Missing org token on session." });

  // Resolve org_id
  const { data: org } = await db
    .from("organizations")
    .select("id")
    .eq("token", orgToken)
    .maybeSingle();

  if (!org) return res.status(400).json({ error: "Organization not found for this session." });

  try {
    const { data: member, error, invite_token } = await createMemberInvite({
      orgId:    org.id,
      orgToken,
      email:    emailNorm,
      name:     name || "",
      role:     normalRole,
    });

    if (error) {
      console.error("[members/invite]", error);
      return res.status(500).json({ error: "Failed to create invite.", details: error.message });
    }

    const origin   = originFromReq(req);
    const setupUrl = `${origin}/finish-setup?token=${invite_token}&email=${encodeURIComponent(emailNorm)}&org=${encodeURIComponent(user.OrgName || orgToken)}&role=${normalRole}`;

    return res.status(200).json({
      ok:       true,
      memberId: member.id,
      email:    emailNorm,
      role:     normalRole,
      setupUrl,
    });
  } catch (err) {
    console.error("[members/invite]", err);
    return res.status(500).json({ error: "Failed to create invite.", details: err?.message });
  }
}
