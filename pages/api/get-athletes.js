import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID
);

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  // Example: org is passed as query param or determined from logged-in user
  const organization = req.query.org || "Default University";

  try {
    const records = await base("Athletes")
      .select({
        filterByFormula: `{Team/Organization}='${organization}'`,
        sort: [{ field: "Name", direction: "asc" }],
      })
      .all();

    res.status(200).json({ athletes: records });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch athletes" });
  }
}
