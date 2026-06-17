// pages/api/commercial/trainers-public.js
// Public endpoint - no auth required.
// Returns all trainer profiles that have a slug set.
// Used by /trainers marketplace page.

import { getPublicTrainers } from "@/lib/commercial/db";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

  if (req.method !== "GET") return res.status(405).end();

  try {
    const records = await getPublicTrainers();

    const trainers = records
      .filter(r => r.fields?.slug)
      .map(r => ({
        id: r.id,
        fields: {
          name:              r.fields.name              ?? "",
          slug:              r.fields.slug              ?? "",
          specialty:         r.fields.specialty         ?? "",
          bio:               r.fields.bio               ?? "",
          photoUrl:          r.fields.photoUrl          ?? null,
          basicPrice:        r.fields.basicPrice        ?? null,
          premiumPrice:      r.fields.premiumPrice      ?? null,
          ultraPrice:        r.fields.ultraPrice        ?? null,
          activeClientCount: r.fields.activeClientCount ?? 0,
          libraryLocked:     r.fields.libraryLocked     ?? false,
        },
      }));

    return res.json({ ok: true, trainers });
  } catch (err) {
    console.error("[trainers-public]", err);
    return res.status(500).json({ ok: false, error: "Failed to fetch trainers" });
  }
}
