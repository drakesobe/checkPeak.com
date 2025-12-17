// pages/api/org/getPlanTemplates.js
import { requireOrg } from "@/lib/requireOrg";
import { PLAN_TEMPLATES } from "@/lib/planTemplates";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = requireOrg(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  // Only return safe fields (don’t ship huge internals if you add them later)
  const templates = PLAN_TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    structured: t.structured, // keep for now (used by builder)
  }));

  return res.status(200).json({ templates });
}
