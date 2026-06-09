// pages/api/athlete/workouts/mergeLifts.js
// POST - rewrites ExerciseTitle on all matching Set Logs records for this athlete.
// Body: { keep: "Barbell Squat", remove: ["BB Squat", "barbell squat"] }
// All records in `remove` get rewritten to `keep`. Old names disappear.

import Airtable from "airtable";
import { requireAthlete } from "@/lib/requireAthlete";

const base  = new Airtable({ apiKey: process.env.ATHLETE_API_KEY }).base(process.env.ATHLETE_BASE_ID);
const TABLE = process.env.SET_LOGS_TABLE_NAME || "Set Logs";

function getAthleteToken(auth) {
  return String(
    auth?.athlete?.AthleteToken ||
    auth?.athlete?.athleteToken ||
    auth?.user?.AthleteToken    ||
    auth?.user?.athleteToken    ||
    ""
  ).trim();
}

// Airtable hard limit: 10 records per update call
async function batchUpdate(ids, fields) {
  for (let i = 0; i < ids.length; i += 10) {
    await base(TABLE).update(
      ids.slice(i, i + 10).map(id => ({ id, fields }))
    );
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  const athleteToken = getAthleteToken(auth);
  if (!athleteToken) return res.status(401).json({ error: "Missing AthleteToken" });

  const { keep, remove } = req.body || {};

  if (!keep || !String(keep).trim()) {
    return res.status(400).json({ error: "keep is required" });
  }
  if (!Array.isArray(remove) || remove.length === 0) {
    return res.status(400).json({ error: "remove must be a non-empty array of names" });
  }

  const canonicalName = String(keep).trim();
  const safeToken     = athleteToken.replace(/"/g, '\\"');
  let   totalUpdated  = 0;

  try {
    for (const oldName of remove) {
      const name = String(oldName || "").trim();
      if (!name || name === canonicalName) continue;

      const safeName = name.replace(/"/g, '\\"');

      const records = await base(TABLE)
        .select({
          filterByFormula: `AND({AthleteToken} = "${safeToken}", {ExerciseTitle} = "${safeName}")`,
        })
        .all();

      if (!records.length) continue;

      await batchUpdate(records.map(r => r.id), { ExerciseTitle: canonicalName });
      totalUpdated += records.length;
    }

    return res.status(200).json({ ok: true, updated: totalUpdated, into: canonicalName });
  } catch (err) {
    console.error("mergeLifts error:", err);
    return res.status(500).json({ error: "Failed to merge lifts" });
  }
}