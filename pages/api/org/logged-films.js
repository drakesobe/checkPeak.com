// pages/api/org/logged-films.js
// GET — returns the set of film IDs that have at least one saved game log entry.
// Used by the film list to show a "Stats Logged" badge on each card.

import { requireOrg }          from "@/lib/requireOrg";
import { supabaseAdmin as db } from "@/lib/supabase";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  const orgToken = String(auth.user?.orgToken || auth.user?.Token || auth.org?.token || "").trim();
  if (!orgToken) return res.status(400).json({ error: "Missing org identity" });

  try {
    // group_key pattern is 'film:{uuid}' — pull all distinct group_keys for this org
    const { data, error } = await db
      .from("athlete_game_logs")
      .select("group_key")
      .eq("org_id", String(auth.org?.id || orgToken))
      .like("group_key", "film:%");

    if (error) return res.status(500).json({ error: error.message });

    const filmIds = [...new Set(
      (data || [])
        .map(r => r.group_key?.replace("film:", ""))
        .filter(Boolean)
    )];

    return res.status(200).json({ ok: true, filmIds });
  } catch (err) {
    return res.status(500).json({ error: err?.message });
  }
}
