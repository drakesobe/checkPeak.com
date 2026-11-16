// pages/api/org/athlete/bulk-update.js
// POST { ids: string[], fields: { sport?, phone?, status? } }
// Updates athletes on the coach's own roster. Only whitelisted fields are written, and only
// rows whose org_token matches the signed-in coach's team are touched.

import { requireOrgSideUser } from "@/lib/requireUser";
import { supabaseAdmin as db } from "@/lib/supabase";

const MAX_IDS = 200;

const ALLOWED_FIELDS = {
  sport:  (v) => ({ sport: String(v || "").toLowerCase().trim().slice(0, 60) || null }),
  phone:  (v) => ({ phone: String(v || "").trim().slice(0, 30) || null }),
  status: (v) => ({ status: String(v || "").toLowerCase().trim().slice(0, 30) || "active" }),
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const orgToken = String(user.orgToken || user.org_token || "").trim();
  if (!orgToken) return res.status(400).json({ error: "Your session is missing a team. Please sign in again." });

  const { ids, fields } = req.body || {};
  const idList = [...new Set((Array.isArray(ids) ? ids : []).map((id) => String(id || "").trim()).filter(Boolean))];
  if (!idList.length) return res.status(400).json({ error: "Choose at least one athlete." });
  if (idList.length > MAX_IDS) return res.status(400).json({ error: `Update at most ${MAX_IDS} athletes at a time.` });

  const patch = {};
  for (const [key, value] of Object.entries(fields || {})) {
    if (ALLOWED_FIELDS[key]) Object.assign(patch, ALLOWED_FIELDS[key](value));
  }
  if (!Object.keys(patch).length) {
    return res.status(400).json({ error: `Nothing to update. Allowed fields: ${Object.keys(ALLOWED_FIELDS).join(", ")}` });
  }

  const { data, error } = await db
    .from("athletes")
    .update(patch)
    .in("id", idList)
    .eq("org_token", orgToken)
    .select("id");

  if (error) {
    console.error("[athlete/bulk-update]", error.message);
    return res.status(500).json({ error: "Could not update athletes. Try again." });
  }
  return res.status(200).json({ ok: true, updated: data?.length || 0 });
}
