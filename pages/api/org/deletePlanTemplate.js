// pages/api/org/deletePlanTemplate.js
// DELETE { templateId } - deletes a plan template, verifying org ownership.

import { supabaseAdmin as db } from "@/lib/supabase";
import { requireOrg } from "@/lib/requireOrg";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req);
  if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

  const orgToken   = String(auth?.org?.token || "").trim();
  const body       = req.body && typeof req.body === "object" ? req.body : {};
  const templateId = String(body.templateId || req.query?.templateId || "").trim();

  if (!templateId) return res.status(400).json({ error: "Missing templateId" });

  try {
    // Verify ownership before deleting
    const { data: record, error: fetchErr } = await db
      .from("plan_templates")
      .select("id, org_token")
      .eq("id", templateId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!record) return res.status(404).json({ error: "Template not found." });
    if (record.org_token !== orgToken) {
      return res.status(403).json({ error: "Forbidden: template does not belong to your organization." });
    }

    const { error: deleteErr } = await db
      .from("plan_templates")
      .delete()
      .eq("id", templateId);

    if (deleteErr) throw deleteErr;

    return res.status(200).json({ ok: true, deleted: { id: templateId } });
  } catch (err) {
    console.error("[deletePlanTemplate] error:", err);
    return res.status(500).json({ error: "Failed to delete plan template", detail: err?.message });
  }
}
