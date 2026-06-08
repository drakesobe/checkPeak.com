// pages/api/commercial/athlete-subscriptions.js
// Returns all active subscriptions for the logged-in athlete,
// enriched with trainer name/slug so My Libraries can render without
// extra round trips.

import { getRequestUser }         from "@/lib/commercial/getRequestUser";
import { getSubscriptionsByEmail, getTrainerById } from "@/lib/commercial/db";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const clientEmail = user.email || user.Email;

  try {
    const subs = await getSubscriptionsByEmail(clientEmail);

    // Enrich each subscription with its trainer's name + slug.
    // Athletes typically have < 10 subscriptions, so N+1 is fine here.
    const enriched = await Promise.all(
      subs.map(async (sub) => {
        const trainerId = sub.fields?.trainerId;
        if (!trainerId) return { ...sub, trainer: null };
        const trainer = await getTrainerById(trainerId);
        return { ...sub, trainer: trainer ?? null };
      })
    );

    return res.status(200).json({ subscriptions: enriched });
  } catch (err) {
    console.error("[athlete-subscriptions]", err);
    return res.status(500).json({ error: "Failed to load subscriptions." });
  }
}