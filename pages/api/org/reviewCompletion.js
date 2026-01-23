import { getBase, escapeAirtableString, normalizeEmail, normalizeToken } from "@/lib/airtableOrgWorkouts";
import { F } from "@/lib/orgWorkoutFields";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { token, trainerEmail, completionId, decision, note } = req.body || {};
    const cleanToken = normalizeToken(token);
    const cleanTrainerEmail = normalizeEmail(trainerEmail);

    if (!cleanToken) return res.status(400).json({ error: "Organization code is required." });
    if (!cleanTrainerEmail || !cleanTrainerEmail.includes("@")) return res.status(400).json({ error: "Valid trainer email is required." });
    if (!completionId) return res.status(400).json({ error: "completionId is required." });

    const normalizedDecision = String(decision || "").toLowerCase();
    const nextStatus = normalizedDecision === "approve" ? "completed" : normalizedDecision === "reject" ? "rejected" : null;
    if (!nextStatus) return res.status(400).json({ error: "decision must be approve or reject." });

    const API_KEY = process.env.ORGANIZATIONS_API_KEY;

    const ORG_BASE_ID = process.env.ORGANIZATIONS_BASE_ID;
    const ORG_TABLE = process.env.ORGANIZATIONS_TABLE_NAME;

    const MEM_BASE_ID = process.env.ORG_MEMBERS_BASE_ID;
    const MEM_TABLE = process.env.ORG_MEMBERS_TABLE_ID;

    const WC_BASE_ID = process.env.WORKOUTCOMPLETIONS_BASE_ID;
    const WC_TABLE = process.env.WORKOUTCOMPLETIONS_TABLE_ID;

    if (!API_KEY) return res.status(500).json({ error: "Airtable API key missing." });
    if (!ORG_BASE_ID || !ORG_TABLE) return res.status(500).json({ error: "Organizations Airtable not configured." });
    if (!MEM_BASE_ID || !MEM_TABLE) return res.status(500).json({ error: "OrgMembers Airtable not configured." });
    if (!WC_BASE_ID || !WC_TABLE) return res.status(500).json({ error: "WorkoutCompletions Airtable not configured." });

    const orgBase = getBase(API_KEY, ORG_BASE_ID);
    const memBase = getBase(API_KEY, MEM_BASE_ID);
    const wcBase = getBase(API_KEY, WC_BASE_ID);

    // org by token
    const safeToken = escapeAirtableString(cleanToken.toLowerCase());
    const orgRecords = await orgBase(ORG_TABLE)
      .select({ filterByFormula: `LOWER({${F.ORG_TOKEN}})='${safeToken}'`, maxRecords: 1 })
      .firstPage();
    if (!orgRecords.length) return res.status(404).json({ error: "Invalid organization code." });
    const orgId = orgRecords[0].id;

    // trainer record
    const safeEmail = escapeAirtableString(cleanTrainerEmail);
    const trainerRecords = await memBase(MEM_TABLE)
      .select({
        filterByFormula: `AND(LOWER({${F.MEMBER_EMAIL}})='${safeEmail}', {${F.MEMBER_ACTIVE}}=TRUE())`,
        maxRecords: 1,
      })
      .firstPage();
    if (!trainerRecords.length) return res.status(403).json({ error: "Trainer not found or inactive." });

    const trainer = trainerRecords[0];
    const role = String(trainer.fields?.[F.MEMBER_ROLE] || "").toLowerCase();
    if (role !== "trainer" && role !== "admin") return res.status(403).json({ error: "Not authorized." });

    // ensure completion belongs to org
    const completion = await wcBase(WC_TABLE).find(completionId);
    const links = completion.fields?.[F.WC_ORG];
    if (!Array.isArray(links) || !links.includes(orgId)) return res.status(403).json({ error: "Not allowed for this org." });

    await wcBase(WC_TABLE).update([
      {
        id: completionId,
        fields: {
          [F.WC_STATUS]: nextStatus,
          [F.WC_REVIEWEDBY]: [trainer.id],
          ...(note ? { [F.WC_REVIEWNOTE]: String(note) } : {}),
        },
      },
    ]);

    return res.status(200).json({ ok: true, status: nextStatus });
  } catch (err) {
    console.error("[org/reviewCompletion] error:", err);
    return res.status(500).json({
      error: "Failed to review completion",
      airtable: { statusCode: err?.statusCode, message: err?.message, error: err?.error },
    });
  }
}
