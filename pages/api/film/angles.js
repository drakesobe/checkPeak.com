// pages/api/film/angles.js
// Manages secondary camera angles linked to a primary film.
//
// GET  ?filmId=<uuid>          — list all angles for a primary film
// POST { action:"add",    primaryFilmId, angleFilmId, label?, timeOffsetSecs? }
// POST { action:"update", id, label?, timeOffsetSecs? }
// POST { action:"delete", id }
//
// SQL migration (run once):
//   create table if not exists film_angles (
//     id               uuid primary key default gen_random_uuid(),
//     primary_film_id  uuid not null references game_films(id) on delete cascade,
//     angle_film_id    uuid not null references game_films(id) on delete cascade,
//     org_id           text not null,
//     label            text not null default 'Angle 2',
//     time_offset_secs numeric(8,3) not null default 0,
//     created_at       timestamptz default now(),
//     unique(primary_film_id, angle_film_id)
//   );
//   create index if not exists idx_film_angles_primary on film_angles(primary_film_id);

import { createClient } from "@supabase/supabase-js";
import { readUserCookie } from "@/lib/requireUser";

const supabase = createClient(
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
    // ── GET: list angles for a film ──────────────────────────────────────────
    if (req.method === "GET") {
      const primaryFilmId = String(req.query.filmId ?? "").trim();
      if (!primaryFilmId) return res.status(400).json({ error: "filmId required" });

      const { data: angles, error } = await supabase
        .from("film_angles")
        .select(`
          id, label, time_offset_secs, angle_film_id,
          game_films:angle_film_id ( id, title, mux_playback_id, duration_secs, status )
        `)
        .eq("primary_film_id", primaryFilmId)
        .eq("org_id", orgId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return res.status(200).json({ ok: true, angles: angles ?? [] });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { action, id, primaryFilmId, angleFilmId, label, timeOffsetSecs } = req.body ?? {};

    // ── ADD ANGLE ────────────────────────────────────────────────────────────
    if (action === "add") {
      if (!primaryFilmId || !angleFilmId) return res.status(400).json({ error: "primaryFilmId and angleFilmId required" });
      if (primaryFilmId === angleFilmId) return res.status(400).json({ error: "Cannot link a film to itself" });

      // Verify org owns both films
      const { data: films } = await supabase
        .from("game_films")
        .select("id")
        .eq("org_id", orgId)
        .in("id", [primaryFilmId, angleFilmId]);

      if (!films || films.length < 2) return res.status(404).json({ error: "One or both films not found in this org" });

      const offset = typeof timeOffsetSecs === "number" ? timeOffsetSecs : parseFloat(timeOffsetSecs ?? "0") || 0;

      const { data, error } = await supabase
        .from("film_angles")
        .insert({
          primary_film_id:  primaryFilmId,
          angle_film_id:    angleFilmId,
          org_id:           orgId,
          label:            String(label || "Angle 2").trim().slice(0, 40),
          time_offset_secs: offset,
        })
        .select("id, label, time_offset_secs, angle_film_id")
        .single();

      if (error) {
        if (error.code === "23505") return res.status(409).json({ error: "This angle is already linked" });
        throw error;
      }
      return res.status(200).json({ ok: true, angle: data });
    }

    // ── UPDATE ANGLE ─────────────────────────────────────────────────────────
    if (action === "update") {
      if (!id) return res.status(400).json({ error: "id required" });

      const { data: angle } = await supabase.from("film_angles").select("id, org_id").eq("id", id).single();
      if (!angle || angle.org_id !== orgId) return res.status(404).json({ error: "Angle not found" });

      const updates = {};
      if (label !== undefined) updates.label = String(label).trim().slice(0, 40);
      if (timeOffsetSecs !== undefined) updates.time_offset_secs = parseFloat(String(timeOffsetSecs)) || 0;
      if (!Object.keys(updates).length) return res.status(400).json({ error: "Nothing to update" });

      const { error } = await supabase.from("film_angles").update(updates).eq("id", id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    // ── DELETE ANGLE ─────────────────────────────────────────────────────────
    if (action === "delete") {
      if (!id) return res.status(400).json({ error: "id required" });

      const { data: angle } = await supabase.from("film_angles").select("id, org_id").eq("id", id).single();
      if (!angle || angle.org_id !== orgId) return res.status(404).json({ error: "Angle not found" });

      const { error } = await supabase.from("film_angles").delete().eq("id", id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    console.error("[film/angles]", err);
    return res.status(500).json({ error: err?.message ?? "Server error" });
  }
}
