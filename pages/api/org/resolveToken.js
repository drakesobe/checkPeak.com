// pages/api/org/resolveToken.js
// GET ?token=ORG-XXX — validates an org token and returns the org name.

import { getOrgByToken } from "@/lib/supabaseOrg";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const token = String(req.query?.token || "").trim();
  if (!token) return res.status(400).json({ error: "token is required" });

  try {
    const { data: org, error } = await getOrgByToken(token);
    if (error) return res.status(500).json({ error: "Failed to resolve token.", details: error.message });
    if (!org)  return res.status(404).json({ error: "Organization not found." });

    return res.status(200).json({ ok: true, orgName: org.name, orgToken: org.token });
  } catch (err) {
    console.error("[resolveToken]", err);
    return res.status(500).json({ error: "Failed to resolve token.", details: err?.message });
  }
}
