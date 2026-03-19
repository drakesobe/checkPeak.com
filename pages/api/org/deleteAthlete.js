// pages/api/org/deleteAthlete.js
// DELETE { athleteId?: string, athleteEmail?: string }
// Permanently removes an athlete record from Airtable.
// Auth: requireOrg — same pattern as updateAthleteMeta / createPrescription.

import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

function escapeAirtableString(str = "") {
  return String(str).replace(/'/g, "\\'");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = requireOrg(req);
  if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

  const orgToken = String(auth?.org?.token || "").trim();
  if (!orgToken) return res.status(401).json({ error: "Organization token missing" });

  if (!process.env.ATHLETE_API_KEY || !process.env.ATHLETE_BASE_ID || !process.env.ATHLETE_TABLE_NAME) {
    return res.status(500).json({ error: "Athletes Airtable not configured." });
  }

  const base = new Airtable({ apiKey: process.env.ATHLETE_API_KEY })
    .base(process.env.ATHLETE_BASE_ID);

  const { athleteId, athleteEmail } = req.body || {};

  if (!athleteId && !athleteEmail) {
    return res.status(400).json({ error: "athleteId or athleteEmail is required" });
  }

  try {
    let recordId = athleteId;

    // If we only have email, look up the record — and verify it belongs to this org
    if (!recordId && athleteEmail) {
      const email      = String(athleteEmail).trim().toLowerCase();
      const safeEmail  = escapeAirtableString(email);
      const safeToken  = escapeAirtableString(orgToken);

      const records = await base(process.env.ATHLETE_TABLE_NAME)
        .select({
          filterByFormula: `AND(LOWER({Email})='${safeEmail}', {Token}='${safeToken}')`,
          maxRecords:      1,
          fields:          ["Email"],
        })
        .firstPage();

      if (!records?.length) {
        return res.status(404).json({ error: "Athlete not found for this organization" });
      }

      recordId = records[0].id;
    }

    await base(process.env.ATHLETE_TABLE_NAME).destroy(String(recordId).trim());

    return res.status(200).json({
      ok:          true,
      deletedId:   recordId,
      athleteEmail: athleteEmail || null,
    });
  } catch (err) {
    console.error("[deleteAthlete]", err);
    if (err?.statusCode === 404 || String(err?.message || "").includes("not found")) {
      return res.status(404).json({ error: "Athlete record not found" });
    }
    return res.status(500).json({ error: err?.message || "Failed to delete athlete" });
  }
}


  const { athleteId, athleteEmail } = req.body || {};

  if (!athleteId && !athleteEmail) {
    return res.status(400).json({ error: "athleteId or athleteEmail is required" });
  }

  const base  = getBase();
  const table = process.env.AIRTABLE_ATHLETES_TABLE || "Athletes";

  try {
    let recordId = athleteId;

    // If we only have email, look up the record ID first
    if (!recordId && athleteEmail) {
      const records = await base(table)
        .select({
          filterByFormula: `LOWER({Email}) = "${String(athleteEmail).toLowerCase().trim()}"`,
          maxRecords:      1,
          fields:          ["Email"],
        })
        .firstPage();

      if (!records || records.length === 0) {
        return res.status(404).json({ error: "Athlete not found" });
      }

      recordId = records[0].id;
    }

    await base(table).destroy(String(recordId).trim());

    return res.status(200).json({
      ok:          true,
      deletedId:   recordId,
      athleteEmail: athleteEmail || null,
    });
  } catch (err) {
    console.error("[deleteAthlete]", err);
    return res.status(500).json({ error: err?.message || "Failed to delete athlete" });
  }
