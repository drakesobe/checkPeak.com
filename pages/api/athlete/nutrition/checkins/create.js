// pages/api/athlete/nutrition/checkins/create.js
import Airtable from "airtable";
import { requireAthlete } from "@/lib/requireAthlete";

/* ---------------- helpers ---------------- */

function asString(v) {
  return String(v ?? "").trim();
}

function safeNum(v) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

function clampInt(n, min, max) {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x));
}

function getTable(apiKey, baseId, tableNameOrId) {
  if (!apiKey || !baseId || !tableNameOrId) return null;
  const base = new Airtable({ apiKey }).base(baseId);
  return base(tableNameOrId);
}

// Monday-start week in America/New_York, returned as YYYY-MM-DD
function nyWeekStartISO(d = new Date()) {
  // Convert to NY “local date parts”
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(d);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  // Create a midday date to avoid timezone edge cases
  const nyMid = new Date(`${y}-${m}-${day}T12:00:00`);

  // JS getDay(): 0=Sun,1=Mon,...6=Sat
  // We'll treat week start as Monday.
  const dow = nyMid.getDay();
  const diffToMon = (dow + 6) % 7; // Mon->0, Tue->1,... Sun->6
  nyMid.setDate(nyMid.getDate() - diffToMon);

  // Convert back to NY ISO date
  const parts2 = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(nyMid);

  const y2 = parts2.find((p) => p.type === "year")?.value;
  const m2 = parts2.find((p) => p.type === "month")?.value;
  const d2 = parts2.find((p) => p.type === "day")?.value;

  return `${y2}-${m2}-${d2}`;
}

/* ---------------- env ---------------- */

const NUTRITIONCHECKINS_API_KEY = process.env.NUTRITIONCHECKINS_API_KEY;
const NUTRITIONCHECKINS_BASE_ID = process.env.NUTRITIONCHECKINS_BASE_ID;
const NUTRITIONCHECKINS_TABLE =
  process.env.NUTRITIONCHECKINS_TABLE ||
  process.env.NUTRITIONCHECKINS_TABLE_NAME ||
  process.env.NUTRITIONCHECKINS_TABLE_ID ||
  "NutritionCheckins";

/* ---------------- STRICT Airtable field names ---------------- */

const CHK_ATH_TOKEN = "AthleteToken";
const CHK_WEEK = "WeekStartISO";
const CHK_CREATED_AT = "CreatedAt";
const CHK_CAL = "CaloriesAdherencePct";
const CHK_PRO = "ProteinAdherencePct";
const CHK_HYD = "HydrationAdherencePct";
const CHK_NOTES = "Notes";

/* ---------------- handler ---------------- */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireAthlete(req, res);
  if (!auth?.ok) return;

  const athleteToken = asString(
    auth?.athlete?.athleteToken || auth?.athlete?.token || auth?.athlete?.AthleteToken
  );

  if (!athleteToken || !athleteToken.toUpperCase().startsWith("ATH-")) {
    return res.status(401).json({ error: "AthleteToken missing from session." });
  }

  const table = getTable(NUTRITIONCHECKINS_API_KEY, NUTRITIONCHECKINS_BASE_ID, NUTRITIONCHECKINS_TABLE);
  if (!table) {
    return res.status(500).json({
      error: "NutritionCheckins Airtable not configured.",
      missing: {
        NUTRITIONCHECKINS_API_KEY: !NUTRITIONCHECKINS_API_KEY,
        NUTRITIONCHECKINS_BASE_ID: !NUTRITIONCHECKINS_BASE_ID,
        NUTRITIONCHECKINS_TABLE: !NUTRITIONCHECKINS_TABLE,
      },
    });
  }

  try {
    const body = req.body || {};

    // Optional: allow client to pass a date, but server determines weekStart anyway
    const weekStartISO = nyWeekStartISO(new Date());

    // Store as 0..100 integers
    const caloriesPct = clampInt(safeNum(body.caloriesPct ?? body.calories) ?? 0, 0, 100);
    const proteinPct = clampInt(safeNum(body.proteinPct ?? body.protein) ?? 0, 0, 100);
    const hydrationPct = clampInt(safeNum(body.hydrationPct ?? body.hydration) ?? 0, 0, 100);

    const notes = asString(body.notes);

    // IMPORTANT: we purposely do not try to “calculate” accuracy.
    // This is a self-report check-in to keep staff time low.

    const nowISO = new Date().toISOString();

    // Upsert by (AthleteToken + WeekStartISO):
    // - If exists, update; else create.
    const filterByFormula = `AND({${CHK_ATH_TOKEN}}='${athleteToken.replace(/'/g, "\\'")}', {${CHK_WEEK}}='${weekStartISO}')`;

    const existing = await table
      .select({ filterByFormula, maxRecords: 1 })
      .firstPage()
      .then((xs) => (xs?.length ? xs[0] : null));

    const fields = {
      [CHK_ATH_TOKEN]: athleteToken,
      [CHK_WEEK]: weekStartISO,
      [CHK_CREATED_AT]: nowISO,
      [CHK_CAL]: caloriesPct,
      [CHK_PRO]: proteinPct,
      [CHK_HYD]: hydrationPct,
      [CHK_NOTES]: notes,
    };

    let record = null;
    if (existing) {
      record = await table.update(existing.id, fields);
    } else {
      record = await table.create(fields);
    }

    return res.status(200).json({
      ok: true,
      weekStartISO,
      checkin: {
        id: record.id,
        athleteToken,
        weekStartISO,
        createdAt: nowISO,
        caloriesPct,
        proteinPct,
        hydrationPct,
        notes,
      },
    });
  } catch (e) {
    console.error("[athlete/nutrition/checkins/create] error:", e);
    return res.status(500).json({
      error: e?.message || "Failed to submit check-in.",
      airtable: {
        statusCode: e?.statusCode,
        message: e?.message,
        error: e?.error,
      },
    });
  }
}
