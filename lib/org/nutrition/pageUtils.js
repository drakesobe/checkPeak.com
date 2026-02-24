// lib/org/nutrition/pageUtils.js

/* -------------------------------------------------------
   Small shared helpers for Org Nutrition Dashboard pages
   - className joiner (cx)
   - auth role normalization
   - safe token checks
   - queue filtering (search + status + sport/team)
   - headline builder
-------------------------------------------------------- */

export function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

/**
 * Normalize role strings coming from session cookie user payload.
 * Supports a few historical variations and casing quirks.
 */
export function normalizeRole(user) {
  const r = String(user?.role || user?.Role || "").trim().toLowerCase();
  if (!r) return "";

  // canonical roles used across org-side pages
  if (r === "organization") return "organization";
  if (r === "admin") return "admin";
  if (r === "trainer") return "trainer";
  if (r === "athlete") return "athlete";

  // tolerate older / inconsistent values
  if (r.includes("org")) return "organization";
  if (r.includes("admin")) return "admin";
  if (r.includes("train")) return "trainer";
  if (r.includes("ath")) return "athlete";

  return r;
}

/**
 * Org-side access includes Organization, Admin, Trainer.
 */
export function isOrgSideRole(role) {
  return role === "organization" || role === "admin" || role === "trainer";
}

/**
 * Defensive check: if something that looks like an ORG token is passed
 * into an athlete route, we should refuse navigation.
 */
export function isLikelyOrgToken(v) {
  const s = String(v || "").trim().toUpperCase();
  return s.startsWith("ORG-");
}

/* -------------------------------------------------------
   Filtering helpers
-------------------------------------------------------- */

function normText(v) {
  return String(v ?? "").trim();
}

function normLower(v) {
  return normText(v).toLowerCase();
}

function normalizeSelectValue(v) {
  // Used for dropdowns where "all" means no filter.
  const x = normLower(v);
  return x && x !== "all" ? normText(v) : "";
}

/**
 * Filter the queue rows by:
 * - search (name/email/token/reasons/priority label + sport/team)
 * - filterMode:
 *    action | missing_checkin | low_adherence | no_plan | all
 * - sport/team dropdown filters (optional)
 *
 * NOTE:
 * - sport/team comparisons are exact match after trim
 * - if sport/team is "all" or empty, filter is not applied
 */
export function filterRows(rows, search, filterMode, sport, team) {
  const q = normLower(search);
  let list = Array.isArray(rows) ? [...rows] : [];

  // ----- Search (broad: includes sport/team and reasons) -----
  if (q) {
    list = list.filter((r) => {
      const hay = [
        r?.athleteName,
        r?.athleteEmail,
        r?.athleteToken,
        r?.sport,
        r?.team,
        Array.isArray(r?.reasons) ? r.reasons.join(" ") : "",
        r?.priorityLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }

  // ----- Status / queue filter -----
  const mode = normLower(filterMode) || "action";

  if (mode === "action") list = list.filter((r) => Boolean(r?.needsAction));
  if (mode === "missing_checkin") list = list.filter((r) => Boolean(r?.missingCheckin));
  if (mode === "low_adherence") list = list.filter((r) => Boolean(r?.lowAdherence));
  if (mode === "no_plan") list = list.filter((r) => !Boolean(r?.hasPlan));
  // "all" => no-op

  // ----- Sport/team filters -----
  const s = normalizeSelectValue(sport); // exact match
  const t = normalizeSelectValue(team);

  if (s) list = list.filter((r) => normText(r?.sport) === s);
  if (t) list = list.filter((r) => normText(r?.team) === t);

  return list;
}

/* -------------------------------------------------------
   Display helpers
-------------------------------------------------------- */

/**
 * Deterministic headline for the dashboard header.
 * meta.weekStartISO is expected to be YYYY-MM-DD.
 */
export function getHeadline(meta) {
  return meta?.weekStartISO ? `Week of ${meta.weekStartISO}` : "This week";
}

/**
 * Optional helper: build a readable subheadline from meta
 * (handy if you want to show athlete counts or last updated label).
 */
export function getSubheadline(meta) {
  const n = Number(meta?.athletesCount || 0);
  if (!n) return "";
  return `${n} athlete${n === 1 ? "" : "s"} in this organization`;
}

/**
 * Optional helper: if you want a tiny “pill label” for active filters.
 * Example output:
 *  - "Needs Action • Basketball • Varsity"
 */
export function describeFilters({ filterMode, sport, team }) {
  const mode = normLower(filterMode) || "action";
  const modeLabel =
    mode === "missing_checkin"
      ? "Missing Check-in"
      : mode === "low_adherence"
      ? "Low Adherence"
      : mode === "no_plan"
      ? "No Plan"
      : mode === "all"
      ? "All"
      : "Needs Action";

  const s = normalizeSelectValue(sport);
  const t = normalizeSelectValue(team);

  const parts = [modeLabel];
  if (s) parts.push(s);
  if (t) parts.push(t);

  return parts.join(" • ");
}