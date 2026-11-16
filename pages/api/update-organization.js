// pages/api/update-organization.js
import { supabaseAdmin as db } from "@/lib/supabase";
import { requireOrgOwner } from "@/lib/requireUser";

function pickString(v) {
  return String(v ?? "").trim();
}

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Only the signed-in organization owner can edit their own organization
    const owner = requireOrgOwner(req, res);
    if (!owner) return;
    const ownOrgId = pickString(owner.orgId || owner.org_id || owner.organizationId || owner.id);

    const { organizationId, updates } = req.body || {};
    const id = pickString(organizationId) || ownOrgId;
    const u  = updates && typeof updates === "object" ? updates : null;

    if (!id || id !== ownOrgId) return res.status(403).json({ error: "You can only edit your own organization." });
    if (!u)  return res.status(400).json({ error: "updates object is required." });

    const fields = {};

    if (u.Name !== undefined) fields["name"] = pickString(u.Name);

    if (u.Email !== undefined) {
      const e = normEmail(u.Email);
      if (!e || !e.includes("@")) return res.status(400).json({ error: "Enter a valid email." });
      fields["email"] = e;
    }

    if (u["Phone Number"] !== undefined) fields["phone_number"] = pickString(u["Phone Number"]);

    if (!Object.keys(fields).length) {
      return res.status(400).json({ error: "No valid fields to update." });
    }

    const { data, error } = await db
      .from("organizations")
      .update(fields)
      .eq("id", id)
      .select("id, name, email, phone_number")
      .single();

    if (error) throw error;

    return res.status(200).json({ ok: true, organization: data });
  } catch (err) {
    console.error("[update-organization] error:", err);
    return res.status(500).json({ error: "Failed to update organization.", details: err?.message });
  }
}
