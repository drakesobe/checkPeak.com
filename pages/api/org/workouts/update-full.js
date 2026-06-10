// pages/api/org/workouts/update-full.js
// POST { id, ids?, title?, date?, status?, sport?, items? }
// Full workout update: patches header fields and replaces all workout items.
// `ids` (array) updates multiple sibling workouts sharing the same title/date.

import { requireOrgSideUser } from "@/lib/requireUser";
import { supabaseAdmin as db } from "@/lib/supabase";

const ALLOWED_STATUSES = ["assigned","complete","completed","draft","archived","pending_review","rejected"];

function clean(v) { return v !== undefined && v !== null ? String(v).trim() : undefined; }

async function updateOne(workoutId, orgToken, { title, date, status, sport, items }) {
  // Verify ownership
  const { data: existing } = await db
    .from("daily_workouts")
    .select("id, org_token")
    .eq("id", workoutId)
    .maybeSingle();

  if (!existing) return { error: "Workout not found.", status: 404 };
  if (existing.org_token !== orgToken) return { error: "Access denied.", status: 403 };

  // Patch header fields
  const patch = {};
  if (title  !== undefined) patch.title  = String(title).trim();
  if (date   !== undefined) patch.date   = String(date).slice(0, 10);
  if (sport  !== undefined) patch.sport  = String(sport).trim();
  if (status !== undefined) {
    const s = String(status).toLowerCase();
    if (!ALLOWED_STATUSES.includes(s)) return { error: `Invalid status: ${s}`, status: 400 };
    patch.status = s;
  }

  if (Object.keys(patch).length) {
    const { error } = await db.from("daily_workouts").update(patch).eq("id", workoutId);
    if (error) return { error: error.message, status: 500 };
  }

  // Replace items if provided
  if (Array.isArray(items)) {
    const { error: delErr } = await db
      .from("workout_items")
      .delete()
      .eq("workout_id", workoutId);
    if (delErr) return { error: delErr.message, status: 500 };

    if (items.length) {
      const rows = items.map((item, idx) => ({
        workout_id:        workoutId,
        exercise_name:     clean(item.ExerciseName || item.exercise_name) || "",
        sets:              item.Sets  != null ? Number(item.Sets)  : item.sets  != null ? Number(item.sets)  : null,
        reps:              clean(item.Reps  ?? item.reps)  ?? "",
        weight:            clean(item.Weight ?? item.weight) ?? "",
        rpe:               clean(item.RPE    ?? item.rpe)    ?? "",
        rest:              clean(item.Rest   ?? item.rest)   ?? "",
        instructions:      clean(item.Instructions ?? item.instructions) ?? "",
        video_url:         clean(item.VideoURL ?? item.video_url) ?? "",
        evidence_required: clean(item.EvidenceRequired ?? item.evidence_required) || "none",
        group_id:          clean(item.GroupId ?? item.group_id) || null,
        sort_order:        item.Order != null ? Number(item.Order) : item.sort_order != null ? Number(item.sort_order) : idx + 1,
      }));

      const { error: insErr } = await db.from("workout_items").insert(rows);
      if (insErr) return { error: insErr.message, status: 500 };
    }
  }

  return { ok: true };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const orgToken = String(user.orgToken || user.Token || "").trim();
  if (!orgToken) return res.status(400).json({ error: "Missing org token on session." });

  const body = req.body || {};
  const ids  = Array.isArray(body.ids) ? body.ids.filter(Boolean) : (body.id ? [body.id] : []);
  if (!ids.length) return res.status(400).json({ error: "id or ids is required" });

  const { title, date, status, sport, items } = body;

  try {
    const results = [];
    for (const id of ids) {
      const r = await updateOne(String(id).trim(), orgToken, { title, date, status, sport, items });
      if (r.error) return res.status(r.status || 500).json({ error: r.error });
      results.push(id);
    }
    return res.status(200).json({ ok: true, updated: results });
  } catch (err) {
    console.error("[org/workouts/update-full]", err);
    return res.status(500).json({ error: "Failed to update workout.", details: err?.message });
  }
}
