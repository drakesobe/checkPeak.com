// pages/api/org/members/list.js
import { requireOrgSideUser } from "@/lib/requireUser";
import { AT, base, F, escapeAirtableString } from "@/lib/airtableOrgWorkoutConfig";

function roleOf(user) {
  return String(user?.role || user?.Role || "").trim().toLowerCase();
}

function isOrg(role) {
  return role === "organization" || role === "org" || role.includes("organization");
}

function isAdmin(role) {
  return role === "admin" || role.includes("admin") || role.includes("head");
}

function canViewMembers(actorRole) {
  // Org + Admin can see staff/athletes list; trainers can be allowed if you want.
  return isOrg(actorRole) || isAdmin(actorRole);
}

function orgFilterFormula(ORG_FIELD, orgId) {
  const safeOrg = escapeAirtableString(String(orgId || "").trim());
  return `FIND('${safeOrg}', ARRAYJOIN({${ORG_FIELD}}&'')) > 0`;
}

async function selectAll(table, selectOpts = {}) {
  const all = [];
  await new Promise((resolve, reject) => {
    table
      .select({ pageSize: 100, ...selectOpts })
      .eachPage(
        (records, fetchNextPage) => {
          all.push(...records);
          fetchNextPage();
        },
        (err) => (err ? reject(err) : resolve())
      );
  });
  return all;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  try {
    const actorRole = roleOf(user);
    if (!canViewMembers(actorRole)) {
      return res.status(403).json({ error: "Only Organization/Admin can view members." });
    }

    const b = base();
    const orgId = String(user.orgId || "").trim();
    if (!orgId) return res.status(400).json({ error: "Missing orgId on session user." });

    const memOrgField = F.MEM_ORG || "Organization";
    const memActiveField = F.MEM_ACTIVE || "Active";
    const memRoleField = F.MEM_ROLE || "Role";

    const athOrgField = F.ATH_ORG || "Organization";

    // ✅ members filtered by org + active IN Airtable
    const members = await selectAll(b(AT.tables.orgMembers), {
      filterByFormula: `AND({${memActiveField}}=TRUE(), ${orgFilterFormula(memOrgField, orgId)})`,
    });

    // ✅ athletes filtered by org IN Airtable
    const athletes = await selectAll(b(AT.tables.athletes), {
      filterByFormula: orgFilterFormula(athOrgField, orgId),
    });

    const trainers = members
      .filter((m) => ["trainer", "admin"].includes(String(m.fields?.[memRoleField] || "").toLowerCase()))
      .map((m) => ({ id: m.id, ...m.fields }));

    const athletesInOrg = athletes.map((a) => ({ id: a.id, ...a.fields }));

    return res.status(200).json({
      ok: true,
      trainers,
      athletes: athletesInOrg,
    });
  } catch (err) {
    console.error("[org/members/list] error:", err);
    return res.status(500).json({ error: "Failed to load members", details: err?.message });
  }
}
