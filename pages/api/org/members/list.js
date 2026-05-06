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
  return isOrg(actorRole) || isAdmin(actorRole);
}

// ── FIX 6: orgLink is the authoritative filter. ───────────────────────────
// orgToken is kept as a fallback ONLY to support members whose Organization
// linked-record field was never populated (legacy records or manual Airtable
// edits). It is NOT the primary filter.
//
// MIGRATION PLAN: once all OrgMembers records have a correct Organization
// link, remove the OR and use orgLinkFormula alone. You can audit readiness
// by running this Airtable formula in a view:
//   {Organization} = BLANK()
// When that view is empty for your org, delete the orgToken branch below.
// ──────────────────────────────────────────────────────────────────────────
function orgLinkFormula(orgField, orgId) {
  const safeOrg = escapeAirtableString(String(orgId || "").trim());
  return `FIND('${safeOrg}', ARRAYJOIN({${orgField}}&'')) > 0`;
}

function orgTokenFormula(tokenField, token) {
  const safeTok = escapeAirtableString(String(token || "").trim().toLowerCase());
  return `LOWER({${tokenField}}&'')='${safeTok}'`;
}

async function selectAll(table, selectOpts = {}) {
  const all = [];
  await new Promise((resolve, reject) => {
    table
      .select({ pageSize: 100, ...selectOpts })
      .eachPage(
        (records, fetchNextPage) => { all.push(...records); fetchNextPage(); },
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

    const orgId    = String(user?.orgId || "").trim();
    const orgToken = String(user?.Token  || "").trim();

    if (!orgId)    return res.status(400).json({ error: "Missing orgId on session user." });
    if (!orgToken) return res.status(400).json({ error: "Missing Token on session user." });

    const b = base();

    const memOrgField      = F.MEM_ORG       || "Organization";
    const memActiveField   = F.MEM_ACTIVE    || "Active";
    const memRoleField     = F.MEM_ROLE      || "Role";
    const memOrgTokenField = F.MEM_ORG_TOKEN || "OrgToken";

    // Primary filter: Organization linked-record field.
    // Fallback: OrgToken field (legacy records only - see migration note above).
    // TODO: remove orgToken branch once all records have the Organization link.
    const filter = `OR(${orgLinkFormula(memOrgField, orgId)}, ${orgTokenFormula(memOrgTokenField, orgToken)})`;

    const members = await selectAll(b(AT.tables.orgMembers), {
      filterByFormula: filter,
    });

    // ── FIX 4: Athletes query removed ────────────────────────────────────
    // The org trainers page never uses the athletes list. Fetching it on
    // every page load costs an extra full Airtable scan (up to N pages at
    // 100 records/page). If athletes are needed in future, add
    // ?include=athletes to the query string and gate the fetch behind that.
    // ──────────────────────────────────────────────────────────────────────

    const trainers = members
      .filter((m) => {
        const r = String(m.fields?.[memRoleField] || "").toLowerCase();
        return ["trainer", "admin"].includes(r);
      })
      .map((m) => ({
        id: m.id,
        ...m.fields,
        // Normalize Active to a real boolean - Airtable checkbox fields can
        // come back as true, false, or undefined (unchecked = missing key).
        [memActiveField]:
          typeof m.fields?.[memActiveField] === "boolean"
            ? m.fields[memActiveField]
            : false,
      }));

    return res.status(200).json({
      ok:       true,
      trainers,
      debug: {
        orgId,
        memberFilter: filter,
        memberCount:  members.length,
        trainerCount: trainers.length,
      },
    });

  } catch (err) {
    console.error("[org/members/list] error:", err);
    return res.status(500).json({ error: "Failed to load members", details: err?.message });
  }
}