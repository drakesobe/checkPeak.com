// pages/api/athlete/getMyPrescriptions.js
import Airtable from "airtable";
import { requireAthlete } from "@/lib/requireAthlete";

const prescriptionsBase =
  process.env.PRESCRIPTIONS_API_KEY && process.env.PRESCRIPTIONS_BASE_ID
    ? new Airtable({ apiKey: process.env.PRESCRIPTIONS_API_KEY }).base(
        process.env.PRESCRIPTIONS_BASE_ID
      )
    : null;

const PRESCRIPTIONS_TABLE = process.env.PRESCRIPTIONS_TABLE_NAME; // you set tblDfj...

function escapeAirtableString(str = "") {
  return String(str).replace(/'/g, "\\'");
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error });

  if (!prescriptionsBase || !PRESCRIPTIONS_TABLE) {
    return res.status(500).json({
      error:
        "Prescriptions Airtable not configured. Check PRESCRIPTIONS_API_KEY, PRESCRIPTIONS_BASE_ID, PRESCRIPTIONS_TABLE_NAME.",
    });
  }

  const athleteEmail = auth.athlete.email;
  const safeEmail = escapeAirtableString(athleteEmail);

  try {
    const records = await prescriptionsBase(PRESCRIPTIONS_TABLE)
      .select({
        filterByFormula: `LOWER({Athlete Email})='${safeEmail}'`,
        sort: [{ field: "CreatedAt", direction: "desc" }],
      })
      .firstPage();

    const prescriptions = records.map((r) => ({
      id: r.id,
      athlete: r.fields?.Athlete || "",
      organization: r.fields?.Organization || "",
      title: r.fields?.Title || "",
      prescription: r.fields?.Prescription || "",
      createdAt: r.fields?.CreatedAt || "",
      createdBy: r.fields?.CreatedBy || "",
    }));

    return res.status(200).json({ prescriptions });
  } catch (err) {
    console.error("[getMyPrescriptions] error:", err);
    return res.status(500).json({
      error: "Failed to fetch prescriptions.",
      details: String(err?.message || err),
    });
  }
}
