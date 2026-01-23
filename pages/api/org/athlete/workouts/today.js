import { requireAthleteUser } from "@/lib/requireUser";
import { AT, base, F, escapeAirtableString } from "@/lib/airtableOrgWorkoutConfig";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = requireAthleteUser(req, res);
  if (!user) return;

  try {
    const b = base();
    const email = String(user.email || "").toLowerCase();
    const today = new Date().toISOString().slice(0, 10);

    // 1) athlete record by email
    const safeEmail = escapeAirtableString(email);
    const athleteRecords = await b(AT.tables.athletes)
      .select({ filterByFormula: `LOWER({${F.ATH_EMAIL}})='${safeEmail}'`, maxRecords: 1 })
      .firstPage();

    if (!athleteRecords.length) return res.status(404).json({ error: "Athlete not found." });
    const athlete = athleteRecords[0];

    // 2) daily workout for today
    const dwRecords = await b(AT.tables.dailyWorkouts)
      .select({
        filterByFormula: `AND({${F.DW_DATE}}='${today}', {${F.DW_ATHLETE}}='${athlete.id}')`,
        maxRecords: 1,
      })
      .firstPage();

    if (!dwRecords.length) return res.status(200).json({ ok: true, dailyWorkout: null, items: [] });
    const dw = dwRecords[0];

    // 3) items for that workout
    const items = await b(AT.tables.workoutItems)
      .select({
        filterByFormula: `{${F.WI_DW}}='${dw.id}'`,
        sort: [{ field: F.WI_ORDER, direction: "asc" }],
      })
      .firstPage();

    return res.status(200).json({
      ok: true,
      dailyWorkout: { id: dw.id, ...dw.fields },
      items: items.map((r) => ({ id: r.id, ...r.fields })),
      athlete: { id: athlete.id, ...athlete.fields },
    });
  } catch (err) {
    console.error("[athlete/workouts/today] error:", err);
    return res.status(500).json({ error: "Failed to load today workout", details: err?.message });
  }
}
