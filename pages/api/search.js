// pages/api/search.js
// POST { query } -> { records: [...] }
// Ingredient search: banned substances first, then general ingredients, matched by name or synonym.
// Both come from Supabase (banned_substances, ingredients), the same tables the label scanner uses.
// Each record: { id, name, synonyms, bannedBy, banType, dosageLimit, notes, source, benefits, weaknesses, antagonisms }

import { supabaseAdmin as db } from "@/lib/supabase";

const MAX_RESULTS = 60;

// Letters, numbers and a little punctuation (no PostgREST filter syntax like "(" or ")")
function clean(query = "") {
  return String(query).trim().replace(/[^a-zA-Z0-9\s\-.+',]/g, " ").replace(/\s+/g, " ").slice(0, 100);
}

// Commas become wildcards (and never reach the filter string), so "1,3-dimethyl" also
// matches "1, 3-dimethylamylamine"
const pattern = (q) => `%${q.replace(/[%_\\]/g, (c) => `\\${c}`).replace(/\s*,\s*/g, "%")}%`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const q = clean(req.body?.query);
  if (q.replace(/[^a-zA-Z0-9]/g, "").length < 2) {
    return res.status(400).json({ error: "Type at least 2 letters or numbers to search." });
  }

  try {
    const like = pattern(q);
    const [banned, ingredients] = await Promise.all([
      db.from("banned_substances")
        .select("id, substance_name, synonyms, banned_by, ban_type, dosage_limit, notes, citation")
        .or(`substance_name.ilike.${like},synonyms.ilike.${like}`)
        .limit(MAX_RESULTS),
      db.from("ingredients")
        .select("id, name, synonyms, pharmacology_notes, benefits, weaknesses, nutrient_antagonism, sources")
        .or(`name.ilike.${like},synonyms.ilike.${like}`)
        .limit(MAX_RESULTS),
    ]);
    if (banned.error) throw banned.error;
    if (ingredients.error) throw ingredients.error;

    const ingByName = new Map((ingredients.data ?? []).map((r) => [String(r.name || "").trim().toLowerCase(), r]));

    const bannedRecords = (banned.data ?? []).map((r) => {
      const name = String(r.substance_name || "").trim();
      const ing = ingByName.get(name.toLowerCase());
      return {
        id:          r.id,
        name,
        synonyms:    r.synonyms ?? null,
        bannedBy:    r.banned_by ?? null,
        banType:     r.ban_type ?? null,
        dosageLimit: r.dosage_limit ?? null,
        notes:       r.notes ?? null,
        source:      r.citation ?? null,
        benefits:    ing?.benefits ?? null,
        weaknesses:  ing?.weaknesses ?? null,
        antagonisms: ing?.nutrient_antagonism ?? null,
      };
    });

    const bannedNames = new Set(bannedRecords.map((r) => r.name.toLowerCase()));
    const ingredientRecords = (ingredients.data ?? [])
      .filter((r) => !bannedNames.has(String(r.name || "").trim().toLowerCase()))
      .map((r) => ({
        id:          r.id,
        name:        String(r.name || "").trim(),
        synonyms:    r.synonyms ?? null,
        bannedBy:    null,
        banType:     null,
        dosageLimit: null,
        notes:       r.pharmacology_notes ?? null,
        source:      r.sources ?? null,
        benefits:    r.benefits ?? null,
        weaknesses:  r.weaknesses ?? null,
        antagonisms: r.nutrient_antagonism ?? null,
      }));

    // Exact and prefix matches first within each group
    const rank = (r) => {
      const n = r.name.toLowerCase(), s = q.toLowerCase();
      return n === s ? 0 : n.startsWith(s) ? 1 : 2;
    };
    bannedRecords.sort((a, b) => rank(a) - rank(b));
    ingredientRecords.sort((a, b) => rank(a) - rank(b));

    return res.status(200).json({ records: [...bannedRecords, ...ingredientRecords] });
  } catch (err) {
    console.error("[search API]", err?.message || err);
    return res.status(500).json({ error: "Search is temporarily unavailable. Please try again shortly." });
  }
}
