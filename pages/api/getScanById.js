import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.SCANS_API_KEY }).base(
  process.env.SCANS_BASE_ID
);

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) return res.status(400).json({ error: "Missing scan ID" });

  try {
    const record = await base(process.env.SCANS_TABLE_NAME).find(id);
    const scan = {
      id: record.id,
      name: record.get("ScanName"),
      date: record.get("ScanDate"),
      summary: record.get("ResultSummary") || "",
      stackDetails: record.get("StackDetails") || "",
    };
    res.status(200).json({ scan });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch scan from Airtable" });
  }
}
