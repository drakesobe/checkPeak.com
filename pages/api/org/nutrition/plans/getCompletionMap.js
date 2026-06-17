// pages/api/org/nutrition/plans/getCompletionMap.js
// GET ?status=active|all - returns set of athlete_tokens that have nutrition plans.

import { supabaseAdmin as db } from "@/lib/supabase";
import { requireOrg } from "@/lib/requireOrg";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req);
  if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

  const status = String(req.query?.status || "active").trim().toLowerCase();

  try {
    let query = db
      .from("nutrition_plans")
      .select("athlete_token, status");

    if (status !== "all") {
      query = query.eq("status", "active");
    }

    const { data: records, error } = await query;
    if (error) throw error;

    const doneTokens = new Set();
    for (const r of records || []) {
      const t = String(r.athlete_token || "").trim();
      if (t) doneTokens.add(t);
    }

    return res.status(200).json({
      ok:         true,
      doneTokens: Array.from(doneTokens),
      debug: {
        statusMode:  status,
        countRecords: records?.length || 0,
        countTokens:  doneTokens.size,
      },
    });
  } catch (err) {
    console.error("[nutrition/plans/getCompletionMap] error:", err);
    return res.status(500).json({ error: "Failed to build completion map", detail: err?.message });
  }
}
