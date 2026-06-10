// pages/api/org/members/remove.js
// DELETE — removes a member from the org.

import { requireOrgSideUser } from "@/lib/requireUser";
import { removeMember } from "@/lib/supabaseOrg";
import { supabaseAdmin as db } from "@/lib/supabase";

function roleOf(user) { return String(user?.role || "").trim().toLowerCase(); }
function canManage(role) { return role === "organization" || role === "admin"; }

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "DELETE" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  if (!canManage(roleOf(user))) {
    return res.status(403).json({ error: "Only Organization or Admin can remove members." });
  }

  const orgToken  = String(user.orgToken || user.Token || "").trim();
  const memberId  = String(req.body?.memberId || req.query?.memberId || "").trim();

  if (!memberId) return res.status(400).json({ error: "memberId is required" });

  try {
    // Verify the member belongs to this org before deleting
    const { data: member } = await db
      .from("org_members")
      .select("id, org_token, role, email")
      .eq("id", memberId)
      .maybeSingle();

    if (!member) return res.status(404).json({ error: "Member not found." });
    if (member.org_token !== orgToken) return res.status(403).json({ error: "Access denied." });

    // Protect org owner from removing themselves
    const myEmail = String(user.email || user.Email || "").toLowerCase();
    if (member.email?.toLowerCase() === myEmail && roleOf(user) !== "organization") {
      return res.status(403).json({ error: "You cannot remove yourself." });
    }

    const { error } = await removeMember(memberId);
    if (error) return res.status(500).json({ error: "Failed to remove member.", details: error.message });

    return res.status(200).json({ ok: true, removed: memberId });
  } catch (err) {
    console.error("[members/remove]", err);
    return res.status(500).json({ error: "Failed to remove member.", details: err?.message });
  }
}
