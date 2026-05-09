// pages/api/org/exercises.js
// GET    — returns exercises for this org from ExerciseLibrary
// POST   — adds a new exercise to the library
// DELETE — removes an exercise from the library (by record id)
//
// All operations scoped to OrgToken — orgs never see each other's data.

import Airtable from "airtable";
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

// Per-org in-process cache, invalidated after 5 minutes
const orgCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCached(orgToken) {
  const entry = orgCache.get(orgToken);
  if (!entry || Date.now() - entry.at > CACHE_TTL) return null;
  return entry.exercises;
}
function setCached(orgToken, exercises) {
  orgCache.set(orgToken, { exercises, at: Date.now() });
}
function bust(orgToken) {
  orgCache.delete(orgToken);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (!process.env.EXERCISE_LIBRARY_API_KEY || !process.env.EXERCISE_LIBRARY_BASE_ID || !process.env.EXERCISE_LIBRARY_TABLE) {
    return res.status(500).json({ error: "Exercise Library env vars missing. Check EXERCISE_LIBRARY_API_KEY, EXERCISE_LIBRARY_BASE_ID, EXERCISE_LIBRARY_TABLE." });
  }

  const base  = new Airtable({ apiKey: process.env.EXERCISE_LIBRARY_API_KEY }).base(process.env.EXERCISE_LIBRARY_BASE_ID);
  const TABLE = process.env.EXERCISE_LIBRARY_TABLE;

  const auth = requireOrg(req);
  if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

  const orgToken = getOrgToken(auth);
  if (!orgToken) return res.status(401).json({ error: "OrgToken missing from session. Re-login." });

  const safeToken = orgToken.replace(/'/g, "\\'");

  // ── GET ───────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    try {
      let exercises = getCached(orgToken);

      if (!exercises) {
        const records = await base(TABLE)
          .select({
            filterByFormula: `{OrgToken} = '${safeToken}'`,
            sort: [{ field: "Name", direction: "asc" }],
          })
          .all();

        exercises = records
          .map(r => ({
            id:       r.id,
            name:     normalize(r.get("Name")),
            category: String(r.get("Category") || ""),
          }))
          .filter(e => e.name);

        setCached(orgToken, exercises);
      }

      const { q = "" } = req.query;
      const results = q
        ? exercises.filter(e => e.name.toLowerCase().includes(q.toLowerCase()))
        : exercises;

      return res.status(200).json({ ok: true, exercises: results });
    } catch (err) {
      console.error("exercises GET error:", err);
      return res.status(500).json({ error: "Failed to fetch exercises" });
    }
  }

  // ── POST — add exercise to library ────────────────────────────────────────
  if (req.method === "POST") {
    const { name, category = "" } = req.body || {};
    const normalizedName = normalize(name);
    if (!normalizedName) return res.status(400).json({ error: "name is required" });

    try {
      // Guard against duplicates within this org
      const safeN = normalizedName.replace(/'/g, "\\'");
      const existing = await base(TABLE)
        .select({
          filterByFormula: `AND({OrgToken} = '${safeToken}', {Name} = '${safeN}')`,
          maxRecords: 1,
        })
        .firstPage();

      if (existing?.length) {
        return res.status(200).json({
          ok: true,
          exercise: { id: existing[0].id, name: normalizedName, category },
          duplicate: true,
        });
      }

      const record = await base(TABLE).create({
        Name:     normalizedName,
        OrgToken: orgToken,
        ...(category ? { Category: category } : {}),
      });

      bust(orgToken);

      return res.status(200).json({
        ok:       true,
        exercise: { id: record.id, name: normalizedName, category },
      });
    } catch (err) {
      console.error("exercises POST error:", err);
      return res.status(500).json({ error: "Failed to add exercise" });
    }
  }

  // ── DELETE — remove exercise from library ─────────────────────────────────
  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "id is required" });

    try {
      // Verify it belongs to this org before deleting
      const record = await base(TABLE).find(id).catch(() => null);
      if (!record) return res.status(404).json({ error: "Exercise not found" });

      const recordOrg = String(record.get("OrgToken") || "").trim();
      if (recordOrg !== orgToken) {
        return res.status(403).json({ error: "Not authorized to delete this exercise" });
      }

      await base(TABLE).destroy(id);
      bust(orgToken);

      return res.status(200).json({ ok: true, deleted: id });
    } catch (err) {
      console.error("exercises DELETE error:", err);
      return res.status(500).json({ error: "Failed to delete exercise" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}