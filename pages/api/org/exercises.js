// pages/api/org/exercises.js
// GET    - returns exercises for this org from exercise_library
// POST   - adds a new exercise to the library
// DELETE - removes an exercise from the library (by id)
//
// All operations scoped to org_token - orgs never see each other's data.

import { supabaseAdmin as db } from "@/lib/supabase";
import { requireOrg } from "@/lib/requireOrg";

function normalize(raw) {
  return String(raw || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

function getOrgToken(auth) {
  return String(
    auth?.org?.token || auth?.org?.Token || auth?.token || ""
  ).trim();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const auth = requireOrg(req);
  if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

  const orgToken = getOrgToken(auth);
  if (!orgToken) return res.status(401).json({ error: "OrgToken missing from session. Re-login." });

  // ── GET ───────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    try {
      let query = db
        .from("exercise_library")
        .select("id, name, category")
        .eq("org_token", orgToken)
        .order("name", { ascending: true });

      const { q = "" } = req.query;
      if (q) query = query.ilike("name", `%${q}%`);

      const { data: records, error } = await query;
      if (error) throw error;

      const exercises = (records || []).map(r => ({
        id:       r.id,
        name:     normalize(r.name),
        category: String(r.category || ""),
      })).filter(e => e.name);

      return res.status(200).json({ ok: true, exercises });
    } catch (err) {
      console.error("exercises GET error:", err);
      return res.status(500).json({ error: "Failed to fetch exercises" });
    }
  }

  // ── POST - add exercise to library ────────────────────────────────────────
  if (req.method === "POST") {
    const { name, category = "" } = req.body || {};
    const normalizedName = normalize(name);
    if (!normalizedName) return res.status(400).json({ error: "name is required" });

    try {
      // Guard against duplicates within this org
      const { data: existing } = await db
        .from("exercise_library")
        .select("id")
        .eq("org_token", orgToken)
        .ilike("name", normalizedName)
        .maybeSingle();

      if (existing) {
        return res.status(200).json({
          ok:       true,
          exercise: { id: existing.id, name: normalizedName, category },
          duplicate: true,
        });
      }

      const { data: record, error } = await db
        .from("exercise_library")
        .insert({ name: normalizedName, org_token: orgToken, category: category || null })
        .select("id")
        .single();

      if (error) throw error;

      return res.status(200).json({
        ok:       true,
        exercise: { id: record.id, name: normalizedName, category },
      });
    } catch (err) {
      console.error("exercises POST error:", err);
      return res.status(500).json({ error: "Failed to add exercise" });
    }
  }

  // ── DELETE - remove exercise from library ─────────────────────────────────
  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "id is required" });

    try {
      // Verify it belongs to this org before deleting
      const { data: record } = await db
        .from("exercise_library")
        .select("id, org_token")
        .eq("id", id)
        .maybeSingle();

      if (!record) return res.status(404).json({ error: "Exercise not found" });
      if (record.org_token !== orgToken) {
        return res.status(403).json({ error: "Not authorized to delete this exercise" });
      }

      const { error } = await db
        .from("exercise_library")
        .delete()
        .eq("id", id);

      if (error) throw error;

      return res.status(200).json({ ok: true, deleted: id });
    } catch (err) {
      console.error("exercises DELETE error:", err);
      return res.status(500).json({ error: "Failed to delete exercise" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
