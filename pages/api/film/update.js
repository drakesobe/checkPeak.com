// pages/api/film/update.js
// PATCH { filmId, opponent, gameDate, filmType, sport }
// Updates film metadata for a film the org owns.

import { createClient } from "@supabase/supabase-js";
import { readUserCookie } from "@/lib/requireUser";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseUser(req) {
  const raw = req.body?._authUser;
  if (raw) { try { return JSON.parse(String(raw)); } catch {} }
  return readUserCookie(req);
}

const VALID_TYPES = ["game", "practice", "7v7", "scrimmage", "tournament"];

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST" && req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = parseUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  const orgId = String(user.orgToken || user.Token || user.orgId || user.OrgId || "").trim();
  if (!orgId) return res.status(400).json({ error: "Missing org identity" });

  const { filmId, opponent, gameDate, filmType, sport } = req.body ?? {};
  if (!filmId) return res.status(400).json({ error: "filmId required" });

  try {
    const { data: film } = await supabase
      .from("game_films")
      .select("id, org_id, opponent, game_date, film_type, sport")
      .eq("id", filmId)
      .eq("org_id", orgId)
      .single();

    if (!film) return res.status(404).json({ error: "Film not found" });

    const update = {};

    if (opponent !== undefined) {
      const opp = String(opponent ?? "").trim();
      update.opponent = opp || null;
      const date = gameDate ?? film.game_date;
      if (opp) {
        update.title = date
          ? `vs ${opp} · ${new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
          : `vs ${opp}`;
      }
    }

    if (gameDate !== undefined) {
      const d = String(gameDate ?? "").trim();
      update.game_date = d || null;
      if (d && !update.title) {
        const opp = (opponent !== undefined ? String(opponent ?? "").trim() : film.opponent) || "";
        update.title = opp
          ? `vs ${opp} · ${new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
          : `${(sport ?? film.sport ?? "Film")} · ${new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
      }
    }

    if (filmType && VALID_TYPES.includes(filmType)) update.film_type = filmType;
    if (sport) update.sport = String(sport).toLowerCase().trim();

    if (Object.keys(update).length === 0) {
      return res.status(200).json({ ok: true, changed: false });
    }

    const { error } = await supabase
      .from("game_films")
      .update(update)
      .eq("id", filmId)
      .eq("org_id", orgId);

    if (error) throw error;

    return res.status(200).json({ ok: true, changed: true, update });
  } catch (err) {
    console.error("[film/update]", err);
    return res.status(500).json({ error: err?.message ?? "Server error" });
  }
}
