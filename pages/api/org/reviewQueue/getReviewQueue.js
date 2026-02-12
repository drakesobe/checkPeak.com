// pages/api/org/reviewQueue/getReviewQueue.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";
import { requireActiveOrgSubscription } from "@/lib/requireActiveOrgSubscription";

function missingEnv() {
  return {
    DAILYWORKOUTS_API_KEY: !process.env.DAILYWORKOUTS_API_KEY,
    DAILYWORKOUTS_BASE_ID: !process.env.DAILYWORKOUTS_BASE_ID,
    DAILYWORKOUTS_TABLE_ID: !process.env.DAILYWORKOUTS_TABLE_ID,
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

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

// Escape for Airtable formula string literals (double-quoted)
function esc(str = "") {
  return String(str).replace(/\\/g, "\\\\").replace(/"/g, '\\"').trim();
}

// Lookup fields often come back as arrays
function firstFromLookup(v) {
  if (Array.isArray(v)) return String(v?.[0] ?? "").trim();
  return String(v ?? "").trim();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const missing = missingEnv();
  if (anyMissing(missing)) {
    return res.status(500).json({
      error: "DailyWorkouts Airtable env vars missing.",
      missing,
      debug: { cwd: process.cwd?.() || "" },
    });
  }

  try {
    const auth = requireOrg(req);
    if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

    // ✅ HARD GATE: subscription check (prevents direct API access)
    const sub = await requireActiveOrgSubscription(req, res, auth);
    if (!sub) return;

    const orgToken = String(auth?.org?.token || auth?.token || "").trim();
    const orgId = String(auth?.org?.id || "").trim(); // legacy fallback
    if (!orgToken && !orgId) {
      return res.status(401).json({ error: "Unauthorized (missing org token/id)." });
    }

    const base = new Airtable({ apiKey: process.env.DAILYWORKOUTS_API_KEY }).base(
      process.env.DAILYWORKOUTS_BASE_ID
    );
    const table = base(process.env.DAILYWORKOUTS_TABLE_ID);

    // Detect fields (best effort)
    let fieldKeys = new Set();
    try {
      const sample = await table.select({ maxRecords: 1 }).firstPage();
      if (sample?.[0]?.fields) Object.keys(sample[0].fields).forEach((k) => fieldKeys.add(k));
    } catch {}

    const hasOrgTokenField = fieldKeys.size ? fieldKeys.has("OrgToken") : true;
    const hasOrganizationField = fieldKeys.size ? fieldKeys.has("Organization") : true;
    const hasReviewStatusField = fieldKeys.size ? fieldKeys.has("ReviewStatus") : false;

    const orgTokenSafe = esc(orgToken);
    const orgIdSafe = esc(orgId);

    // ✅ Org match
    const orgMatchParts = [];

    if (orgTokenSafe && hasOrgTokenField) {
      orgMatchParts.push(`{OrgToken} = "${orgTokenSafe}"`);
      orgMatchParts.push(`FIND("${orgTokenSafe}", ARRAYJOIN({OrgToken})) > 0`);
    }

    // Legacy fallback (linked Organization record id)
    if (orgIdSafe && hasOrganizationField) {
      orgMatchParts.push(`FIND("${orgIdSafe}", ARRAYJOIN({Organization})) > 0`);
    }

    const orgMatch = orgMatchParts.length === 1 ? orgMatchParts[0] : `OR(${orgMatchParts.join(",")})`;

    // Return all statuses; UI filters.
    const filterByFormula = `AND(
      {Status} != "draft",
      OR(COUNTA({Attachments})>0, LEN(TRIM({Attachment Summary}&""))>0),
      ${orgMatch}
    )`;

    const records = await table
      .select({
        pageSize: 100,
        filterByFormula,
        sort: [{ field: "ReviewedAt", direction: "desc" }],
      })
      .all()
      .catch(async () => {
        return await table
          .select({
            pageSize: 100,
            filterByFormula,
          })
          .all();
      });

    const items = records.map((r) => {
      const f = r.fields || {};
      const reviewStatusRaw = hasReviewStatusField ? pick(f, ["ReviewStatus"], "pending") : "pending";
      const reviewStatus = String(reviewStatusRaw || "pending").trim().toLowerCase();

      return {
        id: r.id,
        title: pick(f, ["Title"], "Daily Workout"),
        date: pick(f, ["Date"], ""),
        status: pick(f, ["Status"], ""),
        reviewStatus,
        reviewedAt: pick(f, ["ReviewedAt"], ""),
        reviewedByText: pick(f, ["ReviewedByText"], ""),

        attachmentSummary: pick(f, ["Attachment Summary"], ""),
        attachments: safeArray(f?.Attachments),

        athleteName: firstFromLookup(f?.AthleteName),
        athleteEmail: firstFromLookup(f?.AthleteEmail),

        athlete: safeArray(f?.Athlete),
        createdBy: safeArray(f?.CreatedBy),
        workoutItems: safeArray(f?.WorkoutItems),

        createdAt: r?._rawJson?.createdTime || "",
      };
    });

    const debugEnabled =
      String(req.query?.debug || "").trim() === "1" || String(req.query?.debug || "").trim() === "true";

    if (debugEnabled) {
      async function exists(formula) {
        const rows = await table.select({ filterByFormula: formula, maxRecords: 1 }).firstPage();
        return (rows || []).length;
      }

      const diag = [];
      const orgOnly = orgMatch;
      const orgAndNotDraft = `AND(${orgMatch}, {Status} != "draft")`;
      const orgAndHasUploads = `AND(${orgMatch}, OR(COUNTA({Attachments})>0, LEN(TRIM({Attachment Summary}&""))>0))`;
      const finalQueue = filterByFormula;

      diag.push({ name: "orgMatch_only", formula: orgOnly, count: await exists(orgOnly) });
      diag.push({ name: "orgMatch_and_notDraft", formula: orgAndNotDraft, count: await exists(orgAndNotDraft) });
      diag.push({ name: "orgMatch_and_hasUploads", formula: orgAndHasUploads, count: await exists(orgAndHasUploads) });
      diag.push({ name: "final_queue", formula: finalQueue, count: items.length });

      const sampleRows = await table.select({ filterByFormula: orgOnly, maxRecords: 5 }).firstPage();
      const sample = (sampleRows || []).map((r) => ({
        id: r.id,
        Date: r.fields?.Date,
        Status: r.fields?.Status,
        ReviewStatus: r.fields?.ReviewStatus,
        ReviewedAt: r.fields?.ReviewedAt,
        ReviewedByText: r.fields?.ReviewedByText,
        OrgToken: r.fields?.OrgToken,
        Organization: r.fields?.Organization,
        AthleteName: r.fields?.AthleteName,
        AthleteEmail: r.fields?.AthleteEmail,
        Attachments_count: Array.isArray(r.fields?.Attachments) ? r.fields.Attachments.length : 0,
        Attachment_Summary: r.fields?.["Attachment Summary"],
        Title: r.fields?.Title,
      }));

      return res.status(200).json({
        items,
        debug: {
          orgToken: orgToken || "",
          orgId: orgId || "",
          detectedFields: Array.from(fieldKeys),
          hasOrgTokenField,
          hasOrganizationField,
          hasReviewStatusField,
          orgMatch,
          filterByFormula,
          count: items.length,
          diag,
          sample,
          billingGate: sub,
        },
      });
    }

    return res.status(200).json({ items });
  } catch (err) {
    console.error("[getReviewQueue] error:", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
