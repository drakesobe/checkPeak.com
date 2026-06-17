// pages/api/org/members/update.js
// PATCH - updates a member's role, name, or active status.

import { requireOrgSideUser } from "@/lib/requireUser";
import { updateMember } from "@/lib/supabaseOrg";
import { supabaseAdmin as db } from "@/lib/supabase";

function roleOf(user) { return String(user?.role || "").trim().toLowerCase(); }
function canManage(role) { return role === "organization" || role === "admin"; }

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST" && req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  if (!canManage(roleOf(user))) {
    return res.status(403).json({ error: "Only Organization or Admin can update members." });
  }

  const orgToken = String(user.orgToken || user.Token || "").trim();
  const { memberId, role, active, name } = req.body || {};

  if (!memberId) return res.status(400).json({ error: "memberId is required" });

  try {
    const { data: member } = await db
      .from("org_members")
      .select("id, org_token, role")
      .eq("id", String(memberId).trim())
      .maybeSingle();

    if (!member) return res.status(404).json({ error: "Member not found." });
    if (member.org_token !== orgToken) return res.status(403).json({ error: "Access denied." });

    const fields = {};
    if (name   !== undefined) fields.name   = String(name).trim();
    if (active !== undefined) fields.active = Boolean(active);
    if (role   !== undefined) {
      const normalRole = String(role).toLowerCase() === "admin" ? "admin" : "trainer";
      if (normalRole === "admin" && roleOf(user) !== "organization") {
        return res.status(403).json({ error: "Only Organization owner can set Admin role." });
      }
      fields.role = normalRole;
    }

    if (Object.keys(fields).length === 0) return res.status(400).json({ error: "No fields to update." });

    const { data, error } = await updateMember(String(memberId).trim(), fields);
    if (error) return res.status(500).json({ error: "Failed to update member.", details: error.message });

    return res.status(200).json({ ok: true, member: data });
  } catch (err) {
    console.error("[members/update]", err);
    return res.status(500).json({ error: "Failed to update member.", details: err?.message });
  }
}
