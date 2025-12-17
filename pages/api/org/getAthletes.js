// pages/api/org/getAthletes.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

const base =
  process.env.ATHLETE_API_KEY && process.env.ATHLETE_BASE_ID
    ? new Airtable({ apiKey: process.env.ATHLETE_API_KEY }).base(
        process.env.ATHLETE_BASE_ID
      )
    : null;

export default async function handler(req, res) {
  // Prevent caching so org dashboards always reflect latest state
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!base || !process.env.ATHLETE_TABLE_NAME) {
    return res.status(500).json({
      error:
        "Athletes Airtable not configured. Check ATHLETE_API_KEY, ATHLETE_BASE_ID, ATHLETE_TABLE_NAME.",
      missing: {
        ATHLETE_API_KEY: !process.env.ATHLETE_API_KEY,
        ATHLETE_BASE_ID: !process.env.ATHLETE_BASE_ID,
        ATHLETE_TABLE_NAME: !process.env.ATHLETE_TABLE_NAME,
      },
    });
  }

  const auth = requireOrg(req);
  if (!auth.ok) {
    return res.status(401).json({ error: auth.error || "Unauthorized" });
  }

  const orgToken = String(auth?.org?.token || "").trim();
  if (!orgToken) {
    return res.status(401).json({ error: "Organization token missing" });
  }

  try {
    const safeToken = orgToken.replace(/'/g, "\\'");

    const records = await base(process.env.ATHLETE_TABLE_NAME)
      .select({
        filterByFormula: `{Token}='${safeToken}'`,
        sort: [{ field: "CreatedAt", direction: "desc" }],
      })
      .firstPage();

    const athletes = records.map((r) => ({
      id: r.id,
      name: r.fields?.Name || "",
      email: r.fields?.Email || "",
      createdAt: r.fields?.CreatedAt || "",
    }));

    return res.status(200).json({ athletes });
  } catch (err) {
    console.error("[getAthletes] error:", err);
    return res.status(500).json({
      error: "Failed to fetch athletes",
      airtable: {
        statusCode: err?.statusCode,
        message: err?.message,
        error: err?.error,
      },
    });
  }
}
