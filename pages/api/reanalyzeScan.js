// pages/api/reanalyzeScan.js

import Airtable from "airtable";

/**
 * Reanalyze a scan:
 * - Looks up the scan by Airtable record ID (scanId)
 * - Uses the stored StackDetails / ingredient text
 * - Re-runs banned + ingredient matching from Airtable bases
 * - Recomputes Prohibited / Limited / OtherBanned counts
 * - Updates the Scans record summary fields
 * - Returns updated scan data (including matched arrays)
 *
 * Expected env vars:
 *  - BANNED_API_KEY, BANNED_BASE_ID, BANNED_TABLE_NAME
 *  - INGREDIENT_API_KEY, INGREDIENT_BASE_ID, INGREDIENT_TABLE_NAME
 *  - SCANS_API_KEY, SCANS_BASE_ID, SCANS_TABLE_NAME
 */

const bannedBase =
  process.env.BANNED_API_KEY && process.env.BANNED_BASE_ID
    ? new Airtable({ apiKey: process.env.BANNED_API_KEY }).base(
        process.env.BANNED_BASE_ID
      )
    : null;

const ingredientsBase =
  process.env.INGREDIENT_API_KEY && process.env.INGREDIENT_BASE_ID
    ? new Airtable({ apiKey: process.env.INGREDIENT_API_KEY }).base(
        process.env.INGREDIENT_BASE_ID
      )
    : null;

const scansBase =
  process.env.SCANS_API_KEY && process.env.SCANS_BASE_ID
    ? new Airtable({ apiKey: process.env.SCANS_API_KEY }).base(
        process.env.SCANS_BASE_ID
      )
    : null;

async function fetchAllAirtableRecordsUsingClient(baseInstance, tableName) {
  if (!baseInstance) throw new Error("Airtable base instance not configured");
  if (!tableName) throw new Error("Table name required");

  const pageSize = 100;
  const all = await baseInstance(tableName)
    .select({ view: "Grid view", pageSize })
    .all();

  return all.map((r) => ({ id: r.id, fields: r.fields }));
}

/* ---------- text normalization + matching helpers (same logic as /api/check) ---------- */

