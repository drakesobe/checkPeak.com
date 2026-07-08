// pages/api/org/roster/by-name.js
// DELETE - soft-delete a roster entry by player name (fallback when roster_id is unknown)

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

  if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });

  const user = parseUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });
  const orgId = String(user.orgToken || user.Token || "").trim();

  const name = (req.query.name ?? "").trim();
  if (!name) return res.status(400).json({ error: "name query param required" });

  // ilike for case-insensitive match; covers most name-mismatch scenarios
  const { error } = await supabase
    .from("roster")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .ilike("player_name", name);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
