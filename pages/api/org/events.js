// pages/api/org/events.js
// Schedule events for the coach calendar.
//
// GET  ?start=YYYY-MM-DD&end=YYYY-MM-DD  — list events in date range
// POST { title, type, eventDate, startMinutes, durationMinutes, location?, notes?, groupName? }
// PUT  { id, ...fields }
// DELETE ?id=uuid

import { supabaseAdmin as db } from "@/lib/supabase";
import { readUserCookie }      from "@/lib/requireUser";

function parseUser(req) {
  const raw = req.body?._authUser ?? req.query?._authUser;
  if (raw) {
    try { return JSON.parse(decodeURIComponent(String(raw))); } catch {}
  }
  return readUserCookie(req);
}

function getOrgToken(user) {
  return String(user?.orgToken || user?.Token || user?.token || "").trim();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const user = parseUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  const orgToken = getOrgToken(user);
  if (!orgToken) return res.status(400).json({ error: "Missing org token" });

  // ── GET ──────────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const start = String(req.query.start || "").slice(0, 10);
    const end   = String(req.query.end   || "").slice(0, 10);

    let q = db.from("org_events").select("*").eq("org_token", orgToken);
    if (start) q = q.gte("event_date", start);
    if (end)   q = q.lte("event_date", end);
    q = q.order("event_date", { ascending: true })
         .order("start_minutes", { ascending: true });

    const { data, error } = await q;
    if (error) {
      console.error("[org/events GET]", error);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ ok: true, events: data ?? [] });
  }

  // ── POST ─────────────────────────────────────────────────────────────────────
  if (req.method === "POST") {
    const {
      title, type = "practice",
      eventDate, date,                          // accept both
      startMinutes = 0,
      durationMinutes = 60, location, notes,
      groupName, group,                         // accept both
    } = req.body || {};
    const resolvedDate  = eventDate ?? date;
    const resolvedGroup = groupName ?? group;

    if (!title || !resolvedDate) {
      return res.status(400).json({ error: "title and eventDate (or date) are required" });
    }

    const { data, error } = await db.from("org_events").insert({
      org_token:        orgToken,
      title:            String(title).trim(),
      type:             String(type),
      event_date:       String(resolvedDate).slice(0, 10),
      start_minutes:    Number(startMinutes)    || 0,
      duration_minutes: Number(durationMinutes) || 60,
      location:         location     ? String(location).trim()     : null,
      notes:            notes        ? String(notes).trim()        : null,
      group_name:       resolvedGroup ? String(resolvedGroup).trim() : null,
    }).select().single();

    if (error) {
      console.error("[org/events POST]", error);
      return res.status(500).json({ error: error.message });
    }
    return res.status(201).json({ ok: true, event: data });
  }

  // ── PUT ──────────────────────────────────────────────────────────────────────
  if (req.method === "PUT") {
    const { id, title, type, eventDate, date, startMinutes, durationMinutes, location, notes, groupName, group } = req.body || {};
    if (!id) return res.status(400).json({ error: "id is required" });

    const resolvedDate  = eventDate ?? date;
    const resolvedGroup = groupName ?? group;

    const patch = { updated_at: new Date().toISOString() };
    if (title           !== undefined) patch.title            = String(title).trim();
    if (type            !== undefined) patch.type             = String(type);
    if (resolvedDate    !== undefined) patch.event_date       = String(resolvedDate).slice(0, 10);
    if (startMinutes    !== undefined) patch.start_minutes    = Number(startMinutes);
    if (durationMinutes !== undefined) patch.duration_minutes = Number(durationMinutes);
    if (location        !== undefined) patch.location         = location     ? String(location).trim()     : null;
    if (notes           !== undefined) patch.notes            = notes        ? String(notes).trim()        : null;
    if (resolvedGroup   !== undefined) patch.group_name       = resolvedGroup ? String(resolvedGroup).trim() : null;

    const { data, error } = await db.from("org_events")
      .update(patch)
      .eq("id", id)
      .eq("org_token", orgToken)
      .select().single();

    if (error) {
      console.error("[org/events PUT]", error);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ ok: true, event: data });
  }

  // ── DELETE ───────────────────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    const id = String(req.query.id || req.body?.id || "").trim();
    if (!id) return res.status(400).json({ error: "id is required" });

    const { error } = await db.from("org_events")
      .delete()
      .eq("id", id)
      .eq("org_token", orgToken);

    if (error) {
      console.error("[org/events DELETE]", error);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
