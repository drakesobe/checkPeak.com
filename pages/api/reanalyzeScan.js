// pages/api/reanalyzeScan.js
// Re-runs banned/ingredient matching (Airtable reference data) for a scan stored in Supabase.

import Airtable from "airtable";
import { supabaseAdmin as db } from "@/lib/supabase";

const bannedBase =
  process.env.BANNED_API_KEY && process.env.BANNED_BASE_ID
    ? new Airtable({ apiKey: process.env.BANNED_API_KEY }).base(process.env.BANNED_BASE_ID)
    : null;

const ingredientsBase =
  process.env.INGREDIENT_API_KEY && process.env.INGREDIENT_BASE_ID
    ? new Airtable({ apiKey: process.env.INGREDIENT_API_KEY }).base(process.env.INGREDIENT_BASE_ID)
    : null;

async function fetchAllAirtableRecords(baseInstance, tableName) {
  if (!baseInstance) throw new Error("Airtable base instance not configured");
  if (!tableName) throw new Error("Table name required");
  const all = await baseInstance(tableName).select({ view: "Grid view", pageSize: 100 }).all();
  return all.map((r) => ({ id: r.id, fields: r.fields }));
}

const escapeRegex = (s = "") => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function splitNormalizedTextToTerms(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const cleaned = lower.replace(/\b(ma|made|with|contains|ingredients|ingredient|organic)\b/gi, " ");
  return cleaned
    .split(/[.,;:\/\\\[\]\(\)\{\}"""''<>|@#\$%\^&\*_+=~`·•]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

function recordTerms(fields = {}, primaryFields = ["Name", "Ingredient Name"]) {
  const terms = new Set();
  for (const key of primaryFields) {
    const v = fields?.[key];
    if (!v) continue;
    splitNormalizedTextToTerms(String(v)).forEach((t) => terms.add(t));
  }
  for (const col of ["Synonyms", "Synonyms (Extended)", "Depositor-Supplied Synonyms"]) {
    const v = fields?.[col];
    if (!v) continue;
    splitNormalizedTextToTerms(String(v)).forEach((t) => terms.add(t));
  }
  return Array.from(terms);
}

function termInText(term = "", normalizedText = "") {
  if (!term || term.length < 2 || /^[0-9]+$/.test(term)) return false;
  try {
    return new RegExp(`\\b${escapeRegex(term)}\\b`, "i").test(normalizedText);
  } catch {
    return normalizedText.includes(term.toLowerCase());
  }
}

async function matchAgainstBannedRecords(ingredientsText) {
  if (!bannedBase || !process.env.BANNED_TABLE_NAME) return [];
  const normalized = splitNormalizedTextToTerms(ingredientsText).join(" ");
  const rawRecords = await fetchAllAirtableRecords(bannedBase, process.env.BANNED_TABLE_NAME);
  const matches = [];
  for (const rec of rawRecords) {
    const fields = rec.fields || {};
    const candidates = recordTerms(fields, ["Substance Name"]);
    const matchedTerms = candidates.filter((t) => termInText(t, normalized));
    if (matchedTerms.length > 0) {
      matches.push({
        id: rec.id,
        fields: {
          "Substance Name": fields["Substance Name"] || fields["Name"] || "",
          Synonyms: fields["Synonyms"] || "",
          "Ban Type": fields["Ban Type"] || "",
          "Banned By": fields["Banned By"] || "",
          "Dosage Limit": fields["Dosage Limit"] || "",
          Notes: fields["Notes"] || "",
          "Source / Citation": fields["Source / Citation"] || "",
        },
        matchedTerms,
      });
    }
  }
  return matches;
}

async function matchAgainstIngredientRecords(ingredientsText) {
  if (!ingredientsBase || !process.env.INGREDIENT_TABLE_NAME) {
    throw new Error("Ingredients Airtable not configured");
  }
  const normalized = splitNormalizedTextToTerms(ingredientsText).join(" ");
  const raw = await fetchAllAirtableRecords(ingredientsBase, process.env.INGREDIENT_TABLE_NAME);
  const matches = [];
  for (const rec of raw) {
    const fields = rec.fields || {};
    const candidates = recordTerms(fields, ["Name", "Ingredient Name"]);
    const matchedTerms = candidates.filter((t) => termInText(t, normalized));
    if (matchedTerms.length > 0) {
      matches.push({
        id: rec.id,
        fields: {
          Name: fields["Name"] || fields["Ingredient Name"] || "",
          "PubChem CID": fields["PubChem CID"] || "",
          "Synonyms (Extended)": fields["Synonyms (Extended)"] || fields["Synonyms"] || "",
          "Pharmacology Notes": fields["Pharmacology Notes"] || "",
          Benefits: fields["Benefits"] || "",
          Weaknesses: fields["Weaknesses"] || "",
          "Nutrient Antagonism": fields["Nutrient Antagonism"] || "",
          "Sources / References": fields["Sources / References"] || "",
        },
        matchedTerms,
      });
    }
  }
  return matches;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { scanId } = req.body || {};
    if (!scanId) {
      return res.status(400).json({ error: "Missing scanId in request body." });
    }

    // 1) Load scan from Supabase
    const { data: scanRow, error: fetchErr } = await db
      .from("scans")
      .select("id, scan_name, scan_date, user_email, stack_details, share_enabled, share_token")
      .eq("id", scanId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!scanRow) {
      return res.status(404).json({ error: "Scan not found for given scanId." });
    }

    const rawText = scanRow.stack_details || "";
    if (!rawText) {
      return res.status(400).json({ error: "No ingredient / stack text stored for this scan. Cannot re-analyze." });
    }

    // 2) Re-run matching against Airtable reference bases
    let matchedBanned = [];
    let matchedIngredients = [];

    try {
      matchedBanned = await matchAgainstBannedRecords(rawText);
    } catch (err) {
      console.error("[reanalyzeScan] banned match error:", err);
    }

    try {
      matchedIngredients = await matchAgainstIngredientRecords(rawText);
    } catch (err) {
      console.error("[reanalyzeScan] ingredient match error:", err);
    }

    // 3) Compute counts
    let prohibitedCount = 0;
    let limitedCount = 0;
    let otherBannedCount = 0;

    for (const b of matchedBanned) {
      const banTypeRaw = (b.fields?.["Ban Type"] || "").toString().toLowerCase();
      if (!banTypeRaw) {
        otherBannedCount++;
      } else if (
        banTypeRaw.includes("prohibited") ||
        banTypeRaw.includes("in-competition") ||
        banTypeRaw.includes("in competition") ||
        banTypeRaw.includes("banned")
      ) {
        prohibitedCount++;
      } else if (
        banTypeRaw.includes("limited") ||
        banTypeRaw.includes("out of competition") ||
        banTypeRaw.includes("out-of-competition") ||
        banTypeRaw.includes("threshold")
      ) {
        limitedCount++;
      } else {
        otherBannedCount++;
      }
    }

    const bannedDetails = { ProhibitedCount: prohibitedCount, LimitedCount: limitedCount, OtherBannedCount: otherBannedCount };
    const resultsSummary = `Prohibited: ${prohibitedCount}, Limited: ${limitedCount}, Other: ${otherBannedCount}`;

    // 4) Persist updated summary to Supabase
    try {
      await db.from("scans").update({
        banned_details:  bannedDetails,
        results_summary: resultsSummary,
      }).eq("id", scanRow.id);
    } catch (err) {
      console.error("[reanalyzeScan] update summary error:", err);
    }

    return res.status(200).json({
      scan: {
        id:                scanRow.id,
        name:              scanRow.scan_name || "Scan",
        date:              scanRow.scan_date || null,
        userEmail:         scanRow.user_email || null,
        stackDetails:      rawText,
        resultsSummary,
        bannedDetails,
        matchedBanned,
        matchedIngredients,
        prohibitedCount,
        limitedCount,
        otherCount:        otherBannedCount,
        shareEnabled:      Boolean(scanRow.share_enabled),
        shareToken:        scanRow.share_token || null,
      },
    });
  } catch (err) {
    console.error("[reanalyzeScan] unexpected error:", err);
    return res.status(500).json({ error: "Internal server error", details: String(err?.message || err) });
  }
}
