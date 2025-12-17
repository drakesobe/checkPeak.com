import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

const base = new Airtable({
  apiKey: process.env.ATHLETE_API_KEY,
}).base(process.env.ATHLETE_BASE_ID);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ✅ Debug must be inside handler
  console.log("[getAthletes] cookie header:", req.headers.cookie || "(none)");
  console.log("[getAthletes] has parsed user cookie:", !!req.cookies?.user);

  const auth = requireOrg(req);
  if (!auth.ok) {
    return res.status(401).json({ error: auth.error });
  }

  const { token: orgToken } = auth.org;

  try {
    const records = await base(process.env.ATHLETE_TABLE_NAME)
      .select({
        filterByFormula: `{Token}='${orgToken.replace(/'/g, "\\'")}'`,
        sort: [{ field: "CreatedAt", direction: "desc" }],
      })
      .firstPage();

    const athletes = records.map((r) => ({
      id: r.id,
      name: r.fields.Name || "",
      email: r.fields.Email || "",
      createdAt: r.fields.CreatedAt || "",
    }));

    return res.status(200).json({ athletes });
  } catch (err) {
    console.error("[getAthletes] error:", err);
    return res.status(500).json({ error: "Failed to fetch athletes" });
  }
}
