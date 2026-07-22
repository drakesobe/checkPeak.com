// pages/api/commercial/workout-programs.js
// CRUD for a trainer's published workout programs.

import { getRequestUser } from "@/lib/commercial/getRequestUser";
import {
  getTrainerByUserId,
  getWorkoutsByTrainer,
  createWorkout,
  updateWorkout,
  deleteWorkout,
} from "@/lib/commercial/db";

function normalizePrice(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function airtableError(record) {
  if (record?.error) {
    const e = record.error;
    return typeof e === "string" ? e : (e.message || "Airtable request failed");
  }
  if (!record?.id) return "Airtable returned no record id";
  return null;
}

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
    const { title, description, exercises, tier, tags, price, duration } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "Title required" });
    if (!["Basic", "Premium", "Ultra", "One-Time"].includes(tier))
      return res.status(400).json({ error: "Invalid tier" });
    if (tier === "One-Time" && !normalizePrice(price))
      return res.status(400).json({ error: "A price is required for One-Time workouts" });

    const fields = {
      trainerId,
      title:       title.trim(),
      description: description ?? "",
      exercises:   JSON.stringify(Array.isArray(exercises) ? exercises : []),
      tier,
      tags:        JSON.stringify(tags ?? {}),
      published:   false,
    };
    const priceVal = normalizePrice(price);
    if (priceVal !== null) fields.price = priceVal;
    const durVal = duration != null && duration !== "" ? Math.max(1, Number(duration) || 0) : null;
    if (durVal) fields.duration = durVal;

    const record = await createWorkout(fields);
    const err = airtableError(record);
    if (err) {
      console.error("[workout-programs POST] create failed:", err);
      return res.status(502).json({ error: `Could not create workout: ${err}` });
    }
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
    if (req.body.price       !== undefined) fields.price       = normalizePrice(req.body.price);
    if (req.body.duration    !== undefined) fields.duration    = req.body.duration != null && req.body.duration !== "" ? Math.max(1, Number(req.body.duration) || 0) : null;
    if (req.body.exercises   !== undefined) {
      fields.exercises = JSON.stringify(
        Array.isArray(req.body.exercises) ? req.body.exercises : []
      );
    }

    const updated = await updateWorkout(id, fields);
    const err = airtableError(updated);
    if (err) {
      console.error("[workout-programs PUT] update failed:", err);
      return res.status(502).json({ error: `Could not update workout: ${err}` });
    }
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