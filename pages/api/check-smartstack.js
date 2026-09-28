// pages/api/check-smartstack.js
// POST { ingredientsText } -> { bannedSubstances, ingredients } for SmartStack compare / nutrition views.
// Same matching engine as the scanner (lib/supplementMatching.js).

import { checkText, getSupplementData, BANNED_LIST_MISSING } from "@/lib/supplementCheck";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed. Use POST." });

  const text = String(req.body?.ingredientsText || "").trim();
  if (text.length < 2) return res.status(400).json({ error: "Missing ingredientsText" });

  const data = await getSupplementData();
  if (!data) return res.status(503).json({ error: BANNED_LIST_MISSING });

  const result = checkText(text, data);
  return res.status(200).json({
    bannedSubstances: result.matchedBanned,
    ingredients:      result.matchedIngredients,
    verdict:          result.verdict,
  });
}
