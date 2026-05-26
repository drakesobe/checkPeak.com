// pages/api/commercial/trainers.js
// Public — no auth required. Returns all trainer profiles for the browse page.

import { getPublicTrainers } from "@/lib/commercial/airtable";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  try {
    const trainers = await getPublicTrainers();
    return res.status(200).json({ trainers });
  } catch (err) {
    console.error("[trainers] fetch failed:", err);
    return res.status(500).json({ error: "Failed to load trainers." });
  }
}