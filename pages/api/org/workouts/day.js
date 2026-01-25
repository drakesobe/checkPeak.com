// pages/api/org/workouts/day.js
import Airtable from "airtable";
import { requireOrgSideUser } from "@/lib/requireUser";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toISODateLocal(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function safeJsonString(s) {
  return String(s ?? "").trim();
}

// Escape double quotes for Airtable formulas
function escFormulaString(s) {
  return String(s ?? "").replace(/"/g, '\\"');
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function envMissing() {
  return {
    DAILYWORKOUTS_API_KEY: !process.env.DAILYWORKOUTS_API_KEY,
    DAILYWORKOUTS_BASE_ID: !process.env.DAILYWORKOUTS_BASE_ID,
    DAILYWORKOUTS_TABLE_ID: !process.env.DAILYWORKOUTS_TABLE_ID,
  };
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const missing = envMissing();
  if (missing.DAILYWORKOUTS_API_KEY || missing.DAILYWORKOUTS_BASE_ID || missing.DAILYWORKOUTS_TABLE_ID) {
    return res.status(500).json({
      error: "DailyWorkouts Airtable env vars missing.",
      missing,
      debug: { cwd: process.cwd() },
    });
  }

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  // Query params
  const date = safeJsonString(req.query?.date) || toISODateLocal(new Date());
  const sportRaw = safeJsonString(req.query?.sport);
  const sport = sportRaw ? sportRaw.toLowerCase() : "";

  // Airtable
  const base = new Airtable({ apiKey: process.env.DAILYWORKOUTS_API_KEY }).base(
    process.env.DAILYWORKOUTS_BASE_ID
  );
  const DailyWorkouts = base(process.env.DAILYWORKOUTS_TABLE_ID);

  try {
    // ✅ IMPORTANT: field name must match Airtable exactly: {Sport}
    // ✅ IMPORTANT: your single select values are lowercase ("basketball"), so normalize.
    const parts = [
      `IS_SAME({Date}, "${escFormulaString(date)}", "day")`,
    ];

    if (sport) {
      parts.push(`{Sport} = "${escFormulaString(sport)}"`);
    }

    const formula = `AND(${parts.join(",")})`;

    const rows = await DailyWorkouts.select({
      filterByFormula: formula,
      maxRecords: 50,
      sort: [{ field: "Date", direction: "asc" }],
    }).firstPage();

    if (!rows?.length) {
      // ✅ Empty state is NOT an error
      return res.status(200).json({
        workouts: [],
        itemsByWorkoutId: {},
        completionByItemId: {},
        debug: { date, sport, formula },
      });
    }

    // Minimal “day” payload for calendar
    const workouts = rows.map((rec) => {
      const f = rec.fields || {};
      return {
        id: rec.id,
        Title: f.Title || "Workout",
        Date: f.Date || date,
        Status: f.Status || "assigned",
        athleteCount: safeArray(f.Athlete).length,
        itemCount: safeArray(f.WorkoutItems).length,
      };
    });

    // For now we’re not joining WorkoutItems in this endpoint.
    // The calendar page can call a "workouts/items" endpoint later if we want.
    const itemsByWorkoutId = {};
    const completionByItemId = {};

    return res.status(200).json({
      workouts,
      itemsByWorkoutId,
      completionByItemId,
      debug: { date, sport, formula },
    });
  } catch (e) {
    console.error("[api/org/workouts/day] error:", e);
    return res.status(500).json({
      error: "Failed to load day.",
      details: e?.message || String(e),
    });
  }
}
