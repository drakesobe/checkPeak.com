// pages/api/film/lineup-analytics.js
// GET ?filmId=uuid - lineup success rates for a specific film

import { createClient } from "@supabase/supabase-js";
import { readUserCookie } from "@/lib/requireUser";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseUser(req) {
  const raw = req.query?._authUser;
  if (raw) {
    try { return JSON.parse(decodeURIComponent(String(raw))); } catch {}
  }
  return readUserCookie(req);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = parseUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  const orgId  = String(user.orgToken || user.Token || user.orgId || user.OrgId || "").trim();
  const filmId = String(req.query.filmId ?? "").trim();
  if (!filmId) return res.status(400).json({ error: "filmId required" });

  try {
    // Verify film belongs to org
    const { data: film } = await supabase
      .from("game_films")
      .select("id, org_id")
      .eq("id", filmId)
      .single();

    if (!film || film.org_id !== orgId) return res.status(404).json({ error: "Film not found" });

    // Get lineup hashes that appear in this film's plays
    const { data: lineupRows } = await supabase
      .from("play_lineups")
      .select("lineup_hash")
      .eq("org_id", orgId);

    const hashes = [...new Set((lineupRows ?? []).map(r => r.lineup_hash).filter(Boolean))];

    if (hashes.length === 0) {
      return res.status(200).json({ ok: true, lineups: [] });
    }

    const { data: analytics, error } = await supabase
      .from("lineup_analytics")
      .select("id, lineup_hash, jersey_numbers, play_type, formation, attempts, successes, avg_yards")
      .eq("org_id", orgId)
      .in("lineup_hash", hashes)
      .order("attempts", { ascending: false })
      .limit(20);

    if (error) throw error;

    return res.status(200).json({ ok: true, lineups: analytics ?? [] });
  } catch (err) {
    console.error("[film/lineup-analytics]", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
