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

/**
 * Allow management of:
 * - trainer/admin
 * - pending invites where Role is blank/undefined
 *
 * Block:
 * - organization role (owner record if it ever exists in OrgMembers)
 */
function canManageTarget(actorRole, targetRole) {
  const t = String(targetRole || "").trim().toLowerCase();
  if (t === "organization" || t === "org") return false;
  if (isOrg(actorRole)) return true;
  if (isAdmin(actorRole) && !isOrg(actorRole)) {
    return t === "" || t === "trainer";
  }
  return false;
}

function canSetRole(actorRole, desiredRole) {
  const d = String(desiredRole || "").trim().toLowerCase();
  if (d === "organization" || d === "org") return false;
  if (isAdmin(actorRole) && !isOrg(actorRole)) return d === "trainer";
  if (isOrg(actorRole)) return d === "admin" || d === "trainer";
  return false;
}

/**
 * Robust org membership check.
 * Works whether {Organization} is a linked record (array), lookup, or string.
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
    const b = base();
    const actorRole = roleOf(user);

    const orgId = String(user?.orgId || user?.OrgId || "").trim();
    if (!orgId) return res.status(400).json({ error: "Missing orgId on session user." });

    const { memberId, name, email, role, active } = req.body || {};
    const id = String(memberId || "").trim();
    if (!id) return res.status(400).json({ error: "Missing memberId." });

    const ORG_FIELD    = F.MEM_ORG    || "Organization";
    const ROLE_FIELD   = F.MEM_ROLE   || "Role";
    const NAME_FIELD   = F.MEM_NAME   || "Name";
    const EMAIL_FIELD  = F.MEM_EMAIL  || "Email";
    const ACTIVE_FIELD = F.MEM_ACTIVE || "Active";

    // Block self-deactivation
    const selfMemberId = String(user?.memberId || user?.MemberId || "").trim();
    if (selfMemberId && selfMemberId === id && active === false) {
      return res.status(409).json({ error: "You can't deactivate your own account." });
    }

    // Fetch once - single source of truth, no formula round trip
    const record = await b(AT.tables.orgMembers).find(id);
    if (!record) return res.status(404).json({ error: "Member not found." });

    if (!isMemberInOrg(record, ORG_FIELD, orgId)) {
      return res.status(403).json({
        error:   "Forbidden.",
        details: "Target member is not in your organization (orgId mismatch).",
      });
    }

    const targetRole = String(record.fields?.[ROLE_FIELD] || "").trim().toLowerCase();

    if (!canManageTarget(actorRole, targetRole)) {
      return res.status(403).json({
        error: isOrg(actorRole)
          ? "Organization can manage members."
          : "Admin can manage trainers only.",
      });
    }

    const updates = {};

    // ── FIX 5: Name empty-string guard ───────────────────────────────────
    // Previously: if name="" was sent, updates[NAME_FIELD]="" would silently
    // blank the member's name in Airtable. Now we reject blank names
    // explicitly so the caller knows it wasn't accepted.
    // Name is optional on invite (it can legitimately be absent on a record),
    // but once a name exists it should not be clearable to an empty string
    // through this endpoint. The EditMemberPanel doesn't require name, so
    // if name is undefined (field wasn't touched) we skip it entirely.
    // ──────────────────────────────────────────────────────────────────────
    if (name !== undefined) {
      const cleanName = pickString(name);
      if (cleanName === "") {
        return res.status(400).json({ error: "Name cannot be blank. Leave the field as-is to keep the current name." });
      }
      updates[NAME_FIELD] = cleanName;
    }

    // Role
    if (role !== undefined) {
      if (!isValidRole(role)) {
        return res.status(400).json({ error: "Role must be trainer or admin." });
      }
      const desired = String(role).trim().toLowerCase();
      if (!canSetRole(actorRole, desired)) {
        return res.status(403).json({
          error: isOrg(actorRole)
            ? "Organization can set role to trainer or admin."
            : "Admin can set role to trainer only.",
        });
      }
      updates[ROLE_FIELD] = desired;
    }

    // Active
    if (active !== undefined) {
      updates[ACTIVE_FIELD] = Boolean(active);
    }

    // Email - unique within org
    if (email !== undefined) {
      const nextEmail = normEmail(email);
      if (!nextEmail || !nextEmail.includes("@")) {
        return res.status(400).json({ error: "Enter a valid email." });
      }

      const safe = escapeAirtableString(nextEmail);

      const conflict = await b(AT.tables.orgMembers)
        .select({
          maxRecords: 1,
          filterByFormula: `AND(
            LOWER({${EMAIL_FIELD}})='${safe}',
            FIND('${escapeAirtableString(orgId)}', ARRAYJOIN({${ORG_FIELD}}&'')) > 0,
            RECORD_ID()!='${escapeAirtableString(id)}'
          )`,
        })
        .firstPage();

      if (conflict?.length) {
        return res.status(409).json({
          error: "Email already exists for another member in this organization.",
        });
      }

      updates[EMAIL_FIELD] = nextEmail;
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: "No updates provided." });
    }

    const updated = await b(AT.tables.orgMembers).update(id, updates);

    return res.status(200).json({
      ok:     true,
      member: { id: updated.id, ...(updated.fields || {}) },
    });

  } catch (err) {
    console.error("[org/members/update] error:", err);
    return res.status(500).json({
      error:    "Failed to update member",
      details:  err?.message,
      airtable: {
        statusCode: err?.statusCode,
        message:    err?.message,
        error:      err?.error,
      },
    });
  }
}