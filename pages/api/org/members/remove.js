// pages/api/org/members/remove.js
import { requireOrgSideUser } from "@/lib/requireUser";
import { AT, base, F } from "@/lib/airtableOrgWorkoutConfig";

function pickField(obj, key, fallback) {
  return obj && obj[key] ? obj[key] : fallback;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  try {
    const role = String(user?.role || user?.Role || "").toLowerCase();
    const isAdminish = role.includes("admin") || role.includes("org");
    if (!isAdminish) {
      return res.status(403).json({ error: "Only Organization/Admin can remove members." });
    }

    const orgId = String(user?.orgId || user?.OrgId || "").trim();
    if (!orgId) return res.status(400).json({ error: "Missing orgId on session user." });

    const body = req.body || {};
    const memberId = String(body.memberId || body.trainerId || "").trim();
    if (!memberId) return res.status(400).json({ error: "Missing memberId (or trainerId)." });

    // Optional safety: don’t let someone remove themselves
    const selfMemberId = String(user?.memberId || user?.MemberId || "").trim();
    if (selfMemberId && memberId === selfMemberId) {
      return res.status(400).json({ error: "You cannot remove yourself." });
    }

    const b = base();

    const ACTIVE_FIELD = pickField(F, "MEM_ACTIVE", "Active");
    const ORG_FIELD = pickField(F, "MEM_ORG", "Organization");

    const rec = await b(AT.tables.orgMembers).find(memberId);
    if (!rec) return res.status(404).json({ error: "Member not found." });

    const links = rec?.fields?.[ORG_FIELD];
    const inOrg = Array.isArray(links) && links.map(String).includes(orgId);
    if (!inOrg) return res.status(403).json({ error: "Forbidden." });

    const updated = await b(AT.tables.orgMembers).update(memberId, {
      [ACTIVE_FIELD]: false,
    });

    return res.status(200).json({
      ok: true,
      removed: true,
      member: { id: updated.id, ...updated.fields },
    });
  } catch (err) {
    console.error("[org/members/remove] error:", err);
    return res.status(500).json({ error: "Failed to remove member", details: err?.message });
  }
}
