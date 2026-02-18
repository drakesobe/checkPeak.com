// pages/api/org/reviewQueue/getReviewQueue.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";
import { requireActiveOrgSubscription } from "@/lib/requireActiveOrgSubscription";

/* ---------------- helpers ---------------- */

function missingEnv() {
  return {
    DAILYWORKOUTS_API_KEY: !process.env.DAILYWORKOUTS_API_KEY,
    DAILYWORKOUTS_BASE_ID: !process.env.DAILYWORKOUTS_BASE_ID,
    WORKOUTCOMPLETIONS_TABLE_ID: !process.env.WORKOUTCOMPLETIONS_TABLE_ID, // ✅ new
  };
}

function anyMissing(m) {
  return Object.values(m).some(Boolean);
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function asString(v) {
  return String(v ?? "").trim();
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

function pick(fields, keys, fallback = "") {
  for (const k of keys) {
    const v = fields?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return fallback;
}

// Normalize “review bucket” for UI from WorkoutCompletions.Status
function reviewBucketFromCompletionStatus(status) {
  const st = asString(status).toLowerCase();
  if (st === "completed") return "approved";
  if (st === "rejected") return "needs_info";
  return "pending"; // includes pending_review
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const missing = missingEnv();
  if (anyMissing(missing)) {
    return res.status(500).json({
      error: "Airtable env vars missing (DailyWorkouts base).",
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

    const orgToken = asString(auth?.org?.token || auth?.token || "");
    const orgId = asString(auth?.org?.id || ""); // legacy fallback
    if (!orgToken && !orgId) {
      return res.status(401).json({ error: "Unauthorized (missing org token/id)." });
    }

    const base = new Airtable({ apiKey: process.env.DAILYWORKOUTS_API_KEY }).base(
      process.env.DAILYWORKOUTS_BASE_ID
    );

    // ✅ Source of truth: WorkoutCompletions
    const table = base(process.env.WORKOUTCOMPLETIONS_TABLE_ID);

    // Detect fields (best effort)
    let fieldKeys = new Set();
    try {
      const sample = await table.select({ maxRecords: 1 }).firstPage();
      if (sample?.[0]?.fields) Object.keys(sample[0].fields).forEach((k) => fieldKeys.add(k));
    } catch {}

    const hasOrgTokenField = fieldKeys.size ? fieldKeys.has("OrgToken") : true;
    const hasOrganizationField = fieldKeys.size ? fieldKeys.has("Organization") : true;

    const orgTokenSafe = esc(orgToken);
    const orgIdSafe = esc(orgId);

    // ✅ Org match formula
    const orgMatchParts = [];

    if (orgTokenSafe && hasOrgTokenField) {
      // OrgToken is usually text on WorkoutCompletions
      orgMatchParts.push(`{OrgToken} = "${orgTokenSafe}"`);
      // if OrgToken is lookup/array-like, this catches it
      orgMatchParts.push(`FIND("${orgTokenSafe}", ARRAYJOIN({OrgToken}&"")) > 0`);
    }

    if (orgIdSafe && hasOrganizationField) {
      // Organization is typically a link; stored as array of recordIds
      orgMatchParts.push(`FIND("${orgIdSafe}", ARRAYJOIN({Organization}&"")) > 0`);
    }

    if (!orgMatchParts.length) {
      return res.status(401).json({ error: "Unauthorized (org match not possible)." });
    }

    const orgMatch =
      orgMatchParts.length === 1 ? orgMatchParts[0] : `OR(${orgMatchParts.join(",")})`;

    // ✅ Queue filter:
    // - Only completions that have an Attachment OR an AttachmentSummary
    // - Only within this org
    // - Any Status (UI filters by bucket)
    //
    // Field names per you:
    // - Attachment (not Attachments)
    // - AttachmentSummary (optional)
    //
    const filterByFormula = `AND(
      ${orgMatch},
      OR(
        COUNTA({Attachment}) > 0,
        LEN(TRIM({AttachmentSummary}&"")) > 0
      )
    )`;

    const records = await table
      .select({
        pageSize: 100,
        filterByFormula,
        sort: [{ field: "CompletedAt", direction: "desc" }],
      })
      .all()
      .catch(async () => {
        // If sorting field name differs in Airtable, fallback without sort
        return await table
          .select({
            pageSize: 100,
            filterByFormula,
          })
          .all();
      });

    const items = records.map((r) => {
      const f = r.fields || {};

      const completionStatus = pick(f, ["Status"], "pending_review");
      const reviewStatus = reviewBucketFromCompletionStatus(completionStatus);

      // ✅ Acknowledgement fields (checkbox + datetime)
      const athleteAcknowledged = Boolean(
        pick(f, ["AthleteAcknowledged", "athleteAcknowledged"], false)
      );
      const athleteAcknowledgedAt = pick(
        f,
        ["AthleteAcknowledgedAt", "athleteAcknowledgedAt"],
        ""
      );

      return {
        id: r.id,

        // "title" can be derived from WorkoutItemName lookup if you have it
        // otherwise keep generic
        title: pick(f, ["WorkoutItemName", "ExerciseName", "Title", "Name"], "Workout Completion"),

        // show a date-like value
        date: pick(f, ["CompletedAt", "Date"], ""),

        // workout completion status
        status: completionStatus,

        // UI bucket
        reviewStatus,

        // Coach message field name: ReviewNote
        coachNotes: pick(f, ["ReviewNote", "reviewNote"], ""),

        // uploads
        attachmentSummary: pick(f, ["AttachmentSummary", "Attachment Summary"], ""),
        attachments: safeArray(f?.Attachment),

        // athlete lookup fields if present
        athleteName: firstFromLookup(f?.AthleteName),
        athleteEmail: firstFromLookup(f?.AthleteEmail),

        // keep raw linkage if you use it elsewhere
        athlete: safeArray(f?.Athlete),
        createdBy: safeArray(f?.CreatedBy),
        workoutItem: safeArray(f?.WorkoutItem),
        organization: safeArray(f?.Organization),

        // ✅ ack info
        athleteAcknowledged,
        athleteAcknowledgedAt,

        createdAt: r?._rawJson?.createdTime || "",
      };
    });

    const debugEnabled =
      asString(req.query?.debug) === "1" || asString(req.query?.debug).toLowerCase() === "true";

    if (debugEnabled) {
      async function exists(formula) {
        const rows = await table.select({ filterByFormula: formula, maxRecords: 1 }).firstPage();
        return (rows || []).length;
      }

      const diag = [];
      const orgOnly = orgMatch;
      const orgAndHasUploads = `AND(${orgMatch}, OR(COUNTA({Attachment})>0, LEN(TRIM({AttachmentSummary}&""))>0))`;
      const finalQueue = filterByFormula;

      diag.push({ name: "orgMatch_only", formula: orgOnly, count: await exists(orgOnly) });
      diag.push({ name: "orgMatch_and_hasUploads", formula: orgAndHasUploads, count: await exists(orgAndHasUploads) });
      diag.push({ name: "final_queue", formula: finalQueue, count: items.length });

      const sampleRows = await table.select({ filterByFormula: orgOnly, maxRecords: 5 }).firstPage();
      const sample = (sampleRows || []).map((r) => ({
        id: r.id,
        Status: r.fields?.Status,
        OrgToken: r.fields?.OrgToken,
        Organization: r.fields?.Organization,
        CompletedAt: r.fields?.CompletedAt,
        Attachment_count: Array.isArray(r.fields?.Attachment) ? r.fields.Attachment.length : 0,
        AttachmentSummary: r.fields?.AttachmentSummary,
        ReviewNote: r.fields?.ReviewNote,
        AthleteAcknowledged: r.fields?.AthleteAcknowledged,
        AthleteAcknowledgedAt: r.fields?.AthleteAcknowledgedAt,
      }));

      return res.status(200).json({
        items,
        debug: {
          orgToken: orgToken || "",
          orgId: orgId || "",
          detectedFields: Array.from(fieldKeys),
          hasOrgTokenField,
          hasOrganizationField,
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
