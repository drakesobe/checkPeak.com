// pages/api/org/season-calendar/save.js
// POST { periods: [] } - saves the org's season calendar periods.

import { requireOrgSideUser } from "@/lib/requireUser";
import { supabaseAdmin as db } from "@/lib/supabase";

function sanitizePeriod(p) {
  return {
    id:     String(p?.id    || "").slice(0, 64),
    name:   String(p?.name  || "").slice(0, 120),
    type:   String(p?.type  || "season").slice(0, 40),
    start:  String(p?.start || "").slice(0, 10),
    end:    String(p?.end   || "").slice(0, 10),
    sports: Array.isArray(p?.sports)
      ? p.sports.map(s => String(s).slice(0, 40)).filter(Boolean)
      : [],
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
  if (!orgToken) {
    return res.status(400).json({ error: "No org token on session - re-login." });
  }

  const { periods } = req.body || {};
  if (!Array.isArray(periods)) {
    return res.status(400).json({ error: "periods must be an array." });
  }

  const clean = periods.slice(0, 60).map(sanitizePeriod);

  try {
    const { error } = await db
      .from("organizations")
      .update({ season_calendar: clean })
      .eq("token", orgToken);

    if (error) throw error;

    return res.status(200).json({ ok: true, periods: clean });
  } catch (e) {
    console.error("[season-calendar/save]", e?.message || e);
    return res.status(500).json({ error: e?.message || "Failed to save season calendar." });
  }
}
