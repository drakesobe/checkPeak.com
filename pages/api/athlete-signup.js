// pages/api/athlete-signup.js
// Creates a new athlete account in Supabase.
// Optionally links to an org via org token.

import { createAthlete, getAthleteByEmail, getOrgByToken, normalizeEmail } from "@/lib/supabaseOrg";

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
    if (existing) return res.status(409).json({ error: "An account with this email already exists." });

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
