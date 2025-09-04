import Airtable from "airtable";

export default async function handler(req, res) {
  try {
    const baseId = process.env.ORGANIZATIONS_BASE_ID;
    const apiKey = process.env.ORGANIZATIONS_API_KEY;
    const tableName = process.env.ORGANIZATIONS_TABLE_NAME;

    if (!baseId || !apiKey || !tableName) {
      throw new Error("Missing Airtable environment variables for organizations");
    }

    const base = new Airtable({ apiKey }).base(baseId);

    const records = await base(tableName)
      .select({ view: "Grid view" })
      .all();

    const organizations = records.map((rec) => ({
      id: rec.id,
      fields: rec.fields,
    }));

    res.status(200).json({ organizations });
  } catch (err) {
    console.error("Get organizations error:", err);
    res.status(500).json({ error: err.message });
  }
}
