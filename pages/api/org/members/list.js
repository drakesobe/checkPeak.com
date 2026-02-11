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

function isTrainer(role) {
  return role === "trainer" || role.includes("train");
}

/**
 * ✅ Trainers should be able to VIEW the members list (view-only UI gating stays client-side),
 * but only Org/Admin can invite/update/remove.
 */
function canViewMembers(actorRole) {
  return isOrg(actorRole) || isAdmin(actorRole) || isTrainer(actorRole);
}

function orgFilterFormula(ORG_FIELD, orgId) {
  const safeOrg = escapeAirtableString(String(orgId || "").trim());
  // Handles linked-record arrays (Organization is a link field)
  return `FIND('${safeOrg}', ARRAYJOIN({${ORG_FIELD}}&'')) > 0`;
}

/**
 * Airtable .select().eachPage helper
 */
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

function safeRole(v) {
  return String(v || "").trim().toLowerCase();
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
      return res.status(403).json({ error: "Only Organization/Admin/Trainer can view members." });
    }

    const b = base();
    const orgId = String(user.orgId || "").trim();
    if (!orgId) return res.status(400).json({ error: "Missing orgId on session user." });

    // Field names (allow overrides from your config)
    const memOrgField = F.MEM_ORG || "Organization";
    const memActiveField = F.MEM_ACTIVE || "Active";
    const memRoleField = F.MEM_ROLE || "Role";

    const athOrgField = F.ATH_ORG || "Organization";

    /**
     * ✅ Include inactive members (so the UI can show "Inactive" + reactivate via edit)
     * You can still filter in the UI if you want “active-only”.
     *
     * If you ever want to hide inactive by default, you can add:
     *   ?activeOnly=1
     */
    const activeOnly =
      String(req.query?.activeOnly || "").trim() === "1" ||
      String(req.query?.activeOnly || "").trim().toLowerCase() === "true";

    const membersFilter = activeOnly
      ? `AND({${memActiveField}}=TRUE(), ${orgFilterFormula(memOrgField, orgId)})`
      : orgFilterFormula(memOrgField, orgId);

    // ✅ Org members filtered by org (and optionally activeOnly)
    const members = await selectAll(b(AT.tables.orgMembers), {
      filterByFormula: membersFilter,
      // Optional sort for nicer UX
      sort: [
        { field: memRoleField, direction: "asc" },
        { field: "Email", direction: "asc" },
      ],
    });

    // ✅ Athletes filtered by org
    const athletes = await selectAll(b(AT.tables.athletes), {
      filterByFormula: orgFilterFormula(athOrgField, orgId),
      sort: [{ field: "Email", direction: "asc" }],
    });

    /**
     * ✅ IMPORTANT:
     * You said OrgMembers.Role is single select with ONLY: admin, trainer.
     * So we only return those roles from OrgMembers.
     */
    const trainers = (members || [])
      .filter((m) => {
        const r = safeRole(m?.fields?.[memRoleField]);
        return r === "admin" || r === "trainer";
      })
      .map((m) => ({
        id: m.id,
        ...m.fields,
        // normalize a few keys for frontend safety (optional)
        Role: m?.fields?.[memRoleField],
        Active:
          typeof m?.fields?.[memActiveField] === "boolean"
            ? m.fields[memActiveField]
            : Boolean(m?.fields?.Active),
      }));

    const athletesInOrg = (athletes || []).map((a) => ({
      id: a.id,
      ...a.fields,
    }));

    return res.status(200).json({
      ok: true,
      trainers, // OrgMembers (admin/trainer)
      athletes: athletesInOrg, // Athletes table
      debug: {
        actorRole,
        orgId,
        activeOnly,
        memberCount: trainers.length,
        athleteCount: athletesInOrg.length,
      },
    });
  } catch (err) {
    console.error("[org/members/list] error:", err);
    return res.status(500).json({ error: "Failed to load members", details: err?.message });
  }
}
