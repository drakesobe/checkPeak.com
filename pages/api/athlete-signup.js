// pages/api/athlete-signup.js
// Creates a new athlete account in Supabase.
// Optionally links to an org via org token.

import { createAthlete, getAthleteByEmail, getOrgByToken, normalizeEmail, hashPassword } from "@/lib/supabaseOrg";
import { supabaseAdmin as db } from "@/lib/supabase";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { token, name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }

  try {
    const emailLower = normalizeEmail(email);

    // 1) Prevent duplicate email
    const { data: existing } = await getAthleteByEmail(emailLower);
    if (existing) {
      // A coach added this athlete to their roster (CSV import) before they had an account.
      // They claim it by signing up with the same email and that team's code.
      const preAdded = !existing.password_hash && existing.org_token && token &&
        String(token).trim().toUpperCase() === String(existing.org_token).trim().toUpperCase();
      if (!preAdded) return res.status(409).json({ error: "An account with this email already exists." });
      if (String(password).length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
      const { error: claimErr } = await db
        .from("athletes")
        .update({ password_hash: await hashPassword(password), name: String(name).trim() || existing.name })
        .eq("id", existing.id)
        .is("password_hash", null);
      if (claimErr) return res.status(500).json({ error: "Failed to create athlete.", details: claimErr.message });
      return res.status(200).json({
        success:        true,
        athleteId:      existing.id,
        athleteToken:   existing.athlete_token,
        organization:   existing.org_token,
        tokenValidated: true,
      });
    }

    // 2) Validate org token if provided
    const tokenNorm = token ? String(token).trim() : "";
    let orgToken    = null;

    if (tokenNorm) {
      const { data: org } = await getOrgByToken(tokenNorm);
      if (!org) {
        return res.status(400).json({ error: "Invalid organization token. Verify the token with your organization." });
      }
      orgToken = org.token;
    }

    // 3) Create athlete
    const { data: athlete, error, athlete_token } = await createAthlete({
      name,
      email:     emailLower,
      password,
      orgToken,
    });

    if (error) {
      console.error("[athlete-signup]", error);
      return res.status(500).json({ error: "Failed to create athlete.", details: error.message });
    }

    return res.status(200).json({
      success:        true,
      athleteId:      athlete.id,
      athleteToken:   athlete_token,
      organization:   orgToken || null,
      tokenValidated: Boolean(orgToken),
    });
  } catch (err) {
    console.error("[athlete-signup]", err);
    return res.status(500).json({ error: "Failed to create athlete.", details: err?.message });
  }
}
