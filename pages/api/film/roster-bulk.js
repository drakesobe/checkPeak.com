// pages/api/film/roster-bulk.js
// POST { players: [{playerName, jerseyNumber, position?, grade?}] }
// Bulk upsert into the roster table. Idempotent — conflicts on (org_id, jersey_number)
// are updated in place.
// Returns { inserted, updated, skipped, errors }

import { createClient } from "@supabase/supabase-js";
import { readUserCookie } from "@/lib/requireUser";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseUser(req) {
  const raw = req.body?._authUser;
  if (raw) { try { return JSON.parse(decodeURIComponent(String(raw))); } catch {} }
  return readUserCookie(req);
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = parseUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  const orgId = String(user.orgToken || user.Token || user.orgId || user.OrgId || "").trim();
  if (!orgId) return res.status(400).json({ error: "Missing org identity" });

  const { players } = req.body ?? {};
  if (!Array.isArray(players) || players.length === 0) {
    return res.status(400).json({ error: "players array is required" });
  }
  if (players.length > 200) {
    return res.status(400).json({ error: "Maximum 200 players per bulk operation" });
  }

  // Validate rows
  const valid  = [];
  const errors = [];

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const name   = String(p.playerName || p.name || "").trim();
    const jersey = Number(p.jerseyNumber ?? p.jersey_number ?? p.jersey ?? -1);

    if (!name) { errors.push({ index: i, reason: "Name is required" }); continue; }
    if (!Number.isInteger(jersey) || jersey < 0 || jersey > 99) {
      errors.push({ index: i, name, reason: "Jersey must be 0–99" }); continue;
    }

    valid.push({
      org_id:        orgId,
      player_name:   name,
      jersey_number: jersey,
      position:      String(p.position || "").trim() || null,
      grade:         String(p.grade    || "").trim() || null,
      active:        true,
      updated_at:    new Date().toISOString(),
    });
  }

  if (!valid.length) {
    return res.status(400).json({ ok: false, inserted: 0, updated: 0, skipped: 0, errors });
  }

  let inserted = 0, updated = 0;

  // Fetch existing roster jerseys so we can distinguish insert vs update
  const jerseyNums = valid.map(v => v.jersey_number);
  const { data: existing } = await supabase
    .from("roster")
    .select("jersey_number")
    .eq("org_id", orgId)
    .in("jersey_number", jerseyNums);

  const existingJerseys = new Set((existing ?? []).map(r => r.jersey_number));

  // Upsert in batches (Supabase default upsert limit)
  for (const batch of chunk(valid, 50)) {
    const { error } = await supabase
      .from("roster")
      .upsert(batch, { onConflict: "org_id,jersey_number" });

    if (error) {
      batch.forEach(p => errors.push({ jersey: p.jersey_number, name: p.player_name, reason: error.message }));
      continue;
    }

    for (const p of batch) {
      if (existingJerseys.has(p.jersey_number)) updated++;
      else inserted++;
    }
  }

  return res.status(200).json({ ok: true, inserted, updated, skipped: errors.length, errors });
}
