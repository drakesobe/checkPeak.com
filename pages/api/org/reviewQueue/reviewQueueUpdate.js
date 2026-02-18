// pages/api/org/reviewQueue/reviewQueueUpdate.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";
import { requireActiveOrgSubscription } from "@/lib/requireActiveOrgSubscription";

/* ---------------- helpers ---------------- */

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function asString(v) {
  return String(v ?? "").trim();
}

function toLowerStr(v) {
  return asString(v).toLowerCase();
}

function normalizeIdArray(v) {
  return safeArray(v)
    .map((x) => {
      if (!x) return "";
      if (typeof x === "string") return x.trim();
      if (typeof x === "object" && x.id) return String(x.id).trim();
      return String(x).trim();
    })
    .filter(Boolean);
}

function firstFromLookup(v) {
  if (Array.isArray(v)) return String(v?.[0] ?? "").trim();
  return String(v ?? "").trim();
}

// Escape for Airtable formula string literals (double-quoted)
function esc(str = "") {
  return String(str).replace(/\\/g, "\\\\").replace(/"/g, '\\"').trim();
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function normalizeCompletionStatusForAirtable(nextUiStatus) {
  // UI sends: "approved" | "needs_info" | "pending"
  // Airtable WorkoutCompletions wants: "completed" | "rejected" | "pending_review"
  const s = toLowerStr(nextUiStatus);
  if (s === "approved") return "completed";
  if (s === "needs_info") return "rejected";
  if (s === "pending") return "pending_review";
  return "";
}

function normalizeItemStatus(v) {
  const s = toLowerStr(v);
  if (s === "completed") return "completed";
  if (s === "pending_review") return "pending_review";
  if (s === "rejected") return "rejected";
  return "assigned";
}

function deriveDailyWorkoutStatus(itemStatuses = []) {
  const statuses = (itemStatuses || []).map(normalizeItemStatus);
  if (statuses.includes("rejected")) return "rejected";
  if (statuses.includes("pending_review")) return "pending_review";
  if (statuses.length > 0 && statuses.every((s) => s === "completed")) return "completed";
  return "assigned";
}

/* ---------------- env ---------------- */

function missingEnv() {
  return {
    DAILYWORKOUTS_API_KEY: !process.env.DAILYWORKOUTS_API_KEY,
    DAILYWORKOUTS_BASE_ID: !process.env.DAILYWORKOUTS_BASE_ID,
  };
}

function anyMissing(m) {
  return Object.values(m).some(Boolean);
}

function getTable(base, envKey, fallbackName) {
  const idOrName = process.env[envKey];
  return base(idOrName || fallbackName);
}

/* ---------------- cascade helpers ---------------- */

async function recomputeAndUpdateDailyWorkoutStatus({ base, dailyWorkoutId }) {
  if (!dailyWorkoutId) return { updated: false, status: "" };

  const dw = await base("DailyWorkouts").find(dailyWorkoutId);
  const itemIds = safeArray(dw?.fields?.WorkoutItems).map(String).filter(Boolean);

  if (!itemIds.length) {
    await base("DailyWorkouts").update([{ id: dailyWorkoutId, fields: { Status: "assigned" } }]);
    return { updated: true, status: "assigned" };
  }

  const orFormula = `OR(${itemIds.map((id) => `RECORD_ID()='${String(id).replace(/'/g, "\\'")}'`).join(",")})`;

  const itemRecords = await base("WorkoutItems")
    .select({ filterByFormula: orFormula, fields: ["Status"], pageSize: 100 })
    .all();

  const statuses = (itemRecords || []).map((r) => r?.fields?.Status || "assigned");
  const next = deriveDailyWorkoutStatus(statuses);

  await base("DailyWorkouts").update([{ id: dailyWorkoutId, fields: { Status: next } }]);
  return { updated: true, status: next };
}

