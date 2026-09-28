// lib/supplementCheck.js
// Server-side entry point for supplement checks: loads the banned-substance and ingredient
// tables from Supabase, resolves the signed-in user, and saves scan history.

import { supabaseAdmin as db } from "@/lib/supabase";
import { readUserFromRequest } from "@/lib/requireUser";
import { checkExtractedLabel, checkIngredientText } from "@/lib/supplementMatching";

const CACHE_MS  = 10 * 60 * 1000;
const PAGE_SIZE = 1000;

export const BANNED_LIST_MISSING = "Product checks are unavailable right now because the banned-substance list couldn't be loaded. Please try again in a moment.";

// Supabase rows -> the Airtable-style field names the matcher and result cards use
const toBannedRecord = (r) => ({
  id: r.id,
  fields: {
    "Substance Name":    r.substance_name,
    Synonyms:            r.synonyms,
    "Banned By":         r.banned_by,
    "Ban Type":          r.ban_type,
    "Dosage Limit":      r.dosage_limit,
    Notes:               r.notes,
    "Source / Citation": r.citation,
  },
});

const toIngredientRecord = (r) => ({
  id: r.id,
  fields: {
    Name:                   r.name,
    Synonyms:               r.synonyms,
    "Pharmacology Notes":   r.pharmacology_notes,
    Benefits:               r.benefits,
    Weaknesses:             r.weaknesses,
    "Nutrient Antagonism":  r.nutrient_antagonism,
    "Sources / References": r.sources,
  },
});

async function fetchAll(table, columns) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db.from(table).select(columns).order("id").range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

let cache = null; // { at, data }

// Returns { bannedRecords, ingredientRecords }, or null if the banned list can't be loaded.
// Callers must refuse to check without it: an empty list would clear every product.
export async function getSupplementData() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  try {
    const [banned, ingredients] = await Promise.all([
      fetchAll("banned_substances", "id, substance_name, synonyms, banned_by, ban_type, dosage_limit, notes, citation"),
      fetchAll("ingredients", "id, name, synonyms, pharmacology_notes, benefits, weaknesses, nutrient_antagonism, sources"),
    ]);
    if (!banned.length) throw new Error("banned_substances table is empty");
    const data = {
      // "Approved" rows list explicitly permitted substances (WADA exceptions), never flag them
      bannedRecords:     banned.filter((r) => r.substance_name && !/approved/i.test(r.ban_type || "")).map(toBannedRecord),
      ingredientRecords: ingredients.filter((r) => r.name).map(toIngredientRecord),
    };
    cache = { at: Date.now(), data };
    return data;
  } catch (err) {
    console.error("[supplementCheck] failed to load supplement data:", err);
    return cache?.data || null; // a stale list beats no list
  }
}

export const checkLabel = (extraction, data) => checkExtractedLabel(extraction, data);
export const checkText  = (text, data, opts) => checkIngredientText(text, data, opts);

// Email of the signed-in user, or "" for anonymous visitors. Never taken from the request body.
export function sessionEmail(req) {
  const u = readUserFromRequest(req);
  const email = String(u?.Email || u?.email || "").trim().toLowerCase();
  return email.includes("@") ? email : "";
}

export async function saveScan({ email, productName, ingredientsText, bannedDetails }) {
  if (!email) return { saved: false };
  const now = new Date();
  const stamp = now.toLocaleString("en-US", { hour12: false });
  const { error } = await db.from("scans").insert({
    user_email:      email,
    scan_name:       productName ? `${productName} (${stamp})` : `Scan - ${stamp}`,
    product_name:    productName || null,
    scan_date:       now.toISOString(),
    stack_details:   ingredientsText || "No ingredient text captured",
    results_summary: `Prohibited: ${bannedDetails.ProhibitedCount}, Limited: ${bannedDetails.LimitedCount}, Other: ${bannedDetails.OtherBannedCount}`,
    banned_details:  bannedDetails,
  });
  if (error) {
    console.error("[saveScan]", error);
    return { saved: false };
  }
  return { saved: true };
}
