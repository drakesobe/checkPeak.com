// pages/api/athlete/nutrition/completion/upsert.js
// GET ?date=YYYY-MM-DD - fetch current completion
// POST { date, completion } - upsert completion
//
// Mobile auth fallback: passes _authUser in query/body when cookie is mangled.

import { requireAthlete } from "@/lib/requireAthlete";
import { supabaseAdmin as db } from "@/lib/supabase";

function asString(v) {
  if (v === 0) return "0";
  return String(v ?? "").trim();
}

function isISODateOnly(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}

function makeEmptyCompletion() {
  return {
    breakfast: { mealDone: false, hydrationDone: false },
    lunch:     { mealDone: false, hydrationDone: false },
    afternoon: { mealDone: false, hydrationDone: false },
    dinner:    { mealDone: false, hydrationDone: false },
  };
}

function normalizeCompletion(input) {
  const base = makeEmptyCompletion();
  const c = input && typeof input === "object" ? input : {};
  for (const k of ["breakfast", "lunch", "afternoon", "dinner"]) {
    const row = c?.[k] || {};
    base[k] = { mealDone: Boolean(row.mealDone), hydrationDone: Boolean(row.hydrationDone) };
  }
  return base;
}

function cookieMissingOrBroken(req) {
  try {
    const raw = req?.cookies?.user || "";
    if (!raw) return true;
    const decoded = raw.includes("%7B") || raw.includes("%22") ? decodeURIComponent(raw) : raw;
    JSON.parse(decoded);
    return false;
  } catch {
    return true;
  }
}

function injectAuthFromField(req, authUserField) {
  if (!authUserField) return;
  req.cookies        = req.cookies || {};
  req.cookies.user   = authUserField;
  req.headers        = req.headers || {};
  req.headers.cookie = `user=${encodeURIComponent(authUserField)}`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const method = String(req.method || "").toUpperCase();
  if (method !== "GET" && method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Mobile auth fallback
  if (cookieMissingOrBroken(req)) {
    const authUserField = asString(req.query?._authUser || req.body?._authUser || "");
    if (authUserField) injectAuthFromField(req, authUserField);
  }

  const auth = requireAthlete(req);
  if (!auth?.ok) {
    return res.status(401).json({ error: auth?.error || "Unauthorized" });
  }

  const athleteToken =
    asString(auth?.athlete?.AthleteToken) ||
    asString(auth?.athlete?.athleteToken) ||
    asString(auth?.user?.AthleteToken)    ||
    asString(auth?.user?.athleteToken);

  const athleteEmail =
    asString(auth?.athlete?.Email || auth?.athlete?.email ||
             auth?.user?.Email   || auth?.user?.email);

  try {
    const date = asString(req.query?.date) || asString(req.body?.date) || "";
    if (!isISODateOnly(date)) {
      return res.status(400).json({ error: "date is required in YYYY-MM-DD format." });
    }

    // Resolve athlete token if only email available
    let resolvedToken = athleteToken;
    if (!resolvedToken && athleteEmail) {
      const { data: ath } = await db
        .from("athletes")
        .select("athlete_token")
        .eq("email", athleteEmail)
        .maybeSingle();
      resolvedToken = asString(ath?.athlete_token);
    }

    if (!resolvedToken) {
      return res.status(401).json({ error: "Athlete session missing token/email." });
    }

    // GET: return current completion
    if (method === "GET") {
      const { data: existing } = await db
        .from("nutrition_completions")
        .select("completion_json")
        .eq("athlete_token", resolvedToken)
        .eq("date", date)
        .maybeSingle();

      let completionJson = null;
      if (existing?.completion_json) {
        completionJson = typeof existing.completion_json === "object"
          ? existing.completion_json
          : (() => { try { return JSON.parse(existing.completion_json); } catch { return null; } })();
      }

      const completion = normalizeCompletion(completionJson);
      return res.status(200).json({
        ok:        true,
        date,
        completion,
        hasRecord: Boolean(existing),
      });
    }

    // POST: upsert completion
    // Accept both key names for mobile/web compatibility
    const rawCompletion = req.body?.completion ?? req.body?.completionJson ?? null;
    const completion    = normalizeCompletion(rawCompletion);
    const nowISO        = new Date().toISOString();

    // Manual upsert - table has no unique constraint, only an index, so
    // .upsert({ onConflict }) would silently insert duplicates instead of updating.
    const { data: existing, error: selErr } = await db
      .from("nutrition_completions")
      .select("id")
      .eq("athlete_token", resolvedToken)
      .eq("date", date)
      .maybeSingle();

    if (selErr) throw selErr;

    let savedId = null;

    if (existing?.id) {
      const { error: upErr } = await db
        .from("nutrition_completions")
        .update({ completion_json: completion, updated_at: nowISO })
        .eq("id", existing.id);
      if (upErr) throw upErr;
      savedId = existing.id;
    } else {
      const { data: inserted, error: insErr } = await db
        .from("nutrition_completions")
        .insert({
          athlete_token:   resolvedToken,
          date,
          completion_json: completion,
          updated_at:      nowISO,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      savedId = inserted?.id;
    }

    return res.status(200).json({
      ok:        true,
      date,
      completion,
      recordId:  savedId,
    });

  } catch (e) {
    console.error("[athlete/nutrition/completion/upsert] error:", e);
    return res.status(500).json({ error: e?.message || "Failed to save nutrition completion." });
  }
}
