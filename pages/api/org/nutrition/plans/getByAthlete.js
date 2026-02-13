// pages/api/org/nutrition/plans/getByAthlete.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

function asString(v) {
  return String(v ?? "").trim();
}
function escapeAirtableString(str = "") {
  return String(str).replace(/'/g, "\\'");
}
function lookupSafeContains(fieldName, value) {
  const safe = escapeAirtableString(value);
  return `FIND('${safe}', ARRAYJOIN({${fieldName}}&''))>0`;
}

const base =
  process.env.NUTRITION_API_KEY && process.env.NUTRITION_BASE_ID
    ? new Airtable({ apiKey: process.env.NUTRITION_API_KEY }).base(process.env.NUTRITION_BASE_ID)
    : null;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req);
  if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

  if (!base) {
    return res.status(500).json({
      error: "Nutrition Airtable not configured. Set NUTRITION_API_KEY and NUTRITION_BASE_ID.",
    });
  }

  const athleteToken = asString(req.query?.athleteToken);
  if (!athleteToken) return res.status(400).json({ error: "athleteToken is required." });

  const TABLE = process.env.NUTRITION_PLANS_TABLE || "tblbN4C6BWn6MNWzu";
  const TOKEN_FIELD = process.env.NUTRITION_TOKEN_FIELD || "AthleteToken";

  // output fields (optional)
  const LINK_FIELD = process.env.NUTRITION_PLANS_LINK_FIELD || "Athlete";
  const CREATED_AT_FIELD = process.env.NUTRITION_CREATED_AT_FIELD || "CreatedAt";
  const CREATED_BY_FIELD = process.env.NUTRITION_CREATED_BY_FIELD || "CreatedBy";
  const PHASE_FIELD = process.env.NUTRITION_PHASE_FIELD || "Phase";
  const PRESCRIPTION_FIELD = process.env.NUTRITION_PRESCRIPTION_FIELD || "Prescription";
  const STATUS_FIELD = process.env.NUTRITION_STATUS_FIELD || "Status";
  const DAILY_CAL_FIELD = process.env.NUTRITION_DAILY_CAL_FIELD || "DailyCalories";
  const DAILY_P_FIELD = process.env.NUTRITION_DAILY_P_FIELD || "DailyProtein";
  const DAILY_C_FIELD = process.env.NUTRITION_DAILY_C_FIELD || "DailyCarbs";
  const DAILY_F_FIELD = process.env.NUTRITION_DAILY_F_FIELD || "DailyFat";
  const PLANJSON_FIELD = process.env.NUTRITION_PLANJSON_FIELD || "PlanJson";

  // pagination params
  const pageSizeRaw = parseInt(String(req.query?.pageSize || "20"), 10);
  const pageSize = Number.isFinite(pageSizeRaw) ? Math.min(Math.max(pageSizeRaw, 5), 50) : 20;
  const offset = asString(req.query?.offset); // airtable offset string

  const filterByFormula = lookupSafeContains(TOKEN_FIELD, athleteToken);

  try {
    const result = await base(TABLE)
      .select({
        filterByFormula,
        sort: [{ field: CREATED_AT_FIELD, direction: "desc" }],
        pageSize,
        ...(offset ? { offset } : {}),
      })
      .firstPage();

    // Airtable SDK puts offset on the response object in a slightly awkward way.
    // It’s accessible via result.offset on some versions; safest is to re-run select and read from internal.
    // But we can get it by doing this:
    const nextOffset = result?.offset || null;

    const plans = (result || []).map((r) => ({
      id: r.id,
      phase: r.get(PHASE_FIELD) || "",
      prescription: r.get(PRESCRIPTION_FIELD) || "",
      status: r.get(STATUS_FIELD) || "",
      dailyCalories: String(r.get(DAILY_CAL_FIELD) ?? ""),
      dailyProtein: String(r.get(DAILY_P_FIELD) ?? ""),
      dailyCarbs: String(r.get(DAILY_C_FIELD) ?? ""),
      dailyFat: String(r.get(DAILY_F_FIELD) ?? ""),
      planJson: r.get(PLANJSON_FIELD) || "",
      createdAt: r.get(CREATED_AT_FIELD) || r._rawJson?.createdTime || "",
      createdBy: r.get(CREATED_BY_FIELD) || "",
      athlete: r.get(LINK_FIELD) || [],
      athleteToken: r.get(TOKEN_FIELD) || [],
    }));

    return res.status(200).json({
      ok: true,
      plans,
      nextOffset,
      debug: {
        athleteToken,
        table: TABLE,
        tokenField: TOKEN_FIELD,
        createdAtField: CREATED_AT_FIELD,
        filterByFormula,
        pageSize,
        offset: offset || "",
        count: plans.length,
      },
    });
  } catch (err) {
    console.error("[nutrition/plans/getByAthlete] error:", err);
    return res.status(500).json({
      error: "Failed to load plans",
      detail: err?.message || String(err),
    });
  }
}
