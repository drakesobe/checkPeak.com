// pages/api/org/templates/list.js
// GET - returns all workout templates for this org.
// Stored as JSONB in organizations.workout_templates

import { requireOrgSideUser } from "@/lib/requireUser";
import { supabaseAdmin as db } from "@/lib/supabase";

function normalizeTemplate(t) {
  return {
    id:          String(t?.id          || ""),
    name:        String(t?.name        || "Untitled"),
    sport:       String(t?.sport       || ""),
    category:    String(t?.category    || "strength"),
    description: String(t?.description || ""),
    exercises:   Array.isArray(t?.exercises) ? t.exercises : [],
    createdAt:   String(t?.createdAt   || ""),
    updatedAt:   String(t?.updatedAt   || ""),
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const orgToken = String(user?.Token || user?.token || "").trim();
  if (!orgToken) return res.status(400).json({ error: "No org token on session." });

  try {
    const { data: org, error } = await db
      .from("organizations")
      .select("workout_templates")
      .eq("org_token", orgToken)
      .maybeSingle();

    if (error) throw error;

    let templates = org?.workout_templates ?? [];
    if (!Array.isArray(templates)) templates = [];

    return res.status(200).json({ ok: true, templates: templates.map(normalizeTemplate) });
  } catch (e) {
    console.error("[templates/list]", e?.message || e);
    return res.status(500).json({ error: e?.message || "Failed to load templates." });
  }
}
