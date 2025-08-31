export default function handler(req, res) {
  res.status(200).json({
    airtableKey: process.env.ATHLETE_API_KEY ? "✅ Loaded" : "❌ Missing",
    airtableBase: process.env.ATHLETE_BASE_ID || "❌ Missing",
    airtableTable: process.env.ATHLETE_TABLE_NAME || "❌ Missing",
  });
}
