// pages/api/org/nutrition/send-reminder.js
// POST { athleteToken } — builds a mailto: URL + persists reminder tally in Supabase.

import { requireOrg } from "@/lib/requireOrg";
import { supabaseAdmin as db } from "@/lib/supabase";

function asString(v) { return String(v ?? "").trim(); }

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req);
  if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

  const orgToken     = asString(auth?.org?.token);
  const { athleteToken } = req.body || {};
  if (!asString(athleteToken)) return res.status(400).json({ error: "athleteToken is required." });

  try {
    // Minimal lookup — only guaranteed columns so a missing optional column can't cause 404
    const { data: athlete } = await db
      .from("athletes")
      .select("id, name, email, athlete_token, org_token")
      .eq("athlete_token", asString(athleteToken))
      .maybeSingle();

    if (!athlete) return res.status(404).json({ error: "Athlete not found.", athleteToken });

    // Verify org ownership — soft check (handles case/format differences in stored token)
    if (orgToken && athlete.org_token) {
      if (asString(athlete.org_token).toUpperCase() !== orgToken.toUpperCase()) {
        return res.status(403).json({ error: "Athlete does not belong to this organization." });
      }
    }
    if (!athlete.email) {
      return res.status(400).json({ error: "Athlete has no email on record.", athleteToken, athleteName: athlete.name });
    }

    const orgName = asString(auth?.org?.name || "Your coaching staff");
    const subject = encodeURIComponent("Nutrition check-in reminder");
    const body    = encodeURIComponent(
      `Hi ${athlete.name || "Athlete"},\n\n` +
      `This is a reminder from ${orgName} to log your nutrition check-in.\n\n` +
      `Please open the CheckPeak app and complete your check-in as soon as possible.\n\n` +
      `- ${orgName}`
    );
    const mailto = `mailto:${athlete.email}?subject=${subject}&body=${body}`;

    const nowISO = new Date().toISOString();

    // Read current reminder count — optional columns, non-fatal if they don't exist
    let prevCount = 0;
    try {
      const { data: tally } = await db
        .from("athletes")
        .select("reminder_count")
        .eq("id", athlete.id)
        .maybeSingle();
      prevCount = Number(tally?.reminder_count || 0);
    } catch (_) {}

    const nextCount = prevCount + 1;

    // Persist tally — non-fatal
    try {
      await db.from("athletes").update({
        last_reminder_sent_at: nowISO,
        reminder_count:        nextCount,
      }).eq("id", athlete.id);
    } catch (e) {
      console.warn("[send-reminder] tally update failed:", e?.message);
    }

    return res.status(200).json({
      ok:            true,
      mailto,
      athleteToken:  athlete.athlete_token,
      athleteName:   athlete.name || "",
      athleteEmail:  athlete.email,
      sentAt:        nowISO,
      reminderCount: nextCount,
      delivery:      "mailto",
    });
  } catch (err) {
    console.error("[org/nutrition/send-reminder]", err);
    return res.status(500).json({ error: err?.message || "Failed to build reminder." });
  }
}
