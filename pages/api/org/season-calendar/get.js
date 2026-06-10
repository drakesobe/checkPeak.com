// pages/api/org/season-calendar/get.js
import { requireOrgSideUser } from "@/lib/requireUser";
import { supabaseAdmin as db } from "@/lib/supabase";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const orgToken = String(user?.Token || user?.token || "").trim();
  if (!orgToken) {
    return res.status(400).json({ error: "No org token on session - re-login." });
  }

  try {
    const { data: org, error } = await db
      .from("organizations")
      .select("season_calendar")
      .eq("token", orgToken)
      .maybeSingle();

    if (error) throw error;

    let periods = org?.season_calendar ?? [];
    if (!Array.isArray(periods)) periods = [];

    periods = periods.map(p => ({
      ...p,
      sports: Array.isArray(p.sports) ? p.sports : [],
    }));

    return res.status(200).json({ ok: true, periods });
  } catch (e) {
    console.error("[season-calendar/get] FAILED:", e?.message || e);
    return res.status(500).json({ error: e?.message || "Failed to load season calendar." });
  }
}
