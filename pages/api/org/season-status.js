// pages/api/org/season-status.js
// GET - returns the current CARA season phase for the org.
// Reads organizations.season_calendar jsonb column.

import { requireOrgSideUser } from "@/lib/requireUser";
import { supabaseAdmin as db } from "@/lib/supabase";
import { PERIOD_TYPES, getActivePeriod, getVaraRequirement } from "@/lib/org/seasonCalendar";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function buildStatus(period) {
  if (!period) {
    return {
      phase:  "out-of-season",
      label:  "No Period Defined",
      isCara: false,
      note:   "No season period is configured for today. Treat as voluntary - do not require nutrition logging.",
      period: null,
    };
  }

  const cfg  = PERIOD_TYPES[period.type] || {};
  const vara = getVaraRequirement(period);

  let phase, isCara, note;

  if (vara === "hard") {
    phase  = "dead-period";
    isCara = false;
    note   = `${cfg.label || "Break"} - VARA required for any assigned activity. Do not require nutrition logging or send reminders during this window.`;
  } else if (vara === "soft") {
    phase  = "out-of-season";
    isCara = false;
    note   = "Out-of-season voluntary period. Nutrition tracking is optional - do not require or pressure athletes to log.";
  } else {
    phase  = "in-season";
    isCara = true;
    note   = `${cfg.label || "Season"} period. Nutrition tracking is CARA-countable. Athletes are expected to log.`;
  }

  return {
    phase,
    label:  cfg.label || period.type,
    isCara,
    note:   period.name ? `${period.name} - ${note}` : note,
    period: { name: period.name, type: period.type, start: period.start, end: period.end },
  };
}

const FALLBACK = {
  ok:     true,
  phase:  "out-of-season",
  label:  "Calendar Unavailable",
  isCara: false,
  note:   "Could not load season calendar. Treat as voluntary period.",
  period: null,
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const orgToken = String(user?.Token || user?.token || "").trim();
  if (!orgToken) return res.status(400).json({ error: "No org token on session - re-login." });

  try {
    const { data: org, error } = await db
      .from("organizations")
      .select("season_calendar")
      .eq("org_token", orgToken)
      .maybeSingle();

    if (error) throw error;

    let periods = org?.season_calendar ?? [];
    if (!Array.isArray(periods)) periods = [];

    const today  = todayISO();
    const period = getActivePeriod(today, periods);
    const status = buildStatus(period);

    return res.status(200).json({ ok: true, ...status });
  } catch (e) {
    console.error("[season-status]", e?.message || e);
    return res.status(200).json(FALLBACK);
  }
}
