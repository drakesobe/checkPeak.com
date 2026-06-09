// pages/api/commercial/trainer-workouts-public.js
// Public - no auth needed. Returns subscription workouts for a trainer by slug.

import { getTrainerBySlug, getWorkoutsByTrainer } from "@/lib/commercial/db";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: "Missing slug" });

  const record = await getTrainerBySlug(slug);
  if (!record) return res.status(404).json({ error: "Trainer not found" });

  const allWorkouts = await getWorkoutsByTrainer(record.id, { publishedOnly: true }).catch(() => []);

  const workouts = allWorkouts.map(w => ({ id: w.id, fields: w.fields ?? {} }));

  const pricedWorkouts = workouts
    .filter(w => Number(w.fields?.price) > 0)
    .map(w => ({ id: w.id, fields: { title: w.fields.title, tier: w.fields.tier, price: w.fields.price, description: w.fields.description } }));

  return res.status(200).json({ workouts, pricedWorkouts });
}
