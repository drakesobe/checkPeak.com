import Airtable from "airtable";

/**
 * ORG Workouts Day
 * GET /api/org/workouts/day?date=YYYY-MM-DD&sport=Basketball
 *
 * Returns workouts scheduled that day + linked items + completion summary.
 */

const MAP = {
  ORGS_TABLE: process.env.ORGANIZATIONS_TABLE_NAME || "Organizations",
  DAILY_TABLE: process.env.DAILYWORKOUTS_TABLE_NAME || "DailyWorkout",
  ITEMS_TABLE: process.env.WORKOUTITEMS_TABLE_NAME || "WorkoutItems",
  COMPLETIONS_TABLE: process.env.WORKOUTCOMPLETIONS_TABLE_NAME || "WorkoutCompletions",

  ORG_TOKEN_FIELD: process.env.ORGANIZATION_TOKEN_FIELD || "Token",

  // DailyWorkout
  DAILY_ORG_LINK_FIELD: "Organization",
  DAILY_ATHLETES_LINK_FIELD: "Athlete",
  DAILY_DATE_FIELD: "Date",
  DAILY_TITLE_FIELD: "Title",
  DAILY_STATUS_FIELD: "Status",
  DAILY_SPORT_FIELD: "Sport",

  // WorkoutItems
  ITEM_ORG_LINK_FIELD: "Organization",
  ITEM_DAILY_LINK_FIELD: "DailyWorkout",
  // IMPORTANT: your table lists "ExceciseName" (typo). Keep it here to match Airtable.
  ITEM_EXERCISE_FIELD: "ExceciseName",
  ITEM_SETS_FIELD: "Sets",
  ITEM_REPS_FIELD: "Reps",
  ITEM_WEIGHT_FIELD: "Weight",
  ITEM_REST_FIELD: "Rest",
  ITEM_INSTRUCTIONS_FIELD: "Instructions",
  ITEM_VIDEO_FIELD: "VideoURL",
  ITEM_EVIDENCE_FIELD: "EvidenceRequired",
  ITEM_ORDER_FIELD: "Order",

  // WorkoutCompletions
  COMP_ORG_LINK_FIELD: "Organization",
  COMP_WORKOUTITEM_LINK_FIELD: "WorkoutItem",
  COMP_STATUS_FIELD: "Status",
  COMP_COMPLETED_AT_FIELD: "CompletedAt",
  COMP_NAME_FIELD: "Name", // lookup from Athlete
};

function requireOrgToken(req) {
  const token = String(req.headers["x-org-token"] || "").trim();
  if (!token) return { ok: false, error: "Missing x-org-token" };
  return { ok: true, token };
}

