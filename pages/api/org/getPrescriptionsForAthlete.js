// pages/api/org/getPrescriptionsForAthlete.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

function asString(v) {
  return String(v ?? "").trim();
}

function escapeAirtableString(str = "") {
  return String(str).replace(/'/g, "\\'");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req, res);
  if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

  const athleteToken = asString(req.query?.athleteToken);
  if (!athleteToken) {
    // ✅ Token-only (NO email fallback)
    return res.status(400).json({ error: "athleteToken is required." });
  }

  const API_KEY = process.env.NUTRITION_API_KEY;
  const BASE_ID = process.env.NUTRITION_BASE_ID;

  // NutritionPlans table (you said tblbN4C6BWn6MNWzu)
  const PLANS_TABLE =
    process.env.NUTRITION_TABLE_NAME ||
    process.env.NUTRITION_PLANS_TABLE ||
    "tblbN4C6BWn6MNWzu";

  const TOKEN_FIELD = process.env.NUTRITION_TOKEN_FIELD || "AthleteToken"; // lookup field
  const CREATEDAT_FIELD = process.env.NUTRITION_CREATEDAT_FIELD || "CreatedAt";
  const CREATEDBY_FIELD = "CreatedBy";
  const STATUS_FIELD = process.env.NUTRITION_STATUS_FIELD || "Status";

  if (!API_KEY || !BASE_ID) {
    return res.status(500).json({
      error: "Nutrition Airtable not configured. Set NUTRITION_API_KEY and NUTRITION_BASE_ID.",
      missing: {
        NUTRITION_API_KEY: !API_KEY,
        NUTRITION_BASE_ID: !BASE_ID,
      },
    });
  }

  const base = new Airtable({ apiKey: API_KEY }).base(BASE_ID);

  try {
    const safe = escapeAirtableString(athleteToken);

    // ✅ lookup-safe filter (works for lookup arrays)
    const filterByFormula = `FIND('${safe}', ARRAYJOIN({${TOKEN_FIELD}}&''))>0`;

    const records = await base(PLANS_TABLE)
      .select({
        filterByFormula,
        sort: [{ field: CREATEDAT_FIELD, direction: "desc" }],
        maxRecords: 50,
      })
      .firstPage();

    // Map NutritionPlans -> PlanHistory “prescriptions” shape
    const prescriptions = records.map((r) => {
      const phase = r.get("Phase") || "";
      return {
        id: r.id,
        title: phase ? `Nutrition Plan • ${phase}` : "Nutrition Plan",
        prescription: r.get("Prescription") || "",
        createdAt: r.get(CREATEDAT_FIELD) || r._rawJson?.createdTime || "",
        createdBy: r.get(CREATEDBY_FIELD) || "",
        status: r.get(STATUS_FIELD) || "",
      };
    });

    return res.status(200).json({
      ok: true,
      prescriptions,
      debug: {
        source: "NutritionPlans",
        athleteToken,
        table: PLANS_TABLE,
        tokenField: TOKEN_FIELD,
        filterByFormula,
        count: prescriptions.length,
      },
    });
  } catch (err) {
    console.error("[getPrescriptionsForAthlete] error:", err);
    return res.status(500).json({
      error: "Server error",
      detail: err?.message || String(err),
    });
  }
}
