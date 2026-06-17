// pages/api/org/roster/index.js
// GET  - list active roster players sorted by jersey number
// POST - add or update a player (upsert on jersey number)

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

function getOrgId(user) {
  return String(user.orgToken || user.Token || user.orgId || "").trim();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const user = parseUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });
  const orgId = getOrgId(user);
  if (!orgId) return res.status(400).json({ error: "Missing org identity" });

  // ── GET ──────────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("roster")
      .select("id, jersey_number, player_name, position, grade, created_at")
      .eq("org_id", orgId)
      .eq("active", true)
      .order("jersey_number", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, roster: data ?? [] });
  }

  // ── POST ─────────────────────────────────────────────────────────────────────
  if (req.method === "POST") {
    const { jerseyNumber, playerName, position, grade } = req.body ?? {};

    if (!jerseyNumber || !playerName?.trim()) {
      return res.status(400).json({ error: "jerseyNumber and playerName are required" });
    }
    const num = Number(jerseyNumber);
    if (!Number.isInteger(num) || num < 0 || num > 99) {
      return res.status(400).json({ error: "jerseyNumber must be 0-99" });
    }

    const { data, error } = await supabase
      .from("roster")
      .upsert({
        org_id:        orgId,
        jersey_number: num,
        player_name:   playerName.trim(),
        position:      position?.trim()  ?? null,
        grade:         grade?.trim()     ?? null,
        active:        true,
        updated_at:    new Date().toISOString(),
      }, { onConflict: "org_id,jersey_number" })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, player: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
