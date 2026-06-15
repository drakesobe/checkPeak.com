// pages/api/admin/backfill/completionEvidence.js
// GET ?secret=xxx&dry=true
//
// Backfills Supabase `completion_evidence` from the Airtable WorkoutCompletions
// table — specifically any records that have native Airtable attachment fields
// or a PhotoUrl / AttachmentUrl text field.
//
// Also picks up any Supabase workout_completions rows that have attachment_url set.
//
// Safe to run multiple times — skips rows where (completion_id + url) already exist.

import Airtable from "airtable";
import { supabaseAdmin as db } from "@/lib/supabase";

const BACKFILL_SECRET = process.env.BACKFILL_SECRET || "";

function firstUrl(val) {
  if (!val) return null;
  if (typeof val === "string" && val.startsWith("http")) return val;
  if (Array.isArray(val)) {
    // Native Airtable attachment field: [{url, filename, ...}]
    const hit = val.find(a => a?.url?.startsWith("http"));
    return hit?.url || null;
  }
  return null;
}

function allUrls(val) {
  if (!val) return [];
  if (typeof val === "string" && val.startsWith("http")) return [val];
  if (Array.isArray(val)) return val.map(a => a?.url).filter(u => u?.startsWith("http"));
  return [];
}

// ── Source 1: Airtable WorkoutCompletions — scan for any attachment/url fields ─

async function fetchAirtableCompletionsWithAttachments() {
  const apiKey  = process.env.WORKOUTCOMPLETIONS_API_KEY || "pat1Ao6koEcVayfoB.8027551fd5a3c46ba1dfa888018977f56283a38860df91197b33b468ca483969";
  const baseId  = process.env.WORKOUTCOMPLETIONS_BASE_ID || "appspE640Pggw1VP9";
  const tableId = process.env.WORKOUTCOMPLETIONS_TABLE_ID || "tbljis6BzH1DasOXa";

  const base    = new Airtable({ apiKey }).base(baseId);
  const table   = base(tableId);

  // Fetch all completions (paginated automatically by .all())
  const records = await table.select({ pageSize: 100 }).all();

  const results = [];
  for (const r of records) {
    const f = r.fields || {};

    // Collect every field that could hold a photo/video URL
    const candidateUrls = [];
    for (const [key, val] of Object.entries(f)) {
      const urls = allUrls(val);
      if (urls.length) {
        const lk = key.toLowerCase();
        const isMedia = lk.includes("attach") || lk.includes("photo") || lk.includes("video")
                     || lk.includes("evidence") || lk.includes("url") || lk.includes("file")
                     || lk.includes("image") || lk.includes("media");
        if (isMedia) candidateUrls.push(...urls);
      }
    }

    if (!candidateUrls.length) continue;

    // Identify athlete info
    const athleteToken = String(f?.AthleteToken || f?.["Athlete Token"] || "").trim();

    results.push({
      airtableId: r.id,
      athleteToken,
      urls: candidateUrls,
      submittedAt: r._rawJson?.createdTime || null,
      _fieldNames: Object.keys(f),
    });
  }

  return results;
}

// ── Source 2: Supabase completions with attachment_url ──────────────────────

async function fetchSupabaseCompletionsWithUrl() {
  const { data, error } = await db
    .from("workout_completions")
    .select("id, athlete_id, attachment_url, attachment_type, completed_at")
    .not("attachment_url", "is", null)
    .neq("attachment_url", "");

  if (error) {
    console.warn("[backfill] attachment_url select failed (column may not exist):", error.message);
    return [];
  }
  return (data ?? []).filter(r => r.attachment_url?.startsWith("http"));
}

// ── Core insert helper ───────────────────────────────────────────────────────

async function insertEvidence({ workoutCompletionId, athleteId, url, evidenceType, submittedAt }, dry) {
  // Skip if already exists (idempotent)
  const { data: existing } = await db
    .from("completion_evidence")
    .select("id")
    .eq("workout_completion_id", workoutCompletionId)
    .eq("url", url)
    .maybeSingle();

  if (existing) return { skipped: true };
  if (dry) return { inserted: true, dry: true };

  const { error } = await db.from("completion_evidence").insert({
    workout_completion_id: workoutCompletionId,
    url,
    evidence_type: evidenceType || "photo",
    submitted_at:  submittedAt || new Date().toISOString(),
    ...(athleteId ? { athlete_id: athleteId } : {}),
  });

  if (error) return { inserted: false, error: error.message };
  return { inserted: true };
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const secret = String(req.query?.secret || "").trim();
  if (!secret || secret !== BACKFILL_SECRET) {
    return res.status(403).json({ error: "Forbidden — pass ?secret=..." });
  }

  const dry = String(req.query?.dry || "").toLowerCase() !== "false";

  const report = {
    dry,
    airtableCompletionsFetched: 0,
    airtableCompletionsWithAttachments: 0,
    supabaseWithAttachmentUrl: 0,
    inserted: 0,
    skipped:  0,
    notFoundInSupabase: 0,
    errors:   [],
    sampleFieldNames: null,
  };

  try {
    // ── Source 1: Airtable WorkoutCompletions ────────────────────────────────
    let atRows = [];
    try {
      atRows = await fetchAirtableCompletionsWithAttachments();
      report.airtableCompletionsWithAttachments = atRows.length;
      if (atRows[0]) report.sampleFieldNames = atRows[0]._fieldNames;
    } catch (e) {
      report.errors.push({ source: "airtable-fetch", error: e.message });
    }

    for (const row of atRows) {
      // Find matching Supabase completion by airtable_id
      const { data: comp } = await db
        .from("workout_completions")
        .select("id, athlete_id")
        .eq("airtable_id", row.airtableId)
        .maybeSingle();

      if (!comp) {
        report.notFoundInSupabase++;
        // Not an error — Airtable may have records not yet migrated to Supabase
        continue;
      }

      for (const url of row.urls) {
        const evType = url.match(/\.(mp4|mov|avi|webm)/i) ? "video" : "photo";
        const result = await insertEvidence({
          workoutCompletionId: comp.id,
          athleteId:           comp.athlete_id,
          url,
          evidenceType:        evType,
          submittedAt:         row.submittedAt,
        }, dry);

        if (result.skipped)   report.skipped++;
        else if (result.inserted) report.inserted++;
        else report.errors.push({ airtableId: row.airtableId, url, error: result.error });
      }
    }

    // ── Source 2: Supabase attachment_url ───────────────────────────────────
    const sbRows = await fetchSupabaseCompletionsWithUrl();
    report.supabaseWithAttachmentUrl = sbRows.length;

    for (const row of sbRows) {
      const evType = row.attachment_url?.match(/\.(mp4|mov|avi|webm)/i) ? "video" : (row.attachment_type || "photo");
      const result = await insertEvidence({
        workoutCompletionId: row.id,
        athleteId:           row.athlete_id,
        url:                 row.attachment_url,
        evidenceType:        evType,
        submittedAt:         row.completed_at,
      }, dry);

      if (result.skipped)   report.skipped++;
      else if (result.inserted) report.inserted++;
      else report.errors.push({ completionId: row.id, error: result.error });
    }

    return res.status(200).json(report);
  } catch (err) {
    console.error("[backfill/completionEvidence]", err);
    return res.status(500).json({ error: err.message, report });
  }
}
