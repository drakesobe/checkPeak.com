import { getBase, escapeAirtableString, normalizeEmail, normalizeToken } from "@/lib/airtableOrgWorkouts";
import { F } from "@/lib/orgWorkoutFields";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      token,
      trainerEmail,
      dailyWorkoutId,
      order,
      exerciseName,
      sets,
      reps,
      load,
      rpe,
      rest,
      instructions,
      videoUrl,
      evidenceRequired,
    } = req.body || {};

    const cleanToken = normalizeToken(token);
    const cleanTrainerEmail = normalizeEmail(trainerEmail);

    if (!cleanToken) return res.status(400).json({ error: "Organization code is required." });
    if (!cleanTrainerEmail || !cleanTrainerEmail.includes("@")) return res.status(400).json({ error: "Valid trainer email is required." });
    if (!dailyWorkoutId) return res.status(400).json({ error: "dailyWorkoutId is required." });
    if (!exerciseName) return res.status(400).json({ error: "exerciseName is required." });

    const API_KEY = process.env.ORGANIZATIONS_API_KEY;

    const ORG_BASE_ID = process.env.ORGANIZATIONS_BASE_ID;
    const ORG_TABLE = process.env.ORGANIZATIONS_TABLE_NAME;

    const MEM_BASE_ID = process.env.ORG_MEMBERS_BASE_ID;
    const MEM_TABLE = process.env.ORG_MEMBERS_TABLE_ID;

    const WI_BASE_ID = process.env.WORKOUTITEMS_BASE_ID;
    const WI_TABLE = process.env.WORKOUTITEMS_TABLE_ID;

    if (!API_KEY) return res.status(500).json({ error: "Airtable API key missing." });
    if (!ORG_BASE_ID || !ORG_TABLE) return res.status(500).json({ error: "Organizations Airtable not configured." });
    if (!MEM_BASE_ID || !MEM_TABLE) return res.status(500).json({ error: "OrgMembers Airtable not configured." });
    if (!WI_BASE_ID || !WI_TABLE) return res.status(500).json({ error: "WorkoutItems Airtable not configured." });

    const orgBase = getBase(API_KEY, ORG_BASE_ID);
    const memBase = getBase(API_KEY, MEM_BASE_ID);
    const wiBase = getBase(API_KEY, WI_BASE_ID);

    // 1) org by token
    const safeToken = escapeAirtableString(cleanToken.toLowerCase());
    const orgRecords = await orgBase(ORG_TABLE)
      .select({ filterByFormula: `LOWER({${F.ORG_TOKEN}})='${safeToken}'`, maxRecords: 1 })
      .firstPage();
    if (!orgRecords.length) return res.status(404).json({ error: "Invalid organization code." });
    const orgRecord = orgRecords[0];

    // 2) trainer must exist + active + role
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

    // 3) create workout item
    const created = await wiBase(WI_TABLE).create([
      {
        fields: {
          [F.WI_ORG]: [orgRecord.id],
          [F.WI_DW]: [dailyWorkoutId],
          [F.WI_ORDER]: Number.isFinite(Number(order)) ? Number(order) : 1,
          [F.WI_NAME]: String(exerciseName).trim(),
          ...(sets !== undefined ? { [F.WI_SETS]: Number(sets) || 0 } : {}),
          ...(reps ? { [F.WI_REPS]: String(reps) } : {}),
          ...(load ? { [F.WI_LOAD]: String(load) } : {}),
          ...(rpe ? { [F.WI_RPE]: String(rpe) } : {}),
          ...(rest ? { [F.WI_REST]: String(rest) } : {}),
          ...(instructions ? { [F.WI_INSTRUCTIONS]: String(instructions) } : {}),
          ...(videoUrl ? { [F.WI_VIDEO]: String(videoUrl) } : {}),
          [F.WI_EVIDENCE]: evidenceRequired || "none",
        },
      },
    ]);

    return res.status(200).json({ ok: true, workoutItemId: created?.[0]?.id });
  } catch (err) {
    console.error("[org/addWorkoutItem] error:", err);
    return res.status(500).json({
      error: "Failed to add workout item",
      airtable: { statusCode: err?.statusCode, message: err?.message, error: err?.error },
    });
  }
}
