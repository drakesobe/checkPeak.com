// pages/api/update-password.js
import Airtable from "airtable";
import bcrypt from "bcryptjs";

/**
 * Update Password (Athlete + Org Owner + Org Staff)
 *
 * Supports:
 * - Athlete: Password field on Athletes table
 * - Organization owner: Password field on Organizations table
 * - Org staff (Admin/Trainer): PasswordHash field on OrgMembers table
 *
 * Request body:
 * {
 *   role: "athlete" | "organization" | "admin" | "trainer" | "staff" (optional)
 *   currentPassword: string,
 *   newPassword: string,
 *
 *   // one of these depending on role
 *   athleteId?: string,
 *   organizationId?: string,
 *   memberId?: string
 * }
 */

function normRole(role) {
  const r = String(role || "").trim().toLowerCase();
  if (r === "org" || r === "owner" || r.includes("organization")) return "organization";
  if (r.includes("admin")) return "admin";
  if (r.includes("train")) return "trainer";
  if (r.includes("staff")) return "staff";
  if (r.includes("ath")) return "athlete";
  return r || "athlete";
}

function pickTruthy(...vals) {
  for (const v of vals) {
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function requireEnv(name) {
  if (!process.env[name]) throw new Error(`Missing env var: ${name}`);
  return process.env[name];
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    role: roleIn,
    currentPassword,
    newPassword,
    athleteId,
    organizationId,
    memberId,
  } = req.body || {};

  const role = normRole(roleIn);

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current password and new password are required." });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters." });
  }

  try {
    // ----------------------------
    // ATHLETE
    // ----------------------------
    if (role === "athlete") {
      const id = pickTruthy(athleteId);
      if (!id) return res.status(400).json({ error: "athleteId is required for athlete password updates." });

      const apiKey = requireEnv("ATHLETE_API_KEY");
      const baseId = requireEnv("ATHLETE_BASE_ID");
      const tableName = requireEnv("ATHLETE_TABLE_NAME");

      const base = new Airtable({ apiKey }).base(baseId);

      const record = await base(tableName).find(id);
      if (!record) return res.status(404).json({ error: "Athlete not found." });

      const storedHash = String(record.fields?.Password || "");
      if (!storedHash) return res.status(500).json({ error: "Athlete record missing Password hash." });

      const ok = await bcrypt.compare(String(currentPassword), storedHash);
      if (!ok) return res.status(401).json({ error: "Current password is incorrect." });

      const hashedNew = await bcrypt.hash(String(newPassword), 10);

      const updated = await base(tableName).update([
        { id, fields: { Password: hashedNew } },
      ]);

      return res.status(200).json({
        success: true,
        message: "Password updated successfully.",
        updated: updated?.[0]?.id,
      });
    }

    // ----------------------------
    // ORG OWNER (Organizations table)
    // ----------------------------
    if (role === "organization") {
      const id = pickTruthy(organizationId);
      if (!id) return res.status(400).json({ error: "organizationId is required for organization password updates." });

      const apiKey = requireEnv("ORGANIZATIONS_API_KEY");
      const baseId = requireEnv("ORGANIZATIONS_BASE_ID");
      const tableName = requireEnv("ORGANIZATIONS_TABLE_NAME");

      const base = new Airtable({ apiKey }).base(baseId);

      const record = await base(tableName).find(id);
      if (!record) return res.status(404).json({ error: "Organization not found." });

      const storedHash = String(record.fields?.Password || "");
      if (!storedHash) return res.status(500).json({ error: "Organization record missing Password hash." });

      const ok = await bcrypt.compare(String(currentPassword), storedHash);
      if (!ok) return res.status(401).json({ error: "Current password is incorrect." });

      const hashedNew = await bcrypt.hash(String(newPassword), 10);

      const updated = await base(tableName).update([
        { id, fields: { Password: hashedNew } },
      ]);

      return res.status(200).json({
        success: true,
        message: "Password updated successfully.",
        updated: updated?.[0]?.id,
      });
    }

    // ----------------------------
    // ORG STAFF (OrgMembers table)
    // role: admin/trainer/staff -> PasswordHash
    // ----------------------------
    if (role === "admin" || role === "trainer" || role === "staff") {
      const id = pickTruthy(memberId);
      if (!id) return res.status(400).json({ error: "memberId is required for staff password updates." });

      const apiKey = requireEnv("ORGANIZATIONS_API_KEY");
      const baseId = requireEnv("ORGANIZATIONS_BASE_ID");

      // your OrgMembers is stored as a TABLE ID env (works with Airtable SDK)
      const orgMembersTable =
        process.env.ORG_MEMBERS_TABLE_ID || "tblRvpw7XeVZfdKIq";

      const base = new Airtable({ apiKey }).base(baseId);

      const record = await base(orgMembersTable).find(id);
      if (!record) return res.status(404).json({ error: "Staff member not found." });

      const storedHash = String(record.fields?.PasswordHash || "");
      if (!storedHash) {
        return res.status(409).json({
          error: "This staff account isn’t ready yet. Please finish setup from your invite link.",
        });
      }

      const ok = await bcrypt.compare(String(currentPassword), storedHash);
      if (!ok) return res.status(401).json({ error: "Current password is incorrect." });

      const hashedNew = await bcrypt.hash(String(newPassword), 10);

      const updated = await base(orgMembersTable).update([
        { id, fields: { PasswordHash: hashedNew } },
      ]);

      return res.status(200).json({
        success: true,
        message: "Password updated successfully.",
        updated: updated?.[0]?.id,
      });
    }

    // Fallback (unknown role)
    return res.status(400).json({ error: "Unsupported role for password updates." });
  } catch (err) {
    console.error("[update-password] error:", err);
    // Airtable errors often have statusCode/message
    return res.status(500).json({
      error: "Failed to update password.",
      details: err?.message,
      airtable: {
        statusCode: err?.statusCode,
        message: err?.message,
        error: err?.error,
      },
    });
  }
}
