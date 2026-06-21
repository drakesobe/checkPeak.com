// pages/api/film/playlists.js
// Manages cut-up playlists for a film.
//
// GET  ?filmId=   → list playlists with plays
// POST { action: "create",      filmId, name }        → new playlist
// POST { action: "add_play",    listId, playId }       → add play to list
// POST { action: "remove_play", itemId }               → remove item from list
// POST { action: "delete",      listId }               → delete playlist
// POST { action: "rename",      listId, name }         → rename playlist
// POST { action: "reorder",     listId, orderedIds }   → reorder items

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
    // ── GET: list all playlists for a film ───────────────────────────────────
    if (req.method === "GET") {
      const filmId = String(req.query.filmId ?? "").trim();
      if (!filmId) return res.status(400).json({ error: "filmId required" });

      const { data: lists, error } = await supabase
        .from("game_play_lists")
        .select(`
          id, name, description, created_by, created_at,
          game_play_list_items (
            id, position, note,
            game_plays (
              id, play_number, play_type, down, distance, yards_gained,
              result, start_time_secs, end_time_secs, clip_url,
              formation, play_direction, hash, yard_line, personnel, labels
            )
          )
        `)
        .eq("film_id", filmId)
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Sort items by position within each list
      const playlists = (lists ?? []).map(list => ({
        ...list,
        items: (list.game_play_list_items ?? [])
          .sort((a, b) => a.position - b.position)
          .map(item => ({ ...item.game_plays, _itemId: item.id, _note: item.note, _position: item.position })),
      }));

      return res.status(200).json({ ok: true, playlists });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { action, filmId, listId, playId, itemId, name, description, orderedIds } = req.body ?? {};

    // ── CREATE ───────────────────────────────────────────────────────────────
    if (action === "create") {
      if (!filmId || !name?.trim()) return res.status(400).json({ error: "filmId and name required" });

      // Verify org owns this film
      const { data: film } = await supabase.from("game_films").select("id, org_id").eq("id", filmId).single();
      if (!film || film.org_id !== orgId) return res.status(404).json({ error: "Film not found" });

      const { data, error } = await supabase
        .from("game_play_lists")
        .insert({ film_id: filmId, org_id: orgId, name: name.trim(), description: description ?? null, created_by: user.email ?? "coach" })
        .select("id, name, created_at")
        .single();

      if (error) throw error;
      return res.status(200).json({ ok: true, list: { ...data, items: [] } });
    }

    // ── ADD PLAY ─────────────────────────────────────────────────────────────
    if (action === "add_play") {
      if (!listId || !playId) return res.status(400).json({ error: "listId and playId required" });

      // Verify org owns the list
      const { data: list } = await supabase.from("game_play_lists").select("id, org_id").eq("id", listId).single();
      if (!list || list.org_id !== orgId) return res.status(404).json({ error: "Playlist not found" });

      // Check play isn't already in list
      const { data: existing } = await supabase
        .from("game_play_list_items")
        .select("id")
        .eq("list_id", listId)
        .eq("play_id", playId)
        .maybeSingle();
      if (existing) return res.status(200).json({ ok: true, alreadyAdded: true });

      // Get next position
      const { count } = await supabase
        .from("game_play_list_items")
        .select("*", { count: "exact", head: true })
        .eq("list_id", listId);

      const { data, error } = await supabase
        .from("game_play_list_items")
        .insert({ list_id: listId, play_id: playId, position: (count ?? 0) + 1 })
        .select("id")
        .single();

      if (error) throw error;
      return res.status(200).json({ ok: true, itemId: data.id });
    }

    // ── REMOVE PLAY ──────────────────────────────────────────────────────────
    if (action === "remove_play") {
      if (!itemId) return res.status(400).json({ error: "itemId required" });

      // Verify org owns the item via the list
      const { data: item } = await supabase
        .from("game_play_list_items")
        .select("id, game_play_lists ( org_id )")
        .eq("id", itemId)
        .single();
      if (!item || item.game_play_lists?.org_id !== orgId) return res.status(404).json({ error: "Item not found" });

      const { error } = await supabase.from("game_play_list_items").delete().eq("id", itemId);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    // ── DELETE PLAYLIST ──────────────────────────────────────────────────────
    if (action === "delete") {
      if (!listId) return res.status(400).json({ error: "listId required" });

      const { data: list } = await supabase.from("game_play_lists").select("id, org_id").eq("id", listId).single();
      if (!list || list.org_id !== orgId) return res.status(404).json({ error: "Playlist not found" });

      // Items cascade-delete via FK
      const { error } = await supabase.from("game_play_lists").delete().eq("id", listId);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    // ── RENAME ───────────────────────────────────────────────────────────────
    if (action === "rename") {
      if (!listId || !name?.trim()) return res.status(400).json({ error: "listId and name required" });

      const { data: list } = await supabase.from("game_play_lists").select("id, org_id").eq("id", listId).single();
      if (!list || list.org_id !== orgId) return res.status(404).json({ error: "Playlist not found" });

      const { error } = await supabase.from("game_play_lists").update({ name: name.trim(), updated_at: new Date().toISOString() }).eq("id", listId);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    // ── REORDER ──────────────────────────────────────────────────────────────
    if (action === "reorder") {
      if (!listId || !Array.isArray(orderedIds)) return res.status(400).json({ error: "listId and orderedIds required" });

      const { data: list } = await supabase.from("game_play_lists").select("id, org_id").eq("id", listId).single();
      if (!list || list.org_id !== orgId) return res.status(404).json({ error: "Playlist not found" });

      await Promise.all(orderedIds.map((id, idx) =>
        supabase.from("game_play_list_items").update({ position: idx + 1 }).eq("id", id).eq("list_id", listId)
      ));
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Unknown action" });

  } catch (err) {
    console.error("[film/playlists]", err);
    return res.status(500).json({ error: err?.message ?? "Server error" });
  }
}
