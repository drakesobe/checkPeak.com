// pages/api/admin/backfill/debugReviewQueue.js
// GET ?secret=xxx  - diagnoses why workout completions aren't showing in review queue

import { supabaseAdmin as db } from "@/lib/supabase";
import { requireOrg } from "@/lib/requireOrg";

const BACKFILL_SECRET = process.env.BACKFILL_SECRET || "";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const secret = String(req.query?.secret || "").trim();
  if (!secret || secret !== BACKFILL_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const auth = requireOrg(req);
  const sessionOrgId    = String(auth?.org?.id || "").trim();
  const sessionOrgToken = String(auth?.org?.token || "").trim().toUpperCase();

  // Resolve org UUID
  let orgId = sessionOrgId;
  if (!orgId && sessionOrgToken) {
    const { data: orgRow } = await db.from("organizations").select("id, token").eq("token", sessionOrgToken).maybeSingle();
    orgId = orgRow?.id || "";
  }

  // 1. Total workout_completions
  const { count: totalCompletions } = await db.from("workout_completions").select("*", { count: "exact", head: true });

  // 2. Completions with evidence
  const { count: withEvidence } = await db.from("completion_evidence").select("*", { count: "exact", head: true });

  // 3. Sample of completion_evidence rows
  const { data: evidenceSample } = await db.from("completion_evidence").select("id, workout_completion_id, url, evidence_type").limit(5);

  // 4. Sample completions with their workout_item_id
  const { data: completionSample } = await db.from("workout_completions")
    .select("id, org_id, workout_item_id, status, airtable_id")
    .limit(10);

  // 5. Check if any completion's workout_item_id resolves to a workout_item
  const sampleWorkoutItemIds = (completionSample || []).map(c => c.workout_item_id).filter(Boolean);
  let workoutItemsFound = [];
  if (sampleWorkoutItemIds.length) {
    const { data } = await db.from("workout_items")
      .select("id, evidence_required, daily_workout_id")
      .in("id", sampleWorkoutItemIds);
    workoutItemsFound = data || [];
  }

  // 6. Check daily_workouts with this org's org_id
  const { count: dailyWorkoutsForOrg } = orgId
    ? await db.from("daily_workouts").select("*", { count: "exact", head: true }).eq("org_id", orgId)
    : { count: 0 };

  // 7. Try the nested filter directly and see how many rows come back
  let nestedFilterResult = null;
  if (orgId) {
    const { data, error } = await db
      .from("workout_completions")
      .select(`
        id, status,
        workout_item:workout_items!inner (
          id, evidence_required,
          daily_workout:daily_workouts!inner ( id, org_id )
        )
      `)
      .filter("workout_item.daily_workout.org_id", "eq", orgId)
      .limit(5);
    nestedFilterResult = { rows: data?.length ?? 0, error: error?.message || null, sample: data?.slice(0, 3) };
  }

  // 8. evidence joined to completion → check if we can see them
  const { data: evidenceWithCompletion } = await db
    .from("completion_evidence")
    .select("id, url, workout_completion_id, workout_completion:workout_completions(id, org_id, workout_item_id, status)")
    .limit(5);

  return res.status(200).json({
    session: { orgId, sessionOrgId, sessionOrgToken, authOk: auth?.ok },
    totalCompletions,
    withEvidence,
    evidenceSample,
    completionSample,
    workoutItemsFound,
    dailyWorkoutsForOrg,
    nestedFilterResult,
    evidenceWithCompletion,
  });
}
