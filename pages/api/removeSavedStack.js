// pages/api/removeSavedStack.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  const AIRTABLE_API_KEY = process.env.SAVEDSTACKS_API_KEY;
  const BASE_ID = process.env.SAVEDSTACKS_BASE_ID;
  const TABLE_ID = process.env.SAVEDSTACKS_TABLE_NAME;

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ error: "Missing SAVEDSTACKS_API_KEY env var" });
  }

  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { recordId, UserEmail } = req.body;

    if (!recordId || !UserEmail) {
      return res.status(400).json({ error: "recordId and UserEmail are required" });
    }

    // Delete from Airtable
    const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${recordId}`;
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Airtable delete error:", response.status, text);
      return res.status(500).json({ error: "Failed to remove saved stack" });
    }

    // Return updated saved stacks
    const normalizedEmail = UserEmail.trim().toLowerCase();
    const getUrl = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?filterByFormula={UserEmail}='${normalizedEmail}'`;
    const getRes = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    });
    const getData = await getRes.json();

    const savedStacks = getData.records.map((r) => ({
      recordId: r.id,
      StackID: r.fields.StackID,
      Notes: r.fields.Notes || "",
      DateSaved: r.fields.DateSaved || null,
    }));

    return res.status(200).json({ savedStacks });
  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({ error: "Failed to remove saved stack" });
  }
}
