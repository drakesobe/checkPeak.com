// pages/api/search.js
import Airtable from "airtable";

const bannedBase = new Airtable({ apiKey: process.env.BANNED_API_KEY }).base(
  process.env.BANNED_BASE_ID
);
const ingredientBase = new Airtable({ apiKey: process.env.INGREDIENT_API_KEY }).base(
  process.env.INGREDIENT_BASE_ID
);

const fetchAllRecords = async (base, tableName) => {
  const records = await base(tableName).select({ view: "Grid view" }).all();
  return records.map((rec) => ({ id: rec.id, fields: rec.fields }));
};

const findIngredientMatch = (name, ingredients) => {
  const lowerName = name.toLowerCase();
  return ingredients.find((ing) => {
    const ingName = ing.fields["Ingredient Name"] || "";
    const synonyms = (ing.fields["Synonyms"] || "").split(",").map((s) => s.trim().toLowerCase());
    return ingName.toLowerCase() === lowerName || synonyms.includes(lowerName);
  });
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { query } = req.body;
  if (!query || query.trim().length < 2)
    return res.status(400).json({ error: "Query is required and must be at least 2 characters" });

  const lowerQuery = query.toLowerCase();

  try {
    const bannedRecords = await fetchAllRecords(bannedBase, process.env.BANNED_TABLE_NAME);
    const ingredientRecords = await fetchAllRecords(
      ingredientBase,
      process.env.INGREDIENT_TABLE_NAME
    );

    // --- Filter Banned by query
    const matchedBanned = bannedRecords.filter((rec) => {
      const name = rec.fields["Substance Name"] || "";
      const synonyms = rec.fields["Synonyms"] || "";
      const bannedBy = rec.fields["Banned By"] || "";
      return (
        name.toLowerCase().includes(lowerQuery) ||
        synonyms.toLowerCase().includes(lowerQuery) ||
        bannedBy.toLowerCase().includes(lowerQuery)
      );
    });

    // --- Merge Banned with Ingredients
    const mergedBanned = matchedBanned.map((banned) => {
      const name = banned.fields["Substance Name"] || "";
      const ingredientMatch = findIngredientMatch(name, ingredientRecords);
      return {
        id: banned.id,
        name,
        synonyms: banned.fields["Synonyms"] || "",
        bannedBy: banned.fields["Banned By"] || "",
        banType: banned.fields["Ban Type"] || "",
        dosageLimit: banned.fields["Dosage Limit"] || "",
        notes: banned.fields["Notes"] || "",
        source: banned.fields["Source / Citation"] || "",
        benefits: ingredientMatch?.fields["Benefits"] || "",
        weaknesses: ingredientMatch?.fields["Weaknesses"] || "",
        antagonisms: ingredientMatch?.fields["Nutrient Antagonism"] || "",
      };
    });

    // --- Filter Ingredients by query, exclude already merged banned substances
    const matchedIngredients = ingredientRecords.filter((ing) => {
      const name = ing.fields["Ingredient Name"] || "";
      const synonyms = ing.fields["Synonyms"] || "";
      const alreadyMerged = mergedBanned.some((b) => b.name.toLowerCase() === name.toLowerCase());
      if (alreadyMerged) return false;
      return (
        name.toLowerCase().includes(lowerQuery) ||
        synonyms.toLowerCase().includes(lowerQuery)
      );
    });

    const mergedIngredients = matchedIngredients.map((ing) => ({
      id: ing.id,
      name: ing.fields["Ingredient Name"] || "",
      synonyms: ing.fields["Synonyms"] || "",
      bannedBy: "",
      banType: null,
      dosageLimit: "",
      notes: "",
      source: "",
      benefits: ing.fields["Benefits"] || "",
      weaknesses: ing.fields["Weaknesses"] || "",
      antagonisms: ing.fields["Nutrient Antagonism"] || "",
    }));

    const finalResults = [...mergedBanned, ...mergedIngredients];

    res.status(200).json({ records: finalResults });
  } catch (err) {
    console.error("Search API Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
