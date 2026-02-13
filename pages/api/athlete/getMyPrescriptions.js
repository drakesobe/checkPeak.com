// pages/api/athlete/getMyPrescriptions.js
import Airtable from "airtable";
import { requireAthlete } from "@/lib/requireAthlete";

const prescriptionsBase =
  process.env.PRESCRIPTIONS_API_KEY && process.env.PRESCRIPTIONS_BASE_ID
    ? new Airtable({ apiKey: process.env.PRESCRIPTIONS_API_KEY }).base(process.env.PRESCRIPTIONS_BASE_ID)
    : null;

const PRESCRIPTIONS_TABLE = process.env.PRESCRIPTIONS_TABLE_NAME; // table name or tbl...

function asString(v) {
  return String(v ?? "").trim();
}

function escapeAirtableString(str = "") {
  return String(str).replace(/'/g, "\\'");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Route", "getMyPrescriptions");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  const auth = requireAthlete(req);
  if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

  if (!prescriptionsBase || !PRESCRIPTIONS_TABLE) {
    return res.status(500).json({
      error:
        "Prescriptions Airtable not configured. Check PRESCRIPTIONS_API_KEY, PRESCRIPTIONS_BASE_ID, PRESCRIPTIONS_TABLE_NAME.",
      missing: {
        PRESCRIPTIONS_API_KEY: !process.env.PRESCRIPTIONS_API_KEY,
        PRESCRIPTIONS_BASE_ID: !process.env.PRESCRIPTIONS_BASE_ID,
        PRESCRIPTIONS_TABLE_NAME: !process.env.PRESCRIPTIONS_TABLE_NAME,
      },
    });
  }

  // ✅ STRICT: AthleteToken only
  const athlete = auth?.athlete || {};
  const athleteToken = asString(athlete?.AthleteToken || athlete?.athleteToken);

  if (!athleteToken) {
    return res.status(400).json({
      error: "Missing AthleteToken in athlete session. AthleteToken is required.",
    });
  }

  try {
    const tableRef = prescriptionsBase(PRESCRIPTIONS_TABLE);

    // ✅ STRICT field name: AthleteToken
    const safeTok = escapeAirtableString(athleteToken);
    const filterByFormula = `{AthleteToken}='${safeTok}'`;

    const records = await tableRef
      .select({
        filterByFormula,
        sort: [{ field: "CreatedAt", direction: "desc" }],
      })
      .firstPage();

    const prescriptions = (records || []).map((r) => ({
      id: r.id,
      athlete: r.fields?.Athlete || "",
      organization: r.fields?.Organization || "",
      title: r.fields?.Title || "",
      prescription: r.fields?.Prescription || "",
      createdAt: r.fields?.CreatedAt || "",
      createdBy: r.fields?.CreatedBy || "",
      athleteToken: r.fields?.AthleteToken || "",
    }));

    return res.status(200).json({ prescriptions });
  } catch (err) {
    console.error("[getMyPrescriptions] error:", err);
    return res.status(500).json({
      error: "Failed to fetch prescriptions.",
      airtable: {
        statusCode: err?.statusCode,
        message: err?.message,
        error: err?.error,
      },
    });
  }
}
