// pages/api/film/list.js
// GET - returns all game films for the coach's org.
// Query: ?_authUser=...&limit=20&offset=0

import { createClient } from "@supabase/supabase-js";
import { readUserCookie } from "@/lib/requireUser";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseUser(req) {
  const raw = req.query?._authUser;
  if (raw) {
    try { return JSON.parse(String(raw)); } catch {}
  }
  return readUserCookie(req);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = parseUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  const orgId = String(user.orgToken || user.Token || user.orgId || user.OrgId || "").trim();
  if (!orgId) return res.status(400).json({ error: "Missing org identity" });

  const limit  = Math.min(Number(req.query.limit  ?? 20), 100);
  const offset = Number(req.query.offset ?? 0);

  try {
    const { data: films, error, count } = await supabase
      .from("game_films")
      .select("id, title, sport, game_date, opponent, status, progress_pct, play_count, duration_secs, mux_playback_id, is_published, viewing_type, watch_due_date, created_at", { count: "exact" })
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return res.status(200).json({ ok: true, films: films ?? [], total: count ?? 0 });
  } catch (err) {
    console.error("[film/list]", err);
    return res.status(500).json({ error: "Failed to fetch films", details: err?.message });
  }
}
