// pages/api/org/updateAthleteMeta.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

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
  if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

  const { athleteId, status, tags, notes, sport } = req.body || {};

  if (!athleteId || typeof athleteId !== "string" || !athleteId.trim()) {
    return res.status(400).json({ error: "athleteId is required" });
  }

  const fields = {};
  if (typeof status === "string") fields.Status = status.trim();
  if (Array.isArray(tags))        fields.Tags   = tags.filter(Boolean).map(t => String(t).trim());
  if (typeof notes  === "string") fields.Notes  = notes;
  if (typeof sport  === "string") fields.sport  = sport.trim();

  if (Object.keys(fields).length === 0) {
    return res.status(400).json({ error: "No fields provided to update" });
  }

  try {
    const updated = await base(process.env.ATHLETE_TABLE_NAME).update(athleteId.trim(), fields);

    return res.status(200).json({
      ok:      true,
      athlete: {
        id:     updated.id,
        email:  updated.fields?.Email  || "",
        name:   updated.fields?.Name   || "",
        status: updated.fields?.Status || "Active",
        tags:   updated.fields?.Tags   || [],
        notes:  updated.fields?.Notes  || "",
        sport:  updated.fields?.sport  || "",
      },
    });
  } catch (err) {
    console.error("[updateAthleteMeta] error:", err);
    return res.status(500).json({
      error:    "Failed to update athlete",
      airtable: { statusCode: err?.statusCode, message: err?.message },
    });
  }
}