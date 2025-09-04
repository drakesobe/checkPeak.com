// pages/api/saveStack.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  const AIRTABLE_API_KEY = process.env.SAVEDSTACKS_API_KEY;
  const BASE_ID = process.env.SAVEDSTACKS_BASE_ID;
  const TABLE_ID = process.env.SAVEDSTACKS_TABLE_NAME;

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ error: "Missing SAVEDSTACKS_API_KEY env var" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { UserEmail, stack } = req.body;
    if (!UserEmail || !stack) {
      return res.status(400).json({ error: "UserEmail and stack are required" });
    }

    // Normalize email (case-insensitive, trim)
    const normalizedEmail = UserEmail.trim().toLowerCase();

    // Save to Airtable
    const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          UserEmail: normalizedEmail,
          StackID: stack.id,
          DateSaved: new Date().toISOString(),
          Notes: stack.notes || "",
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Airtable save error:", response.status, text);
      return res.status(500).json({ error: "Failed to save stack" });
    }

    // Parse Airtable response
    const savedRecord = await response.json();

    // Now fetch *all* saved stacks for this user
    const fetchUrl = `${url}?filterByFormula={UserEmail}='${normalizedEmail}'`;
    const fetchRes = await fetch(fetchUrl, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    });

    if (!fetchRes.ok) {
      const text = await fetchRes.text();
      console.error("Airtable fetch error:", fetchRes.status, text);
      return res.status(500).json({ error: "Failed to fetch saved stacks" });
    }

    const data = await fetchRes.json();

    // Map into a cleaner format for frontend
    const savedStacks = data.records.map((r) => ({
      recordId: r.id, // Airtable record ID (needed for remove)
      StackID: r.fields.StackID,
      Notes: r.fields.Notes || "",
      DateSaved: r.fields.DateSaved || null,
    }));

    return res.status(200).json({ savedStacks });
  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({ error: "Failed to save stack" });
  }
}
