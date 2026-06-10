// pages/api/org/createPlanTemplate.js
// POST { templateName, structured, createdBy?, notes?, status?, tags? }
// Creates a nutrition plan template for this org in Supabase.

import { supabaseAdmin as db } from "@/lib/supabase";
import { requireOrg } from "@/lib/requireOrg";

function asString(v) { return String(v ?? "").trim(); }

function normalizeTagsToString(input) {
  if (!input) return "";
  if (Array.isArray(input)) {
    return input.map(t => {
      if (t == null) return "";
      if (typeof t === "string") return t.trim();
      if (typeof t === "object") return String(t.label || t.value || t.name || "").trim();
      return String(t).trim();
    }).filter(Boolean).join(", ");
  }
  if (typeof input === "string") return input.trim();
  return String(input).trim();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req);
  const headerToken = asString(req.headers["x-org-token"]);
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const bodyToken = asString(body.token);
  const cookieToken = auth?.ok ? asString(auth?.org?.token || "") : "";
  const orgToken = cookieToken || headerToken || bodyToken;

  if (!orgToken) {
    return res.status(401).json({
      error: "Missing organization token. Log in (cookie auth) or provide x-org-token / body.token.",
    });
  }

  const name       = asString(body.templateName);
  const creator    = asString(body.createdBy);
  const notes      = asString(body.notes);
  const status     = asString(body.status || "Active") || "Active";
  const structured = body.structured;
  const tags       = normalizeTagsToString(body.tags);

  if (!name) return res.status(400).json({ error: "Missing templateName" });
  if (!structured || typeof structured !== "object") {
    return res.status(400).json({ error: "Missing structured plan object" });
  }

  try {
    const { data: record, error } = await db
      .from("plan_templates")
      .insert({
        org_token:  orgToken,
        name,
        structured,
        created_by: creator || null,
        status,
        notes:      notes || null,
        tags:       tags  || null,
        created_at: new Date().toISOString(),
      })
      .select("id, name, status, tags, org_token")
      .single();

    if (error) throw error;

    return res.status(200).json({
      ok:       true,
      template: {
        id:       record.id,
        name:     record.name,
        status:   record.status,
        tags:     record.tags || "",
        orgToken: record.org_token,
      },
      debug: { authMode: cookieToken ? "cookie" : "token" },
    });
  } catch (err) {
    console.error("[createPlanTemplate] error:", err);
    return res.status(500).json({ error: "Failed to create plan template", detail: err?.message });
  }
}
