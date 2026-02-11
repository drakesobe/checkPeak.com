// pages/api/org/members/update.js
import { requireOrgSideUser } from "@/lib/requireUser";
import { AT, base, F, escapeAirtableString } from "@/lib/airtableOrgWorkoutConfig";

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function pickString(v) {
  return String(v ?? "").trim();
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

function isValidRole(r) {
  const x = String(r || "").trim().toLowerCase();
  return x === "trainer" || x === "admin";
}

function canManageTarget(actorRole, targetRole) {
  const t = String(targetRole || "").toLowerCase();
  if (t === "organization" || t === "org") return false;

  if (isOrg(actorRole)) return t === "admin" || t === "trainer";
  if (isAdmin(actorRole) && !isOrg(actorRole)) return t === "trainer";
  return false;
}

function canSetRole(actorRole, desiredRole) {
  const d = String(desiredRole || "").toLowerCase();
  if (d === "organization" || d === "org") return false;

  // admin can only set trainer
  if (isAdmin(actorRole) && !isOrg(actorRole)) return d === "trainer";

  // org can set admin or trainer
  if (isOrg(actorRole)) return d === "admin" || d === "trainer";

  return false;
}

function orgFilterFormula(ORG_FIELD, orgId) {
  const safeOrg = escapeAirtableString(String(orgId || "").trim());
  return `FIND('${safeOrg}', ARRAYJOIN({${ORG_FIELD}}&'')) > 0`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  try {
    const b = base();

    const actorRole = roleOf(user);

    const orgId = String(user.orgId || "").trim();
    if (!orgId) return res.status(400).json({ error: "Missing orgId on session user." });

    const { memberId, name, email, role, active } = req.body || {};
    const id = String(memberId || "").trim();
    if (!id) return res.status(400).json({ error: "Missing memberId." });

    // Optional: block self-deactivation (matches your previous behavior)
    if (user.memberId && String(user.memberId) === id && active === false) {
      return res.status(409).json({ error: "You can’t deactivate your own account." });
    }

    // Load existing member
    const record = await b(AT.tables.orgMembers).find(id);
    if (!record) return res.status(404).json({ error: "Member not found." });

    const ORG_FIELD = F.MEM_ORG || "Organization";
    const ROLE_FIELD = F.MEM_ROLE || "Role";

    // Must belong to org (strong check)
    const verify = await b(AT.tables.orgMembers)
      .select({
        maxRecords: 1,
        filterByFormula: `AND(RECORD_ID()='${escapeAirtableString(id)}', ${orgFilterFormula(ORG_FIELD, orgId)})`,
      })
      .firstPage();

    if (!verify?.length) return res.status(403).json({ error: "Forbidden." });

    const targetRole = String(record.fields?.[ROLE_FIELD] || "").toLowerCase();

    // Actor must be allowed to manage this target at all
    if (!canManageTarget(actorRole, targetRole)) {
      return res.status(403).json({
        error: isOrg(actorRole)
          ? "Organization can manage admins + trainers."
          : "Admin can manage trainers only.",
      });
    }

    const updates = {};

    // Name
    if (name !== undefined) {
      updates[F.MEM_NAME] = pickString(name);
    }

    // Role
    if (role !== undefined) {
      if (!isValidRole(role)) return res.status(400).json({ error: "Role must be trainer or admin." });

      const desired = String(role).trim().toLowerCase();

      if (!canSetRole(actorRole, desired)) {
        return res.status(403).json({
          error: isOrg(actorRole)
            ? "Organization can set role to trainer or admin."
            : "Admin can set role to trainer only.",
        });
      }

      updates[F.MEM_ROLE] = desired;
    }

    // Active
    if (active !== undefined) {
      // Only org/admin can deactivate/reactivate, but trainers shouldn't reach here anyway
      updates[F.MEM_ACTIVE] = Boolean(active);
    }

    // Email (unique within org)
    if (email !== undefined) {
      const nextEmail = normEmail(email);
      if (!nextEmail || !nextEmail.includes("@")) return res.status(400).json({ error: "Enter a valid email." });

      const safe = escapeAirtableString(nextEmail);

      const conflict = await b(AT.tables.orgMembers)
        .select({
          maxRecords: 1,
          filterByFormula: `AND(
            LOWER({${F.MEM_EMAIL}})='${safe}',
            ${orgFilterFormula(ORG_FIELD, orgId)},
            RECORD_ID()!='${escapeAirtableString(id)}'
          )`,
        })
        .firstPage();

      if (conflict?.length) {
        return res.status(409).json({ error: "Email already exists for another member in this organization." });
      }

      updates[F.MEM_EMAIL] = nextEmail;
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: "No updates provided." });
    }

    const updated = await b(AT.tables.orgMembers).update(id, updates);

    return res.status(200).json({
      ok: true,
      member: { id: updated.id, ...(updated.fields || {}) },
    });
  } catch (err) {
    console.error("[org/members/update] error:", err);
    return res.status(500).json({ error: "Failed to update member", details: err?.message });
  }
}
