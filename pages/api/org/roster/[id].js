// pages/api/org/roster/[id].js
// PUT    - update a player's details
// DELETE - soft-delete (sets active=false)

import { readUserCookie } from "@/lib/requireUser";
import { createClient }   from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseUser(req) {
  const raw = req.body?._authUser ?? req.query?._authUser;
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
  const orgId = String(user.orgToken || user.Token || "").trim();
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Missing player id" });

  // ── PATCH — link/unlink an athlete account to a roster entry ─────────────────
  if (req.method === "PATCH") {
    const { athleteToken } = req.body ?? {};
    const { data, error } = await supabase
      .from("roster")
      .update({ athlete_token: athleteToken || null, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", orgId)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, player: data });
  }

  // ── PUT ───────────────────────────────────────────────────────────────────────
  if (req.method === "PUT") {
    const { playerName, position, grade, jerseyNumber } = req.body ?? {};
    const updates = { updated_at: new Date().toISOString() };
    if (playerName?.trim())      updates.player_name   = playerName.trim();
    if (position  !== undefined) updates.position       = position?.trim() ?? null;
    if (grade     !== undefined) updates.grade          = grade?.trim()    ?? null;
    if (jerseyNumber !== undefined) {
      const num = Number(jerseyNumber);
      if (Number.isInteger(num) && num >= 0 && num <= 99) updates.jersey_number = num;
    }

    const { data, error } = await supabase
      .from("roster")
      .update(updates)
      .eq("id", id)
      .eq("org_id", orgId)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, player: data });
  }

  // ── DELETE ────────────────────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    const { error } = await supabase
      .from("roster")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", orgId);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
