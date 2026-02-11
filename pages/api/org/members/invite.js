// pages/api/org/members/invite.js
import crypto from "crypto";
import { requireOrgSideUser } from "@/lib/requireUser";
import { AT, base, F, escapeAirtableString } from "@/lib/airtableOrgWorkoutConfig";

function roleOf(user) {
  return String(user?.role || user?.Role || "").trim().toLowerCase();
}

function isOrg(role) {
  return role === "organization" || role === "org" || role.includes("organization");
}

function isAdmin(role) {
  return role === "admin" || role.includes("admin") || role.includes("head");
}

function canInvite(actorRole) {
  return isOrg(actorRole) || isAdmin(actorRole);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function makeInviteToken() {
  return crypto.randomBytes(24).toString("hex");
}

function addDaysISO(days = 7) {
  const d = new Date();
  d.setDate(d.getDate() + Number(days || 7));
  return d.toISOString();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  try {
    const actorRole = roleOf(user);
    if (!canInvite(actorRole)) {
      return res.status(403).json({ error: "Only Organization/Admin can invite members." });
    }

    const orgId = String(user?.orgId || "").trim();
    const orgToken = String(user?.Token || "").trim();

    if (!orgId) return res.status(400).json({ error: "Missing orgId on session user." });
    if (!orgToken) return res.status(400).json({ error: "Missing Token on session user." });

    const { email, role, name } = req.body || {};
    const emailLower = normalizeEmail(email);

    if (!emailLower || !emailLower.includes("@")) {
      return res.status(400).json({ error: "Valid email is required." });
    }

    const roleLower = String(role || "trainer").trim().toLowerCase();
    if (!["trainer", "admin"].includes(roleLower)) {
      return res.status(400).json({ error: "Role must be trainer or admin." });
    }

    const b = base();

    // ---- Field names (defaults)
    const memEmailField = F.MEM_EMAIL || "Email";
    const memNameField = F.MEM_NAME || "Name";
    const memRoleField = F.MEM_ROLE || "Role";
    const memActiveField = F.MEM_ACTIVE || "Active";
    const memOrgField = F.MEM_ORG || "Organization";

    // ✅ NEW: OrgToken debug field
    const memOrgTokenField = F.MEM_ORG_TOKEN || "OrgToken";

    // Optional invite token fields (only if you created them)
    const memInviteTokenField = F.MEM_INVITE_TOKEN || "InviteToken";
    const memInviteExpiresField = F.MEM_INVITE_EXPIRES || "InviteExpiresAt";

    // Find existing member in this org by email + org link
    const safeEmail = escapeAirtableString(emailLower);
    const safeOrgId = escapeAirtableString(orgId);

    const existing = await b(AT.tables.orgMembers)
      .select({
        filterByFormula: `AND(LOWER({${memEmailField}})='${safeEmail}', FIND('${safeOrgId}', ARRAYJOIN({${memOrgField}}&'')) > 0)`,
        maxRecords: 1,
      })
      .firstPage();

    const inviteToken = makeInviteToken();
    const expiresAt = addDaysISO(7);

    // Build fields to write
    const fieldsToWrite = {
      [memEmailField]: emailLower,
      [memRoleField]: roleLower,
      [memOrgTokenField]: orgToken,     // ✅ store org token on member
      [memOrgField]: [orgId],           // ✅ keep correct link to org record
    };

    if (name && String(name).trim()) fieldsToWrite[memNameField] = String(name).trim();

    // If you want invited members to be "pending" until setup:
    // set Active=false now; then your setup/password endpoint can flip Active=true.
    // If you want them immediately active, set true.
    fieldsToWrite[memActiveField] = false;

    // Only write invite fields if your table actually has them
    // (If these fields don't exist, Airtable will 422)
    if (memInviteTokenField) fieldsToWrite[memInviteTokenField] = inviteToken;
    if (memInviteExpiresField) fieldsToWrite[memInviteExpiresField] = expiresAt;

    let record;
    if (existing?.length) {
      record = await b(AT.tables.orgMembers).update(existing[0].id, fieldsToWrite);
    } else {
      record = await b(AT.tables.orgMembers).create(fieldsToWrite);
    }

    // Construct setup URL (adjust path to your real setup page)
    const origin =
      req.headers["x-forwarded-proto"] && req.headers["x-forwarded-host"]
        ? `${req.headers["x-forwarded-proto"]}://${req.headers["x-forwarded-host"]}`
        : `http://${req.headers.host}`;

    const inviteUrl = `${origin}/setup/trainer?token=${encodeURIComponent(inviteToken)}`;

    return res.status(200).json({
      ok: true,
      memberId: record?.id,
      inviteUrl,
      expiresAt,
      role: roleLower,
      email: emailLower,
      debug: {
        wroteOrgId: orgId,
        wroteOrgToken: orgToken,
        active: fieldsToWrite[memActiveField],
      },
    });
  } catch (err) {
    console.error("[org/members/invite] error:", err);
    return res.status(500).json({
      error: "Failed to invite member",
      details: err?.message,
      airtable: {
        statusCode: err?.statusCode,
        message: err?.message,
        error: err?.error,
      },
    });
  }
}
