// pages/api/org/members/finishSetup.js
import bcrypt from "bcryptjs";
import { AT, base, F, escapeAirtableString } from "@/lib/airtableOrgWorkoutConfig";

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

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { inviteToken, password } = req.body || {};
    const token = norm(inviteToken);
    const pw = String(password || "");

    if (!token) return res.status(400).json({ error: "Missing inviteToken." });
    if (!pw || pw.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    const b = base();

    const INVITE_TOKEN_FIELD = pickField(F, "MEM_INVITE_TOKEN", "InviteToken");
    const INVITE_EXPIRES_FIELD = pickField(F, "MEM_INVITE_EXPIRES", "InviteExpiresAt");
    const INVITE_USED_FIELD = pickField(F, "MEM_INVITE_USED", "InviteUsedAt");
    const ACTIVE_FIELD = pickField(F, "MEM_ACTIVE", "Active");
    const ROLE_FIELD = pickField(F, "MEM_ROLE", "Role");

    const safeToken = escapeAirtableString(token);

    // Find member by invite token
    const matches = await b(AT.tables.orgMembers)
      .select({
        filterByFormula: `AND({${INVITE_TOKEN_FIELD}}='${safeToken}')`,
        maxRecords: 5,
      })
      .firstPage();

    if (!matches?.length) {
      return res.status(404).json({ error: "Invite link is invalid or has already been used." });
    }

    // Prefer the first match (token should be unique)
    const member = matches[0];
    const fields = member.fields || {};

    if (fields[ACTIVE_FIELD] === false) {
      return res.status(403).json({ error: "This invite is inactive. Ask your org admin to resend." });
    }

    const expiresAt = fields[INVITE_EXPIRES_FIELD];
    if (isExpired(expiresAt)) {
      return res.status(410).json({ error: "Invite link expired. Ask your org admin to resend." });
    }

    // Optional: block if already used
    const usedAt = fields[INVITE_USED_FIELD];
    if (usedAt) {
      return res.status(409).json({ error: "Invite already used. Please log in." });
    }

    // Only allow trainer/admin through this flow (safety)
    const role = String(fields[ROLE_FIELD] || "").toLowerCase();
    if (!["trainer", "admin"].includes(role)) {
      return res.status(403).json({ error: "This invite is not valid for staff setup." });
    }

    const hash = await bcrypt.hash(pw, 10);

    // Save password + burn token
    await b(AT.tables.orgMembers).update(member.id, {
      PasswordHash: hash,
      [INVITE_USED_FIELD]: new Date().toISOString(),
      [INVITE_TOKEN_FIELD]: "", // burn token
    });

    return res.status(200).json({
      ok: true,
      message: "Password set! You can now log in as Staff.",
    });
  } catch (err) {
    console.error("[org/members/finishSetup] error:", err);
    return res.status(500).json({ error: "Failed to set password", details: err?.message });
  }
}
