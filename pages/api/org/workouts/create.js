// pages/api/org/workouts/create.js
import { requireOrgSideUser } from "@/lib/requireUser";
import { AT, base, F } from "@/lib/airtableOrgWorkoutConfig";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  try {
    const { athleteId, date, title, items = [] } = req.body || {};

    if (!athleteId) return res.status(400).json({ error: "athleteId is required." });
    if (!date) return res.status(400).json({ error: "date is required (YYYY-MM-DD)." });
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "At least 1 workout item is required." });
    }

    const b = base();

    const orgId = user.orgId;
    const memberId = user.memberId; // OrgMembers record id (trainer/admin OR ensured org owner)

    if (!orgId) return res.status(400).json({ error: "Missing orgId on session user." });
    if (!memberId) {
      return res.status(400).json({ error: "Missing memberId on session user. Re-login." });
    }

    // 1) Create DailyWorkout
    const createdDW = await b(AT.tables.dailyWorkouts).create([
      {
        fields: {
          [F.DW_ORG]: [orgId],
          [F.DW_ATHLETE]: [athleteId],
          [F.DW_DATE]: String(date),
          [F.DW_TITLE]: String(title || "Daily Workout"),
          [F.DW_STATUS]: "assigned",
          [F.DW_CREATEDBY]: [memberId], // ✅ linked record
        },
      },
    ]);

    const dailyWorkoutId = createdDW?.[0]?.id;
    if (!dailyWorkoutId) {
      return res.status(500).json({ error: "Failed to create DailyWorkout (missing id)." });
    }

    // 2) Create WorkoutItems
    const itemCreates = items.map((it, idx) => ({
      fields: {
        [F.WI_ORG]: [orgId],
        [F.WI_DW]: [dailyWorkoutId],
        [F.WI_ORDER]: Number.isFinite(Number(it.order)) ? Number(it.order) : idx + 1,
        [F.WI_NAME]: String(it.exerciseName || "").trim(),

        ...(it.sets !== undefined ? { [F.WI_SETS]: Number(it.sets) || 0 } : {}),
        ...(it.reps ? { [F.WI_REPS]: String(it.reps) } : {}),
        ...(it.load ? { [F.WI_LOAD]: String(it.load) } : {}),
        ...(it.rpe ? { [F.WI_RPE]: String(it.rpe) } : {}),
        ...(it.rest ? { [F.WI_REST]: String(it.rest) } : {}),
        ...(it.instructions ? { [F.WI_INSTR]: String(it.instructions) } : {}),
        ...(it.videoUrl ? { [F.WI_VIDEO]: String(it.videoUrl) } : {}),

        [F.WI_EVIDENCE]: it.evidenceRequired || "none",
      },
    }));

    const createdItems = await b(AT.tables.workoutItems).create(itemCreates);

    return res.status(200).json({
      ok: true,
      dailyWorkoutId,
      workoutItemIds: (createdItems || []).map((r) => r.id),
    });
  } catch (err) {
    console.error("[org/workouts/create] error:", err);
    return res.status(500).json({
      error: "Failed to create workout",
      details: err?.message || String(err),
    });
  }
}
