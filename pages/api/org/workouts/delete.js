// pages/api/org/workouts/delete.js
// POST { id: string }
// Hard-deletes a DailyWorkouts record by ID after verifying it belongs
// to the currently authenticated org-side user.

import Airtable from "airtable";
import { requireOrgSideUser } from "@/lib/requireUser";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function norm(v) {
  return String(v || "").trim();
}

function normLower(v) {
  return norm(v).toLowerCase();
}

function envMissing() {
  return {
    DAILYWORKOUTS_API_KEY: !process.env.DAILYWORKOUTS_API_KEY,
    DAILYWORKOUTS_BASE_ID: !process.env.DAILYWORKOUTS_BASE_ID,
    DAILYWORKOUTS_TABLE_ID: !process.env.DAILYWORKOUTS_TABLE_ID,
  };
}

function buildOrgCandidates(user) {
  const orgId = String(user?.org?.id || user?.orgId || user?.OrgId || "").trim();
  const orgToken = String(user?.org?.token || user?.Token || user?.token || "").trim();

  const orgName = String(
    user?.org?.name ||
      user?.org?.Name ||
      user?.orgName ||
      user?.OrgName ||
      user?.organizationName ||
      user?.["Organization Name"] ||
      ""
  ).trim();

  const candidates = [orgName, orgToken, orgId].filter(Boolean);

  return { orgId, orgToken, orgName, candidates };
}

function recordBelongsToOrg(record, candidates) {
  const f = record?.fields || {};

  // In your setup, linked record fields stringify to PRIMARY values
  // and on find() they may come back as an array of those linked primary strings.
  const orgLinked = safeArray(f?.Organization).map((v) => String(v || "").trim()).filter(Boolean);

  const joined = orgLinked.join(" | ").toLowerCase();
  const normalizedCandidates = safeArray(candidates).map((c) => String(c || "").trim()).filter(Boolean);

  if (!normalizedCandidates.length) return false;
  if (!orgLinked.length) return false;

  return normalizedCandidates.some((candidate) => {
    const c = candidate.toLowerCase();
    return orgLinked.some((value) => normLower(value) === c) || joined.includes(c);
  });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const missing = envMissing();
  if (
    missing.DAILYWORKOUTS_API_KEY ||
    missing.DAILYWORKOUTS_BASE_ID ||
    missing.DAILYWORKOUTS_TABLE_ID
  ) {
    return res.status(500).json({
      error: "DailyWorkouts Airtable env vars missing.",
      missing,
    });
  }

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const { orgId, orgToken, orgName, candidates } = buildOrgCandidates(user);

  const { id } = req.body || {};
  const recordId = String(id || "").trim();

  if (!recordId) {
    return res.status(400).json({ error: "id is required" });
  }

  if (!candidates.length) {
    return res.status(400).json({
      error:
        "Missing org identity on session (need at least orgName or orgToken or orgId).",
      debug: {
        has_orgId: Boolean(orgId),
        has_orgToken: Boolean(orgToken),
        has_orgName: Boolean(orgName),
      },
    });
  }

  const base = new Airtable({
    apiKey: process.env.DAILYWORKOUTS_API_KEY,
  }).base(process.env.DAILYWORKOUTS_BASE_ID);

  const TABLE_ID = process.env.DAILYWORKOUTS_TABLE_ID;

  try {
    const record = await base(TABLE_ID).find(recordId);

    if (!record) {
      return res.status(404).json({ error: "Workout not found" });
    }

    const allowed = recordBelongsToOrg(record, candidates);

    if (!allowed) {
      return res.status(403).json({
        error: "Access denied",
        debug: {
          recordId,
          orgId,
          orgToken,
          orgName,
          orgCandidates: candidates,
          recordOrganization: safeArray(record?.fields?.Organization),
        },
      });
    }

    await base(TABLE_ID).destroy(recordId);

    return res.status(200).json({
      ok: true,
      deleted: recordId,
    });
  } catch (err) {
    console.error("[api/org/workouts/delete] error:", err);

    const status = err?.statusCode || err?.status || 500;

    if (status === 404) {
      return res.status(404).json({ error: "Workout not found" });
    }

    if (status === 401 || status === 403) {
      return res.status(status).json({
        error:
          "Airtable authorization error. Verify DAILYWORKOUTS_API_KEY has access to the DAILYWORKOUTS base/table and correct scopes.",
      });
    }

    return res.status(500).json({
      error: "Failed to delete workout.",
      details: err?.message || String(err),
      debug: {
        recordId,
        orgId,
        orgToken,
        orgName,
        orgCandidates: candidates,
      },
    });
  }
}