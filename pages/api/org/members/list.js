import { requireOrgSideUser } from "@/lib/requireUser";
import { AT, base, F, escapeAirtableString } from "@/lib/airtableOrgWorkoutConfig";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  try {
    const b = base();

    // orgId must be on cookie user (we'll add it in lookupUser update)
    const orgId = user.orgId;
    if (!orgId) return res.status(400).json({ error: "Missing orgId on session user." });

    const members = await b(AT.tables.orgMembers)
      .select({
        filterByFormula: `AND({${F.MEM_ACTIVE}}=TRUE())`,
        maxRecords: 100,
      })
      .firstPage();

    const inOrg = members.filter((m) => Array.isArray(m.fields?.[F.MEM_ORG]) && m.fields[F.MEM_ORG].includes(orgId));

    // optionally also pull athletes
    const athletes = await b(AT.tables.athletes)
      .select({ maxRecords: 200 })
      .firstPage();
    const athletesInOrg = athletes.filter((a) => Array.isArray(a.fields?.[F.ATH_ORG]) && a.fields[F.ATH_ORG].includes(orgId));

    return res.status(200).json({
      ok: true,
      trainers: inOrg
        .filter((m) => ["trainer", "admin"].includes(String(m.fields?.[F.MEM_ROLE] || "").toLowerCase()))
        .map((m) => ({ id: m.id, ...m.fields })),
      athletes: athletesInOrg.map((a) => ({ id: a.id, ...a.fields })),
    });
  } catch (err) {
    console.error("[org/members/list] error:", err);
    return res.status(500).json({ error: "Failed to load members", details: err?.message });
  }
}
