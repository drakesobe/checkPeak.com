// pages/api/org-signup.js
// Creates a new organization account in Supabase.

import { createOrg, getOrgByEmail, normalizeEmail } from "@/lib/supabaseOrg";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const {
    name,
    email,
    password,
    contactName = "",
    phoneNumber = "",
    website     = "",
    address     = "",
    notes       = "",
    type        = "Organization",
  } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Organization name, email, and password are required." });
  }

  try {
    const emailLower = normalizeEmail(email);

    // Prevent duplicate email
    const { data: existing } = await getOrgByEmail(emailLower);
    if (existing) return res.status(409).json({ error: "An organization with this email already exists." });

    const { data: org, error, token } = await createOrg({
      name,
      email:       emailLower,
      password,
      contactName,
      phone:       phoneNumber,
      website,
      address,
      notes,
      type,
    });

    if (error) {
      console.error("[org-signup]", error);
      return res.status(500).json({ error: "Failed to create organization.", details: error.message });
    }

    return res.status(200).json({
      success:  true,
      orgId:    org.id,
      orgToken: token,
      name:     org.name,
    });
  } catch (err) {
    console.error("[org-signup]", err);
    return res.status(500).json({ error: "Failed to create organization.", details: err?.message });
  }
}
