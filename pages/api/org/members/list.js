// pages/api/org/members/list.js
// GET — returns all members for the logged-in org.

import { requireOrgSideUser } from "@/lib/requireUser";
import { getMembersByOrg } from "@/lib/supabaseOrg";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const orgToken = String(user.orgToken || user.Token || "").trim();
  if (!orgToken) return res.status(400).json({ error: "Missing org token on session." });

  try {
    const { data: members, error } = await getMembersByOrg(orgToken);
    if (error) return res.status(500).json({ error: "Failed to fetch members.", details: error.message });

    return res.status(200).json({ ok: true, members });
  } catch (err) {
    console.error("[members/list]", err);
    return res.status(500).json({ error: "Failed to fetch members.", details: err?.message });
  }
}
