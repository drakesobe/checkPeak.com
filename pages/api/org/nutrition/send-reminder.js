// pages/api/org/nutrition/send-reminder.js
//
// Phase 1: mailto-based reminders.
// Returns a pre-built mailto: URL the client opens directly.
// Also persists LastReminderSentAt + ReminderCount to Airtable so the
// queue page can show tally, countdown, and "Send Again" after 12h.

import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

function asString(v) { return String(v ?? "").trim(); }
function escapeAirtableString(str = "") {
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
function getTable(apiKey, baseId, tableNameOrId) {
  if (!apiKey || !baseId || !tableNameOrId) return null;
  return new Airtable({ apiKey }).base(baseId)(tableNameOrId);
}

const ATHLETE_API_KEY    = process.env.ATHLETE_API_KEY;
const ATHLETE_BASE_ID    = process.env.ATHLETE_BASE_ID;
const ATHLETE_TABLE_NAME = process.env.ATHLETE_TABLE_NAME;

// Add these two fields to your Athlete table in Airtable if not present:
//   LastReminderSentAt  — Date field (date + time)
//   ReminderCount   — Number field (integer, default 0)
const ATH_TOKEN          = "AthleteToken";
const ATH_NAME           = "Name";
const ATH_EMAIL          = "Email";
const ATH_REMINDER_AT    = "LastReminderSentAt";
const ATH_REMINDER_COUNT = "ReminderCount";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req, res);
  if (!auth?.ok) return;

  const { athleteToken } = req.body || {};
  if (!asString(athleteToken)) {
    return res.status(400).json({ error: "athleteToken is required." });
  }

  const athleteTable = getTable(ATHLETE_API_KEY, ATHLETE_BASE_ID, ATHLETE_TABLE_NAME);
  if (!athleteTable) return res.status(500).json({ error: "Athlete Airtable not configured." });

  try {
    const safeTok    = escapeAirtableString(asString(athleteToken));
    const athleteRec = await athleteTable
      .select({
        filterByFormula: `FIND('${safeTok}', ARRAYJOIN({${ATH_TOKEN}}&''))`,
        maxRecords: 1,
      })
      .firstPage()
      .then((xs) => xs?.[0] || null);

    if (!athleteRec?.id) {
      return res.status(404).json({ error: "Athlete not found.", athleteToken });
    }

    const af           = athleteRec.fields || {};
    const athleteName  = asString(af[ATH_NAME])  || "Athlete";
    const athleteEmail = asString(af[ATH_EMAIL]);
    const orgName      = asString(auth.org?.name || "Your coaching staff");

    if (!athleteEmail) {
      return res.status(400).json({
        error: "Athlete has no email on record — cannot send reminder.",
        athleteToken,
        athleteName,
      });
    }

    const subject = encodeURIComponent(`Nutrition check-in reminder`);
    const body    = encodeURIComponent(
      `Hi ${athleteName},\n\n` +
      `This is a reminder from ${orgName} to log your nutrition check-in.\n\n` +
      `Please open the CheckPeak app and complete your check-in as soon as possible.\n\n` +
      `- ${orgName}`
    );
    const mailto = `mailto:${athleteEmail}?subject=${subject}&body=${body}`;

    // Persist tally — non-fatal if it fails
    const prevCount = Number(af[ATH_REMINDER_COUNT] || 0);
    const nowISO    = new Date().toISOString();

    try {
      await athleteTable.update(athleteRec.id, {
        [ATH_REMINDER_AT]:    nowISO,
        [ATH_REMINDER_COUNT]: prevCount + 1,
      });
    } catch (updateErr) {
      console.warn("[send-reminder] Airtable tally update failed:", updateErr?.message);
    }

    return res.status(200).json({
      ok:            true,
      mailto,
      athleteToken,
      athleteName,
      athleteEmail,
      sentAt:        nowISO,
      reminderCount: prevCount + 1,
      delivery:      "mailto",
    });

  } catch (e) {
    console.error("[org/nutrition/send-reminder] error:", e);
    return res.status(500).json({
      error: e?.message || "Failed to build reminder.",
      airtable: { statusCode: e?.statusCode },
    });
  }
}