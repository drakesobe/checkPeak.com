// pages/api/auth/resetPassword.js
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { supabaseAdmin as db } from "@/lib/supabase";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

function normalizeRole(role) {
  const r = String(role || "").trim().toLowerCase();
  if (r === "organization" || r === "org") return "organization";
  if (r === "athlete") return "athlete";
  return "";
}

async function findUserByEmailInRole(cleanEmail, roleNorm) {
  if (roleNorm === "athlete") {
    const { data } = await db.from("athletes")
      .select("id, reset_token_hash, reset_token_expires")
      .eq("email", cleanEmail)
      .maybeSingle();
    if (data) return { table: "athletes", ...data };
  }

  if (roleNorm === "organization") {
    const { data } = await db.from("organizations")
      .select("id, reset_token_hash, reset_token_expires")
      .eq("email", cleanEmail)
      .maybeSingle();
    if (data) return { table: "organizations", ...data };
  }

  return null;
}

async function findUserByEmailAnyRole(cleanEmail) {
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
  const roleNorm   = normalizeRole(role);

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

    if (!found) {
      return res.status(400).json({ error: "Invalid or expired reset link" });
    }

    const storedHash   = String(found.reset_token_hash    || "");
    const storedExpiry = found.reset_token_expires ? new Date(found.reset_token_expires) : null;

    if (!storedHash || !storedExpiry) {
      return res.status(400).json({ error: "Invalid or expired reset link" });
    }

    const incomingHash = sha256Hex(token);
    if (incomingHash !== storedHash) {
      return res.status(400).json({ error: "Invalid or expired reset link" });
    }

    const now = new Date();
    if (Number.isNaN(storedExpiry.getTime()) || storedExpiry.getTime() < now.getTime()) {
      return res.status(400).json({ error: "Invalid or expired reset link" });
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 12);

    await db.from(found.table).update({
      password:            passwordHash,
      reset_token_hash:    null,
      reset_token_expires: null,
      reset_token_used_at: new Date().toISOString(),
    }).eq("id", found.id);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[resetPassword] error:", err);
    return res.status(500).json({ error: "Failed to reset password" });
  }
}
