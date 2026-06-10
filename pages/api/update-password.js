// pages/api/update-password.js
// Updates the password for the currently logged-in athlete or org member.

import bcrypt from "bcryptjs";
import { hashPassword, normalizeEmail, getAthleteByEmail } from "@/lib/supabaseOrg";
import { supabaseAdmin as db } from "@/lib/supabase";
import { readUserCookie } from "@/lib/requireUser";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = readUserCookie(req);
  if (!user?.email) return res.status(401).json({ error: "Not authenticated" });

  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "currentPassword and newPassword are required." });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters." });
  }

  const emailLower = normalizeEmail(user.email);
  const roleLower  = String(user.role || user.Role || "").toLowerCase();

  try {
    const new_hash = await hashPassword(newPassword);

    if (roleLower === "athlete") {
      const { data: athlete } = await getAthleteByEmail(emailLower);
      if (!athlete) return res.status(404).json({ error: "Athlete not found." });

      const match = await bcrypt.compare(String(currentPassword), athlete.password_hash || "");
      if (!match) return res.status(401).json({ error: "Current password is incorrect." });

      const { error } = await db.from("athletes").update({ password_hash: new_hash }).eq("id", athlete.id);
      if (error) return res.status(500).json({ error: "Failed to update password." });
    } else {
      const { data: member } = await db
        .from("org_members")
        .select("id, password_hash")
        .eq("email", emailLower)
        .maybeSingle();

      if (member) {
        const match = await bcrypt.compare(String(currentPassword), member.password_hash || "");
        if (!match) return res.status(401).json({ error: "Current password is incorrect." });
        const { error } = await db.from("org_members").update({ password_hash: new_hash }).eq("id", member.id);
        if (error) return res.status(500).json({ error: "Failed to update password." });
      } else {
        const { data: org } = await db
          .from("organizations")
          .select("id, password_hash")
          .eq("email", emailLower)
          .maybeSingle();
        if (!org) return res.status(404).json({ error: "Account not found." });
        const match = await bcrypt.compare(String(currentPassword), org.password_hash || "");
        if (!match) return res.status(401).json({ error: "Current password is incorrect." });
        const { error } = await db.from("organizations").update({ password_hash: new_hash }).eq("id", org.id);
        if (error) return res.status(500).json({ error: "Failed to update password." });
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[update-password]", err);
    return res.status(500).json({ error: "Failed to update password.", details: err?.message });
  }
}
