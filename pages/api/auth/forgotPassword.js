// pages/api/auth/forgotPassword.js
import crypto from "crypto";
import nodemailer from "nodemailer";
import { supabaseAdmin as db } from "@/lib/supabase";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function getSmtpConfig() {
  const SMTP_HOST   = process.env.SMTP_HOST   || "smtp.gmail.com";
  const SMTP_PORT   = Number(process.env.SMTP_PORT || 465);
  const SMTP_SECURE = String(process.env.SMTP_SECURE || "true") === "true";
  const SMTP_USER   = process.env.SMTP_USER;
  const SMTP_PASS   = process.env.SMTP_PASS;
  const FROM_EMAIL  = process.env.FROM_EMAIL || SMTP_USER;
  return { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, FROM_EMAIL };
}

function safeOk(res) {
  return res.status(200).json({
    ok: true,
    message: "If your account exists, we've sent reset instructions.",
  });
}

async function findUserByEmail(cleanEmail) {
  // Try athlete first
  const { data: athlete } = await db
    .from("athletes")
    .select("id, email")
    .eq("email", cleanEmail)
    .maybeSingle();

  if (athlete) return { role: "athlete", table: "athletes", id: athlete.id };

  // Then org
  const { data: org } = await db
    .from("organizations")
    .select("id, email")
    .eq("email", cleanEmail)
    .maybeSingle();

  if (org) return { role: "organization", table: "organizations", id: org.id };

  return null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email } = req.body || {};
  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail || !cleanEmail.includes("@")) return safeOk(res);

  try {
    const found = await findUserByEmail(cleanEmail);
    if (!found) return safeOk(res);

    const token      = crypto.randomBytes(32).toString("hex");
    const tokenHash  = sha256Hex(token);
    const expiresAt  = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    await db.from(found.table).update({
      reset_token_hash:    tokenHash,
      reset_token_expires: expiresAt,
      reset_token_used_at: null,
    }).eq("id", found.id);

    const baseUrl  = getBaseUrl();
    const resetUrl =
      `${baseUrl}/reset-password` +
      `?token=${encodeURIComponent(token)}` +
      `&email=${encodeURIComponent(cleanEmail)}` +
      `&role=${encodeURIComponent(found.role)}`;

    const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, FROM_EMAIL } = getSmtpConfig();

    if (!SMTP_USER || !SMTP_PASS) {
      console.error("[forgotPassword] Missing SMTP_USER/SMTP_PASS");
      return safeOk(res);
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.verify();

    const subject = "Reset your CheckPeak password";
    const text    = `Reset your password:\n\n${resetUrl}\n\nThis link expires in 30 minutes. If you didn't request this, ignore this email.`;
    const html    = `
      <div style="font-family: Arial, sans-serif; line-height: 1.4;">
        <h2 style="margin: 0 0 12px;">Reset your password</h2>
        <p style="margin: 0 0 14px;">Click the button below to reset your CheckPeak password.</p>
        <p style="margin: 0 0 18px;">
          <a href="${resetUrl}" style="display:inline-block;padding:12px 16px;border-radius:10px;background:#46769B;color:#fff;text-decoration:none;font-weight:700;">
            Reset password
          </a>
        </p>
        <p style="margin: 0 0 10px; color: #555;">This link expires in 30 minutes. If the button doesn't work, copy and paste:</p>
        <p style="margin: 0 0 18px;"><a href="${resetUrl}">${resetUrl}</a></p>
        <p style="font-size: 12px; color: #888;">If you didn't request this, you can ignore this email.</p>
      </div>
    `;

    await transporter.sendMail({ from: `CheckPeak <${FROM_EMAIL}>`, to: cleanEmail, subject, text, html });

    return safeOk(res);
  } catch (err) {
    console.error("[forgotPassword] error:", err);
    return safeOk(res);
  }
}
