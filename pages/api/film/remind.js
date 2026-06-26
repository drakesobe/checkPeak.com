// pages/api/film/remind.js
// POST { filmId } — sends a push reminder to athletes who haven't completed the film.
// Only fires to athletes with a valid push_token who have watched fewer plays than total.
// Athletes with no entry in film_watches at all (never started) are also included.

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

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = parseUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  const orgId  = String(user.orgToken || user.Token || user.orgId || user.OrgId || "").trim();
  const filmId = String(req.body?.filmId || "").trim();

  if (!orgId)  return res.status(400).json({ error: "Missing org identity" });
  if (!filmId) return res.status(400).json({ error: "filmId required" });

  try {
    // Verify film belongs to org and is published CARA
    const { data: film } = await supabase
      .from("game_films")
      .select("id, org_id, title, opponent, is_published, viewing_type, play_count")
      .eq("id", filmId)
      .eq("org_id", orgId)
      .maybeSingle();

    if (!film) return res.status(404).json({ error: "Film not found" });
    if (!film.is_published) return res.status(400).json({ error: "Film is not published" });

    // Get total play count
    const { count: totalPlays } = await supabase
      .from("game_plays")
      .select("id", { count: "exact", head: true })
      .eq("film_id", filmId);

    const total = totalPlays ?? film.play_count ?? 0;

    // Get all org athletes with push tokens
    const { data: athletes } = await supabase
      .from("athletes")
      .select("athlete_id, push_token")
      .eq("org_id", orgId)
      .not("push_token", "is", null);

    if (!athletes?.length) return res.status(200).json({ ok: true, sent_count: 0 });

    // Count plays watched per athlete for this film
    const { data: playWatches } = await supabase
      .from("play_watches")
      .select("athlete_id")
      .eq("film_id", filmId);

    const watchedByAthlete = {};
    for (const pw of (playWatches ?? [])) {
      watchedByAthlete[pw.athlete_id] = (watchedByAthlete[pw.athlete_id] || 0) + 1;
    }

    // Filter to incomplete athletes with valid tokens
    const incompleteTokens = athletes
      .filter(a => {
        const token = a.push_token;
        if (!token || (!token.startsWith("ExponentPushToken[") && !token.startsWith("ExpoPushToken["))) return false;
        const watched = watchedByAthlete[a.athlete_id] ?? 0;
        return total === 0 || watched < total; // not yet done
      })
      .map(a => a.push_token);

    if (!incompleteTokens.length) return res.status(200).json({ ok: true, sent_count: 0 });

    const opponentStr  = film.opponent ? ` vs ${film.opponent}` : "";
    const filmLabel    = film.title || `Film${opponentStr}`;
    const body         = `Don't forget: "${filmLabel}" is required viewing. Finish before it's due.`;

    const BATCH = 100;
    for (let i = 0; i < incompleteTokens.length; i += BATCH) {
      const messages = incompleteTokens.slice(i, i + BATCH).map(to => ({
        to,
        title:    "Film Reminder",
        body,
        sound:    "default",
        priority: "high",
        data:     { type: "required_film", filmId, filmTitle: film.title || "" },
      }));
      await fetch("https://exp.host/--/api/v2/push/send", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body:    JSON.stringify(messages),
      }).catch(err => console.error("[film/remind] push error:", err?.message));
    }

    return res.status(200).json({ ok: true, sent_count: incompleteTokens.length });
  } catch (err) {
    console.error("[film/remind]", err);
    return res.status(500).json({ error: "Server error", details: err?.message });
  }
}
