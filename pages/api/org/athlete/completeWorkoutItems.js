import { getBase, escapeAirtableString, normalizeEmail } from "@/lib/airtableOrgWorkouts";
import { F } from "@/lib/orgWorkoutFields";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { email, workoutItemId, evidenceType, fileUrl } = req.body || {};
    const cleanEmail = normalizeEmail(email);

    if (!cleanEmail || !cleanEmail.includes("@")) return res.status(400).json({ error: "Valid email is required." });
    if (!workoutItemId) return res.status(400).json({ error: "workoutItemId is required." });

    const API_KEY = process.env.ORGANIZATIONS_API_KEY;

    const ATH_BASE_ID = process.env.ATHLETE_BASE_ID;
    const ATH_TABLE = process.env.ATHLETE_TABLE_NAME;

    const WI_BASE_ID = process.env.WORKOUTITEMS_BASE_ID;
    const WI_TABLE = process.env.WORKOUTITEMS_TABLE_ID;

    const WC_BASE_ID = process.env.WORKOUTCOMPLETIONS_BASE_ID;
    const WC_TABLE = process.env.WORKOUTCOMPLETIONS_TABLE_ID;

    const EV_BASE_ID = process.env.COMPLETIONEVIDENCE_BASE_ID;
    const EV_TABLE = process.env.COMPLETIONEVIDENCE_TABLE_ID;

    if (!API_KEY) return res.status(500).json({ error: "Airtable API key missing." });
    if (!ATH_BASE_ID || !ATH_TABLE) return res.status(500).json({ error: "Athletes Airtable not configured." });
    if (!WI_BASE_ID || !WI_TABLE) return res.status(500).json({ error: "WorkoutItems Airtable not configured." });
    if (!WC_BASE_ID || !WC_TABLE) return res.status(500).json({ error: "WorkoutCompletions Airtable not configured." });
    if (!EV_BASE_ID || !EV_TABLE) return res.status(500).json({ error: "CompletionEvidence Airtable not configured." });

    const athBase = getBase(API_KEY, ATH_BASE_ID);
    const wiBase = getBase(API_KEY, WI_BASE_ID);
    const wcBase = getBase(API_KEY, WC_BASE_ID);
    const evBase = getBase(API_KEY, EV_BASE_ID);

    // 1) athlete record
    const safeEmail = escapeAirtableString(cleanEmail);
    const athleteRecords = await athBase(ATH_TABLE)
      .select({ filterByFormula: `LOWER({${F.ATH_EMAIL}})='${safeEmail}'`, maxRecords: 1 })
      .firstPage();

    if (!athleteRecords.length) return res.status(404).json({ error: "Athlete not found." });
    const athlete = athleteRecords[0];

    // 2) workout item record (to read org + evidence requirement)
    const item = await wiBase(WI_TABLE).find(workoutItemId);
    const evidenceReq = String(item.fields?.[F.WI_EVIDENCE] || "none");

    const orgLinks = item.fields?.[F.WI_ORG];
    const orgId = Array.isArray(orgLinks) && orgLinks.length ? orgLinks[0] : null;
    if (!orgId) return res.status(500).json({ error: "Workout item missing organization link." });

    // 3) decide completion status
    const needsEvidence = evidenceReq && evidenceReq !== "none";
    const status = needsEvidence ? "pending_review" : "completed";

    // 4) create completion
    const completionCreated = await wcBase(WC_TABLE).create([
      {
        fields: {
          [F.WC_ORG]: [orgId],
          [F.WC_ITEM]: [workoutItemId],
          [F.WC_ATHLETE]: [athlete.id],
          [F.WC_STATUS]: status,
          [F.WC_COMPLETEDAT]: new Date().toISOString(),
        },
      },
    ]);

    const completionId = completionCreated?.[0]?.id;

    // 5) add evidence if provided
    if (fileUrl) {
      await evBase(EV_TABLE).create([
        {
          fields: {
            [F.EV_ORG]: [orgId],
            [F.EV_COMPLETION]: [completionId],
            [F.EV_TYPE]: evidenceType || "photo",
            [F.EV_FILEURL]: String(fileUrl),
            [F.EV_UPLOADEDAT]: new Date().toISOString(),
          },
        },
      ]);
    }

    return res.status(200).json({ ok: true, completionId, status });
  } catch (err) {
    console.error("[athlete/completeWorkoutItem] error:", err);
    return res.status(500).json({
      error: "Failed to complete workout item",
      airtable: { statusCode: err?.statusCode, message: err?.message, error: err?.error },
    });
  }
}
