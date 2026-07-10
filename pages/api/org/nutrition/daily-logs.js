// pages/api/org/nutrition/daily-logs.js
// GET ?athleteToken=X&start=YYYY-MM-DD&end=YYYY-MM-DD
// Returns per-day calorie/macro totals from athlete_food_logs (real logged food).

import { requireOrg } from "@/lib/requireOrg";
import { supabaseAdmin as db } from "@/lib/supabase";

function injectMobileAuth(req) {
  const raw = req?.query?._authUser ?? req?.body?._authUser;
  if (!raw) return;
  const str = String(raw);
  req.cookies = req.cookies || {};
  req.cookies.user = str;
  req.headers = req.headers || {};
  req.headers.cookie = `user=${encodeURIComponent(str)}`;
}

function asString(v) { return String(v ?? "").trim(); }

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  injectMobileAuth(req);
  const auth = requireOrg(req);
  if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

  const orgToken     = asString(auth?.org?.token);
  const athleteToken = asString(req.query?.athleteToken);
  const start        = asString(req.query?.start);
  const end          = asString(req.query?.end);

  if (!athleteToken) return res.status(400).json({ error: "athleteToken required" });
  if (!start || !end) return res.status(400).json({ error: "start and end required" });

  try {
    // Verify athlete belongs to this org
    const { data: athleteRow } = await db
      .from("athletes")
      .select("id")
      .eq("athlete_token", athleteToken)
      .eq("org_token", orgToken)
      .maybeSingle();

    if (!athleteRow) return res.status(404).json({ error: "Athlete not found for this organization." });

    const { data: rows, error } = await db
      .from("athlete_food_logs")
      .select("log_date, calories, protein_g, carbs_g, fat_g")
      .eq("athlete_token", athleteToken)
      .gte("log_date", start)
      .lte("log_date", end)
      .order("log_date", { ascending: true });

    if (error) throw error;

    // Aggregate by date
    const byDate = {};
    for (const row of (rows ?? [])) {
      const d = String(row.log_date || "").slice(0, 10);
      if (!d) continue;
      if (!byDate[d]) byDate[d] = { date: d, calories: 0, protein: 0, carbs: 0, fat: 0 };
      byDate[d].calories += Math.round(Number(row.calories)   || 0);
      byDate[d].protein  += Math.round(Number(row.protein_g)  || 0);
      byDate[d].carbs    += Math.round(Number(row.carbs_g)    || 0);
      byDate[d].fat      += Math.round(Number(row.fat_g)      || 0);
    }

    return res.status(200).json({ ok: true, days: Object.values(byDate) });
  } catch (err) {
    console.error("[org/nutrition/daily-logs]", err);
    return res.status(500).json({ error: err?.message || "Failed to load nutrition history." });
  }
}
