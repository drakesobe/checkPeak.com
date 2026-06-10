// pages/api/org/templates/delete.js
// POST { id } - removes a workout template by ID.

import { requireOrgSideUser } from "@/lib/requireUser";
import { supabaseAdmin as db } from "@/lib/supabase";

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

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: "id required." });

  try {
    const { data: org, error: fetchErr } = await db
      .from("organizations")
      .select("workout_templates")
      .eq("token", orgToken)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    let templates = org?.workout_templates ?? [];
    if (!Array.isArray(templates)) templates = [];

    const before    = templates.length;
    templates       = templates.filter(t => t.id !== String(id));

    if (templates.length === before) {
      return res.status(404).json({ error: "Template not found." });
    }

    const { error: saveErr } = await db
      .from("organizations")
      .update({ workout_templates: templates })
      .eq("token", orgToken);

    if (saveErr) throw saveErr;

    return res.status(200).json({ ok: true, deleted: id });
  } catch (e) {
    console.error("[templates/delete]", e?.message || e);
    return res.status(500).json({ error: e?.message || "Failed to delete template." });
  }
}
