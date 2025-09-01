import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.SCANS_API_KEY }).base(
  process.env.SCANS_BASE_ID
);

export default async function handler(req, res) {
  const { userEmail } = req.query;

  if (!userEmail) return res.status(400).json({ error: "Missing userEmail" });

  try {
    const records = await base(process.env.SCANS_TABLE_NAME)
      .select({
        filterByFormula: `{UserEmail}='${userEmail}'`,
        sort: [{ field: "ScanDate", direction: "desc" }],
      })
      .firstPage();

    const scans = records.map((record) => ({
      id: record.id,
      name: record.get("ScanName"),
      date: record.get("ScanDate"),
      summary: record.get("ResultSummary") || "",
      stackDetails: record.get("StackDetails") || "",
    }));

    res.status(200).json({ scans });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch scans from Airtable" });
  }
}
