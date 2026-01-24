// pages/api/org/members/update.js
import { requireOrgSideUser } from "@/lib/requireUser";
import { AT, base, F, escapeAirtableString } from "@/lib/airtableOrgWorkoutConfig";

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function pickString(v) {
  const s = String(v ?? "").trim();
  return s;
}

function isValidRole(r) {
  const x = String(r || "").trim().toLowerCase();
  return x === "trainer" || x === "admin";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  try {
    const b = base();

    const orgId = String(user.orgId || "").trim();
    if (!orgId) return res.status(400).json({ error: "Missing orgId on session user." });

    const { memberId, name, email, role, active } = req.body || {};
    const id = String(memberId || "").trim();
    if (!id) return res.status(400).json({ error: "Missing memberId." });

    // Optional: block self-deactivation
    // (If your session includes memberId for org owner/admin/trainer)
    if (user.memberId && String(user.memberId) === id && active === false) {
      return res.status(409).json({ error: "You can’t deactivate your own account." });
    }

    // Load existing member to verify org ownership
    const record = await b(AT.tables.orgMembers).find(id);
    if (!record) return res.status(404).json({ error: "Member not found." });

    const orgLinks = record.fields?.[F.MEM_ORG];
    const belongs =
      Array.isArray(orgLinks) && orgLinks.map(String).includes(String(orgId));

    if (!belongs) return res.status(403).json({ error: "Forbidden." });

    // Build updates safely
    const updates = {};

    // Name
    if (name !== undefined) {
      const nextName = pickString(name);
      updates[F.MEM_NAME] = nextName;
    }

    // Role (trainer/admin only)
    if (role !== undefined) {
      if (!isValidRole(role)) return res.status(400).json({ error: "Role must be trainer or admin." });
      updates[F.MEM_ROLE] = String(role).trim().toLowerCase();
    }

    // Active (boolean)
    if (active !== undefined) {
      updates[F.MEM_ACTIVE] = Boolean(active);
    }

    // Email (must be unique per org)
    if (email !== undefined) {
      const nextEmail = normEmail(email);
      if (!nextEmail || !nextEmail.includes("@")) return res.status(400).json({ error: "Enter a valid email." });

      // Check conflict: another member in same org already has this email
      const safe = escapeAirtableString(nextEmail);

      // Filter: same email AND active (optional) AND linked to org AND NOT same record
      const conflict = await b(AT.tables.orgMembers)
        .select({
          maxRecords: 1,
          filterByFormula: `AND(
            LOWER({${F.MEM_EMAIL}})='${safe}',
            FIND('${orgId}', ARRAYJOIN({${F.MEM_ORG}})),
            RECORD_ID()!='${id}'
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