const escapeRegex = (s = "") =>
  String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function splitNormalizedTextToTerms(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const cleaned = lower.replace(
    /\b(ma|made|with|contains|ingredients|ingredient|organic)\b/gi,
    " "
  );
  const rawTerms = cleaned.split(
    /[.,;:\/\\\[\]\(\)\{\}"“”‘’<>|@#\$%\^&\*_+=~`·•]/
  );
  return rawTerms
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

  const synonymCols = [
    "Synonyms",
    "Synonyms (Extended)",
    "Depositor-Supplied Synonyms",
  ];
  for (const col of synonymCols) {
    const v = fields?.[col];
    if (!v) continue;
    splitNormalizedTextToTerms(String(v)).forEach((t) => terms.add(t));
  }

  return Array.from(terms);
}

function termInText(term = "", normalizedText = "") {
  if (!term) return false;
  if (term.length < 2) return false;
  if (/^[0-9]+$/.test(term)) return false;

  try {
    const rx = new RegExp(`\\b${escapeRegex(term)}\\b`, "i");
    return rx.test(normalizedText);
  } catch {
    return normalizedText.includes(term.toLowerCase());
  }
}

async function matchAgainstBannedRecords(ingredientsText) {
  if (!bannedBase || !process.env.BANNED_TABLE_NAME) return [];
  const normalized = splitNormalizedTextToTerms(ingredientsText).join(" ");
  const rawRecords = await fetchAllAirtableRecordsUsingClient(
    bannedBase,
    process.env.BANNED_TABLE_NAME
  );

  const matches = [];
  for (const rec of rawRecords) {
    const fields = rec.fields || {};
    const candidates = recordTerms(fields, ["Substance Name"]);
    const matchedTerms = [];

    for (const t of candidates) {
      if (termInText(t, normalized)) matchedTerms.push(t);
    }

    if (matchedTerms.length > 0) {
      matches.push({
        id: rec.id,
        fields: {
          "Substance Name":
            fields["Substance Name"] || fields["Name"] || "",
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
  const raw = await fetchAllAirtableRecordsUsingClient(
    ingredientsBase,
    process.env.INGREDIENT_TABLE_NAME
  );

  const matches = [];
  for (const rec of raw) {
    const fields = rec.fields || {};
    const candidates = recordTerms(fields, ["Name", "Ingredient Name"]);
    const matchedTerms = [];

    for (const t of candidates) {
      if (termInText(t, normalized)) matchedTerms.push(t);
    }

    if (matchedTerms.length > 0) {
      matches.push({
        id: rec.id,
        fields: {
          Name: fields["Name"] || fields["Ingredient Name"] || "",
          "PubChem CID": fields["PubChem CID"] || "",
          "Synonyms (Extended)":
            fields["Synonyms (Extended)"] || fields["Synonyms"] || "",
          "Pharmacology Notes": fields["Pharmacology Notes"] || "",
          Benefits: fields["Benefits"] || "",
          Weaknesses: fields["Weaknesses"] || "",
          "Nutrient Antagonism":
            fields["Nutrient Antagonism"] || "",
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
    return res
      .status(405)
      .json({ error: "Method not allowed. Use POST." });
  }

  if (!scansBase || !process.env.SCANS_TABLE_NAME) {
    return res.status(500).json({
      error: "Scans Airtable not configured.",
    });
  }

  try {
    const { scanId } = req.body || {};
    if (!scanId) {
      return res
        .status(400)
        .json({ error: "Missing scanId in request body." });
    }

    // 1) load scan record
    let record;
    try {
      record = await scansBase(process.env.SCANS_TABLE_NAME).find(scanId);
    } catch (err) {
      console.error("[reanalyzeScan] Airtable find error:", err);
      return res
        .status(404)
        .json({ error: "Scan not found for given scanId." });
    }

    const fields = record.fields || {};

    // 2) figure out text to analyze
    const rawText =
      fields.StackDetails ||
      fields.IngredientsText ||
      fields.Ingredients ||
      "";

    if (!rawText) {
      return res.status(400).json({
        error:
          "No ingredient / stack text stored for this scan. Cannot re-analyze.",
      });
    }

    // 3) re-run matching
    let matchedBanned = [];
    let matchedIngredients = [];

    try {
      matchedBanned = await matchAgainstBannedRecords(rawText);
    } catch (err) {
      console.error("[reanalyzeScan] banned match error:", err);
      matchedBanned = [];
    }

    try {
      matchedIngredients = await matchAgainstIngredientRecords(rawText);
    } catch (err) {
      console.error("[reanalyzeScan] ingredient match error:", err);
      matchedIngredients = [];
    }

    // 4) compute counts
    let prohibitedCount = 0;
    let limitedCount = 0;
    let otherBannedCount = 0;

    for (const b of matchedBanned) {
      const banTypeRaw = (b.fields?.["Ban Type"] || "")
        .toString()
        .toLowerCase();

      if (!banTypeRaw) {
        otherBannedCount += 1;
        continue;
      }

      if (
        banTypeRaw.includes("prohibited") ||
        banTypeRaw.includes("in-competition") ||
        banTypeRaw.includes("in competition") ||
        banTypeRaw.includes("banned")
      ) {
        prohibitedCount += 1;
      } else if (
        banTypeRaw.includes("limited") ||
        banTypeRaw.includes("out of competition") ||
        banTypeRaw.includes("out-of-competition") ||
        banTypeRaw.includes("threshold")
      ) {
        limitedCount += 1;
      } else {
        otherBannedCount += 1;
      }
    }

    const bannedDetails = {
      ProhibitedCount: prohibitedCount,
      LimitedCount: limitedCount,
      OtherBannedCount: otherBannedCount,
    };

    const resultsSummary = `Prohibited: ${prohibitedCount}, Limited: ${limitedCount}, Other: ${otherBannedCount}`;

    // 5) update scan record summary fields
    try {
      await scansBase(process.env.SCANS_TABLE_NAME).update(record.id, {
        BannedDetails: JSON.stringify(bannedDetails),
        ResultsSummary: resultsSummary,
      });
    } catch (err) {
      console.error("[reanalyzeScan] update summary error:", err);
      // not fatal for API response – we'll still return data
    }

    // 6) build scan object for UI
    const scanObj = {
      id: record.id,
      name: fields.ScanName || fields.Name || "Scan",
      date: fields.ScanDate || null,
      userEmail: fields.UserEmail || null,
      stackDetails: rawText,
      resultsSummary,
      bannedDetails,
      matchedBanned,
      matchedIngredients,
      prohibitedCount,
      limitedCount,
      otherCount: otherBannedCount,
      shareEnabled: Boolean(fields.ShareEnabled),
      shareToken: fields.ShareToken || null,
      source: fields.Source || null,
    };

    return res.status(200).json({ scan: scanObj });
  } catch (err) {
    console.error("[reanalyzeScan] unexpected error:", err);
    return res.status(500).json({
      error: "Internal server error",
      details: String(err?.message || err),
    });
  }
}
