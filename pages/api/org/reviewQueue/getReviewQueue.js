// pages/api/org/getReviewQueue.js
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

function pick(fields, keys, fallback = "") {
  for (const k of keys) {
    const v = fields?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return fallback;
}

// Airtable formula string safety for quotes
function escapeFormulaString(str = "") {
  return String(str).replace(/"/g, '\\"');
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
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

    const base = new Airtable({ apiKey: process.env.DAILYWORKOUTS_API_KEY }).base(
      process.env.DAILYWORKOUTS_BASE_ID
    );

    const table = base(process.env.DAILYWORKOUTS_TABLE_ID);

    // Queue definition:
    // - completed daily workouts
    // - has attachments OR attachment summary
    // - ReviewStatus blank OR pending
    // - belongs to org (Organization linked contains org recordId)
    const orgIdSafe = escapeFormulaString(orgId);

    const filterByFormula = `AND(
      {Status}="completed",
      OR(COUNTA({Attachments})>0, LEN({Attachment Summary})>0),
      OR({ReviewStatus}="", {ReviewStatus}=BLANK(), {ReviewStatus}="pending"),
      FIND("${orgIdSafe}", ARRAYJOIN({Organization}))>0
    )`;

    const records = await table
      .select({
        pageSize: 100,
        filterByFormula,
      })
      .all();

    const items = records.map((r) => {
      const f = r.fields || {};
      return {
        id: r.id,
        title: pick(f, ["Title"], "Daily Workout"),
        date: pick(f, ["Date"], ""),
        status: pick(f, ["Status"], ""),
        reviewStatus: String(pick(f, ["ReviewStatus"], "pending")).toLowerCase(),
        attachmentSummary: pick(f, ["Attachment Summary"], ""),
        attachments: f?.Attachments || [],
        athlete: f?.Athlete || [],
        createdBy: f?.CreatedBy || [],
        workoutItems: f?.WorkoutItems || [],
        createdAt: r?._rawJson?.createdTime || "",
      };
    });

    return res.status(200).json({ items });
  } catch (err) {
    console.error("[getReviewQueue] error:", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
