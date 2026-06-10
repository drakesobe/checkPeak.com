// pages/api/org/members/finishSetup.js
// Activates an invited org member — sets their name + password via invite token.
// POST { inviteToken, name, password }

import { getMemberByInviteToken, activateMember } from "@/lib/supabaseOrg";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { inviteToken, name, password } = req.body || {};

  if (!inviteToken) return res.status(400).json({ error: "inviteToken is required." });
  if (!name)        return res.status(400).json({ error: "name is required." });
  if (!password)    return res.status(400).json({ error: "password is required." });

  try {
    const { data: member } = await getMemberByInviteToken(String(inviteToken).trim());
    if (!member) return res.status(404).json({ error: "Invite not found or already used." });

    if (member.invite_expires_at && new Date(member.invite_expires_at) < new Date()) {
      return res.status(410).json({ error: "Invite link has expired. Ask your org admin to resend." });
    }

    const { data, error } = await activateMember(member.id, { name, password });
    if (error) return res.status(500).json({ error: "Failed to activate account.", details: error.message });

    return res.status(200).json({
      ok:       true,
      memberId: data.id,
      email:    data.email,
      role:     data.role,
      orgToken: data.org_token,
    });
  } catch (err) {
    console.error("[members/finishSetup]", err);
    return res.status(500).json({ error: "Failed to activate account.", details: err?.message });
  }
}
