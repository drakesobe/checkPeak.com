// pages/api/get-athlete.js
import Airtable from "airtable";

function asString(v) {
  return String(v ?? "").trim();
}

function normalizeEmail(v) {
  return asString(v).toLowerCase();
}

function looksLikeAirtableRecordId(id) {
  // Airtable record IDs are typically like "recXXXXXXXXXXXXXX"
  return /^rec[a-zA-Z0-9]{10,}$/.test(String(id || "").trim());
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ATHLETE_API_KEY;
  const baseId = process.env.ATHLETE_BASE_ID;
  const tableName = process.env.ATHLETE_TABLE_NAME;

  if (!apiKey || !baseId || !tableName) {
    return res.status(500).json({
      error: "Athlete Airtable not configured.",
      missing: {
        ATHLETE_API_KEY: !apiKey,
        ATHLETE_BASE_ID: !baseId,
        ATHLETE_TABLE_NAME: !tableName,
      },
    });
  }

  const id = asString(req.query?.id || req.query?.athleteId);
  if (!id) {
    return res.status(400).json({ error: "Athlete ID is required" });
  }

  // This will make the underlying bug obvious instead of a confusing 404.
  if (!looksLikeAirtableRecordId(id)) {
    return res.status(400).json({
      error: "Invalid athlete id. Expected an Airtable record id like 'rec...'.",
      got: id,
      hint: "Something is calling /api/get-athlete with a route slug (e.g. 'nutrition') instead of a record id.",
    });
  }

  try {
    const base = new Airtable({ apiKey }).base(baseId);
    const record = await base(tableName).find(id);

    if (!record) {
      return res.status(404).json({ error: "Athlete not found" });
    }

    const f = record.fields || {};

    const athlete = {
      id: record.id,
      name: asString(f.Name),
      email: normalizeEmail(f.Email),
      phone: asString(f.Phone),

      organization: f.Organization || [],
      orgToken: asString(f.Token),
      athleteToken: asString(f.AthleteToken),

      title: asString(f.Title),
      role: asString(f.Role),

      created: asString(f.Created),
      createdAt: asString(f.CreatedAt),
      source: asString(f.Source),
      type: asString(f.Type),
      plan: asString(f.Plan),

      raw: {
        Name: f.Name || "",
        Email: f.Email || "",
        Phone: f.Phone || "",
        Organization: f.Organization || "",
        Title: f.Title || "",
        Role: f.Role || "",
        Token: f.Token || "",
        AthleteToken: f.AthleteToken || "",
      },
    };

    return res.status(200).json({ ok: true, athlete });
  } catch (err) {
    console.error("[get-athlete] error:", err);
    return res.status(500).json({
      error: "Failed to fetch athlete",
      details: asString(err?.message || err),
    });
  }
}
