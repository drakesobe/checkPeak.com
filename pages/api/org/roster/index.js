// pages/api/org/roster/index.js
// GET  - list all org athletes merged with roster table (jersey numbers optional)
// POST - add or update a roster entry (jersey number optional)

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
    // Fetch both tables in parallel
    const [{ data: rosterData, error: rosterErr }, { data: athleteData }] = await Promise.all([
      supabase
        .from("roster")
        .select("id, jersey_number, player_name, position, grade")
        .eq("org_id", orgId)
        .eq("active", true),
      supabase
        .from("athletes")
        .select("id, name, email, athlete_token")
        .eq("org_token", orgId),
    ]);

    if (rosterErr) return res.status(500).json({ error: rosterErr.message });

    // Normalize name: lowercase, collapse internal whitespace, strip punctuation
    function norm(s) {
      return (s ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
    }

    // Build roster lookup by normalized name
    const rosterByName = {};
    for (const r of rosterData ?? []) {
      const key = norm(r.player_name);
      if (key) rosterByName[key] = r;
    }

    // Org athletes — overlay jersey number / position / grade where names match
    const athleteNames = new Set();
    const athleteEntries = (athleteData ?? []).map(a => {
      const key = norm(a.name);
      athleteNames.add(key);
      const r = rosterByName[key];
      return {
        id:            r?.id ?? `athlete-${a.id}`,
        roster_id:     r?.id ?? null,
        athlete_id:    a.id,
        player_name:   a.name ?? "",
        email:         a.email ?? null,
        jersey_number: r?.jersey_number ?? null,
        position:      r?.position      ?? null,
        grade:         r?.grade         ?? null,
      };
    });

    // Roster-only entries (manually added, no athlete account)
    const rosterOnly = (rosterData ?? [])
      .filter(r => !athleteNames.has(norm(r.player_name)))
      .map(r => ({
        id:            r.id,
        roster_id:     r.id,
        athlete_id:    null,
        player_name:   r.player_name,
        email:         null,
        jersey_number: r.jersey_number,
        position:      r.position,
        grade:         r.grade,
      }));

    const combined = [...athleteEntries, ...rosterOnly].sort((a, b) => {
      // Numbered players first (sorted by number), then alphabetical
      if (a.jersey_number !== null && b.jersey_number !== null) return a.jersey_number - b.jersey_number;
      if (a.jersey_number !== null) return -1;
      if (b.jersey_number !== null) return 1;
      return (a.player_name ?? "").localeCompare(b.player_name ?? "");
    });

    return res.status(200).json({ ok: true, roster: combined });
  }

  // ── POST ─────────────────────────────────────────────────────────────────────
  if (req.method === "POST") {
    const { jerseyNumber, playerName, position, grade } = req.body ?? {};

    if (!playerName?.trim()) {
      return res.status(400).json({ error: "playerName is required" });
    }

    const num = jerseyNumber != null && jerseyNumber !== "" ? Number(jerseyNumber) : null;
    if (num !== null && (!Number.isInteger(num) || num < 0 || num > 99)) {
      return res.status(400).json({ error: "jerseyNumber must be 0–99" });
    }

    let data, error;

    if (num !== null) {
      // Upsert on org+jersey_number unique constraint
      ({ data, error } = await supabase
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
        .single());
    } else {
      // Insert without jersey number (no unique constraint on null numbers)
      ({ data, error } = await supabase
        .from("roster")
        .insert({
          org_id:        orgId,
          jersey_number: null,
          player_name:   playerName.trim(),
          position:      position?.trim()  ?? null,
          grade:         grade?.trim()     ?? null,
          active:        true,
          updated_at:    new Date().toISOString(),
        })
        .select()
        .single());
    }

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, player: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
