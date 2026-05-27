// pages/api/commercial/workout-programs.js
// CRUD for a trainer's published workout programs.
// GET    — list all workouts for this trainer
// POST   — create new workout
// PUT    — update workout (id in query)
// DELETE — delete workout (id in query)

import { getRequestUser } from "@/lib/commercial/getRequestUser";
import {
  getTrainerByUserId,
  getWorkoutsByTrainer,
  createWorkout,
  updateWorkout,
  deleteWorkout,
} from "@/lib/commercial/airtable";

export default async function handler(req, res) {
  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const trainer = await getTrainerByUserId(user.email || user.Email);
  if (!trainer) return res.status(403).json({ error: "No trainer profile" });

  const trainerId = trainer.id;

  if (req.method === "GET") {
    const workouts = await getWorkoutsByTrainer(trainerId);
    return res.status(200).json({ workouts });
  }

  if (req.method === "POST") {
    const { title, description, exercises, tier, tags } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "Title required" });
    if (!["Basic", "Premium", "Ultra"].includes(tier))
      return res.status(400).json({ error: "Invalid tier" });

    const record = await createWorkout({
      trainerId,
      title:       title.trim(),
      description: description ?? "",
      exercises:   JSON.stringify(Array.isArray(exercises) ? exercises : []),
      tier,
      tags:        JSON.stringify(tags ?? {}),
      published:   false,
    });
    return res.status(201).json({ workout: record });
  }

  if (req.method === "PUT") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Missing workout id" });

    const fields = {};
    if (req.body.title       !== undefined) fields.title       = String(req.body.title).trim();
    if (req.body.description !== undefined) fields.description = req.body.description;
    if (req.body.tier        !== undefined) fields.tier        = req.body.tier;
    if (req.body.published   !== undefined) fields.published   = Boolean(req.body.published);
    if (req.body.tags        !== undefined) fields.tags        = JSON.stringify(req.body.tags);
    if (req.body.exercises   !== undefined) {
      fields.exercises = JSON.stringify(
        Array.isArray(req.body.exercises) ? req.body.exercises : []
      );
    }

    const updated = await updateWorkout(id, fields);
    return res.status(200).json({ workout: updated });
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Missing workout id" });
    await deleteWorkout(id);
    return res.status(200).json({ deleted: true });
  }

  return res.status(405).end();
}