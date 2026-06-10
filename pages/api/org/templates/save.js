// pages/api/org/templates/save.js
// POST { template } - creates or updates a single workout template.
// Templates are stored as JSONB array in organizations.workout_templates

import { requireOrgSideUser } from "@/lib/requireUser";
import { supabaseAdmin as db } from "@/lib/supabase";

function sanitizeExercise(ex, idx) {
  return {
    Order:            Number(ex?.Order ?? idx + 1),
    ExerciseName:     String(ex?.ExerciseName || "").slice(0, 200),
    Sets:             ex?.Sets != null ? Number(ex.Sets) || null : null,
    Reps:             String(ex?.Reps    || "").slice(0, 50),
    Weight:           String(ex?.Weight  || "").slice(0, 50),
    Rest:             String(ex?.Rest    || "").slice(0, 50),
    Instructions:     String(ex?.Instructions || "").slice(0, 2000),
    VideoURL:         String(ex?.VideoURL     || "").slice(0, 500),
    EvidenceRequired: String(ex?.EvidenceRequired || "none").slice(0, 50),
  };
}

function sanitizeTemplate(t, now) {
  const isNew = !t?.id;
  return {
    id:          String(t?.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2)),
    name:        String(t?.name        || "Untitled").slice(0, 120),
    sport:       String(t?.sport       || "").slice(0, 40),
    category:    String(t?.category    || "strength").slice(0, 40),
    description: String(t?.description || "").slice(0, 500),
    exercises:   (Array.isArray(t?.exercises) ? t.exercises : [])
      .slice(0, 60)
      .map(sanitizeExercise),
    createdAt:   isNew ? now : String(t?.createdAt || now),
    updatedAt:   now,
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const orgToken = String(user?.Token || user?.token || "").trim();
  if (!orgToken) return res.status(400).json({ error: "No org token on session." });

  const { template } = req.body || {};
  if (!template || typeof template !== "object") {
    return res.status(400).json({ error: "template object required." });
  }

  const now   = new Date().toISOString();
  const clean = sanitizeTemplate(template, now);

  try {
    const { data: org, error: fetchErr } = await db
      .from("organizations")
      .select("workout_templates")
      .eq("token", orgToken)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    let templates = org?.workout_templates ?? [];
    if (!Array.isArray(templates)) templates = [];

    const idx = templates.findIndex(t => t.id === clean.id);
    if (idx >= 0) {
      templates[idx] = clean;
    } else {
      templates.push(clean);
    }

    if (templates.length > 200) templates = templates.slice(-200);

    const { error: saveErr } = await db
      .from("organizations")
      .update({ workout_templates: templates })
      .eq("token", orgToken);

    if (saveErr) throw saveErr;

    return res.status(200).json({ ok: true, template: clean });
  } catch (e) {
    console.error("[templates/save]", e?.message || e);
    return res.status(500).json({ error: e?.message || "Failed to save template." });
  }
}
