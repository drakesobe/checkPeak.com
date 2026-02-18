// pages/api/athlete/workouts/acknowledgeCompletion.js
import Airtable from "airtable";
import { requireAthlete } from "@/lib/requireAthlete";

function asString(v) {
  return String(v ?? "").trim();
}

function safeJson(res) {
  return res.json().catch(() => ({}));
}

function unwrapAuth(maybe) {
  if (!maybe) return { ok: false, athlete: null, user: null, raw: null };
  if (typeof maybe === "object" && "ok" in maybe) {
    return { ok: Boolean(maybe.ok), athlete: maybe.athlete || null, user: maybe.user || null, raw: maybe };
  }
  return { ok: true, athlete: maybe, user: null, raw: maybe };
}

function mustAthleteToken(auth) {
  const tok =
    auth?.athlete?.AthleteToken ||
    auth?.athlete?.athleteToken ||
    auth?.user?.AthleteToken ||
    auth?.user?.athleteToken ||
    auth?.raw?.AthleteToken ||
    auth?.raw?.athleteToken ||
    "";
  return asString(tok);
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.WORKOUTCOMPLETIONS_API_KEY || process.env.DAILYWORKOUTS_API_KEY;
  const baseId = process.env.WORKOUTCOMPLETIONS_BASE_ID || process.env.DAILYWORKOUTS_BASE_ID;
  const tableId = process.env.WORKOUTCOMPLETIONS_TABLE_ID;

  if (!apiKey || !baseId || !tableId) {
    return res.status(500).json({
      error: "WorkoutCompletions Airtable env vars missing.",
      missing: {
        WORKOUTCOMPLETIONS_API_KEY: !process.env.WORKOUTCOMPLETIONS_API_KEY,
        WORKOUTCOMPLETIONS_BASE_ID: !process.env.WORKOUTCOMPLETIONS_BASE_ID,
        WORKOUTCOMPLETIONS_TABLE_ID: !process.env.WORKOUTCOMPLETIONS_TABLE_ID,
      },
    });
  }

  let authRaw = null;
  try {
    authRaw = requireAthlete.length >= 2 ? await requireAthlete(req, res) : requireAthlete(req);
  } catch (e) {
    return res.status(401).json({ error: e?.message || "Unauthorized" });
  }
  if (res.writableEnded) return;

  const auth = unwrapAuth(authRaw);
  if (!auth.ok) return res.status(401).json({ error: auth?.raw?.error || "Unauthorized" });

  const athleteToken = mustAthleteToken(auth);
  if (!athleteToken) return res.status(400).json({ error: "Missing AthleteToken in session." });

  const body = req.body || {};
  const completionId = asString(body?.completionId || body?.id);
  if (!completionId) return res.status(400).json({ error: "Missing completionId." });

  const base = new Airtable({ apiKey }).base(baseId);
  const WorkoutCompletions = base(tableId);

  try {
    const rec = await WorkoutCompletions.find(completionId);
    const f = rec?.fields || {};

    // ownership check: token must match
    const recToken = asString(f?.AthleteToken);
    if (!recToken || recToken !== athleteToken) {
      // fallback: Athlete link matches session athlete record id (if available)
      const athleteRecordId = asString(auth?.athlete?.id || auth?.raw?.athlete?.id || "");
      const links = safeArray(f?.Athlete).map(String);
      const ok = athleteRecordId && links.includes(athleteRecordId);
      if (!ok) return res.status(403).json({ error: "Forbidden." });
    }

    // optional: only allow acknowledge when rejected
    const status = asString(f?.Status).toLowerCase();
    if (status !== "rejected") {
      return res.status(400).json({ error: "Can only acknowledge rejected completions." });
    }

    const updated = await WorkoutCompletions.update(completionId, {
      AthleteAcknowledged: true,
      AthleteAcknowledgedAt: new Date().toISOString(),
    });

    return res.status(200).json({
      ok: true,
      id: updated.id,
      athleteAcknowledged: true,
      athleteAcknowledgedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[acknowledgeCompletion] error:", e);
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
