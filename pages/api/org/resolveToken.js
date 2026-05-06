// pages/api/org/resolveToken.js
import Airtable from "airtable";

function escapeAirtableString(str = "") {
  return String(str).replace(/'/g, "\\'");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const token = String(req.query?.token || "").trim();
    if (!token) return res.status(400).json({ error: "token is required" });

    const API_KEY = process.env.ORGANIZATIONS_API_KEY;
    const BASE_ID = process.env.ORGANIZATIONS_BASE_ID;
    const TABLE = process.env.ORGANIZATIONS_TABLE_NAME;

    if (!API_KEY || !BASE_ID || !TABLE) {
      return res.status(500).json({
        error: "Organizations Airtable env vars missing.",
        debug: {
          has_ORGANIZATIONS_API_KEY: !!API_KEY,
          has_ORGANIZATIONS_BASE_ID: !!BASE_ID,
          has_ORGANIZATIONS_TABLE_NAME: !!TABLE,
        },
      });
    }

    Airtable.configure({ apiKey: API_KEY });
    const base = Airtable.base(BASE_ID);

    const t = escapeAirtableString(token);

    // Token could be a text field OR a lookup/multi-value field.
    const filterByFormula = `OR(
      {Token}='${t}',
      FIND('${t}', ARRAYJOIN({Token}&''))>0
    )`;

    const records = await base(TABLE)
      .select({
        maxRecords: 1,
        filterByFormula,
      })
      .firstPage();

    if (!records || records.length === 0) {
      return res.status(404).json({ error: "No organization found for that token." });
    }

    const r = records[0];
    return res.status(200).json({
      ok: true,
      org: {
        id: r.id,
        // Airtable primary field is often "Name" - adjust if your primary field is different
        name: r.fields?.Name || r.fields?.name || "",
        token: token,
      },
    });
  } catch (err) {
    console.error("[resolveToken] error:", err);
    return res.status(500).json({ error: "Failed to resolve token." });
  }
}
