// pages/api/org/reviewQueue/list.js

import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

/**
 * GET /api/org/reviewQueue/list
 * Returns review queue items for the org.
 *
 * Env:
 * REVIEW_QUEUE_API_KEY
 * REVIEW_QUEUE_BASE_ID
 * REVIEW_QUEUE_TABLE_NAME
 *
 * Table expected fields (flexible; we map safely):
 * - OrgId (or Organization Id / orgId)  [single line]
 * - Status (pending | needs_info | approved | rejected)
 * - Title / Product Name / Type
 * - Athlete Email
 * - Athlete Name
 * - Reason / Summary
 * - Tags (multi-select or text)
 * - Created At (optional; we’ll use airtable createdTime if missing)
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

function pick(fields, keys, fallback = "") {
  for (const k of keys) {
    const v = fields?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return fallback;
}

function normTags(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  // allow comma-separated single line
  return String(v)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const missing = missingEnv();
  if (anyMissing(missing)) {
    return res.status(500).json({
      error: "ReviewQueue Airtable env vars missing.",
      missing,
      debug: { cwd: process.cwd?.() || "" },
    });
  }

  try {
    // ✅ relies on cookie session
    const org = await requireOrg(req); // should return { orgId, ... }
    const orgId = String(org?.orgId || org?.OrgId || "").trim();
    if (!orgId) return res.status(401).json({ error: "Unauthorized (missing orgId)." });

    const base = new Airtable({ apiKey: process.env.REVIEW_QUEUE_API_KEY }).base(
      process.env.REVIEW_QUEUE_BASE_ID
    );

    const table = base(process.env.REVIEW_QUEUE_TABLE_NAME);

    // Filter: match orgId; support a few field naming variants
    // Airtable filter formulas need exact field names; you can standardize to "OrgId"
    const filter = `OR({OrgId}="${orgId}", {orgId}="${orgId}", {Organization Id}="${orgId}", {OrganizationId}="${orgId}")`;

    const records = await table
      .select({
        pageSize: 100,
        sort: [{ field: "Created", direction: "desc" }], // if exists
        filterByFormula: filter,
      })
      .all()
      .catch(async () => {
        // If sort field doesn't exist, retry without it
        return await table.select({ pageSize: 100, filterByFormula: filter }).all();
      });

    const items = records.map((r) => {
      const f = r.fields || {};
      const status = String(pick(f, ["Status", "status"], "pending")).toLowerCase();

      return {
        id: r.id,
        status,
        type: pick(f, ["Type", "type"], ""),
        title: pick(f, ["Title", "title", "Product Name", "Product", "Name"], ""),
        productName: pick(f, ["Product Name", "Product", "Name"], ""),
        brand: pick(f, ["Brand", "brand"], ""),
        athleteEmail: pick(f, ["Athlete Email", "athleteEmail", "Email"], ""),
        athleteName: pick(f, ["Athlete Name", "athleteName", "Athlete"], ""),
        trainerName: pick(f, ["Trainer Name", "trainerName", "Coach"], ""),
        reason: pick(f, ["Reason", "Summary", "reason", "summary"], ""),
        notes: pick(f, ["Notes", "notes"], ""),
        tags: normTags(pick(f, ["Tags", "tags"], "")),
        createdAt: pick(f, ["Created At", "createdAt", "Created"], r._rawJson?.createdTime || ""),
      };
    });

    return res.status(200).json({ items });
  } catch (err) {
    console.error("[reviewQueue/list] error:", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
