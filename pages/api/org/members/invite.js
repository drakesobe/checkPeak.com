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

function makeInviteToken() {
  return crypto.randomBytes(24).toString("hex");
}

function addDaysISO(days = 7) {
  const d = new Date();
  d.setDate(d.getDate() + Number(days || 7));
  return d.toISOString();
}

function originFromReq(req) {
  const proto = req.headers["x-forwarded-proto"];
  const host = req.headers["x-forwarded-host"] || req.headers.host;

  if (proto && host) return `${proto}://${host}`;
  return `http://${host}`;
}

// Add rich query params so setup page can show context + prefill email on login
function buildSetupUrl({ origin, token, email, orgName, role, inviterName, expiresAt }) {
  const qs = new URLSearchParams();
  qs.set("token", token);
  if (email) qs.set("email", email);
  if (orgName) qs.set("org", orgName);
  if (role) qs.set("role", role);
  if (inviterName) qs.set("inviter", inviterName);
  if (expiresAt) qs.set("expiresAt", expiresAt);

  return `${origin}/setup/trainer?${qs.toString()}`;
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
    const orgName = String(user?.OrgName || user?.OrgName?.Name || user?.OrganizationName || "").trim();
    const inviterName = String(user?.Name || user?.name || "").trim();
    const inviterEmail = String(user?.Email || user?.email || "").trim().toLowerCase();

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

    // ✅ store org token on member (your debug / filtering strategy)
    const memOrgTokenField = F.MEM_ORG_TOKEN || "OrgToken";

    // Invite token fields (must exist in Airtable)
    const memInviteTokenField = F.MEM_INVITE_TOKEN || "InviteToken";
    const memInviteExpiresField = F.MEM_INVITE_EXPIRES || "InviteExpiresAt";
    const memInviteUsedField = F.MEM_INVITE_USED || "InviteUsedAt";

    // Find existing member in this org by email + org link
    const safeEmail = escapeAirtableString(emailLower);
    const safeOrgId = escapeAirtableString(orgId);

    const existing = await b(AT.tables.orgMembers)
      .select({
        filterByFormula: `AND(LOWER({${memEmailField}})='${safeEmail}', FIND('${safeOrgId}', ARRAYJOIN({${memOrgField}}&'')) > 0)`,
        maxRecords: 1,
      })
      .firstPage();

    // New invite token + expiration
    const inviteToken = makeInviteToken();
    const expiresAt = addDaysISO(7);

    // Fields to write
    const fieldsToWrite = {
      [memEmailField]: emailLower,
      [memRoleField]: roleLower,
      [memOrgTokenField]: orgToken, // ✅ new debug field
      [memOrgField]: [orgId], // ✅ keep link
      [memActiveField]: false, // ✅ pending until finishSetup flips it
    };

    // Optional: name
    if (name && String(name).trim()) fieldsToWrite[memNameField] = String(name).trim();

    // Invite state
    // If these fields don't exist in Airtable you will get 422; keep your table aligned.
    fieldsToWrite[memInviteTokenField] = inviteToken;
    fieldsToWrite[memInviteExpiresField] = expiresAt;
    // clear any prior used marker on re-invite
    if (memInviteUsedField) fieldsToWrite[memInviteUsedField] = "";

    let record;
    if (existing?.length) {
      record = await b(AT.tables.orgMembers).update(existing[0].id, fieldsToWrite);
    } else {
      record = await b(AT.tables.orgMembers).create(fieldsToWrite);
    }

    // Build setup URL with rich context
    const origin = originFromReq(req);

    const inviteUrl = buildSetupUrl({
      origin,
      token: inviteToken,
      email: emailLower,
      orgName: orgName || "Organization",
      role: roleLower,
      inviterName: inviterName || inviterEmail || "Admin",
      expiresAt,
    });

    return res.status(200).json({
      ok: true,
      memberId: record?.id,
      inviteUrl,
      expiresAt,
      role: roleLower,
      email: emailLower,

      // ✅ Optional payload useful for your InviteCard email builder
      context: {
        orgId,
        orgToken,
        orgName: orgName || "Organization",
        inviterName: inviterName || "",
        inviterEmail: inviterEmail || "",
      },

      debug: {
        wroteOrgId: orgId,
        wroteOrgToken: orgToken,
        active: fieldsToWrite[memActiveField],
        wroteInviteTokenField: memInviteTokenField,
        wroteInviteExpiresField: memInviteExpiresField,
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
