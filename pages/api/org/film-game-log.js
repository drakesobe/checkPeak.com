// pages/api/org/film-game-log.js
// POST — aggregate film play attributions into athlete_game_logs entries.
// Body: { filmId, sport, gameDate, opponent, location, result, teamScore, oppScore,
//         playerStats: [{ athleteToken, rosterName, rosterJersey, stats }] }

import { requireOrg }             from "@/lib/requireOrg";
import { supabaseAdmin as db }    from "@/lib/supabase";
import { sendNotification }       from "@/lib/sendNotification";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  // orgToken is what game_films.org_id stores (same as film/plays.js)
  const orgToken = String(auth.user?.orgToken || auth.user?.Token || auth.org?.token || "").trim();
  // orgId (UUID) is what athletes.org_id stores
  const orgId    = String(auth.org?.id || auth.user?.orgId || orgToken || "").trim();
  if (!orgId) return res.status(400).json({ error: "Missing org identity" });

  try {
    const {
      filmId,
      sport,
      gameDate,
      opponent,
      location,
      result,
      teamScore,
      oppScore,
      seasonYear,
      playerStats = [],
    } = req.body ?? {};

    if (!gameDate) return res.status(400).json({ error: "gameDate is required" });
    if (!sport)    return res.status(400).json({ error: "sport is required" });
    const sportNorm = String(sport).toLowerCase().trim();
    if (!playerStats.length) return res.status(400).json({ error: "No player stats provided" });

    // Verify film belongs to this org — game_films.org_id stores the org token
    if (filmId) {
      const { data: film } = await db.from("game_films").select("id, org_id").eq("id", filmId).single();
      const filmOrg = film?.org_id || "";
      const matches = filmOrg === orgToken || filmOrg === orgId;
      if (!film || !matches) return res.status(403).json({ error: "Film not found or access denied" });
    }

    const year = seasonYear || new Date(gameDate).getFullYear();

    // For each playerStat that has a valid athleteToken, upsert a game log.
    // We use a group_key to avoid duplicating (athlete + game + film).
    const groupKey = filmId ? `film:${filmId}` : `manual:${gameDate}:${opponent || ""}`;

    const saved = [];
    const skipped = [];

    for (const row of playerStats) {
      const { athleteToken, rosterName, rosterJersey, stats } = row;

      if (!athleteToken) {
        skipped.push({ rosterName, rosterJersey, reason: "no_athlete_link" });
        continue;
      }

      // Verify athlete belongs to this org — athletes table uses org_token column
      const { data: athlete } = await db
        .from("athletes")
        .select("athlete_token, name")
        .eq("athlete_token", athleteToken)
        .eq("org_token", orgToken)
        .maybeSingle();

      if (!athlete) {
        skipped.push({ rosterName, rosterJersey, reason: "athlete_not_in_org" });
        continue;
      }

      // Upsert: if same athlete+film already saved, overwrite stats
      const existing = filmId
        ? await db
            .from("athlete_game_logs")
            .select("id")
            .eq("athlete_token", athleteToken)
            .eq("group_key", groupKey)
            .maybeSingle()
        : { data: null };

      const payload = {
        athlete_token: athleteToken,
        sport:        sportNorm,
        season_year:  year,
        game_date:    gameDate,
        opponent:     opponent || null,
        location:     location || null,
        result:       result   || null,
        team_score:   teamScore != null ? Number(teamScore) : null,
        opp_score:    oppScore  != null ? Number(oppScore)  : null,
        group_key:    groupKey,
        stats:        stats || {},
        logged_by:    "coach",
        org_id:       orgId,
        updated_at:   new Date().toISOString(),
      };

      let err;
      if (existing.data?.id) {
        ({ error: err } = await db
          .from("athlete_game_logs")
          .update(payload)
          .eq("id", existing.data.id));
      } else {
        ({ error: err } = await db
          .from("athlete_game_logs")
          .insert(payload));
      }

      if (err) {
        skipped.push({ rosterName, rosterJersey, reason: err.message });
      } else {
        saved.push({ athleteToken, name: athlete.name });
      }
    }

    // Push notification to each athlete whose stats were just coach-logged
    if (saved.length > 0) {
      const opponentLabel = opponent ? `vs ${opponent}` : "a recent game";
      for (const s of saved) {
        const row = playerStats.find(p => p.athleteToken === s.athleteToken);
        const st  = row?.stats || {};
        const parts = [];
        if (st.att > 0)      parts.push(`${st.comp ?? 0}/${st.att} passing`);
        if (st.pass_yds > 0) parts.push(`${st.pass_yds} yds`);
        if (st.pass_td > 0)  parts.push(`${st.pass_td} TD`);
        if (st.rush_yds > 0) parts.push(`${st.rush_yds} rush`);
        if (st.rec_yds > 0)  parts.push(`${st.rec_yds} rec yds`);
        if (st.tackles > 0)  parts.push(`${st.tackles} tkl`);
        const statLine = parts.slice(0, 3).join(" · ");
        sendNotification([s.athleteToken], {
          title: "Coach logged your stats",
          body:  statLine ? `${opponentLabel}: ${statLine}` : `Your stats from ${opponentLabel} were verified by your coach.`,
          type:  "coach_stat_log",
          data:  { screen: "Stats", sport: sportNorm, season: String(year) },
        });
      }
    }

    return res.status(200).json({ ok: true, saved, skipped });
  } catch (err) {
    console.error("[film-game-log]", err);
    return res.status(500).json({ error: "Failed", details: err?.message });
  }
}
