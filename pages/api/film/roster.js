// pages/api/film/roster.js
// GET  - list all roster players for this org
// POST - add a new player to the roster
// DELETE - remove a player (?playerId=uuid)

import { createClient } from "@supabase/supabase-js";
import { readUserCookie } from "@/lib/requireUser";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseUser(req) {
  const raw = req.method === "GET"
    ? req.query?._authUser
    : req.body?._authUser;
  if (raw) {
    try { return JSON.parse(decodeURIComponent(String(raw))); } catch {}
  }
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
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("roster")
        .select("id, jersey_number, player_name, position, active")
        .eq("org_id", orgId)
        .order("jersey_number", { ascending: true });

      if (error) throw error;
      return res.status(200).json({ ok: true, players: data ?? [] });
    }

    if (req.method === "POST") {
      const { playerName, jerseyNumber, position } = req.body ?? {};
      if (!playerName?.trim() || jerseyNumber === undefined || jerseyNumber === null) {
        return res.status(400).json({ error: "playerName and jerseyNumber are required" });
      }

      const { data, error } = await supabase
        .from("roster")
        .insert({
          org_id:        orgId,
          player_name:   String(playerName).trim(),
          jersey_number: Number(jerseyNumber),
          position:      position?.trim() || null,
          active:        true,
        })
        .select("id, jersey_number, player_name, position, active")
        .single();

      if (error) throw error;
      return res.status(200).json({ ok: true, player: data });
    }

    if (req.method === "DELETE") {
      const playerId = String(req.query?.playerId || "").trim();
      if (!playerId) return res.status(400).json({ error: "playerId required" });

      const { error } = await supabase
        .from("roster")
        .delete()
        .eq("id", playerId)
        .eq("org_id", orgId);

      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("[film/roster]", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
