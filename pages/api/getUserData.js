import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.ATHLETE_API_KEY }).base(
  process.env.ATHLETE_BASE_ID
);

export default async function handler(req, res) {
  const { userEmail } = req.query;

  if (!userEmail) return res.status(400).json({ error: "Missing userEmail" });

  try {
    // Fetch scans for this user (you could add a "Scans" table later)
    const records = await base(process.env.ATHLETE_TABLE_NAME)
      .select({
        filterByFormula: `{Email}='${userEmail}'`,
        sort: [{ field: "Name", direction: "asc" }],
      })
      .firstPage();

    // Map to simplified array
    const formattedRecords = records.map((record) => ({
      id: record.id,
      name: record.get("Name"),
      date: new Date(record.get("Created") || Date.now()).toISOString().split("T")[0],
      organization: record.get("Organization"),
      title: record.get("Title"),
    }));

    res.status(200).json({
      recentActivity: formattedRecords,
      stats: {
        totalScans: formattedRecords.length,
        recentSearches: 5, // Placeholder, can track actual searches later
        stacksSaved: 3,    // Placeholder
        accountCompletion: 80, // Placeholder
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch data from Airtable" });
  }
}
