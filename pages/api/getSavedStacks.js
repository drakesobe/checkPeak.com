// pages/api/getSavedStacks.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  const AIRTABLE_API_KEY = process.env.SAVEDSTACKS_API_KEY;
  const BASE_ID = process.env.SAVEDSTACKS_BASE_ID;
  const TABLE_ID = process.env.SAVEDSTACKS_TABLE_NAME;

  if (!AIRTABLE_API_KEY || !BASE_ID || !TABLE_ID) {
    console.error("[getSavedStacks] Missing Airtable env vars");
    return res
      .status(500)
      .json({ error: "Missing SAVEDSTACKS_* environment variables" });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { UserEmail } = req.query;

    if (!UserEmail) {
      return res.status(400).json({ error: "UserEmail is required" });
    }

    // Normalize email (trim + lowercase)
    const normalizedEmail = UserEmail.trim().toLowerCase();

    // Escape single quotes for Airtable formula
    const safeEmail = normalizedEmail.replace(/'/g, "''");

    // Case-insensitive match on UserEmail
    const formula = `LOWER({UserEmail})='${safeEmail}'`;
    const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?filterByFormula=${encodeURIComponent(
      formula
    )}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Airtable fetch error:", response.status, text);
      return res.status(500).json({ error: "Failed to fetch saved stacks" });
    }

    const data = await response.json();

    // Map to clean objects
    const savedStacks = (data.records || []).map((r) => ({
      recordId: r.id, // Airtable record ID for SavedStacks table (useful for delete / update)
      StackID: r.fields.StackID, // can be a single value or an array (linked record / multi-select)
      UserEmail: r.fields.UserEmail || null,
      Notes: r.fields.Notes || "",
      DateSaved: r.fields.DateSaved || null,
    }));

    return res.status(200).json({ savedStacks });
  } catch (error) {
    console.error("[getSavedStacks] API error:", error);
    return res.status(500).json({ error: "Failed to fetch saved stacks" });
  }
}
