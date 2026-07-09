// pages/api/athlete/profile.js
// GET  — return own recruiting profile (auto-creates on first visit), includes view analytics
// POST { action:"update", ...fields } — update editable fields including achievements array
// POST { action:"share" }             — make public, return share token
// POST { action:"unpublish" }         — take private

import { requireAthlete } from "@/lib/requireAthlete";
import { supabaseAdmin as db } from "@/lib/supabase";

function getAthleteToken(auth) {
  return String(auth?.athlete?.AthleteToken || auth?.user?.AthleteToken || "").trim();
}

const EDITABLE = [
  "sport", "position", "level", "graduation_year", "school",
  "height", "weight", "gpa", "bio",
  "show_contact", "achievements", "hudl_url", "parent_message",
  "instagram_url", "twitter_url", "maxpreps_url",
  "sat_score", "act_score", "recruiting_status", "top_schools", "family_statement",
];

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  const athleteToken = getAthleteToken(auth);
  if (!athleteToken) return res.status(401).json({ error: "Missing AthleteToken" });

  // ── GET ─────────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    let { data: profile, error } = await db
      .from("athlete_profiles")
      .select("*")
      .eq("athlete_token", athleteToken)
      .maybeSingle();

    if (error) return res.status(500).json({ error: "DB error", details: error.message });

    if (!profile) {
      const { data: created, error: cErr } = await db
        .from("athlete_profiles")
        .insert({ athlete_token: athleteToken })
        .select("*")
        .single();
      if (cErr) return res.status(500).json({ error: "Could not create profile", details: cErr.message });
      profile = created;
    }

    // View analytics from profile_views table
    let viewStats = { thisWeek: 0, lastWeek: 0, allTime: profile.view_count || 0 };
    if (profile.share_token) {
      const now       = Date.now();
      const week7     = new Date(now - 7  * 86400000).toISOString();
      const week14    = new Date(now - 14 * 86400000).toISOString();

      const [{ count: thisWeekCount }, { count: lastWeekCount }] = await Promise.all([
        db.from("profile_views")
          .select("*", { count: "exact", head: true })
          .eq("share_token", profile.share_token)
          .gte("viewed_at", week7)
          .then(r => ({ count: r.count ?? 0 })),
        db.from("profile_views")
          .select("*", { count: "exact", head: true })
          .eq("share_token", profile.share_token)
          .gte("viewed_at", week14)
          .lt("viewed_at", week7)
          .then(r => ({ count: r.count ?? 0 })),
      ]);

      viewStats = { thisWeek: thisWeekCount, lastWeek: lastWeekCount, allTime: profile.view_count || 0 };
    }

    return res.status(200).json({ ok: true, profile, viewStats });
  }

  // ── POST ────────────────────────────────────────────────────────────────────
  if (req.method === "POST") {
    const body   = req.body || {};
    const action = String(body.action || "update").trim();

    if (action === "share") {
      const { data, error } = await db
        .from("athlete_profiles")
        .update({ is_public: true, updated_at: new Date().toISOString() })
        .eq("athlete_token", athleteToken)
        .select("share_token")
        .single();
      if (error) return res.status(500).json({ error: "Could not publish profile", details: error.message });
      return res.status(200).json({ ok: true, shareToken: data.share_token });
    }

    if (action === "unpublish") {
      await db
        .from("athlete_profiles")
        .update({ is_public: false, updated_at: new Date().toISOString() })
        .eq("athlete_token", athleteToken);
      return res.status(200).json({ ok: true });
    }

    // action === "update"
    const updates = { updated_at: new Date().toISOString() };
    for (const key of EDITABLE) {
      if (!(key in body)) continue;
      if (key === "graduation_year") {
        updates[key] = body[key] ? Number(body[key]) : null;
      } else if (key === "show_contact") {
        updates[key] = Boolean(body[key]);
      } else if (key === "achievements") {
        updates[key] = Array.isArray(body[key])
          ? body[key].slice(0, 10).map(a => String(a).trim().slice(0, 60)).filter(Boolean)
          : [];
      } else if (key === "sat_score" || key === "act_score") {
        updates[key] = body[key] ? Math.min(Math.max(Number(body[key]), 0), 9999) : null;
      } else if (key === "top_schools") {
        updates[key] = Array.isArray(body[key])
          ? body[key].slice(0, 3).map(s => String(s).trim().slice(0, 80)).filter(Boolean)
          : [];
      } else {
        updates[key] = String(body[key] ?? "").trim() || null;
      }
    }

    const { data, error } = await db
      .from("athlete_profiles")
      .upsert({ athlete_token: athleteToken, ...updates }, { onConflict: "athlete_token" })
      .select("*")
      .single();

    if (error) return res.status(500).json({ error: "Could not save profile", details: error.message });
    return res.status(200).json({ ok: true, profile: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
