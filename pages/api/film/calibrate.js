// pages/api/film/calibrate.js
// Saves a homography matrix to game_films.homography_json.
// The homography transforms pixel coordinates → field yards coordinates.
//
// POST { filmId, homography: number[9], srcPoints: [x,y][], dstPoints: [X,Y][], calibratedAt }
// GET  ?filmId=<uuid>  — returns existing homography_json for a film

import { createClient } from "@supabase/supabase-js";
import { readUserCookie } from "@/lib/requireUser";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseUser(req) {
  const raw = req.method === "GET" ? req.query?._authUser : req.body?._authUser;
  if (raw) { try { return JSON.parse(String(raw)); } catch {} }
  return readUserCookie(req);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const user = parseUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  const orgId = String(user.orgToken || user.Token || user.orgId || user.OrgId || "").trim();
  if (!orgId) return res.status(400).json({ error: "Missing org identity" });

  try {
    // ── GET: fetch calibration for a film ────────────────────────────────────
    if (req.method === "GET") {
      const filmId = String(req.query.filmId ?? "").trim();
      if (!filmId) return res.status(400).json({ error: "filmId required" });

      const { data: film, error } = await db
        .from("game_films")
        .select("id, homography_json, mux_playback_id, duration_secs")
        .eq("id", filmId)
        .eq("org_id", orgId)
        .maybeSingle();

      if (error) throw error;
      if (!film) return res.status(404).json({ error: "Film not found" });

      return res.status(200).json({
        ok:           true,
        calibrated:   !!film.homography_json,
        homography:   film.homography_json ?? null,
        playbackId:   film.mux_playback_id,
        durationSecs: film.duration_secs,
      });
    }

    // ── POST: save calibration ───────────────────────────────────────────────
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { filmId, homography, srcPoints, dstPoints } = req.body ?? {};
    if (!filmId) return res.status(400).json({ error: "filmId required" });
    if (!Array.isArray(homography) || homography.length !== 9)
      return res.status(400).json({ error: "homography must be a 9-element array" });

    // Validate all values are finite numbers
    if (homography.some(v => !Number.isFinite(v)))
      return res.status(400).json({ error: "homography contains non-finite values" });

    // Verify org owns the film
    const { data: film } = await db
      .from("game_films")
      .select("id")
      .eq("id", String(filmId).trim())
      .eq("org_id", orgId)
      .maybeSingle();

    if (!film) return res.status(404).json({ error: "Film not found in this org" });

    const homographyJson = {
      matrix:      homography,
      srcPoints:   srcPoints ?? null,
      dstPoints:   dstPoints ?? null,
      calibratedAt: new Date().toISOString(),
      version:     1,
    };

    const { error: updErr } = await db
      .from("game_films")
      .update({ homography_json: homographyJson })
      .eq("id", film.id);

    if (updErr) throw updErr;

    return res.status(200).json({ ok: true, filmId: film.id, calibratedAt: homographyJson.calibratedAt });
  } catch (err) {
    console.error("[film/calibrate]", err);
    return res.status(500).json({ error: err?.message ?? "Server error" });
  }
}
