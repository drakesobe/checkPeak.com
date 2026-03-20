// pages/api/org/reviewQueue/getReviewQueue.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";
import { requireActiveOrgSubscription } from "@/lib/requireActiveOrgSubscription";

function missingEnv() {
  return {
    DAILYWORKOUTS_API_KEY:       !process.env.DAILYWORKOUTS_API_KEY,
    DAILYWORKOUTS_BASE_ID:       !process.env.DAILYWORKOUTS_BASE_ID,
    WORKOUTCOMPLETIONS_TABLE_ID: !process.env.WORKOUTCOMPLETIONS_TABLE_ID,
  };
}

function anyMissing(m) { return Object.values(m).some(Boolean); }
function safeArray(v)  { return Array.isArray(v) ? v : []; }
function asString(v)   { return String(v ?? "").trim(); }

function esc(str = "") {
  return String(str).replace(/\\/g, "\\\\").replace(/"/g, '\\"').trim();
}

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

function reviewBucketFromCompletionStatus(status) {
  const st = asString(status).toLowerCase();
  if (st === "completed") return "approved";
  if (st === "rejected")  return "needs_info";
  return "pending";
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const missing = missingEnv();
  if (anyMissing(missing)) {
    return res.status(500).json({ error: "Airtable env vars missing.", missing });
  }

  try {
    const auth = requireOrg(req);
    if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

    const sub = await requireActiveOrgSubscription(req, res, auth);
    if (!sub) return;

    const orgToken = asString(auth?.org?.token || "");
    const orgId    = asString(auth?.org?.id    || "");
    if (!orgToken && !orgId) {
      return res.status(401).json({ error: "Unauthorized (missing org token/id)." });
    }

    const base  = new Airtable({ apiKey: process.env.DAILYWORKOUTS_API_KEY }).base(process.env.DAILYWORKOUTS_BASE_ID);
    const table = base(process.env.WORKOUTCOMPLETIONS_TABLE_ID);

    /* ── Detect available fields ── */
    let fieldKeys = new Set();
    try {
      const sample = await table.select({ maxRecords: 1 }).firstPage();
      if (sample?.[0]?.fields) Object.keys(sample[0].fields).forEach(k => fieldKeys.add(k));
    } catch {}

    const hasOrgTokenField     = fieldKeys.size ? fieldKeys.has("OrgToken")     : true;
    const hasOrganizationField = fieldKeys.size ? fieldKeys.has("Organization") : true;

    const orgMatchParts = [];
    if (orgToken && hasOrgTokenField) {
      const t = esc(orgToken);
      orgMatchParts.push(`{OrgToken} = "${t}"`);
      orgMatchParts.push(`FIND("${t}", ARRAYJOIN({OrgToken}&"")) > 0`);
    }
    if (orgId && hasOrganizationField) {
      orgMatchParts.push(`FIND("${esc(orgId)}", ARRAYJOIN({Organization}&"")) > 0`);
    }
    if (!orgMatchParts.length) {
      return res.status(401).json({ error: "Unauthorized (org match not possible)." });
    }

    const orgMatch = orgMatchParts.length === 1
      ? orgMatchParts[0]
      : `OR(${orgMatchParts.join(",")})`;

    const filterByFormula = `AND(
      ${orgMatch},
      OR(
        COUNTA({Attachment}) > 0,
        LEN(TRIM({AttachmentSummary}&"")) > 0
      )
    )`;

    const records = await table
      .select({
        pageSize:        100,
        filterByFormula,
        sort:            [{ field: "CompletedAt", direction: "desc" }],
      })
      .all()
      .catch(async () =>
        await table.select({ pageSize: 100, filterByFormula }).all()
      );

    /* ── Batch-fetch WorkoutItems to get ExerciseName ─────────────────────
       Each WorkoutCompletion has a WorkoutItem linked field (array of IDs).
       We collect all unique IDs, fetch them in batches of 10, and build a
       map so we can attach ExerciseName to each completion row.
    ── */
    const allItemIds = [
      ...new Set(
        records.flatMap(r => safeArray(r.fields?.WorkoutItem).map(String).filter(Boolean))
      ),
    ];

    const exerciseNameById = new Map();

    if (allItemIds.length > 0) {
      try {
        const WorkoutItems = base(process.env.WORKOUTITEMS_TABLE_ID || "WorkoutItems");

        for (const batch of chunk(allItemIds, 10)) {
          const formula = `OR(${batch.map(id => `RECORD_ID()="${esc(id)}"`).join(",")})`;
          const rows    = await WorkoutItems
            .select({
              filterByFormula: formula,
              fields:          ["ExerciseName", "Name"],
              maxRecords:      batch.length,
            })
            .firstPage();

          for (const row of rows || []) {
            const name = asString(
              row.fields?.ExerciseName || row.fields?.Name
            );
            if (name) exerciseNameById.set(row.id, name);
          }
        }
      } catch (itemErr) {
        // Non-fatal — completions still return, just without exercise names
        console.warn("[getReviewQueue] WorkoutItems fetch failed:", itemErr?.message);
      }
    }

    /* ── Build items ── */
    const items = records.map(r => {
      const f = r.fields || {};

      const completionStatus = pick(f, ["Status"], "pending_review");
      const reviewStatus     = reviewBucketFromCompletionStatus(completionStatus);

      const athleteAcknowledged   = Boolean(pick(f, ["AthleteAcknowledged",   "athleteAcknowledged"],   false));
      const athleteAcknowledgedAt =         pick(f, ["AthleteAcknowledgedAt", "athleteAcknowledgedAt"], "");

      // Resolve ExerciseName from linked WorkoutItem
      const workoutItemIds  = safeArray(f?.WorkoutItem).map(String).filter(Boolean);
      const exerciseName    = workoutItemIds.map(id => exerciseNameById.get(id)).filter(Boolean).join(", ");

      // Title: ExerciseName from linked record wins, then lookup fields, then generic
      const title = exerciseName ||
        pick(f, ["WorkoutItemName", "ExerciseName", "Title", "Name"], "Workout Completion");

      return {
        id: r.id,

        title,
        exerciseName, // explicit field for the detail panel

        date:   pick(f, ["CompletedAt", "Date"], ""),
        status: completionStatus,
        reviewStatus,

        coachNotes:       pick(f, ["ReviewNote", "reviewNote"], ""),
        attachmentSummary: pick(f, ["AttachmentSummary", "Attachment Summary"], ""),
        attachments:       safeArray(f?.Attachment),

        athleteName:  firstFromLookup(f?.AthleteName),
        athleteEmail: firstFromLookup(f?.AthleteEmail),

        athlete:      safeArray(f?.Athlete),
        workoutItem:  workoutItemIds,
        organization: safeArray(f?.Organization),

        athleteAcknowledged,
        athleteAcknowledgedAt,

        createdAt: r?._rawJson?.createdTime || "",
      };
    });

    return res.status(200).json({ items });

  } catch (err) {
    console.error("[getReviewQueue] error:", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}