// pages/api/recruit/watchlist.js
// POST — coach adds an athlete to their watchlist
// Requires the recruit_watchlist table (see SQL in recruit/[token].js comments)

import { supabaseAdmin as db } from "@/lib/supabase";
import { sendNotification }    from "@/lib/sendNotification";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { token, coachName, coachEmail, coachOrg } = req.body || {};

  if (!token || !coachEmail || !coachEmail.includes("@")) {
    return res.status(400).json({ error: "token and a valid coachEmail are required" });
  }
  if (!coachName?.trim()) {
    return res.status(400).json({ error: "coachName is required" });
  }

  // Resolve athlete_token from share_token
  const { data: profile, error: pErr } = await db
    .from("athlete_profiles")
    .select("athlete_token, is_public")
    .eq("share_token", token)
    .maybeSingle();

  if (pErr || !profile)        return res.status(404).json({ error: "Profile not found" });
  if (!profile.is_public)      return res.status(403).json({ error: "Profile is private" });

  // Upsert so a coach can re-watchlist after removing (no-op if already watching)
  const { error: wErr } = await db
    .from("recruit_watchlist")
    .upsert(
      {
        share_token: token,
        coach_email: coachEmail.trim().toLowerCase(),
        coach_name:  coachName.trim() || null,
        coach_org:   coachOrg?.trim() || null,
      },
      { onConflict: "share_token,coach_email" }
    );

  if (wErr) return res.status(500).json({ error: wErr.message });

  // Fire push to athlete (non-blocking)
  const orgPart = coachOrg?.trim() ? ` from ${coachOrg.trim()}` : "";
  sendNotification([profile.athlete_token], {
    title: "A coach added you to their watchlist",
    body:  `${coachName.trim()}${orgPart} is now following your progress on CheckPeak.`,
    data:  { type: "watchlist_add", screen: "recruiting-profile" },
    type:  "watchlist_add",
  }).catch(() => {});

  return res.status(200).json({ ok: true });
}
