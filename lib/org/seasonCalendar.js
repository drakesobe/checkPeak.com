// lib/org/seasonCalendar.js
// Shared utility for org academic/athletic calendar periods.
// Stored in localStorage - no API required.

const LS_KEY = "org_season_calendar_v1";

// ─── Period type definitions ──────────────────────────────────────────────────
// varaRequired:
//   true  = hard red flag  (breaks, vacations - coach-directed work is NOT allowed)
//   "warn" = amber warning (out of season - VARA strongly preferred)
//   false = no warning     (active season periods)

export const PERIOD_TYPES = {
  preseason:     { label: "Preseason",       varaRequired: false,   tone: "brand"   },
  season:        { label: "Regular Season",  varaRequired: false,   tone: "safe"    },
  postseason:    { label: "Postseason",      varaRequired: false,   tone: "safe"    },
  championship:  { label: "Championship",    varaRequired: false,   tone: "safe"    },
  out_of_season: { label: "Out of Season",   varaRequired: "warn",  tone: "caution" },
  winter_break:  { label: "Winter Break",    varaRequired: true,    tone: "banned"  },
  spring_break:  { label: "Spring Break",    varaRequired: true,    tone: "banned"  },
  summer_break:  { label: "Summer Break",    varaRequired: true,    tone: "banned"  },
  vacation:      { label: "Vacation",        varaRequired: true,    tone: "banned"  },
  holiday:       { label: "Holiday",         varaRequired: true,    tone: "banned"  },
};

export const PERIOD_TYPE_OPTIONS = Object.entries(PERIOD_TYPES).map(([value, cfg]) => ({
  value,
  label: cfg.label,
  tone:  cfg.tone,
}));

// ─── Storage ──────────────────────────────────────────────────────────────────

export function loadPeriods() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePeriods(periods) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(Array.isArray(periods) ? periods : []));
  } catch {}
}

export function newPeriod() {
  return {
    id:    crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    name:  "",
    type:  "season",
    start: "",
    end:   "",
    sports: [],
  };
}

// ─── Date logic ───────────────────────────────────────────────────────────────

/**
 * Returns the first period that contains the given ISO date string,
 * or null if the date doesn't fall in any defined period.
 */
export function getActivePeriod(isoDate, periods) {
  if (!isoDate || !Array.isArray(periods)) return null;
  const d = isoDate.slice(0, 10);
  return periods.find((p) => {
    if (!p?.start || !p?.end) return false;
    return d >= p.start.slice(0, 10) && d <= p.end.slice(0, 10);
  }) || null;
}

/**
 * Returns the VARA requirement level for a period:
 *   "hard" - break/vacation (red)
 *   "soft" - out of season (amber)
 *   null   - active season, no restriction
 */
export function getVaraRequirement(period) {
  if (!period) return null;
  const cfg = PERIOD_TYPES[period.type];
  if (!cfg) return null;
  if (cfg.varaRequired === true)     return "hard";
  if (cfg.varaRequired === "warn")   return "soft";
  return null;
}