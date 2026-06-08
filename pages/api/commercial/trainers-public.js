// pages/api/commercial/trainers-public.js
// Public endpoint — no auth required.
// Returns all trainer profiles that have a slug set.
// Used by /trainers marketplace page.

import Airtable from "airtable";

export default async function handler(req, res) {
  // Cache for 60s on CDN, serve stale for up to 5 min while revalidating
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

  if (req.method !== "GET") return res.status(405).end();

  const base = new Airtable({ apiKey: process.env.COMMERCIAL_TRAINERS_API_KEY })
    .base(process.env.COMMERCIAL_TRAINERS_BASE_ID);

  try {
    const records = await base(process.env.COMMERCIAL_TRAINERS_TABLE_ID)
      .select({ filterByFormula: `NOT({slug}="")` })
      .all();

    // Only expose public-safe fields — never userId or internal data
    const trainers = records.map(r => ({
      id: r.id,
      fields: {
        name:              r.fields.name              ?? "",
        slug:              r.fields.slug              ?? "",
        specialty:         r.fields.specialty         ?? "",
        bio:               r.fields.bio               ?? "",
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