// pages/api/commercial/nutrition-plans.js
// CRUD for a trainer's nutrition plan templates.

import { getRequestUser } from "@/lib/commercial/getRequestUser";
import {
  getTrainerByUserId,
  getNutritionPlansByTrainer,
  createNutritionPlan,
  updateNutritionPlan,
  deleteNutritionPlan,
} from "@/lib/commercial/db";

export default async function handler(req, res) {
  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const trainer = await getTrainerByUserId(user.email || user.Email);
  if (!trainer) return res.status(403).json({ error: "No trainer profile" });

  const trainerId = trainer.id;

  if (req.method === "GET") {
    const plans = await getNutritionPlansByTrainer(trainerId);
    return res.status(200).json({ plans });
  }

  if (req.method === "POST") {
    const { title, description, tier, phase, planJson, prescription } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "Title required" });
    if (!["Basic", "Premium", "Ultra"].includes(tier))
      return res.status(400).json({ error: "Invalid tier" });

    const record = await createNutritionPlan({
      trainerId,
      title:        title.trim(),
      description:  description ?? "",
      tier,
      phase:        phase ?? "Maintain",
      planJson:     planJson ?? {},
      prescription: prescription ?? "",
      published:    false,
    });
    if (record?.error) return res.status(502).json({ error: "Could not create plan" });
    return res.status(201).json({ plan: record });
  }

  if (req.method === "PUT") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Missing plan id" });

    const fields = {};
    const allow = ["title", "description", "tier", "phase", "published", "planJson", "prescription"];
    for (const key of allow) {
      if (req.body[key] !== undefined) {
        if (key === "published") fields[key] = Boolean(req.body[key]);
        else fields[key] = req.body[key];
      }
    }
    if (fields.title) fields.title = String(fields.title).trim();

    const updated = await updateNutritionPlan(id, fields);
    if (updated?.error) return res.status(502).json({ error: "Could not update plan" });
    return res.status(200).json({ plan: updated });
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Missing plan id" });
    await deleteNutritionPlan(id);
    return res.status(200).json({ deleted: true });
  }

  return res.status(405).end();
}
