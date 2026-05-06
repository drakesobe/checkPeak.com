// pages/api/org/season-status.js
// GET - returns the current CARA season phase for the org.
//
// Reads the org's SeasonCalendar JSON from the Organizations Airtable record
// (same field used by season-calendar/get.js and season-calendar/save.js).
// Uses getActivePeriod + getVaraRequirement from lib/org/seasonCalendar.js.

import Airtable from "airtable";
import { requireOrgSideUser } from "@/lib/requireUser";
import { PERIOD_TYPES, getActivePeriod, getVaraRequirement } from "@/lib/org/seasonCalendar";

function getBase() {
  if (!process.env.ORGANIZATIONS_API_KEY || !process.env.ORGANIZATIONS_BASE_ID) {
    throw new Error("ORGANIZATIONS_API_KEY or ORGANIZATIONS_BASE_ID env var missing.");
  }
  return new Airtable({ apiKey: process.env.ORGANIZATIONS_API_KEY })
    .base(process.env.ORGANIZATIONS_BASE_ID);
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// Maps PERIOD_TYPES + vara requirement → nutrition page response
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
  const vara = getVaraRequirement(period); // "hard" | "soft" | null

  // Derive phase from tone + vara
  let phase, isCara, note;

  if (vara === "hard") {
    // winter_break, spring_break, summer_break, vacation, holiday
    phase  = "dead-period";
    isCara = false;
    note   = `${cfg.label || "Break"} - VARA required for any assigned activity. Do not require nutrition logging or send reminders during this window. Doing so may constitute an NCAA violation.`;
  } else if (vara === "soft") {
    // out_of_season
    phase  = "out-of-season";
    isCara = false;
    note   = "Out-of-season voluntary period. Nutrition tracking is optional - do not require or pressure athletes to log.";
  } else {
    // preseason, season, postseason, championship
    phase  = "in-season";
    isCara = true;
    note   = `${cfg.label || "Season"} period. Nutrition tracking is CARA-countable. Athletes are expected to log.`;
  }

  return {
    phase,
    label:  cfg.label || period.type,
    isCara,
    note:   period.name ? `${period.name} - ${note}` : note,
    period: {
      name:  period.name,
      type:  period.type,
      start: period.start,
      end:   period.end,
    },
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const orgId = String(user?.orgId || user?.OrgId || "").trim();
  if (!orgId) return res.status(400).json({ error: "No orgId on session - re-login." });

  const table = process.env.ORGANIZATIONS_TABLE_NAME || "tblDfjURwuvxOI0Su";

  try {
    const record = await getBase()(table).find(orgId);
    const raw    = record?.fields?.SeasonCalendar || "";

    let periods = [];
    if (raw) { try { periods = JSON.parse(raw); } catch {} }
    if (!Array.isArray(periods)) periods = [];

    const today  = todayISO();
    const period = getActivePeriod(today, periods);
    const status = buildStatus(period);

    return res.status(200).json({ ok: true, ...status });

  } catch (e) {
    console.error("[season-status]", e?.message || e);
    // Non-fatal - nutrition page still loads, banner shows safe fallback
    return res.status(200).json({
      ok:     true,
      phase:  "out-of-season",
      label:  "Calendar Unavailable",
      isCara: false,
      note:   "Could not load season calendar. Treat as voluntary period - do not require nutrition logging until resolved.",
      period: null,
    });
  }
}