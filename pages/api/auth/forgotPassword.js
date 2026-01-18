// pages/api/auth/forgotPassword.js
import crypto from "crypto";
import nodemailer from "nodemailer";
import Airtable from "airtable";

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

function getBaseUrl() {
  // Prefer explicit public app URL (best for prod)
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;

  // Vercel preview / prod URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  // Local dev fallback
  return "http://localhost:3000";
}

function getSmtpConfig() {
  const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
  const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
  const SMTP_SECURE = String(process.env.SMTP_SECURE || "true") === "true";
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS;
  const FROM_EMAIL = process.env.FROM_EMAIL || SMTP_USER;

  return { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, FROM_EMAIL };
}

function safeOk(res) {
  return res.status(200).json({
    ok: true,
    message: "If your account exists, we’ve sent reset instructions.",
  });
}

async function findUserByEmail(cleanEmail) {
  const safeEmail = escapeAirtableString(cleanEmail);

  // ---- Athletes config
  const ATHLETE_API_KEY = process.env.ATHLETE_API_KEY;
  const ATHLETE_BASE_ID = process.env.ATHLETE_BASE_ID;
  const ATHLETE_TABLE_NAME = process.env.ATHLETE_TABLE_NAME;

  // ---- Organizations config
  const ORGANIZATIONS_API_KEY = process.env.ORGANIZATIONS_API_KEY;
  const ORGANIZATIONS_BASE_ID = process.env.ORGANIZATIONS_BASE_ID;
  const ORGANIZATIONS_TABLE_NAME = process.env.ORGANIZATIONS_TABLE_NAME;

  // Try athlete first
  if (ATHLETE_API_KEY && ATHLETE_BASE_ID && ATHLETE_TABLE_NAME) {
    const athleteBase = new Airtable({ apiKey: ATHLETE_API_KEY }).base(ATHLETE_BASE_ID);

    const athleteRecords = await athleteBase(ATHLETE_TABLE_NAME)
      .select({
        filterByFormula: `LOWER({Email})='${safeEmail}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (athleteRecords?.length) {
      return {
        role: "athlete",
        base: athleteBase,
        tableName: ATHLETE_TABLE_NAME,
        record: athleteRecords[0],
      };
    }
  }

  // Then org
  if (ORGANIZATIONS_API_KEY && ORGANIZATIONS_BASE_ID && ORGANIZATIONS_TABLE_NAME) {
    const orgBase = new Airtable({ apiKey: ORGANIZATIONS_API_KEY }).base(ORGANIZATIONS_BASE_ID);

    const orgRecords = await orgBase(ORGANIZATIONS_TABLE_NAME)
      .select({
        filterByFormula: `LOWER({Email})='${safeEmail}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (orgRecords?.length) {
      return {
        role: "organization",
        base: orgBase,
        tableName: ORGANIZATIONS_TABLE_NAME,
        record: orgRecords[0],
      };
    }
  }

  return null;
}

export default async function handler(req, res) {
  // Avoid caching
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email } = req.body || {};
  const cleanEmail = normalizeEmail(email);

  // Always generic response (prevents enumeration)
  if (!cleanEmail || !cleanEmail.includes("@")) return safeOk(res);

  try {
    // Find user record in Airtable
    const found = await findUserByEmail(cleanEmail);

    // If not found, do not send email — still generic ok
    if (!found?.record) return safeOk(res);

    // Create reset token
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256Hex(token);

    // Expiry: 30 minutes
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    // Store hashed token + expiry on the user record
    await found.base(found.tableName).update(found.record.id, {
      ResetTokenHash: tokenHash,
      ResetTokenExpires: expiresAt,
      ResetTokenUsedAt: null, // optional (clears previous)
    });

    // Build reset URL (include role for faster lookup)
    const baseUrl = getBaseUrl();
    const resetUrl =
      `${baseUrl}/reset-password` +
      `?token=${encodeURIComponent(token)}` +
      `&email=${encodeURIComponent(cleanEmail)}` +
      `&role=${encodeURIComponent(found.role)}`;

    // SMTP config
    const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, FROM_EMAIL } =
      getSmtpConfig();

    if (!SMTP_USER || !SMTP_PASS) {
      console.error("[forgotPassword] Missing SMTP_USER/SMTP_PASS");
      // Still generic to user
      return safeOk(res);
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    // Verify connection/auth (debug-friendly)
    await transporter.verify();

    const subject = "Reset your CheckPeak password";
    const text = `Reset your password:\n\n${resetUrl}\n\nThis link expires in 30 minutes. If you didn’t request this, ignore this email.`;
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.4;">
        <h2 style="margin: 0 0 12px;">Reset your password</h2>
        <p style="margin: 0 0 14px;">
          Click the button below to reset your CheckPeak password.
        </p>
        <p style="margin: 0 0 18px;">
          <a href="${resetUrl}" style="display:inline-block;padding:12px 16px;border-radius:10px;background:#46769B;color:#fff;text-decoration:none;font-weight:700;">
            Reset password
          </a>
        </p>
        <p style="margin: 0 0 10px; color: #555;">
          This link expires in 30 minutes. If the button doesn’t work, copy and paste:
        </p>
        <p style="margin: 0 0 18px;">
          <a href="${resetUrl}">${resetUrl}</a>
        </p>
        <p style="font-size: 12px; color: #888;">
          If you didn’t request this, you can ignore this email.
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: `CheckPeak <${FROM_EMAIL}>`,
      to: cleanEmail,
      subject,
      text,
      html,
    });

    return safeOk(res);
  } catch (err) {
    console.error("[forgotPassword] error:", err);
    // Return generic message to user (still prevents enumeration)
    return safeOk(res);
  }
}
