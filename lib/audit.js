// lib/audit.js
import Airtable from "airtable";

const auditBase =
  process.env.AUDIT_API_KEY && process.env.AUDIT_BASE_ID
    ? new Airtable({ apiKey: process.env.AUDIT_API_KEY }).base(process.env.AUDIT_BASE_ID)
    : null;

export async function logAuditEvent({
  action,
  orgToken,
  actorEmail = "",
  targetEmail = "",
  meta = {},
}) {
  const TABLE = process.env.AUDIT_TABLE_NAME || "AuditLog";
  if (!auditBase) return; // silently no-op if not configured

  try {
    await auditBase(TABLE).create({
      OrgToken: String(orgToken || ""),
      Action: String(action || ""),
      ActorEmail: String(actorEmail || ""),
      TargetEmail: String(targetEmail || ""),
      Meta: JSON.stringify(meta || {}),
    });
  } catch (err) {
    // don’t break product flow if audit fails
    console.warn("[audit] failed:", err?.message || err);
  }
}
