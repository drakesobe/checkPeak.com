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
    const pw    = String(password || "");

    if (!token) return res.status(400).json({ error: "Missing inviteToken." });
    if (!pw || pw.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    const b = base();

    const INVITE_TOKEN_FIELD   = pickField(F, "MEM_INVITE_TOKEN",   "InviteToken");
    const INVITE_EXPIRES_FIELD = pickField(F, "MEM_INVITE_EXPIRES", "InviteExpiresAt");
    const INVITE_USED_FIELD    = pickField(F, "MEM_INVITE_USED",    "InviteUsedAt");
    const ACTIVE_FIELD         = pickField(F, "MEM_ACTIVE",         "Active");
    const ROLE_FIELD           = pickField(F, "MEM_ROLE",           "Role");

    const safeToken = escapeAirtableString(token);

    /* 1) Find member by invite token ─────────────────────────────────────
       Token is 48 hex chars so collisions are astronomically unlikely, but
       we defensively fetch up to 5 and take the first.
    ──────────────────────────────────────────────────────────────────────── */
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

    /* 2) Role gate — checked BEFORE expiry/used ──────────────────────────
       Order matters: we check role first so that probing an expired or used
       token doesn't reveal its state to someone who isn't the intended
       recipient. If the role is wrong, we return the same 404 as "not found"
       to avoid leaking that the token exists at all.
    ──────────────────────────────────────────────────────────────────────── */
    const role = String(fields[ROLE_FIELD] || "").trim().toLowerCase();
    if (!["trainer", "admin"].includes(role)) {
      // Return 404 rather than 403 — don't confirm the token exists
      return res.status(404).json({ error: "Invite link is invalid or has already been used." });
    }

    /* 3) Expiry check ────────────────────────────────────────────────────── */
    const expiresAt = fields[INVITE_EXPIRES_FIELD];
    if (isExpired(expiresAt)) {
      return res.status(410).json({ error: "Invite link expired. Ask your org admin to resend." });
    }

    /* 4) Already used check ─────────────────────────────────────────────── */
    const usedAt = fields[INVITE_USED_FIELD];
    if (usedAt) {
      return res.status(409).json({ error: "Invite already used. Please log in." });
    }

    /* 5) Hash password + activate account ───────────────────────────────────
       All three writes happen atomically in a single Airtable update:
         - PasswordHash set       → member can now log in
         - Active = true          → account is live
         - InviteToken cleared    → link is burned, can't be replayed
         - InviteUsedAt = now     → audit trail of when setup completed
    ──────────────────────────────────────────────────────────────────────── */
    const hash = await bcrypt.hash(pw, 10);

    await b(AT.tables.orgMembers).update(member.id, {
      PasswordHash:        hash,
      [INVITE_USED_FIELD]: new Date().toISOString(),
      [INVITE_TOKEN_FIELD]: "",   // burn token so link can't be reused
      [ACTIVE_FIELD]:      true,  // activate account
    });

    return res.status(200).json({
      ok:       true,
      role,
      memberId: member.id,
      message:  "Password set! Your account is now active — you can log in as Trainer/Admin.",
    });

  } catch (err) {
    console.error("[org/members/finishSetup] error:", err);
    return res.status(500).json({ error: "Failed to set password", details: err?.message });
  }
}