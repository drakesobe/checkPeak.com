// pages/api/org/nutrition/plans/getCompletionMap.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

function safeJson(res, code, obj) {
  return res.status(code).json(obj);
}

function escapeAirtableString(str = "") {
  return String(str).replace(/'/g, "\\'");
}

/**
 * Lookup-safe match (works if field is text OR lookup/array)
 */
function lookupSafeContains(fieldName, value) {
  const safe = escapeAirtableString(value);
  return `FIND('${safe}', ARRAYJOIN({${fieldName}}&''))>0`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return safeJson(res, 405, { error: "Method not allowed" });

  const auth = requireOrg(req);
  if (!auth?.ok) return safeJson(res, 401, { error: auth?.error || "Unauthorized" });

  const NUTRITION_API_KEY = process.env.NUTRITION_API_KEY;
  const NUTRITION_BASE_ID = process.env.NUTRITION_BASE_ID;

  if (!NUTRITION_API_KEY || !NUTRITION_BASE_ID) {
    return safeJson(res, 500, {
      error: "Nutrition Airtable not configured. Set NUTRITION_API_KEY and NUTRITION_BASE_ID.",
      missing: {
        NUTRITION_API_KEY: !NUTRITION_API_KEY,
        NUTRITION_BASE_ID: !NUTRITION_BASE_ID,
      },
    });
  }

  // Your table IDs/names (matches what you shared)
  const NUTRITION_PLANS_TABLE = process.env.NUTRITION_PLANS_TABLE || "tblbN4C6BWn6MNWzu";

  // Fields
  const TOKEN_FIELD = process.env.NUTRITION_TOKEN_FIELD || "AthleteToken";
  const STATUS_FIELD = process.env.NUTRITION_STATUS_FIELD || "Status";

  // Query param: ?status=active | all
  const status = String(req.query?.status || "active").trim().toLowerCase();

  const base = new Airtable({ apiKey: NUTRITION_API_KEY }).base(NUTRITION_BASE_ID);

  try {
    const filterByFormula =
      status === "all"
        ? "TRUE()"
        : `LOWER({${STATUS_FIELD}}&'')='active'`;

    // Pull enough records to cover your org usage.
    // If you expect >100, we use .all() (paginates automatically).
    const records = await base(NUTRITION_PLANS_TABLE)
      .select({
        filterByFormula,
        fields: [TOKEN_FIELD, STATUS_FIELD],
        pageSize: 100,
      })
      .all();

    const doneTokens = new Set();

    for (const r of records) {
      const raw = r.get(TOKEN_FIELD);

      // Lookup can come as array OR string depending on Airtable configuration
      if (Array.isArray(raw)) {
        for (const t of raw) {
          const s = String(t || "").trim();
          if (s) doneTokens.add(s);
        }
      } else {
        const s = String(raw || "").trim();
        if (s) doneTokens.add(s);
      }
    }

    return safeJson(res, 200, {
      ok: true,
      doneTokens: Array.from(doneTokens),
      debug: {
        table: NUTRITION_PLANS_TABLE,
        tokenField: TOKEN_FIELD,
        statusField: STATUS_FIELD,
        statusMode: status,
        filterByFormula,
        countRecords: records.length,
        countTokens: doneTokens.size,
      },
    });
  } catch (err) {
    console.error("[nutrition/plans/getCompletionMap] error:", err);
    return safeJson(res, 500, {
      error: "Failed to build completion map",
      detail: err?.message || String(err),
    });
  }
}
