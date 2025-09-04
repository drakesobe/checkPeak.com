// pages/api/getSavedStacks.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  const AIRTABLE_API_KEY = process.env.SAVEDSTACKS_API_KEY;
  const BASE_ID = process.env.SAVEDSTACKS_BASE_ID;
  const TABLE_ID = process.env.SAVEDSTACKS_TABLE_NAME;

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ error: "Missing SAVEDSTACKS_API_KEY env var" });
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

    // Airtable request
    const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?filterByFormula={UserEmail}='${normalizedEmail}'`;
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
    const savedStacks = data.records.map((r) => ({
      recordId: r.id, // Airtable record ID (needed for remove)
      StackID: r.fields.StackID,
      Notes: r.fields.Notes || "",
      DateSaved: r.fields.DateSaved || null,
    }));

    return res.status(200).json({ savedStacks });
  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({ error: "Failed to fetch saved stacks" });
  }
}
