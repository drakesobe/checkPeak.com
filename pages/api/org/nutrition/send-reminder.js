// pages/api/org/nutrition/send-reminder.js
//
// Phase 1: mailto-based reminders.
// Returns a pre-built mailto: URL the client opens directly.
// No Twilio, no webhook, no extra Airtable table required.
// When Twilio is ready, swap in the delivery block below.

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

const ATH_TOKEN = "AthleteToken";
const ATH_NAME  = "Name";
const ATH_EMAIL = "Email";

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
    /* 1) Resolve athlete */
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

    /* 2) Build mailto — client opens this directly */
    const subject = encodeURIComponent(`Nutrition check-in reminder`);
    const body    = encodeURIComponent(
      `Hi ${athleteName},\n\n` +
      `This is a reminder from ${orgName} to log your nutrition check-in for this week.\n\n` +
      `Please open the CheckPeak app and complete your check-in when you get a chance.\n\n` +
      `— ${orgName}`
    );
    const mailto = `mailto:${athleteEmail}?subject=${subject}&body=${body}`;

    return res.status(200).json({
      ok:           true,
      mailto,
      athleteToken,
      athleteName,
      athleteEmail,
      sentAt:       new Date().toISOString(),
      // Future: when Twilio is enabled, delivery will happen server-side
      // and this field will be `delivery: "sms"` instead of `delivery: "mailto"`
      delivery:     "mailto",
    });

  } catch (e) {
    console.error("[org/nutrition/send-reminder] error:", e);
    return res.status(500).json({
      error: e?.message || "Failed to build reminder.",
      airtable: { statusCode: e?.statusCode },
    });
  }
}