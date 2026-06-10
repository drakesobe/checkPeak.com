// pages/api/org/getPlanTemplates.js
// GET — returns all plan templates for this org.

import { supabaseAdmin as db } from "@/lib/supabase";
import { requireOrg } from "@/lib/requireOrg";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req);
  const headerToken = req.headers["x-org-token"];
  const queryToken  = req.query?.token;
  const cookieToken = auth?.ok ? String(auth?.org?.token || "").trim() : "";
  const orgToken    = cookieToken || String(headerToken || queryToken || "").trim();

  if (!orgToken) {
    return res.status(401).json({
      error: "Missing organization token. Log in (cookie auth) or provide x-org-token / ?token=.",
    });
  }

  try {
    const { data: records, error } = await db
      .from("plan_templates")
      .select("id, name, structured, created_by, status, notes, tags, created_at")
      .eq("org_token", orgToken)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;

    const templates = (records || []).map(r => {
      const tagsRaw = r.tags || "";
      const tags = typeof tagsRaw === "string"
        ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean)
        : Array.isArray(tagsRaw) ? tagsRaw : [];

      return {
        id:         r.id,
        name:       r.name        || "Template",
        structured: r.structured  || null,
        createdBy:  r.created_by  || "",
        status:     r.status      || "Active",
        notes:      r.notes       || "",
        tags,
        createdAt:  r.created_at  || "",
      };
    });

    return res.status(200).json({
      ok:        true,
      authMode:  cookieToken ? "cookie" : "token",
      templates,
    });
  } catch (err) {
    console.error("[getPlanTemplates] error:", err);
    return res.status(500).json({ error: "Failed to load plan templates", detail: err?.message });
  }
}
