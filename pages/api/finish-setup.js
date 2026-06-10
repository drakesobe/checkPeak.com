// pages/api/finish-setup.js
// Sets a password for athletes or org members who were invited / are finishing setup.
// Replaces Airtable-based version; reads/writes Supabase only.

import { hashPassword, normalizeEmail, getAthleteByEmail, getMemberByInviteToken } from "@/lib/supabaseOrg";
import { supabaseAdmin as db } from "@/lib/supabase";

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase() === "organization" ? "organization" : "athlete";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, password, role, inviteToken } = req.body || {};

  if (!password) return res.status(400).json({ error: "Password is required." });

  const roleNorm   = normalizeRole(role);
  const emailLower = normalizeEmail(email || "");

  try {
    const password_hash = await hashPassword(password);

    // ── Org member invite flow ──────────────────────────────────
    if (inviteToken) {
      const { data: member } = await getMemberByInviteToken(String(inviteToken).trim());
      if (!member) return res.status(404).json({ error: "Invite not found or already used." });

      const now = new Date();
      if (member.invite_expires_at && new Date(member.invite_expires_at) < now) {
        return res.status(410).json({ error: "Invite link has expired. Ask your org to resend." });
      }

      const { error } = await db
        .from("org_members")
        .update({
          password_hash,
          active:           true,
          invite_token:     null,
          invite_expires_at: null,
          ...(email ? { email: normalizeEmail(email) } : {}),
        })
        .eq("id", member.id);

      if (error) {
        console.error("[finish-setup] member update:", error);
        return res.status(500).json({ error: "Failed to activate member account." });
      }

      return res.status(200).json({ ok: true, role: member.role });
    }

    // ── Athlete setup flow ──────────────────────────────────────
    if (roleNorm === "athlete") {
      if (!emailLower) return res.status(400).json({ error: "Email is required." });

      const { data: athlete } = await getAthleteByEmail(emailLower);
      if (!athlete) return res.status(404).json({ error: "Athlete not found." });

      const { error } = await db
        .from("athletes")
        .update({ password_hash })
        .eq("id", athlete.id);

      if (error) {
        console.error("[finish-setup] athlete update:", error);
        return res.status(500).json({ error: "Failed to set password." });
      }

      return res.status(200).json({ ok: true });
    }

    // ── Org owner setup flow ────────────────────────────────────
    if (!emailLower) return res.status(400).json({ error: "Email is required." });

    const { data: org, error: orgErr } = await db
      .from("organizations")
      .select("id")
      .eq("email", emailLower)
      .maybeSingle();

    if (orgErr || !org) return res.status(404).json({ error: "Organization not found." });

    const { error } = await db
      .from("organizations")
      .update({ password_hash })
      .eq("id", org.id);

    if (error) {
      console.error("[finish-setup] org update:", error);
      return res.status(500).json({ error: "Failed to set password." });
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error("[finish-setup]", err);
    return res.status(500).json({ error: "Setup failed.", details: err?.message });
  }
}
