// lib/profileViewAlerts.js
// Push the athlete when their public recruiting profile is viewed — rate-limited so it stays meaningful:
//   • milestone totals (10, 25, 50, 100, 250, 500, 1000) always notify
//   • otherwise only the FIRST view of the day (UTC) notifies
// Fire-and-forget; never throws.

import { supabaseAdmin as db } from "@/lib/supabase";
import { sendNotification } from "@/lib/sendNotification";

const MILESTONES = new Set([10, 25, 50, 100, 250, 500, 1000]);

export async function notifyProfileView({ athleteToken, shareToken, totalViews }) {
  try {
    if (!athleteToken) return;

    if (MILESTONES.has(totalViews)) {
      await sendNotification([athleteToken], {
        title: `${totalViews} profile views`,
        body:  "Your recruiting profile just hit a milestone. Keep it fresh — add your latest PRs and film.",
        type:  "profile_view",
        data:  { milestone: totalViews },
      });
      return;
    }

    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const { count } = await db
      .from("profile_views")
      .select("id", { count: "exact", head: true })
      .eq("share_token", shareToken)
      .gte("viewed_at", dayStart.toISOString());

    // This view is already logged, so the first view of the day shows count === 1.
    if ((count ?? 0) !== 1) return;

    await sendNotification([athleteToken], {
      title: "Your recruiting profile was viewed",
      body:  `Someone checked out your profile today — ${totalViews} total views.`,
      type:  "profile_view",
      data:  {},
    });
  } catch {}
}
