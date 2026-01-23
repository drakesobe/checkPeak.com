// pages/api/org/reviewQueue/updateStatus.js

import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

/**
 * POST /api/org/reviewQueue/updateStatus
 * Body: { id, status }
 *
 * Env:
 * REVIEW_QUEUE_API_KEY
 * REVIEW_QUEUE_BASE_ID
 * REVIEW_QUEUE_TABLE_NAME
 *
 * Writes: Status
 */

function missingEnv() {
  return {
    REVIEW_QUEUE_API_KEY: !process.env.REVIEW_QUEUE_API_KEY,
    REVIEW_QUEUE_BASE_ID: !process.env.REVIEW_QUEUE_BASE_ID,
    REVIEW_QUEUE_TABLE_NAME: !process.env.REVIEW_QUEUE_TABLE_NAME,
  };
}

function anyMissing(m) {
  return Object.values(m).some(Boolean);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const missing = missingEnv();
  if (anyMissing(missing)) {
    return res.status(500).json({
      error: "ReviewQueue Airtable env vars missing.",
      missing,
      debug: { cwd: process.cwd?.() || "" },
    });
  }

  try {
    const org = await requireOrg(req);
    const orgId = String(org?.orgId || org?.OrgId || "").trim();
    if (!orgId) return res.status(401).json({ error: "Unauthorized." });

    const { id, status } = req.body || {};
    const recordId = String(id || "").trim();
    const nextStatus = String(status || "").trim().toLowerCase();

    const allowed = new Set(["pending", "needs_info", "approved", "rejected"]);
    if (!recordId) return res.status(400).json({ error: "Missing id." });
    if (!allowed.has(nextStatus))
      return res.status(400).json({ error: "Invalid status." });

    const base = new Airtable({ apiKey: process.env.REVIEW_QUEUE_API_KEY }).base(
      process.env.REVIEW_QUEUE_BASE_ID
    );
    const table = base(process.env.REVIEW_QUEUE_TABLE_NAME);

    // Optional: you can verify record belongs to org by reading it first (recommended).
    const existing = await table.find(recordId);
    const f = existing?.fields || {};
    const recOrgId = String(f?.OrgId || f?.orgId || f?.["Organization Id"] || f?.OrganizationId || "").trim();
    if (recOrgId && recOrgId !== orgId) {
      return res.status(403).json({ error: "Forbidden." });
    }

    const updated = await table.update(recordId, { Status: nextStatus });

    return res.status(200).json({
      ok: true,
      item: {
        id: updated.id,
        status: nextStatus,
      },
    });
  } catch (err) {
    console.error("[reviewQueue/updateStatus] error:", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
