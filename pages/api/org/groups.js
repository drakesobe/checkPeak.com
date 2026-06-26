// pages/api/org/groups.js
// Position group management — coaches create named groups of athletes
// and can target them when publishing CARA/VARA film.
//
// Requires Supabase table:
//   create table org_groups (
//     id uuid default gen_random_uuid() primary key,
//     org_id text not null,
//     name text not null,
//     athlete_emails text[] default '{}',
//     created_at timestamptz default now(),
//     updated_at timestamptz default now()
//   );
//   create index on org_groups(org_id);
//
// Also requires:
//   alter table game_films add column if not exists publish_group_ids uuid[] default null;
//
// GET          — list all groups for the org
// POST  { name, athleteEmails? }            — create group
// PUT   { id, name?, athleteEmails? }       — update group
// DELETE ?id=<uuid>                          — delete group

import { createClient } from "@supabase/supabase-js";
import { requireOrgSideUser } from "@/lib/requireUser";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function orgId(user) {
  return String(user?.orgToken || user?.Token || user?.orgId || user?.OrgId || "").trim();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const oid = orgId(user);
  if (!oid) return res.status(400).json({ error: "Missing org identity" });

  // ── GET — list groups ───────────────────────────────────────────────────────
  if (req.method === "GET") {
    const { data: groups, error } = await supabase
      .from("org_groups")
      .select("id, name, athlete_emails, created_at")
      .eq("org_id", oid)
      .order("name", { ascending: true });

    if (error) { console.error("[org/groups GET]", error); return res.status(500).json({ error: error.message }); }
    return res.status(200).json({ ok: true, groups: groups ?? [] });
  }

  // ── POST — create group ─────────────────────────────────────────────────────
  if (req.method === "POST") {
    const { name, athleteEmails = [] } = req.body ?? {};
    if (!String(name || "").trim()) return res.status(400).json({ error: "name is required" });

    const safeEmails = (Array.isArray(athleteEmails) ? athleteEmails : [])
      .map(e => String(e).trim().toLowerCase())
      .filter(Boolean);

    const { data, error } = await supabase
      .from("org_groups")
      .insert({ org_id: oid, name: String(name).trim(), athlete_emails: safeEmails })
      .select("id, name, athlete_emails, created_at")
      .single();

    if (error) { console.error("[org/groups POST]", error); return res.status(500).json({ error: error.message }); }
    return res.status(201).json({ ok: true, group: data });
  }

  // ── PUT — update group ──────────────────────────────────────────────────────
  if (req.method === "PUT") {
    const { id, name, athleteEmails } = req.body ?? {};
    if (!id) return res.status(400).json({ error: "id is required" });

    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = String(name).trim();
    if (athleteEmails !== undefined) {
      updates.athlete_emails = (Array.isArray(athleteEmails) ? athleteEmails : [])
        .map(e => String(e).trim().toLowerCase())
        .filter(Boolean);
    }

    const { data, error } = await supabase
      .from("org_groups")
      .update(updates)
      .eq("id", id)
      .eq("org_id", oid)
      .select("id, name, athlete_emails, created_at")
      .single();

    if (error) { console.error("[org/groups PUT]", error); return res.status(500).json({ error: error.message }); }
    return res.status(200).json({ ok: true, group: data });
  }

  // ── DELETE — delete group ───────────────────────────────────────────────────
  if (req.method === "DELETE") {
    const id = String(req.query.id || "").trim();
    if (!id) return res.status(400).json({ error: "id is required" });

    const { error } = await supabase
      .from("org_groups")
      .delete()
      .eq("id", id)
      .eq("org_id", oid);

    if (error) { console.error("[org/groups DELETE]", error); return res.status(500).json({ error: error.message }); }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
