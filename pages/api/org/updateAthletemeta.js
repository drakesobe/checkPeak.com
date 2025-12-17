// pages/api/org/updateAthleteMeta.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

function escapeAirtableString(str = "") {
  return String(str).replace(/'/g, "\\'");
}

const base =
  process.env.ATHLETE_API_KEY && process.env.ATHLETE_BASE_ID
    ? new Airtable({ apiKey: process.env.ATHLETE_API_KEY }).base(process.env.ATHLETE_BASE_ID)
    : null;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!base || !process.env.ATHLETE_TABLE_NAME) {
    return res.status(500).json({ error: "Athletes Airtable not configured." });
  }

  const auth = requireOrg(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  const orgToken = String(auth?.org?.token || "").trim();
  if (!orgToken) return res.status(401).json({ error: "Organization token missing" });

  const { athleteEmail, status, tags, notes } = req.body || {};
  const email = String(athleteEmail || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return res.status(400).json({ error: "Missing athleteEmail" });

  const safeEmail = escapeAirtableString(email);
  const safeToken = escapeAirtableString(orgToken);

  try {
    // Find athlete record by email + org token
    const records = await base(process.env.ATHLETE_TABLE_NAME)
      .select({
        filterByFormula: `AND({Email}='${safeEmail}', {Token}='${safeToken}')`,
        maxRecords: 1,
      })
      .firstPage();

    if (!records?.length) {
      return res.status(404).json({ error: "Athlete not found for this organization" });
    }

    const rec = records[0];

    const fields = {};
    if (typeof status === "string") fields.Status = status.trim();
    if (Array.isArray(tags)) fields.Tags = tags.filter(Boolean).map((t) => String(t).trim());
    if (typeof notes === "string") fields.Notes = notes;

    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: "No fields provided to update" });
    }

    const updated = await base(process.env.ATHLETE_TABLE_NAME).update(rec.id, fields);

    return res.status(200).json({
      ok: true,
      athlete: {
        id: updated.id,
        email: updated.fields?.Email || email,
        name: updated.fields?.Name || "",
        status: updated.fields?.Status || "Active",
        tags: updated.fields?.Tags || [],
        notes: updated.fields?.Notes || "",
      },
    });
  } catch (err) {
    console.error("[updateAthleteMeta] error:", err);
    return res.status(500).json({
      error: "Failed to update athlete",
      airtable: { statusCode: err?.statusCode, message: err?.message },
    });
  }
}
