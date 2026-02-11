// pages/api/org/members/invite.js
import crypto from "crypto";
import { requireOrgSideUser } from "@/lib/requireUser";
import { AT, base, F, escapeAirtableString } from "@/lib/airtableOrgWorkoutConfig";

function normEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function pickField(obj, key, fallback) {
  return obj && obj[key] ? obj[key] : fallback;
}

function normalizeRole(raw) {
  const r = String(raw || "").trim().toLowerCase();
  if (r === "organization" || r === "org" || r.includes("org")) return "organization";
  if (r === "admin" || r.includes("admin")) return "admin";
  if (r === "trainer" || r.includes("train")) return "trainer";
  return r;
}

function canInviteRole(inviterRole, nextRole) {
  // ✅ Permission layering:
  // - Organization can invite admin + trainer
  // - Admin can invite trainer only
  // - Trainer cannot invite
  if (inviterRole === "organization") return nextRole === "trainer" || nextRole === "admin";
  if (inviterRole === "admin") return nextRole === "trainer";
  return false;
}

function makeInviteToken() {
  // URL-safe token
  return crypto.randomBytes(24).toString("base64url");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  try {
    const inviterRole = normalizeRole(user?.role || user?.Role);
    if (!["organization", "admin"].includes(inviterRole)) {
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

    // ✅ permission gating
    if (!canInviteRole(inviterRole, nextRole)) {
      return res.status(403).json({
        error:
          inviterRole === "admin"
            ? "Admins can invite Trainers only."
            : "Not authorized to invite this role.",
      });
    }

    const b = base();

    // Field name fallbacks
    const EMAIL_FIELD = pickField(F, "MEM_EMAIL", "Email");
    const NAME_FIELD = pickField(F, "MEM_NAME", "Name");
    const ROLE_FIELD = pickField(F, "MEM_ROLE", "Role");
    const ACTIVE_FIELD = pickField(F, "MEM_ACTIVE", "Active");
    const ORG_FIELD = pickField(F, "MEM_ORG", "Organization");

    // Invite fields (add these columns in Airtable OrgMembers)
    const INVITE_TOKEN_FIELD = pickField(F, "MEM_INVITE_TOKEN", "InviteToken");
    const INVITE_EXPIRES_FIELD = pickField(F, "MEM_INVITE_EXPIRES", "InviteExpiresAt");
    const INVITE_USED_FIELD = pickField(F, "MEM_INVITE_USED", "InviteUsedAt");

    const safeEmail = escapeAirtableString(email);

    // Find existing member by email (then verify linked to this org)
    const existing = await b(AT.tables.orgMembers)
      .select({
        filterByFormula: `LOWER({${EMAIL_FIELD}})='${safeEmail}'`,
        maxRecords: 20,
      })
      .firstPage();

    const inOrg =
      (existing || []).find((m) => {
        const links = m?.fields?.[ORG_FIELD];
        return Array.isArray(links) && links.map(String).includes(orgId);
      }) || null;

    // ✅ generate one-time invite token + expiry
    const inviteToken = makeInviteToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(); // 7 days

    const updates = {
      [ROLE_FIELD]: nextRole,
      [ACTIVE_FIELD]: true,
      [INVITE_TOKEN_FIELD]: inviteToken,
      [INVITE_EXPIRES_FIELD]: expiresAt,
      [INVITE_USED_FIELD]: "", // clear used marker if re-inviting
    };
    if (name) updates[NAME_FIELD] = name;

    let record;
    let mode;

    if (inOrg) {
      record = await b(AT.tables.orgMembers).update(inOrg.id, updates);
      mode = "updated";
    } else {
      const createFields = {
        [EMAIL_FIELD]: email,
        [ROLE_FIELD]: nextRole,
        [ACTIVE_FIELD]: true,
        [ORG_FIELD]: [orgId],
        [INVITE_TOKEN_FIELD]: inviteToken,
        [INVITE_EXPIRES_FIELD]: expiresAt,
      };
      if (name) createFields[NAME_FIELD] = name;

      record = await b(AT.tables.orgMembers).create(createFields);
      mode = "created";
    }

    // Build invite URL (works on localhost + prod)
    const origin =
      String(req.headers["x-forwarded-proto"] || "").startsWith("https")
        ? `https://${req.headers["x-forwarded-host"] || req.headers.host}`
        : `http://${req.headers.host}`;

    const inviteUrl = `${origin}/finish-setup?invite=${encodeURIComponent(inviteToken)}`;

    return res.status(200).json({
      ok: true,
      mode,
      inviteUrl,
      expiresAt,
      member: { id: record.id, ...(record.fields || {}) },
      note: "This invite link lets the staff member set their password. Email sending is not wired yet.",
    });
  } catch (err) {
    console.error("[org/members/invite] error:", err);
    return res.status(500).json({ error: "Failed to invite member", details: err?.message });
  }
}
