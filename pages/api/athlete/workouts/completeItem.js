// pages/api/athlete/workouts/completeItem.js
import Airtable from "airtable";
import { requireAthlete } from "@/lib/requireAthlete";

/**
 * Athlete completes a workout item
 *
 * Writes ONLY to WORKOUTCOMPLETIONS table
 *
 * Fields:
 * - CompletedAt (Date)
 * - WorkoutItem (linked to WorkoutItems)
 * - Athlete (linked to AthleteScans)
 * - CompletionEvidence (linked to CompletionEvidence)
 * - Attachment Summary (athlete note)
 * - Status (single select: rejected, pending_review, completed)
 */

export const config = {
  api: { bodyParser: true },
};

const WC_FIELDS = {
  CompletedAt: "CompletedAt",
  WorkoutItem: "WorkoutItem",
  Athlete: "Athlete",
  CompletionEvidence: "CompletionEvidence",
  AttachmentSummary: "Attachment Summary",
  Status: "Status",
};

/* ---------- helpers ---------- */

function pickStr(v) {
  return String(v ?? "").trim();
}

function pickStringArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  return String(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Accept true/false, "true"/"false", 1/0, "yes"/"no", etc
function pickBoolLoose(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1 ? true : v === 0 ? false : null;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(s)) return true;
    if (["false", "0", "no", "n", "off"].includes(s)) return false;
  }
  return null;
}

/* ---------- handler ---------- */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  /* ---- auth ---- */
  const auth = requireAthlete(req);
  if (!auth.ok) {
    return res.status(401).json({ error: auth.error || "Unauthorized" });
  }

  const athleteRecordId = pickStr(auth.athlete?.id);
  if (!athleteRecordId) {
    return res.status(400).json({
      error: "Missing athlete record id (expected AthleteScans Airtable record id)",
    });
  }

  /* ---- env ---- */
  if (
    !process.env.WORKOUTCOMPLETIONS_API_KEY ||
    !process.env.WORKOUTCOMPLETIONS_BASE_ID ||
    !process.env.WORKOUTCOMPLETIONS_TABLE_ID
  ) {
    return res.status(500).json({
      error: "WorkoutCompletions Airtable env vars missing",
    });
  }

  /* ---- body ---- */
  const body = req.body || {};

  const workoutItemId = pickStr(body.workoutItemId);
  const note = pickStr(body.note);
  const completionEvidenceIds = pickStringArray(body.completionEvidenceIds);

  if (!workoutItemId) {
    return res.status(400).json({
      error: "workoutItemId is required (WorkoutItems record id)",
    });
  }

  /* ---- determine evidence requirement (robust) ---- */
  let requiresEvidence =
    pickBoolLoose(body.requiresEvidence) ??
    pickBoolLoose(body.EvidenceRequired) ??
    (completionEvidenceIds.length > 0);

  /* ---- enforce rules ---- */
  if (requiresEvidence && completionEvidenceIds.length === 0) {
    return res.status(400).json({
      error: "Evidence is required for this item. Upload an image or video first.",
      code: "EVIDENCE_REQUIRED",
    });
  }

  const status = requiresEvidence ? "pending_review" : "completed";

  /* ---- airtable ---- */
  const base = new Airtable({
    apiKey: process.env.WORKOUTCOMPLETIONS_API_KEY,
  }).base(process.env.WORKOUTCOMPLETIONS_BASE_ID);

  const WorkoutCompletions = base(process.env.WORKOUTCOMPLETIONS_TABLE_ID);

  try {
    // Upsert: one completion per (Athlete + WorkoutItem)
    const recent = await WorkoutCompletions.select({
      maxRecords: 100,
      sort: [{ field: WC_FIELDS.CompletedAt, direction: "desc" }],
    }).firstPage();

    const existing = recent.find((r) => {
      const a = Array.isArray(r.fields?.[WC_FIELDS.Athlete])
        ? r.fields[WC_FIELDS.Athlete]
        : [];
      const w = Array.isArray(r.fields?.[WC_FIELDS.WorkoutItem])
        ? r.fields[WC_FIELDS.WorkoutItem]
        : [];

      return (
        a.map(String).includes(athleteRecordId) &&
        w.map(String).includes(workoutItemId)
      );
    });

    const nowIso = new Date().toISOString();

    const fieldsToWrite = {
      [WC_FIELDS.CompletedAt]: nowIso,
      [WC_FIELDS.Athlete]: [athleteRecordId],
      [WC_FIELDS.WorkoutItem]: [workoutItemId],
      [WC_FIELDS.AttachmentSummary]: note || "",
      [WC_FIELDS.Status]: status,
    };

    if (completionEvidenceIds.length) {
      fieldsToWrite[WC_FIELDS.CompletionEvidence] = completionEvidenceIds;
    }

    let completionId;

    if (existing) {
      completionId = existing.id;

      // merge evidence links (append)
      if (completionEvidenceIds.length) {
        const current = Array.isArray(existing.fields?.[WC_FIELDS.CompletionEvidence])
          ? existing.fields[WC_FIELDS.CompletionEvidence].map(String)
          : [];
        fieldsToWrite[WC_FIELDS.CompletionEvidence] = Array.from(
          new Set([...current, ...completionEvidenceIds])
        );
      }

      await WorkoutCompletions.update(completionId, fieldsToWrite);
    } else {
      const created = await WorkoutCompletions.create([{ fields: fieldsToWrite }]);
      completionId = created?.[0]?.id;
    }

    return res.status(200).json({
      ok: true,
      completionId,
      workoutItemId,
      athleteRecordId,
      status,
      athleteCountsAsDoneToday: status === "completed" || status === "pending_review",
      requiresEvidence,
      evidenceProvided: completionEvidenceIds.length > 0,
      completedAt: nowIso,
    });
  } catch (e) {
    console.error("[api/athlete/workouts/completeItem] error:", e);
    return res.status(500).json({
      error: "Failed to submit completion",
      airtable: {
        statusCode: e?.statusCode,
        error: e?.error,
        message: e?.message,
      },
    });
  }
}
