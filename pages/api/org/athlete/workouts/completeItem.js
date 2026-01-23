import { requireAthleteUser } from "@/lib/requireUser";
import { AT, base, F, escapeAirtableString } from "@/lib/airtableOrgWorkoutConfig";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireAthleteUser(req, res);
  if (!user) return;

  try {
    const { workoutItemId, fileUrl, evidenceType = "photo" } = req.body || {};
    if (!workoutItemId) return res.status(400).json({ error: "workoutItemId is required." });

    const b = base();
    const email = String(user.email || "").toLowerCase();

    // athlete record
    const safeEmail = escapeAirtableString(email);
    const athleteRecords = await b(AT.tables.athletes)
      .select({ filterByFormula: `LOWER({${F.ATH_EMAIL}})='${safeEmail}'`, maxRecords: 1 })
      .firstPage();
    if (!athleteRecords.length) return res.status(404).json({ error: "Athlete not found." });
    const athlete = athleteRecords[0];

    // workout item record (get org + evidence requirement)
    const item = await b(AT.tables.workoutItems).find(workoutItemId);
    const orgId = Array.isArray(item.fields?.[F.WI_ORG]) ? item.fields[F.WI_ORG][0] : null;
    if (!orgId) return res.status(500).json({ error: "Workout item missing Organization link." });

    const evidenceReq = String(item.fields?.[F.WI_EVIDENCE] || "none");
    const needsEvidence = evidenceReq !== "none";
    const status = needsEvidence ? "pending_review" : "completed";

    // create completion
    const created = await b(AT.tables.workoutCompletions).create([
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

    const completionId = created?.[0]?.id;

    // evidence (optional but expected if needsEvidence)
    if (fileUrl) {
      await b(AT.tables.completionEvidence).create([
        {
          fields: {
            [F.EV_ORG]: [orgId],
            [F.EV_COMPLETION]: [completionId],
            [F.EV_TYPE]: evidenceType,
            [F.EV_FILEURL]: String(fileUrl),
            [F.EV_UPLOADEDAT]: new Date().toISOString(),
          },
        },
      ]);
    }

    return res.status(200).json({ ok: true, completionId, status });
  } catch (err) {
    console.error("[athlete/workouts/completeItem] error:", err);
    return res.status(500).json({ error: "Failed to complete item", details: err?.message });
  }
}
