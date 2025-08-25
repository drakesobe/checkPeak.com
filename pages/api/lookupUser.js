import Airtable from "airtable";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    // --- Debug log for request with timestamp
    console.log(`[LOOKUP_USER] ${new Date().toISOString()} - Incoming request for email: ${email}`);

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
      process.env.AIRTABLE_BASE_ID
    );

    const records = await base(process.env.AIRTABLE_TABLE_NAME)
      .select({ filterByFormula: `{Email} = '${email}'` })
      .firstPage();

    if (records.length === 0) {
      console.log(`[LOOKUP_USER] No user found for: ${email}`);
      res.setHeader("Cache-Control", "no-store, max-age=0");
      return res.status(404).json({ error: "User not found" });
    }

    const user = records[0].fields;
    console.log(`[LOOKUP_USER] User found: ${user.Name} (${email})`);

    // --- Prevent all caching
    res.setHeader("Cache-Control", "no-store, max-age=0");

    return res.status(200).json({ user });
  } catch (err) {
    console.error(`[LOOKUP_USER] ${new Date().toISOString()} - Error:`, err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
