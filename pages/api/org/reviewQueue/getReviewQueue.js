// pages/api/org/reviewQueue/getReviewQueue.js
// GET - fetches workout completions (Supabase) + class attendance (Supabase/Airtable),
// merges them into a single list sorted by date desc.

import { requireOrg } from "@/lib/requireOrg";
import { requireActiveOrgSubscription } from "@/lib/requireActiveOrgSubscription";
import { readUserFromRequest } from "@/lib/requireUser";
import { resolveOrgId, loadReviewQueueItems } from "@/lib/org/reviewQueueData";

function asString(v) { return String(v ?? "").trim(); }

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    let orgToken = "";
    let orgId    = "";

    // Mobile path: _authUser in query bypasses requireOrg + subscription check
    const mobileSession = req.query._authUser ? readUserFromRequest(req) : null;
    if (mobileSession) {
      orgToken = asString(mobileSession.Token || mobileSession.org_token || "").toUpperCase();
      if (!orgToken) return res.status(401).json({ error: "Unauthorized" });
      orgId = await resolveOrgId({ org: { id: "", token: orgToken } });
    } else {
      const auth = requireOrg(req);
      if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

      const sub = await requireActiveOrgSubscription(req, res, auth);
      if (!sub) return;

      orgToken = asString(auth?.org?.token || "");
      orgId    = await resolveOrgId(auth);
    }

    if (!orgId && !orgToken) return res.status(401).json({ error: "Unauthorized (missing org id/token)." });

    const items = await loadReviewQueueItems({ orgId, orgToken });
    return res.status(200).json({ items });
  } catch (err) {
    console.error("[getReviewQueue]", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
