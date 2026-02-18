// components/org/reviewQueue/table/helpers.js

/* ---------------- basic utils ---------------- */

export function safeCount(v) {
  return Array.isArray(v) ? v.length : 0;
}

export function normLower(v) {
  return String(v ?? "").trim().toLowerCase();
}

export function fallbackNormalizeText(v) {
  return String(v ?? "").trim();
}

export function fmtMaybe(fmtDate, v) {
  if (!v) return "—";
  return fmtDate ? fmtDate(v) : v;
}

/* ---------------- airtable-friendly field readers ---------------- */

/**
 * Airtable "Lookup" fields commonly come back as:
 * - string
 * - array of strings
 * - array of objects (rare, depending on how data is shaped upstream)
 *
 * This helper returns:
 * - first non-empty string from the lookup
 * - otherwise empty string
 */
function firstLookupText(raw, normalizeText) {
  const norm = normalizeText || fallbackNormalizeText;

  if (raw == null) return "";

  // Lookup: [ "John Smith" ]
  if (Array.isArray(raw)) {
    for (const v of raw) {
      if (v == null) continue;

      // string
      if (typeof v === "string") {
        const s = norm(v);
        if (s) return s;
        continue;
      }

      // object shapes
      if (typeof v === "object") {
        const candidate =
          v?.name ??
          v?.email ??
          v?.fields?.Name ??
          v?.fields?.Email ??
          v?.value ??
          v?.label;

        const s = norm(candidate);
        if (s) return s;

        // last resort: stringify
        const fallback = norm(String(v));
        if (fallback) return fallback;
      }
    }
    return "";
  }

  // Lookup: "John Smith"
  return norm(raw);
}

/* ---------------- athlete resolvers ---------------- */

/**
 * ✅ Prefer Airtable lookup fields:
 * - AthleteName (lookup)
 * - AthleteEmail (lookup)
 *
 * Then fall back to:
 * - API mapped fields (athleteName / athleteEmail)
 * - linked record-like fields (athlete / createdBy)
 * - email prefix (for name)
 */

export function resolveAthleteName(it, normalizeText) {
  const norm = normalizeText || fallbackNormalizeText;

  // 1) Airtable Lookup: AthleteName
  const rawLookup = it?.AthleteName ?? it?.["AthleteName"];
  const fromLookup = firstLookupText(rawLookup, norm);
  if (fromLookup) return fromLookup;

  // 2) API mapped (if your API already normalized)
  const direct = norm(it?.athleteName);
  if (direct) return direct;

  // 3) Linked record-ish fallback: athlete
  if (Array.isArray(it?.athlete) && it.athlete.length > 0) {
    const first = it.athlete[0];
    if (typeof first === "string") return norm(first);
    if (first?.name) return norm(first.name);
    if (first?.fields?.Name) return norm(first.fields.Name);
  }

  // 4) createdBy fallback
  if (Array.isArray(it?.createdBy) && it.createdBy.length > 0) {
    const first = it.createdBy[0];
    if (typeof first === "string") return norm(first);
    if (first?.name) return norm(first.name);
  }

  // 5) last resort: email prefix
  const email = resolveAthleteEmail(it, norm);
  if (email && email.includes("@")) return norm(String(email).split("@")[0]);

  return "Athlete";
}

export function resolveAthleteEmail(it, normalizeText) {
  const norm = normalizeText || fallbackNormalizeText;

  // 1) Airtable Lookup: AthleteEmail
  const rawLookup = it?.AthleteEmail ?? it?.["AthleteEmail"];
  const fromLookup = firstLookupText(rawLookup, norm);
  if (fromLookup) return fromLookup;

  // 2) API mapped
  const direct = norm(it?.athleteEmail);
  if (direct) return direct;

  // 3) createdBy fallback
  if (Array.isArray(it?.createdBy) && it.createdBy.length > 0) {
    const first = it.createdBy[0];
    if (typeof first === "string") return "";
    if (first?.email) return norm(first.email);
    if (first?.fields?.Email) return norm(first.fields.Email);
  }

  return "";
}

/* ---------------- acknowledgement logic ---------------- */

/**
 * Show “Acknowledged / Not acknowledged” when:
 * - reviewStatus === "needs_info" OR completion status is "rejected"
 *
 * This matches your mapping:
 * - completion rejected  -> needs_info bucket
 * - completion completed -> approved
 * - completion pending_review -> pending
 */
export function shouldShowAck({ reviewStatus, completionStatus }) {
  const rev = normLower(reviewStatus);
  const st = normLower(completionStatus);
  return rev === "needs_info" || st === "rejected";
}

export function getRowAccent(rev) {
  const r = normLower(rev);
  return r === "pending" ? "bg-amber-50/40" : r === "needs_info" ? "bg-amber-50/20" : "";
}

/* ---------------- row view model builder ---------------- */

/** Build a “view model” so the UI components stay clean */
export function buildRowVM(it, normIn, fmtDate) {
  const norm = normIn || fallbackNormalizeText;

  const id = String(it?.id || "");
  const title = norm(it?.title) || "Workout Completion";
  const date = norm(it?.date);

  // "status" is used in a few places in your data model:
  // - daily workout status (if provided)
  // - completion status (if provided as Status/completionStatus)
  // We'll keep current behavior: use it?.status as "daily status" display,
  // and compute completionStatus separately for ack logic.
  const dwStatus = norm(it?.status);

  const rev = normLower(it?.reviewStatus) || "pending";

  const athleteName = resolveAthleteName(it, norm);
  const athleteEmail = resolveAthleteEmail(it, norm);

  const uploads = safeCount(it?.attachments);

  const ack = Boolean(it?.athleteAcknowledged);
  const ackAtRaw = norm(it?.athleteAcknowledgedAt || "");
  const ackAt = ackAtRaw ? fmtMaybe(fmtDate, ackAtRaw) : "";

  // Completion status (WorkoutCompletions.Status) if included by API
  const completionStatus = normLower(it?.status || it?.completionStatus || it?.Status);

  const showAck = shouldShowAck({ reviewStatus: rev, completionStatus });
  const rowAccent = getRowAccent(rev);

  const createdAt = it?.createdAt ? fmtMaybe(fmtDate, it.createdAt) : "—";

  const attachmentSummary =
    it?.attachmentSummary ? String(it.attachmentSummary) : uploads ? "Uploads attached" : "No upload summary";

  return {
    id,
    title,
    date,
    dwStatus,
    rev,
    athleteName,
    athleteEmail,
    uploads,
    ack,
    ackAt,
    showAck,
    rowAccent,
    createdAt,
    attachmentSummary,
    raw: it,
  };
}
