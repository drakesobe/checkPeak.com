// lib/getBannedSubstances.js
import Airtable from "airtable";

export async function getBannedSubstancesFromAirtable() {
  const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base("appspE640Pggw1VP9");

  const records = await base("Banned_Substances_DB").select({ view: "Grid view" }).all();

  return records.map((record) => ({
    substanceName: record.get("Substance Name") || "",
    synonyms: record.get("Synonyms") || "",
    banType: record.get("Ban Type") || "Approved",
  }));
}
