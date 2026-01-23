import { getBase, escapeAirtableString, normalizeEmail, normalizeToken } from "@/lib/airtableOrgWorkouts";
import { F } from "@/lib/orgWorkoutFields";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { token, trainerEmail, max = 25 } = req.body || {};
    const cleanToken = normalizeToken(token);
    const cleanTrainerEmail = normalizeEmail(trainerEmail);

    if (!cleanToken) return res.status(400).json({ error: "Organization code is required." });
    if (!cleanTrainerEmail || !cleanTrainerEmail.includes("@")) return res.status(400).json({ error: "Valid trainer email is required." });

    const API_KEY = process.env.ORGANIZATIONS_API_KEY;

    const ORG_BASE_ID = process.env.ORGANIZATIONS_BASE_ID;
    const ORG_TABLE = process.env.ORGANIZATIONS_TABLE_NAME;

    const MEM_BASE_ID = process.env.ORG_MEMBERS_BASE_ID;
    const MEM_TABLE = process.env.ORG_MEMBERS_TABLE_ID;

    const WC_BASE_ID = process.env.WORKOUTCOMPLETIONS_BASE_ID;
    const WC_TABLE = process.env.WORKOUTCOMPLETIONS_TABLE_ID;

    const EV_BASE_ID = process.env.COMPLETIONEVIDENCE_BASE_ID;
    const EV_TABLE = process.env.COMPLETIONEVIDENCE_TABLE_ID;

    if (!API_KEY) return res.status(500).json({ error: "Airtable API key missing." });
    if (!ORG_BASE_ID || !ORG_TABLE) return res.status(500).json({ error: "Organizations Airtable not configured." });
    if (!MEM_BASE_ID || !MEM_TABLE) return res.status(500).json({ error: "OrgMembers Airtable not configured." });
    if (!WC_BASE_ID || !WC_TABLE) return res.status(500).json({ error: "WorkoutCompletions Airtable not configured." });
    if (!EV_BASE_ID || !EV_TABLE) return res.status(500).json({ error: "CompletionEvidence Airtable not configured." });

    const orgBase = getBase(API_KEY, ORG_BASE_ID);
    const memBase = getBase(API_KEY, MEM_BASE_ID);
    const wcBase = getBase(API_KEY, WC_BASE_ID);
    const evBase = getBase(API_KEY, EV_BASE_ID);

    // org by token
    const safeToken = escapeAirtableString(cleanToken.toLowerCase());
    const orgRecords = await orgBase(ORG_TABLE)
      .select({ filterByFormula: `LOWER({${F.ORG_TOKEN}})='${safeToken}'`, maxRecords: 1 })
      .firstPage();
    if (!orgRecords.length) return res.status(404).json({ error: "Invalid organization code." });
    const orgId = orgRecords[0].id;

    // trainer auth
    const safeEmail = escapeAirtableString(cleanTrainerEmail);
    const trainerRecords = await memBase(MEM_TABLE)
      .select({
        filterByFormula: `AND(LOWER({${F.MEMBER_EMAIL}})='${safeEmail}', {${F.MEMBER_ACTIVE}}=TRUE())`,
        maxRecords: 1,
      })
      .firstPage();
    if (!trainerRecords.length) return res.status(403).json({ error: "Trainer not found or inactive." });

    const role = String(trainerRecords[0].fields?.[F.MEMBER_ROLE] || "").toLowerCase();
    if (role !== "trainer" && role !== "admin") return res.status(403).json({ error: "Not authorized." });

    // completions pending review for this org
    const completions = await wcBase(WC_TABLE)
      .select({
        filterByFormula: `AND({${F.WC_STATUS}}='pending_review')`,
        maxRecords: Math.min(Number(max) || 25, 50),
      })
      .firstPage();

    // filter to org (some Airtable formula quirks w/ linked fields; we filter in JS reliably)
    const inOrg = completions.filter((r) => {
      const links = r.fields?.[F.WC_ORG];
      return Array.isArray(links) && links.includes(orgId);
    });

    // attach evidence records
    const completionIds = inOrg.map((c) => c.id);
    let evidence = [];
    if (completionIds.length) {
      // Airtable formula OR(...) for up to 25-50 ids; keep it simple
      const clauses = completionIds.slice(0, 25).map((id) => `{${F.EV_COMPLETION}}='${id}'`);
      evidence = await evBase(EV_TABLE)
        .select({ filterByFormula: clauses.length ? `OR(${clauses.join(",")})` : "FALSE()", maxRecords: 100 })
        .firstPage();
    }

    const evidenceByCompletion = {};
    for (const e of evidence) {
      const links = e.fields?.[F.EV_COMPLETION];
      const cid = Array.isArray(links) && links[0];
      if (!cid) continue;
      evidenceByCompletion[cid] = evidenceByCompletion[cid] || [];
      evidenceByCompletion[cid].push({ id: e.id, ...e.fields });
    }

    return res.status(200).json({
      ok: true,
      queue: inOrg.map((c) => ({
        id: c.id,
        ...c.fields,
        evidence: evidenceByCompletion[c.id] || [],
      })),
    });
  } catch (err) {
    console.error("[org/reviewQueue] error:", err);
    return res.status(500).json({
      error: "Failed to load review queue",
      airtable: { statusCode: err?.statusCode, message: err?.message, error: err?.error },
    });
  }
}
