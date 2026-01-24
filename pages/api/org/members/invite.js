// pages/api/org/members/invite.js
import { requireOrgSideUser } from "@/lib/requireUser";
import { AT, base, F, escapeAirtableString } from "@/lib/airtableOrgWorkoutConfig";

function normEmail(email) {
  return String(email || "").trim().toLowerCase();
}

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
      return res.status(403).json({ error: "Only Organization/Admin can invite members." });
    }

    const orgId = String(user?.orgId || user?.OrgId || "").trim();
    if (!orgId) return res.status(400).json({ error: "Missing orgId on session user." });

    const body = req.body || {};
    const email = normEmail(body.email);
    const nextRole = String(body.role || "trainer").trim().toLowerCase();
    const name = String(body.name || "").trim();

    if (!email || !email.includes("@")) return res.status(400).json({ error: "Valid email is required." });
    if (!["trainer", "admin"].includes(nextRole)) {
      return res.status(400).json({ error: "Role must be 'trainer' or 'admin'." });
    }

    const b = base();

    // Field name fallbacks (in case your F map doesn’t include them)
    const EMAIL_FIELD = pickField(F, "MEM_EMAIL", "Email");
    const NAME_FIELD = pickField(F, "MEM_NAME", "Name");
    const ROLE_FIELD = pickField(F, "MEM_ROLE", "Role");
    const ACTIVE_FIELD = pickField(F, "MEM_ACTIVE", "Active");
    const ORG_FIELD = pickField(F, "MEM_ORG", "Organization");

    const safeEmail = escapeAirtableString(email);

    // Find existing member by email (then we’ll verify it’s linked to this org)
    const existing = await b(AT.tables.orgMembers)
      .select({
        filterByFormula: `LOWER({${EMAIL_FIELD}})='${safeEmail}'`,
        maxRecords: 5,
      })
      .firstPage();

    // If one exists for this org, update it; otherwise create a new member linked to this org
    const inOrg =
      (existing || []).find((m) => {
        const links = m?.fields?.[ORG_FIELD];
        return Array.isArray(links) && links.map(String).includes(orgId);
      }) || null;

    if (inOrg) {
      const updates = {
        [ROLE_FIELD]: nextRole,
        [ACTIVE_FIELD]: true,
      };
      if (name) updates[NAME_FIELD] = name;

      const updated = await b(AT.tables.orgMembers).update(inOrg.id, updates);

      return res.status(200).json({
        ok: true,
        mode: "updated",
        member: { id: updated.id, ...updated.fields },
      });
    }

    // Create new OrgMember
    const createFields = {
      [EMAIL_FIELD]: email,
      [ROLE_FIELD]: nextRole,
      [ACTIVE_FIELD]: true,
      [ORG_FIELD]: [orgId],
    };
    if (name) createFields[NAME_FIELD] = name;

    const created = await b(AT.tables.orgMembers).create(createFields);

    // NOTE: This does NOT send an email. It creates access. If you want “invite email”,
    // we can add an Email provider later (Resend/SendGrid) + an invite token flow.
    return res.status(200).json({
      ok: true,
      mode: "created",
      member: { id: created.id, ...created.fields },
    });
  } catch (err) {
    console.error("[org/members/invite] error:", err);
    return res.status(500).json({ error: "Failed to invite member", details: err?.message });
  }
}
