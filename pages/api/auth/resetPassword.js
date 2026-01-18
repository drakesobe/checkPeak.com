// pages/api/auth/resetPassword.js
import crypto from "crypto";
import Airtable from "airtable";
import bcrypt from "bcryptjs";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function escapeAirtableString(str = "") {
  return String(str).replace(/'/g, "\\'");
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

function normalizeRole(role) {
  const r = String(role || "").trim().toLowerCase();
  if (r === "organization" || r === "org") return "organization";
  if (r === "athlete") return "athlete";
  return ""; // unknown
}

async function findUserByEmailInRole(cleanEmail, roleNorm) {
  const safeEmail = escapeAirtableString(cleanEmail);

  // ---- Athletes config
  const ATHLETE_API_KEY = process.env.ATHLETE_API_KEY;
  const ATHLETE_BASE_ID = process.env.ATHLETE_BASE_ID;
  const ATHLETE_TABLE_NAME = process.env.ATHLETE_TABLE_NAME;

  // ---- Organizations config
  const ORGANIZATIONS_API_KEY = process.env.ORGANIZATIONS_API_KEY;
  const ORGANIZATIONS_BASE_ID = process.env.ORGANIZATIONS_BASE_ID;
  const ORGANIZATIONS_TABLE_NAME = process.env.ORGANIZATIONS_TABLE_NAME;

  if (roleNorm === "athlete") {
    if (!ATHLETE_API_KEY || !ATHLETE_BASE_ID || !ATHLETE_TABLE_NAME) return null;

    const base = new Airtable({ apiKey: ATHLETE_API_KEY }).base(ATHLETE_BASE_ID);
    const records = await base(ATHLETE_TABLE_NAME)
      .select({ filterByFormula: `LOWER({Email})='${safeEmail}'`, maxRecords: 1 })
      .firstPage();

    if (!records?.length) return null;
    return { role: "athlete", base, tableName: ATHLETE_TABLE_NAME, record: records[0] };
  }

  if (roleNorm === "organization") {
    if (!ORGANIZATIONS_API_KEY || !ORGANIZATIONS_BASE_ID || !ORGANIZATIONS_TABLE_NAME) return null;

    const base = new Airtable({ apiKey: ORGANIZATIONS_API_KEY }).base(ORGANIZATIONS_BASE_ID);
    const records = await base(ORGANIZATIONS_TABLE_NAME)
      .select({ filterByFormula: `LOWER({Email})='${safeEmail}'`, maxRecords: 1 })
      .firstPage();

    if (!records?.length) return null;
    return { role: "organization", base, tableName: ORGANIZATIONS_TABLE_NAME, record: records[0] };
  }

  return null;
}

async function findUserByEmailAnyRole(cleanEmail) {
  // Try athlete first, then org
  const athlete = await findUserByEmailInRole(cleanEmail, "athlete");
  if (athlete) return athlete;
  const org = await findUserByEmailInRole(cleanEmail, "organization");
  if (org) return org;
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, token, role, newPassword } = req.body || {};
  const cleanEmail = normalizeEmail(email);
  const roleNorm = normalizeRole(role);

  if (!cleanEmail || !cleanEmail.includes("@")) {
    return res.status(400).json({ error: "Invalid email" });
  }
  if (!token || String(token).length < 10) {
    return res.status(400).json({ error: "Invalid token" });
  }
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  try {
    const found = roleNorm
      ? await findUserByEmailInRole(cleanEmail, roleNorm)
      : await findUserByEmailAnyRole(cleanEmail);

    if (!found?.record) {
      return res.status(400).json({ error: "Invalid or expired reset link" });
    }

    const fields = found.record.fields || {};
    const storedHash = String(fields.ResetTokenHash || "");
    const storedExpiry = fields.ResetTokenExpires ? new Date(fields.ResetTokenExpires) : null;

    if (!storedHash || !storedExpiry) {
      return res.status(400).json({ error: "Invalid or expired reset link" });
    }

    // Verify token match
    const incomingHash = sha256Hex(token);
    if (incomingHash !== storedHash) {
      return res.status(400).json({ error: "Invalid or expired reset link" });
    }

    // Verify not expired
    const now = new Date();
    if (Number.isNaN(storedExpiry.getTime()) || storedExpiry.getTime() < now.getTime()) {
      return res.status(400).json({ error: "Invalid or expired reset link" });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(String(newPassword), 12);

    // Update password + clear reset token so it can't be reused
    await found.base(found.tableName).update(found.record.id, {
      Password: passwordHash,
      ResetTokenHash: null,
      ResetTokenExpires: null,
      ResetTokenUsedAt: new Date().toISOString(),
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[resetPassword] error:", err);
    return res.status(500).json({ error: "Failed to reset password" });
  }
}
