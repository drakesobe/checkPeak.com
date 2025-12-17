// pages/api/org/getPrescriptionsForAthletes.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

function escapeAirtableString(str = "") {
  return String(str).replace(/'/g, "\\'");
}

const base =
  process.env.PRESCRIPTIONS_API_KEY && process.env.PRESCRIPTIONS_BASE_ID
    ? new Airtable({ apiKey: process.env.PRESCRIPTIONS_API_KEY }).base(
        process.env.PRESCRIPTIONS_BASE_ID
      )
    : null;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!base || !process.env.PRESCRIPTIONS_TABLE_NAME) {
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

  const auth = requireOrg(req);
  if (!auth.ok) {
    return res.status(401).json({ error: auth.error || "Unauthorized" });
  }

  const { org } = auth;
  const athleteEmail = String(req.query?.athleteEmail || "").trim().toLowerCase();

  if (!athleteEmail || !athleteEmail.includes("@")) {
    return res.status(400).json({ error: "Missing athleteEmail" });
  }

  if (!org?.token) {
    return res.status(401).json({
      error:
        "Organization token missing from session. Make sure org login returns Token and it is stored in cookie/localStorage user.",
    });
  }

  try {
    const safeEmail = escapeAirtableString(athleteEmail);
    const safeToken = escapeAirtableString(org.token);

    const records = await base(process.env.PRESCRIPTIONS_TABLE_NAME)
      .select({
        filterByFormula: `AND({Athlete Email}='${safeEmail}', {Organization Token}='${safeToken}')`,
        sort: [{ field: "CreatedAt", direction: "desc" }],
      })
      .firstPage();

    const prescriptions = records.map((r) => ({
      id: r.id,
      title: r.fields?.Title || "",
      prescription: r.fields?.Prescription || "",
      createdAt: r.fields?.CreatedAt || "",
      createdBy: r.fields?.CreatedBy || "",
      organization: r.fields?.Organization || "",
    }));

    return res.status(200).json({ prescriptions });
  } catch (err) {
    console.error("[getPrescriptionsForAthletes] error:", err);
    return res.status(500).json({
      error: "Failed to fetch prescriptions",
      airtable: {
        statusCode: err?.statusCode,
        message: err?.message,
        error: err?.error,
      },
    });
  }
}