/* ---------------- handler ---------------- */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const missing = missingEnv();
  if (anyMissing(missing)) {
    return res.status(500).json({
      error: "Airtable env vars missing (DailyWorkouts base).",
      missing,
      debug: { cwd: process.cwd?.() || "" },
    });
  }

  try {
    const auth = requireOrg(req);
    if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

    // ✅ HARD GATE: subscription check
    const sub = await requireActiveOrgSubscription(req, res, auth);
    if (!sub) return;

    const orgToken = asString(auth?.org?.token || auth?.token || "");
    const orgId = asString(auth?.org?.id || "");

    if (!orgToken && !orgId) {
      return res.status(401).json({ error: "Unauthorized (missing org token/id)." });
    }

    const body = req.body || {};
    const recordId = asString(body?.id || "");
    if (!recordId) return res.status(400).json({ error: "Missing id." });

    // UI sends either { reviewStatus } or { status }
    const incomingStatus = body?.reviewStatus ?? body?.status;
    const nextUi = toLowerStr(incomingStatus);

    const allowedUi = new Set(["pending", "approved", "needs_info"]);
    if (!allowedUi.has(nextUi)) return res.status(400).json({ error: "Invalid status." });

    // UI sends either { reviewedNotes } or legacy { coachNotes }
    const incomingNotes =
      typeof body?.reviewedNotes === "string"
        ? body.reviewedNotes
        : typeof body?.coachNotes === "string"
        ? body.coachNotes
        : "";

    const reviewNote = asString(incomingNotes);

    // needs_info requires a note
    if (nextUi === "needs_info" && reviewNote.length < 3) {
      return res.status(400).json({ error: "ReviewNote is required for Needs Info." });
    }

    const nextCompletionStatus = normalizeCompletionStatusForAirtable(nextUi);
    if (!nextCompletionStatus) return res.status(400).json({ error: "Invalid mapping for status." });

    const base = new Airtable({ apiKey: process.env.DAILYWORKOUTS_API_KEY }).base(process.env.DAILYWORKOUTS_BASE_ID);

    const WorkoutCompletions = getTable(base, "WORKOUTCOMPLETIONS_TABLE_ID", "WorkoutCompletions");
    const WorkoutItems = getTable(base, "WORKOUTITEMS_TABLE_ID", "WorkoutItems");
    const DailyWorkouts = getTable(base, "DAILYWORKOUTS_TABLE_ID", "DailyWorkouts");
    const OrgMembers = getTable(base, "ORGMEMBERS_TABLE_ID", "OrgMembers");

    // Load completion
    const completion = await WorkoutCompletions.find(recordId);
    const cf = completion?.fields || {};

    // Ownership check: prefer OrgToken lookup, fallback to Organization linked ids
    const recOrgToken = firstFromLookup(cf?.OrgToken);
    let owns = false;

    if (orgToken && recOrgToken) owns = asString(recOrgToken) === orgToken;

    if (!owns && orgId) {
      const orgLinks = normalizeIdArray(cf?.Organization);
      owns = orgLinks.includes(orgId);
    }

    if (!owns) return res.status(403).json({ error: "Forbidden." });

    // Reviewer: try to set ReviewedBy (linked to OrgMembers)
    // We'll attempt:
    // - auth.user.memberId / auth.user.OrgMemberId / auth.user.id (if it’s an OrgMembers rec id)
    // - else find OrgMembers by Email
    let reviewedByLinkId = asString(
      auth?.user?.memberId ||
        auth?.user?.MemberId ||
        auth?.user?.OrgMemberId ||
        auth?.user?.orgMemberId ||
        ""
    );

    const reviewerEmail = asString(auth?.user?.Email || auth?.user?.email || auth?.org?.email || "");
    const reviewerName = asString(auth?.user?.Name || auth?.user?.name || auth?.org?.name || "");

    // If we don't have a memberId but we do have email, try lookup in OrgMembers
    if (!reviewedByLinkId && reviewerEmail) {
      try {
        const emailSafe = esc(reviewerEmail.toLowerCase());
        const orgIdSafe = esc(orgId);

        // If OrgMembers has Organization link, this keeps it scoped.
        // If not, it still tries by email.
        const formula = orgId
          ? `AND(LOWER({Email}&"")="${emailSafe}", FIND("${orgIdSafe}", ARRAYJOIN({Organization}&""))>0)`
          : `LOWER({Email}&"")="${emailSafe}"`;

        const rows = await OrgMembers.select({ maxRecords: 1, filterByFormula: formula }).firstPage();
        reviewedByLinkId = asString(rows?.[0]?.id || "");
      } catch {
        // ignore
      }
    }

    const updates = {
      Status: nextCompletionStatus,
      // ReviewNote is your long text field on WorkoutCompletions
      ReviewNote: nextUi === "needs_info" ? reviewNote : "",
      ...(reviewedByLinkId ? { ReviewedBy: [reviewedByLinkId] } : {}),
    };

    const updated = await WorkoutCompletions.update(recordId, updates);

    // ---- Cascade: update WorkoutItems.Status ----
    const workoutItemId = asString(safeArray(cf?.WorkoutItem)?.[0] || "");
    if (workoutItemId) {
      await WorkoutItems.update([{ id: workoutItemId, fields: { Status: nextCompletionStatus } }]);
    }

    // ---- Cascade: recompute DailyWorkouts.Status ----
    // Prefer to infer DailyWorkout via WorkoutItems.DailyWorkout link
    let dailyWorkoutId = "";
    try {
      if (workoutItemId) {
        const wi = await WorkoutItems.find(workoutItemId);
        dailyWorkoutId = asString(safeArray(wi?.fields?.DailyWorkout)?.[0] || "");
      }
    } catch {
      dailyWorkoutId = "";
    }

    let daily = { updated: false, status: "" };
    try {
      if (dailyWorkoutId) {
        // ensure DailyWorkouts table exists (used in helper)
        // helper uses base("DailyWorkouts") directly; keep that name stable
        // If your table name isn't "DailyWorkouts", set DAILYWORKOUTS_TABLE_ID to the correct one
        daily = await recomputeAndUpdateDailyWorkoutStatus({ base, dailyWorkoutId });
      }
    } catch (e) {
      console.error("[reviewQueueUpdate] DailyWorkouts recompute failed:", e);
    }

    return res.status(200).json({
      ok: true,
      id: updated.id,
      uiStatus: nextUi,
      status: nextCompletionStatus,
      reviewNote: updates.ReviewNote || "",
      reviewedBy: reviewedByLinkId || (reviewerEmail || reviewerName || ""),
      cascades: {
        workoutItemUpdated: Boolean(workoutItemId),
        dailyWorkoutUpdated: Boolean(dailyWorkoutId && daily?.updated),
        dailyWorkoutStatus: daily?.status || "",
      },
      billingGate: {
        status: sub?.status || "",
        trialEnds: sub?.trialEnds || "",
      },
    });
  } catch (err) {
    console.error("[reviewQueueUpdate] error:", err);
    const status = err?.statusCode || err?.status || 500;

    if (status === 422) {
      return res.status(500).json({
        error: err?.message || "Airtable rejected a value (check field types).",
        details: {
          statusCode: err?.statusCode,
          airtableError: err?.error,
          message: err?.message,
        },
      });
    }

    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
