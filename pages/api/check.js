// pages/api/check.js
import Airtable from "airtable";

// Initialize Airtable base
const bannedBase = new Airtable({ apiKey: process.env.BANNED_API_KEY }).base(
  process.env.BANNED_BASE_ID
);

// Escape regex safely
const escapeRegex = (string) => String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const text = req.body.text || req.body.ocrText;
  if (!text) {
    return res.status(400).json({ error: "No text field in request body!" });
  }

  try {
    // --- Normalize OCR text
    const normalizedOCRText = text
      .replace(/[\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .toLowerCase();

    // --- Fetch banned substances from Airtable
    const bannedRecords = await bannedBase(process.env.BANNED_TABLE_NAME)
      .select({ view: "Grid view" })
      .all();

    // --- Filter only substances that are actually present in the OCR
    const matchedBanned = bannedRecords.filter((rec) => {
      const names = [
        rec.get("Substance Name") || "",
        ...(rec.get("Synonyms")?.split(",") || []),
      ]
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      // Exact word match in OCR
      return names.some((name) => {
        if (name.length < 2) return false;          // skip too short
        if (/^[0-9]+$/.test(name)) return false;   // skip pure numbers
        try {
          const regex = new RegExp(`\\b${escapeRegex(name)}\\b`, "i");
          return regex.test(normalizedOCRText);
        } catch {
          return normalizedOCRText.includes(name);
        }
      });
    });

    // --- Map matched banned substances for frontend (no raw OCR in fields!)
    const bannedResults = matchedBanned.map((rec) => ({
      id: rec.id,
      fields: {
        "Substance Name": rec.get("Substance Name") || "",
        "Ban Type": rec.get("Ban Type") || "",
        "Synonyms": rec.get("Synonyms") || "",
        "Banned By": rec.get("Banned By") || "",
        "Dosage Limit": rec.get("Dosage Limit") || "",
        "Notes": rec.get("Notes") || "",
        "Source / Citation": rec.get("Source / Citation") || "",
      },
    }));

    console.log("Matched banned count:", bannedResults.length);
    bannedResults.forEach((r) =>
      console.log("Matched banned:", r.fields["Substance Name"])
    );

    res.status(200).json({
      ocrText: text,             // OCR text stays separate
      matchedBanned: bannedResults,
    });
  } catch (err) {
    console.error("Check API Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
