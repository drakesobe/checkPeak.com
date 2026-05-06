import Airtable from "airtable";
import { requireOrgSideUser } from "@/lib/requireUser";

function getBase() {
  if (!process.env.ORGANIZATIONS_API_KEY || !process.env.ORGANIZATIONS_BASE_ID) {
    throw new Error("ORGANIZATIONS_API_KEY or ORGANIZATIONS_BASE_ID env var missing.");
  }
  return new Airtable({ apiKey: process.env.ORGANIZATIONS_API_KEY })
    .base(process.env.ORGANIZATIONS_BASE_ID);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = requireOrgSideUser(req, res);
  console.log("[season-calendar/get] user:", JSON.stringify(user));

  if (!user) return;

  const orgId = String(
    user?.orgId || user?.OrgId || user?.org_id ||
    user?.OrganizationId || user?.airtableId || user?.id || ""
  ).trim();

  console.log("[season-calendar/get] orgId resolved:", orgId);

  if (!orgId) {
    return res.status(400).json({ error: "No orgId on session — re-login." });
  }

  const table = process.env.ORGANIZATIONS_TABLE_NAME || "tblDfjURwuvxOI0Su";

  try {
    console.log("[season-calendar/get] fetching record:", orgId, "from table:", table);
    const record = await getBase()(table).find(orgId);
    console.log("[season-calendar/get] record fields keys:", Object.keys(record?.fields || {}));

    const raw = (record?.fields?.SeasonCalendar || "").replace(/\\\_/g, "_");
    console.log("[season-calendar/get] raw value:", raw?.slice(0, 100));

    let periods = [];
    if (raw) {
      try { periods = JSON.parse(raw); } catch (parseErr) {
        console.error("[season-calendar/get] JSON parse failed:", parseErr?.message);
      }
    }
    if (!Array.isArray(periods)) periods = [];

    // Backfill sports field for periods saved before it was added
    periods = periods.map(p => ({
      ...p,
      sports: Array.isArray(p.sports) ? p.sports : [],
    }));

    console.log("[season-calendar/get] returning", periods.length, "periods");
    return res.status(200).json({ ok: true, periods });

  } catch (e) {
    console.error("[season-calendar/get] FAILED:", e?.message || e);
    // Now returns 500 so the frontend actually knows something went wrong
    return res.status(500).json({ error: e?.message || "Failed to load season calendar." });
  }
}