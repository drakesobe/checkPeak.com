// pages/api/org/nutrition/plans/upsert.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

function safeJson(res, code, obj) {
  return res.status(code).json(obj);
}

function escFormulaStr(v) {
  return String(v || "").replace(/'/g, "\\'");
}

function envMissingMap(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k] = !v;
  return out;
}

function safeStringifyJson(v) {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
}

async function batchUpdate(base, table, updates, batchSize = 10) {
  const list = Array.isArray(updates) ? updates : [];
  for (let i = 0; i < list.length; i += batchSize) {
    const chunk = list.slice(i, i + batchSize);
    // eslint-disable-next-line no-await-in-loop
    await base(table).update(chunk);
  }
}

// Helper: supports BOTH auth styles:
// - requireOrg(req,res) returning truthy org object (newer)
// - requireOrg(req) returning { ok: true } / { ok:false, error } (older)
function requireOrgCompat(req, res) {
  try {
    const out = requireOrg.length >= 2 ? requireOrg(req, res) : requireOrg(req);
    if (!out) return { ok: false, error: "Unauthorized" };
    if (typeof out === "object" && "ok" in out) return out; // {ok:...}
    return { ok: true, org: out };
  } catch (e) {
    return { ok: false, error: e?.message || "Unauthorized" };
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return safeJson(res, 405, { error: "Method not allowed" });

  const auth = requireOrgCompat(req, res);
  if (!auth?.ok) return safeJson(res, 401, { error: auth?.error || "Unauthorized" });

  // ✅ Trim envs so leading/trailing whitespace can't break config
  const NUTRITION_API_KEY = String(process.env.NUTRITION_API_KEY || "").trim();
  const NUTRITION_BASE_ID = String(process.env.NUTRITION_BASE_ID || "").trim();

  /**
   * ✅ Table env name compatibility
   * Your .env.local currently has:
   *   NUTRITION_TABLE_NAME=tblbN4C6BWn6MNWzu   (this is the PLANS table ID)
   *
   * This API originally expected:
   *   NUTRITION_PLANS_TABLE / NUTRITION_ROSTER_TABLE
   */
  const NUTRITION_PLANS_TABLE = String(
    process.env.NUTRITION_PLANS_TABLE ||
      process.env.NUTRITION_TABLE_NAME || // 👈 backwards compatible with your env
      "tblbN4C6BWn6MNWzu"
  ).trim();

  const NUTRITION_ROSTER_TABLE = String(process.env.NUTRITION_ROSTER_TABLE || "tblyfqbVBXKR7jPEz").trim();

  // Fields (override via env if needed)
  const TOKEN_FIELD = String(process.env.NUTRITION_TOKEN_FIELD || "AthleteToken").trim();
  const PLANS_LINK_FIELD = String(process.env.NUTRITION_PLANS_LINK_FIELD || "Athlete").trim();
  const STATUS_FIELD = String(process.env.NUTRITION_STATUS_FIELD || "Status").trim();
  const CREATEDAT_FIELD = String(process.env.NUTRITION_CREATEDAT_FIELD || "CreatedAt").trim();

  const ARCHIVED_AT_FIELD = String(process.env.NUTRITION_ARCHIVEDAT_FIELD || "ArchivedAt").trim();
  const ARCHIVED_BY_FIELD = String(process.env.NUTRITION_ARCHIVEDBY_FIELD || "ArchivedBy").trim();

  if (!NUTRITION_API_KEY || !NUTRITION_BASE_ID) {
    return safeJson(res, 500, {
      error: "Nutrition Airtable not configured. Set NUTRITION_API_KEY and NUTRITION_BASE_ID.",
      missing: envMissingMap({ NUTRITION_API_KEY, NUTRITION_BASE_ID }),
      debug: {
        // ✅ helps you confirm which table envs are being used
        NUTRITION_PLANS_TABLE,
        NUTRITION_ROSTER_TABLE,
        TOKEN_FIELD,
        PLANS_LINK_FIELD,
        STATUS_FIELD,
        CREATEDAT_FIELD,
      },
    });
  }

  const base = new Airtable({ apiKey: NUTRITION_API_KEY }).base(NUTRITION_BASE_ID);

  try {
    const {
      athleteToken,
      phase = "",
      daily = {},
      planJson,
      prescription = "",
      createdBy = "",
      status = "active",
    } = req.body || {};

    const token = String(athleteToken || "").trim();
    if (!token) return safeJson(res, 400, { error: "athleteToken is required" });

    // 1) Find athlete record in roster by token (lookup-safe)
    const safeToken = escFormulaStr(token);
    const rosterFilter = `OR(
      {${TOKEN_FIELD}}='${safeToken}',
      FIND('${safeToken}', ARRAYJOIN({${TOKEN_FIELD}}&''))>0
    )`;

    const rosterFound = await base(NUTRITION_ROSTER_TABLE)
      .select({ maxRecords: 1, filterByFormula: rosterFilter })
      .firstPage();

    const athleteRec = rosterFound?.[0];
    if (!athleteRec) {
      return safeJson(res, 404, {
        error: "Athlete not found for token",
        debug: { token, tokenField: TOKEN_FIELD, rosterTable: NUTRITION_ROSTER_TABLE, rosterFilter },
      });
    }

    // 2) Find active plans for that athlete
    const findActivePlans = `AND(
      FIND('${athleteRec.id}', ARRAYJOIN({${PLANS_LINK_FIELD}}&''))>0,
      LOWER({${STATUS_FIELD}}&'')='active'
    )`;

    const activePlans = await base(NUTRITION_PLANS_TABLE)
      .select({
        filterByFormula: findActivePlans,
        fields: [STATUS_FIELD],
        maxRecords: 100,
      })
      .firstPage();

    const nowISO = new Date().toISOString();

    // 3) Archive existing active plans (if any)
    if (activePlans?.length) {
      const updates = activePlans.map((rec) => {
        const fields = { [STATUS_FIELD]: "archived" };

        // Only write archive metadata if fields exist / env names are not blank
        if (ARCHIVED_AT_FIELD) fields[ARCHIVED_AT_FIELD] = nowISO;
        if (ARCHIVED_BY_FIELD) fields[ARCHIVED_BY_FIELD] = String(createdBy || "");

        return { id: rec.id, fields };
      });

      await batchUpdate(base, NUTRITION_PLANS_TABLE, updates, 10);
    }

    // 4) Create the new plan
    const planJsonStr = safeStringifyJson(planJson);

    const newFields = {
      [PLANS_LINK_FIELD]: [athleteRec.id],
      Phase: String(phase || ""),
      DailyCalories: daily?.calories ?? "",
      DailyProtein: daily?.protein ?? "",
      DailyCarbs: daily?.carbs ?? "",
      DailyFat: daily?.fat ?? "",
      PlanJson: planJsonStr,
      Prescription: String(prescription || ""),
      [CREATEDAT_FIELD]: nowISO,
      CreatedBy: String(createdBy || ""),
      [STATUS_FIELD]: String(status || "active") || "active",
    };

    const created = await base(NUTRITION_PLANS_TABLE).create(newFields);

    return safeJson(res, 200, {
      ok: true,
      athleteId: athleteRec.id,
      archivedCount: activePlans?.length || 0,
      planId: created?.id || "",
    });
  } catch (err) {
    console.error("[nutrition/plans/upsert] error:", err);
    return safeJson(res, 500, { error: err?.message || "Failed to upsert nutrition plan" });
  }
}
