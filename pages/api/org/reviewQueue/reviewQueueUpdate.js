// pages/api/org/reviewQueue/reviewQueueUpdate.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";
import { requireActiveOrgSubscription } from "@/lib/requireActiveOrgSubscription";

function missingEnv() {
  return {
    DAILYWORKOUTS_API_KEY: !process.env.DAILYWORKOUTS_API_KEY,
    DAILYWORKOUTS_BASE_ID: !process.env.DAILYWORKOUTS_BASE_ID,
    DAILYWORKOUTS_TABLE_ID: !process.env.DAILYWORKOUTS_TABLE_ID,
  };
}

function anyMissing(m) {
  return Object.values(m).some(Boolean);
}

function normalizeIdArray(v) {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => {
      if (!x) return "";
      if (typeof x === "string") return x.trim();
      if (typeof x === "object" && x.id) return String(x.id).trim();
      return String(x).trim();
    })
    .filter(Boolean);
}

function toLowerStr(v) {
  return String(v || "").trim().toLowerCase();
}

function firstFromLookup(v) {
  if (Array.isArray(v)) return String(v?.[0] ?? "").trim();
  return String(v ?? "").trim();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const missing = missingEnv();
  if (anyMissing(missing)) {
    return res.status(500).json({
      error: "DailyWorkouts Airtable env vars missing.",
      missing,
      debug: { cwd: process.cwd?.() || "" },
    });
  }

  try {
    const auth = requireOrg(req);
    if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

    // ✅ HARD GATE: subscription check (prevents direct API updates when not subscribed)
    const sub = await requireActiveOrgSubscription(req, res, auth);
    if (!sub) return;

    const orgToken = String(auth?.org?.token || auth?.token || "").trim();
    const orgId = String(auth?.org?.id || "").trim();
    if (!orgToken && !orgId) {
      return res.status(401).json({ error: "Unauthorized (missing org token/id)." });
    }

    const body = req.body || {};
    const recordId = String(body?.id || "").trim();

    // Accept either { reviewStatus } or { status }
    const incomingStatus = body?.reviewStatus ?? body?.status;
    const next = toLowerStr(incomingStatus);

    // Accept either { reviewedNotes } or legacy { coachNotes }
    const incomingNotes =
      typeof body?.reviewedNotes === "string"
        ? body.reviewedNotes
        : typeof body?.coachNotes === "string"
        ? body.coachNotes
        : "";

    const reviewedNotes = String(incomingNotes || "").trim();

    const allowed = new Set(["pending", "approved", "needs_info"]);
    if (!recordId) return res.status(400).json({ error: "Missing id." });
    if (!allowed.has(next)) return res.status(400).json({ error: "Invalid reviewStatus." });

    const base = new Airtable({ apiKey: process.env.DAILYWORKOUTS_API_KEY }).base(
      process.env.DAILYWORKOUTS_BASE_ID
    );
    const table = base(process.env.DAILYWORKOUTS_TABLE_ID);

    const existing = await table.find(recordId);

    // Ownership check: prefer OrgToken lookup, fallback to Organization links
    const recOrgToken = firstFromLookup(existing?.fields?.OrgToken);

    let owns = false;
    if (orgToken && recOrgToken) owns = String(recOrgToken).trim() === String(orgToken).trim();

    if (!owns && orgId) {
      const orgLinks = normalizeIdArray(existing?.fields?.Organization);
      owns = orgLinks.includes(orgId);
    }

    if (!owns) return res.status(403).json({ error: "Forbidden." });

    // Reviewer email -> ReviewedByText
    const reviewerEmail = String(auth?.user?.Email || auth?.user?.email || auth?.org?.email || "").trim();
    const reviewerName = String(auth?.user?.Name || auth?.user?.name || auth?.org?.name || "").trim();
    const reviewerText = reviewerEmail || reviewerName || "Coach";

    const updates = {
      ReviewStatus: next,
      ReviewedAt: new Date().toISOString(),
      ReviewedByText: reviewerText, // ✅ your text field (NOT the linked ReviewedBy)
    };

    // ✅ If needs_info, require a message
    if (next === "needs_info") {
      if (!reviewedNotes) return res.status(400).json({ error: "ReviewedNotes is required for Needs Info." });
      updates.ReviewedNotes = reviewedNotes;
    }

    // ✅ For approved: clear notes (optional). Comment out if you want to keep.
    if (next === "approved") {
      updates.ReviewedNotes = "";
    }

    const updated = await table.update(recordId, updates);

    return res.status(200).json({
      ok: true,
      id: updated.id,
      reviewStatus: next,
      reviewedBy: reviewerText,
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
