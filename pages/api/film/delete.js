// pages/api/film/delete.js
// DELETE /api/film/delete?filmId=uuid
// Hard-deletes a film and all child records (plays, tracks, lineups, analytics).

import { createClient } from "@supabase/supabase-js";
import { readUserCookie } from "@/lib/requireUser";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });

  const user = readUserCookie(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  const orgId  = String(user.orgToken || user.Token || user.orgId || user.OrgId || "").trim();
  const filmId = String(req.query.filmId ?? "").trim();
  if (!filmId) return res.status(400).json({ error: "filmId required" });

  try {
    // Verify org owns this film
    const { data: film, error: fe } = await supabase
      .from("game_films")
      .select("id, org_id")
      .eq("id", filmId)
      .eq("org_id", orgId)
      .single();

    if (fe || !film) return res.status(404).json({ error: "Film not found" });

    // Delete child records first (FK order)
    await supabase.from("lineup_analytics").delete().eq("film_id", filmId);
    await supabase.from("play_lineups").delete().eq("film_id", filmId);
    await supabase.from("player_tracks").delete().eq("film_id", filmId);
    await supabase.from("game_plays").delete().eq("film_id", filmId);

    const { error: delErr } = await supabase
      .from("game_films")
      .delete()
      .eq("id", filmId)
      .eq("org_id", orgId);

    if (delErr) throw delErr;

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[film/delete]", err);
    return res.status(500).json({ error: err?.message ?? "Server error" });
  }
}
