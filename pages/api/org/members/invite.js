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
  const host  = req.headers["x-forwarded-host"] || req.headers.host;
  if (proto && host) return `${proto}://${host}`;
  return `http://${host}`;
}

function buildSetupUrl({ origin, token, email, orgName, role, inviterName, expiresAt }) {
  const qs = new URLSearchParams();
  qs.set("token", token);
  if (email)       qs.set("email",     email);
  if (orgName)     qs.set("org",       orgName);
  if (role)        qs.set("role",      role);
  if (inviterName) qs.set("inviter",   inviterName);
  if (expiresAt)   qs.set("expiresAt", expiresAt);
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

    const orgId        = String(user?.orgId || "").trim();
    const orgToken     = String(user?.Token  || "").trim();
    const orgName      = String(user?.OrgName || user?.OrgName?.Name || user?.OrganizationName || "").trim();
    const inviterName  = String(user?.Name   || user?.name  || "").trim();
    const inviterEmail = String(user?.Email  || user?.email || "").trim().toLowerCase();

    if (!orgId)    return res.status(400).json({ error: "Missing orgId on session user." });
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

    const memEmailField         = F.MEM_EMAIL          || "Email";
    const memNameField          = F.MEM_NAME           || "Name";
    const memRoleField          = F.MEM_ROLE           || "Role";
    const memActiveField        = F.MEM_ACTIVE         || "Active";
    const memOrgField           = F.MEM_ORG            || "Organization";
    const memOrgTokenField      = F.MEM_ORG_TOKEN      || "OrgToken";
    const memInviteTokenField   = F.MEM_INVITE_TOKEN   || "InviteToken";
    const memInviteExpiresField = F.MEM_INVITE_EXPIRES || "InviteExpiresAt";
    const memInviteUsedField    = F.MEM_INVITE_USED    || "InviteUsedAt";

    // Look for an existing member record in this org with the same email
    const safeEmail = escapeAirtableString(emailLower);
    const safeOrgId = escapeAirtableString(orgId);

    const existing = await b(AT.tables.orgMembers)
      .select({
        filterByFormula: `AND(
          LOWER({${memEmailField}})='${safeEmail}',
          FIND('${safeOrgId}', ARRAYJOIN({${memOrgField}}&'')) > 0
        )`,
        maxRecords: 1,
      })
      .firstPage();

    const inviteToken = makeInviteToken();
    const expiresAt   = addDaysISO(7);

    let record;

    if (existing?.length) {
      const existingFields    = existing[0].fields || {};
      const isAlreadyActive   = Boolean(existingFields[memActiveField]);
      const hasCompletedSetup = Boolean(existingFields[memInviteUsedField]);

      // ── FIX: Re-invite guard ───────────────────────────────────────────────
      // If InviteUsedAt is set AND Active=true, the member has already completed
      // their setup and is a live account. Do NOT set Active=false — that locks
      // them out immediately. Instead, refresh the invite token only (allows
      // password reset flow) and leave Active untouched.
      //
      // Only set Active=false when:
      //   - Record exists but setup was never completed (InviteUsedAt is blank)
      //   - OR account is already inactive (Active=false)
      //
      // In both those cases the member has no working access anyway, so
      // resetting to pending state is correct.
      // ──────────────────────────────────────────────────────────────────────

      const fieldsToWrite = {
        [memRoleField]:          roleLower,
        [memOrgTokenField]:      orgToken,
        [memOrgField]:           [orgId],
        [memInviteTokenField]:   inviteToken,
        [memInviteExpiresField]: expiresAt,
        [memInviteUsedField]:    "", // clear used marker so new token is valid
      };

      if (name && String(name).trim()) {
        fieldsToWrite[memNameField] = String(name).trim();
      }

      if (isAlreadyActive && hasCompletedSetup) {
        // Live member — preserve Active=true, don't include it in the write
      } else {
        // Pending or inactive — reset to pending
        fieldsToWrite[memActiveField] = false;
      }

      record = await b(AT.tables.orgMembers).update(existing[0].id, fieldsToWrite);

    } else {
      // New record — always starts as pending (Active=false)
      const fieldsToWrite = {
        [memEmailField]:         emailLower,
        [memRoleField]:          roleLower,
        [memOrgTokenField]:      orgToken,
        [memOrgField]:           [orgId],
        [memActiveField]:        false,
        [memInviteTokenField]:   inviteToken,
        [memInviteExpiresField]: expiresAt,
        [memInviteUsedField]:    "",
      };

      if (name && String(name).trim()) {
        fieldsToWrite[memNameField] = String(name).trim();
      }

      record = await b(AT.tables.orgMembers).create(fieldsToWrite);
    }

    const origin    = originFromReq(req);
    const inviteUrl = buildSetupUrl({
      origin,
      token:       inviteToken,
      email:       emailLower,
      orgName:     orgName || "Organization",
      role:        roleLower,
      inviterName: inviterName || inviterEmail || "Admin",
      expiresAt,
    });

    return res.status(200).json({
      ok:        true,
      memberId:  record?.id,
      inviteUrl,
      expiresAt,
      role:      roleLower,
      email:     emailLower,
    });

  } catch (err) {
    console.error("[org/members/invite] error:", err);
    return res.status(500).json({
      error:    "Failed to invite member",
      details:  err?.message,
      airtable: {
        statusCode: err?.statusCode,
        message:    err?.message,
        error:      err?.error,
      },
    });
  }
}