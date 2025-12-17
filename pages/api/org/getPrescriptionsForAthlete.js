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
  // Always prevent caching while debugging
  res.setHeader("Cache-Control", "no-store");

  // Quick sanity marker so you know THIS file handled the request
  res.setHeader("X-Route", "getPrescriptionsForAthletes");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const TABLE = process.env.PRESCRIPTIONS_TABLE_NAME;

  if (!base || !TABLE) {
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

  const orgToken = String(auth?.org?.token || "").trim();
  const athleteEmail = String(req.query?.athleteEmail || "")
    .trim()
    .toLowerCase();

  if (!athleteEmail || !athleteEmail.includes("@")) {
    return res.status(400).json({ error: "Missing athleteEmail" });
  }

  if (!orgToken) {
    return res.status(401).json({
      error:
        "Organization token missing from session. Make sure org login returns Token and it is stored in the auth cookie.",
    });
  }

  try {
    const safeEmail = escapeAirtableString(athleteEmail);
    const safeToken = escapeAirtableString(orgToken);

    // IMPORTANT:
    // These field names must match Airtable exactly:
    // - "Athlete Email"
    // - "Organization Token"
    const formula = `AND({Athlete Email}='${safeEmail}', {Organization Token}='${safeToken}')`;

    const records = await base(TABLE)
      .select({
        filterByFormula: formula,
        sort: [{ field: "CreatedAt", direction: "desc" }],
      })
      .firstPage();

    // ✅ If no records found, return an empty list (never 404)
    if (!records || records.length === 0) {
      return res.status(200).json({ prescriptions: [] });
    }

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