function nyISO(v) {
  return String(v || "").trim().slice(0, 10);
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

async function getOrgRecordId(base, token) {
  const f = MAP.ORG_TOKEN_FIELD;
  const rows = await base(MAP.ORGS_TABLE)
    .select({
      maxRecords: 1,
      filterByFormula: `{${f}}="${token.replace(/"/g, '\\"')}"`,
    })
    .firstPage();

  return rows?.[0]?.id || "";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.DAILYWORKOUTS_API_KEY || !process.env.DAILYWORKOUTS_BASE_ID) {
    return res.status(500).json({ error: "Missing DAILYWORKOUTS_API_KEY or DAILYWORKOUTS_BASE_ID" });
  }

  const auth = requireOrgToken(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error });

  const date = nyISO(req.query?.date);
  const sport = String(req.query?.sport || "").trim();

  if (!date) return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });

  const base = new Airtable({ apiKey: process.env.DAILYWORKOUTS_API_KEY }).base(process.env.DAILYWORKOUTS_BASE_ID);

  try {
    const orgId = await getOrgRecordId(base, auth.token);
    if (!orgId) return res.status(404).json({ error: "Organization not found for token." });

    const parts = [];
    parts.push(`FIND("${orgId}", ARRAYJOIN({${MAP.DAILY_ORG_LINK_FIELD}}&""))`);
    parts.push(`IS_SAME({${MAP.DAILY_DATE_FIELD}}, "${date}", "day")`);
    if (sport) parts.push(`{${MAP.DAILY_SPORT_FIELD}}="${sport.replace(/"/g, '\\"')}"`);

    const formula = `AND(${parts.join(",")})`;

    const dailyRows = await base(MAP.DAILY_TABLE)
      .select({
        filterByFormula: formula,
        maxRecords: 50,
        sort: [{ field: MAP.DAILY_TITLE_FIELD, direction: "asc" }],
      })
      .firstPage();

    const workouts = (dailyRows || []).map((rec) => {
      const f = rec.fields || {};
      const athletes = safeArray(f[MAP.DAILY_ATHLETES_LINK_FIELD]);
      return {
        id: rec.id,
        Date: date,
        Title: f[MAP.DAILY_TITLE_FIELD] || "Workout",
        Status: f[MAP.DAILY_STATUS_FIELD] || "assigned",
        Sport: f[MAP.DAILY_SPORT_FIELD] || "",
        athleteCount: athletes.length,
      };
    });

    const workoutIds = workouts.map((w) => w.id).filter(Boolean);

    // Items for those DailyWorkouts
    const itemsByWorkoutId = {};
    let allItemIds = [];

    if (workoutIds.length) {
      // Airtable OR formula for linked record contains recId in ARRAYJOIN({DailyWorkout}&"")
      const orParts = workoutIds.map((id) => `FIND("${id}", ARRAYJOIN({${MAP.ITEM_DAILY_LINK_FIELD}}&""))`);
      const itemFormula = `AND(FIND("${orgId}", ARRAYJOIN({${MAP.ITEM_ORG_LINK_FIELD}}&"")), OR(${orParts.join(",")}))`;

      const itemRows = await base(MAP.ITEMS_TABLE)
        .select({
          filterByFormula: itemFormula,
          maxRecords: 500,
          sort: [{ field: MAP.ITEM_ORDER_FIELD, direction: "asc" }],
        })
        .firstPage();

      for (const rec of itemRows || []) {
        const f = rec.fields || {};
        const dailyLinks = safeArray(f[MAP.ITEM_DAILY_LINK_FIELD]);
        const wid = String(dailyLinks?.[0] || "").trim(); // usually 1 dailyworkout
        if (!wid) continue;

        if (!itemsByWorkoutId[wid]) itemsByWorkoutId[wid] = [];
        itemsByWorkoutId[wid].push({
          id: rec.id,
          ExerciseName: f[MAP.ITEM_EXERCISE_FIELD] || "",
          ExceciseName: f[MAP.ITEM_EXERCISE_FIELD] || "",
          Sets: f[MAP.ITEM_SETS_FIELD] ?? "",
          Reps: f[MAP.ITEM_REPS_FIELD] ?? "",
          Weight: f[MAP.ITEM_WEIGHT_FIELD] ?? "",
          Rest: f[MAP.ITEM_REST_FIELD] ?? "",
          Instructions: f[MAP.ITEM_INSTRUCTIONS_FIELD] ?? "",
          VideoURL: f[MAP.ITEM_VIDEO_FIELD] ?? "",
          EvidenceRequired: f[MAP.ITEM_EVIDENCE_FIELD] ?? "none",
          Order: f[MAP.ITEM_ORDER_FIELD] ?? "",
        });
        allItemIds.push(rec.id);
      }

      allItemIds = Array.from(new Set(allItemIds));
    }

    // Completion summary by WorkoutItem (pull most recent completion record per item if multiple)
    const completionByItemId = {};

    if (allItemIds.length) {
      // Keep OR size reasonable; for very large days we can paginate/optimize later.
      const orParts = allItemIds.slice(0, 60).map((id) => `FIND("${id}", ARRAYJOIN({${MAP.COMP_WORKOUTITEM_LINK_FIELD}}&""))`);
      const compFormula = `AND(FIND("${orgId}", ARRAYJOIN({${MAP.COMP_ORG_LINK_FIELD}}&"")), OR(${orParts.join(",")}))`;

      const compRows = await base(MAP.COMPLETIONS_TABLE)
        .select({
          filterByFormula: compFormula,
          maxRecords: 200,
          sort: [{ field: MAP.COMP_COMPLETED_AT_FIELD, direction: "desc" }],
        })
        .firstPage();

      for (const rec of compRows || []) {
        const f = rec.fields || {};
        const links = safeArray(f[MAP.COMP_WORKOUTITEM_LINK_FIELD]);
        const itemId = String(links?.[0] || "").trim();
        if (!itemId) continue;

        // keep first (newest) since we sorted desc by CompletedAt
        if (!completionByItemId[itemId]) {
          completionByItemId[itemId] = {
            id: rec.id,
            Status: f[MAP.COMP_STATUS_FIELD] || "",
            CompletedAt: f[MAP.COMP_COMPLETED_AT_FIELD] || "",
            Name: f[MAP.COMP_NAME_FIELD] || "",
          };
        }
      }
    }

    return res.status(200).json({
      workouts,
      itemsByWorkoutId,
      completionByItemId,
    });
  } catch (e) {
    console.error("[api/org/workouts/day] error:", e);
    return res.status(500).json({ error: "Failed to load workouts for day." });
  }
}
