// pages/api/org/reviewQueueUpdate.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

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
  // Airtable linked fields usually come back as:
  // - array of recordId strings: ["rec123", "rec456"]
  // - sometimes array of objects (rare in REST): [{id:"rec123"}]
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

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

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
    // ✅ cookie session → org-side auth
    const auth = requireOrg(req);
    if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

    // ✅ Organizations record id (recXXXX...) from cookie
    const orgId = String(auth?.org?.id || "").trim();
    if (!orgId) return res.status(401).json({ error: "Unauthorized (missing orgId)." });

    const { id, reviewStatus, coachNotes } = req.body || {};
    const recordId = String(id || "").trim();
    const next = String(reviewStatus || "").trim().toLowerCase();

    const allowed = new Set(["pending", "approved", "needs_info"]);
    if (!recordId) return res.status(400).json({ error: "Missing id." });
    if (!allowed.has(next)) return res.status(400).json({ error: "Invalid reviewStatus." });

    const base = new Airtable({ apiKey: process.env.DAILYWORKOUTS_API_KEY }).base(
      process.env.DAILYWORKOUTS_BASE_ID
    );
    const table = base(process.env.DAILYWORKOUTS_TABLE_ID);

    // ✅ Safety: verify this DailyWorkout belongs to org
    const existing = await table.find(recordId);
    const orgLinks = normalizeIdArray(existing?.fields?.Organization);

    const owns = orgLinks.includes(orgId);
    if (!owns) return res.status(403).json({ error: "Forbidden." });

    // ReviewedBy: prefer member identity (trainer/admin), else org account email/name
    const reviewerEmail = String(auth?.user?.Email || auth?.user?.email || auth?.org?.email || "").trim();
    const reviewerName = String(auth?.user?.Name || auth?.user?.name || auth?.org?.name || "Coach").trim();

    // NOTE: These fields must exist in Airtable to be written:
    // - ReviewStatus (single select: pending | approved | needs_info)
    // - ReviewedAt (date)
    // - ReviewedBy (single line OR link to OrgMembers if you prefer)
    // - CoachNotes (long text) optional
    const updates = {
      ReviewStatus: next,
      ReviewedAt: new Date().toISOString(),
      ReviewedBy: reviewerEmail || reviewerName,
    };

    if (typeof coachNotes === "string" && coachNotes.trim()) {
      updates.CoachNotes = coachNotes.trim();
    }

    const updated = await table.update(recordId, updates);

    return res.status(200).json({
      ok: true,
      id: updated.id,
      reviewStatus: next,
    });
  } catch (err) {
    console.error("[reviewQueueUpdate] error:", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
