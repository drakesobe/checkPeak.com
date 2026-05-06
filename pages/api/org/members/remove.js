// pages/api/org/members/remove.js
import { requireOrgSideUser } from "@/lib/requireUser";
import { AT, base, F } from "@/lib/airtableOrgWorkoutConfig";

function pickField(obj, key, fallback) {
  return obj && obj[key] ? obj[key] : fallback;
}

function roleOf(user) {
  return String(user?.role || user?.Role || "").trim().toLowerCase();
}

function isOrg(role) {
  return role === "organization" || role === "org" || role.includes("organization");
}

function isAdmin(role) {
  return role === "admin" || role.includes("admin") || role.includes("head");
}

// ── FIX: canManage now handles blank role (pending invite records) ─────────
//
// Original bug: if targetRole is blank (member was invited but Airtable field
// is empty, or record was created manually), canManage returned false for
// everyone. The org owner or admin trying to deactivate/remove a broken
// pending invite would get a silent 403.
//
// Fix mirrors update.js canManageTarget logic:
//   - Org owner can manage anyone except another org owner
//   - Admin can manage trainers AND pending invites (blank role)
//   - Nobody can touch an org-role record via this endpoint
// ──────────────────────────────────────────────────────────────────────────
function canManage(actorRole, targetRole) {
  const t = String(targetRole || "").trim().toLowerCase();

  // Never allow deactivating an org owner record via this endpoint
  if (t === "organization" || t === "org") return false;

  // Org owner can deactivate admins, trainers, and pending invites (blank role)
  if (isOrg(actorRole)) return t === "admin" || t === "trainer" || t === "";

  // Admin can deactivate trainers and pending invites (blank role)
  // but cannot touch other admins
  if (isAdmin(actorRole) && !isOrg(actorRole)) {
    return t === "trainer" || t === "";
  }

  return false;
}

/**
 * Robust org membership check.
 * Works whether {Organization} is:
 * - a linked record field (array of record ids)
 * - a lookup (array of strings)
 * - a single string
 */
function isMemberInOrg(rec, ORG_FIELD, orgId) {
  const v = rec?.fields?.[ORG_FIELD];
  if (!orgId) return false;

  if (Array.isArray(v)) {
    return v.map((x) => String(x).trim()).includes(String(orgId).trim());
  }

  const s = String(v ?? "").trim();
  if (!s) return false;
  return s === String(orgId).trim() || s.includes(String(orgId).trim());
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  try {
    const actorRole = roleOf(user);
    const orgId     = String(user?.orgId || user?.OrgId || "").trim();

    if (!orgId) return res.status(400).json({ error: "Missing orgId on session user." });

    const body     = req.body || {};
    const memberId = String(body.memberId || body.trainerId || "").trim();
    if (!memberId) return res.status(400).json({ error: "Missing memberId (or trainerId)." });

    // Don't allow self-removal
    const selfMemberId = String(user?.memberId || user?.MemberId || "").trim();
    if (selfMemberId && memberId === selfMemberId) {
      return res.status(409).json({ error: "You cannot remove yourself." });
    }

    const b = base();

    const ACTIVE_FIELD = pickField(F, "MEM_ACTIVE", "Active");
    const ORG_FIELD    = pickField(F, "MEM_ORG",    "Organization");
    const ROLE_FIELD   = pickField(F, "MEM_ROLE",   "Role");

    // Fetch once - single source of truth
    const rec = await b(AT.tables.orgMembers).find(memberId);
    if (!rec) return res.status(404).json({ error: "Member not found." });

    // Hard org check in JS - no Airtable formula round trip
    if (!isMemberInOrg(rec, ORG_FIELD, orgId)) {
      return res.status(403).json({
        error:   "Forbidden.",
        details: "Target member is not in your organization (orgId mismatch).",
      });
    }

    const targetRole = String(rec.fields?.[ROLE_FIELD] || "").trim().toLowerCase();

    if (!canManage(actorRole, targetRole)) {
      return res.status(403).json({
        error: isOrg(actorRole)
          ? "Organization can manage admins + trainers."
          : "Admin can manage trainers only.",
      });
    }

    const updated = await b(AT.tables.orgMembers).update(memberId, {
      [ACTIVE_FIELD]: false,
    });

    return res.status(200).json({
      ok:      true,
      removed: true,
      member:  { id: updated.id, ...updated.fields },
    });

  } catch (err) {
    console.error("[org/members/remove] error:", err);
    return res.status(500).json({ error: "Failed to remove member", details: err?.message });
  }
}