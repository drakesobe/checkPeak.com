// pages/api/org/members/finishSetup.js
import bcrypt from "bcryptjs";
import { AT, base, F, escapeAirtableString } from "@/lib/airtableOrgWorkoutConfig";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function pickField(obj, key, fallback) {
  return obj && obj[key] ? obj[key] : fallback;
}

function norm(v) {
  return String(v || "").trim();
}

function isExpired(iso) {
  if (!iso) return true;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return true;
  return d.getTime() < Date.now();
}

/**
 * Airtable filter strings are picky; keep this consistent everywhere.
 */
function safeEq(field, safeValue) {
  return `{${field}}='${safeValue}'`;
}

/* -------------------------------------------------------------------------- */
/* Handler                                                                    */
/* -------------------------------------------------------------------------- */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { inviteToken, password } = req.body || {};
    const token = norm(inviteToken);
    const pw = String(password || "");

    // Basic validation
    if (!token) return res.status(400).json({ error: "Missing inviteToken." });
    if (!pw || pw.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    const b = base();

    // Field names (defaults)
    const INVITE_TOKEN_FIELD = pickField(F, "MEM_INVITE_TOKEN", "InviteToken");
    const INVITE_EXPIRES_FIELD = pickField(F, "MEM_INVITE_EXPIRES", "InviteExpiresAt");
    const INVITE_USED_FIELD = pickField(F, "MEM_INVITE_USED", "InviteUsedAt");
    const ACTIVE_FIELD = pickField(F, "MEM_ACTIVE", "Active");
    const ROLE_FIELD = pickField(F, "MEM_ROLE", "Role");

    // Optional but helpful in your newer approach:
    // when you start storing Token in OrgMembers as "OrgToken"
    const ORG_TOKEN_FIELD = pickField(F, "MEM_ORG_TOKEN", "OrgToken");

    const safeToken = escapeAirtableString(token);

    /**
     * 1) Find member by invite token
     * Token should be unique; we still defensively handle multiples.
     */
    const matches = await b(AT.tables.orgMembers)
      .select({
        filterByFormula: `AND(${safeEq(INVITE_TOKEN_FIELD, safeToken)})`,
        maxRecords: 5,
      })
      .firstPage();

    if (!matches?.length) {
      return res.status(404).json({ error: "Invite link is invalid or has already been used." });
    }

    const member = matches[0];
    const fields = member.fields || {};

    /**
     * 2) Validate invite state
     * - Expired? -> 410
     * - Already used? -> 409
     */
    const expiresAt = fields[INVITE_EXPIRES_FIELD];
    if (isExpired(expiresAt)) {
      return res.status(410).json({ error: "Invite link expired. Ask your org admin to resend." });
    }

    const usedAt = fields[INVITE_USED_FIELD];
    if (usedAt) {
      return res.status(409).json({ error: "Invite already used. Please log in." });
    }

    /**
     * 3) Role gate: only trainer/admin may use this flow
     * (This protects you from someone using a staff setup endpoint on an athlete invite.)
     */
    const role = String(fields[ROLE_FIELD] || "").trim().toLowerCase();
    if (!["trainer", "admin"].includes(role)) {
      return res.status(403).json({ error: "This invite is not valid for staff setup." });
    }

    /**
     * 4) Hash password + activate account
     *
     * Key behavior for your desired UX:
     * - Active=false means "pending invite" (allowed to setup)
     * - When they finish setup:
     *    ✅ Active=true (checkbox checkmark)
     *    ✅ InviteUsedAt = now
     *    ✅ InviteToken cleared (burn link)
     */
    const hash = await bcrypt.hash(pw, 10);

    const updateFields = {
      PasswordHash: hash,
      [INVITE_USED_FIELD]: new Date().toISOString(),
      [INVITE_TOKEN_FIELD]: "", // burn token so link can't be reused
      [ACTIVE_FIELD]: true, // ✅ activate
    };

    // If you’re moving toward "OrgToken stored on OrgMembers", don’t overwrite it here.
    // But if it’s missing, you can keep the record "debug-friendly" by ensuring it exists.
    // (This is optional. Comment out if you don't want it.)
    if (ORG_TOKEN_FIELD && !fields?.[ORG_TOKEN_FIELD]) {
      // leave as-is; we don't have org token in this endpoint payload
      // updateFields[ORG_TOKEN_FIELD] = fields?.[ORG_TOKEN_FIELD] || ""; // no-op
    }

    await b(AT.tables.orgMembers).update(member.id, updateFields);

    /**
     * 5) Response payload: give the setup page everything it needs to provide next actions.
     * Your setup page currently redirects to "/" after success; this message is shown before redirect.
     */
    return res.status(200).json({
      ok: true,
      role,
      memberId: member.id,
      message: "Password set! Your account is now active — you can log in as Trainer/Admin.",
    });
  } catch (err) {
    console.error("[org/members/finishSetup] error:", err);
    return res.status(500).json({ error: "Failed to set password", details: err?.message });
  }
}
