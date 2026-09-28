// lib/supplementMatching.js
// Pure matching + verdict logic for the supplement scanner. No I/O: records are passed in,
// so this runs identically in API routes and in tests.

// ---------------------------------------------------------------------------
// Text normalization
// ---------------------------------------------------------------------------

const escapeRegex = (s = "") => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// Split on whitespace and brackets only. Commas stay inside tokens so
// "1,3-dimethylamylamine" never yields a bare "1" that matches "1 scoop".
function splitToTerms(text) {
  if (!text) return [];
  return normalizeText(text)
    .replace(/\b(ma|made|with|contains|ingredients|ingredient|organic)\b/gi, " ")
    .split(/[\s;\/\\\[\]\(\)\{\}"\u201c\u201d'\u2018\u2019<>|@#$%^&*_+=~`\u00b7\u2022]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

const NOISE_TOKENS = new Set([
  "methyl", "ethyl", "propyl", "butyl", "acetyl", "phenyl", "dimethyl",
  "beta", "alpha", "gamma", "delta",
  "acid", "acids", "salt", "salts", "powder", "powders",
  "sodium", "potassium", "calcium", "magnesium", "iron",
  "chloride", "citrate", "phosphate", "sulfate", "malate", "tartrate",
  "oxide", "hydroxide", "extract", "blend", "complex", "concentrate",
  "protein", "peptide", "enzyme", "enzymes", "culture", "cultures",
  "milk", "cheese", "whey", "lactose", "casein", "sugar", "glucose",
  "oil", "fat", "fiber", "starch", "flour", "water",
  "color", "colour", "flavor", "flavors", "flavour", "spice", "spices",
  "green", "red", "blue", "yellow", "white", "black",
  "mg", "mcg", "g", "iu", "ml",
  "scoop", "scoops", "serving", "servings", "container",
  "per", "size", "amount", "other", "natural", "artificial",
  "contains", "ingredients", "ingredient",
]);

function isNoiseToken(t) {
  const s = String(t || "").toLowerCase().trim();
  if (!s)                        return true;
  if (NOISE_TOKENS.has(s))       return true;
  if (s.length < 5)              return true;
  if (/^\d+$/.test(s))           return true;
  if (/^\d+[a-z]{1,2}$/.test(s)) return true;
  if (/^[a-z]{1,3}\d*$/.test(s)) return true;
  return false;
}

function normalizeForPhrase(str = "") {
  return String(str)
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^a-z0-9\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function phraseInText(phrase = "", normalizedText = "") {
  const p = normalizeForPhrase(phrase);
  if (!p || p.length < 6 || !/[a-z]/.test(p)) return false;
  return normalizeForPhrase(normalizedText).includes(p);
}

// Synonyms are phrase-matched only, never tokenized ("Chi Powder" must not match "onion powder" via "powder").
function primaryTerms(fields = {}, primaryFields) {
  const terms = new Set();
  for (const key of primaryFields) {
    const v = fields?.[key];
    if (v) splitToTerms(String(v)).forEach((t) => terms.add(t));
  }
  return Array.from(terms);
}

function synonymPhrases(fields = {}) {
  const phrases = [];
  for (const col of ["Synonyms", "Synonyms (Extended)", "Depositor-Supplied Synonyms", "Other Names", "Alt Names"]) {
    const v = fields?.[col];
    if (!v) continue;
    String(v).split(/[,;\n]/).forEach((s) => {
      const trimmed = s.trim();
      if (trimmed) phrases.push(trimmed);
    });
  }
  return phrases;
}

function termInText(term = "", normalizedText = "") {
  if (!term || term.length < 2 || /^\d+$/.test(term)) return false;
  try {
    return new RegExp(`\\b${escapeRegex(term)}\\b`, "i").test(normalizedText);
  } catch {
    return normalizedText.includes(term.toLowerCase());
  }
}

// Short names that must still match as standalone tokens despite the length gate.
const SHORT_TERM_ALLOWLIST = new Set([
  "dmaa", "dmha", "dmba", "dmae", "dhea", "dheas",
  "hgh", "hcg", "epo", "igf", "thc", "cbd", "cbn", "thcv",
  "lsd", "ghb", "gbl", "aicar", "sarms", "sarm",
  "zinc", "iodine", "nac", "atp", "gaba", "5-htp", "egcg",
]);

// Short synonyms like "DMAA" are below the phrase length gate, so allowlisted ones match as whole words.
function synonymInText(syn, normalizedText) {
  if (phraseInText(syn, normalizedText)) return true;
  const s = normalizeText(syn);
  return SHORT_TERM_ALLOWLIST.has(s) && termInText(s, normalizedText);
}

// A record matches only on: full name phrase, full synonym phrase, or a
// meaningful primary-name token (>= 7 chars or allowlisted).
function hasStrongMatch(primaryMatchedTerms, primaryPhraseHit, synPhraseHit) {
  if (primaryPhraseHit || synPhraseHit) return true;
  const meaningful = (primaryMatchedTerms || []).filter((t) => !isNoiseToken(t));
  return meaningful.some((t) => {
    const s = String(t).toLowerCase();
    return s.length >= 7 || SHORT_TERM_ALLOWLIST.has(s);
  });
}

function matchRecords(text, records, { nameFields, pickFields }) {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  return (records || []).reduce((matches, rec) => {
    const fields = rec.fields || {};
    const name   = nameFields.map((f) => fields[f]).find(Boolean) || "";

    const primaryPhraseHit = phraseInText(name, normalized);
    const syns             = synonymPhrases(fields);
    const hitSyns          = syns.filter((syn) => synonymInText(syn, normalized));
    const matchedTerms     = primaryTerms(fields, nameFields)
      .filter((t) => !isNoiseToken(t) && termInText(t, normalized));

    if (!hasStrongMatch(matchedTerms, primaryPhraseHit, hitSyns.length > 0)) return matches;

    matches.push({
      id: rec.id,
      fields: pickFields(fields),
      matchedTerms: primaryPhraseHit ? [name] : hitSyns.length ? hitSyns : matchedTerms,
      matchKind:    primaryPhraseHit ? "name" : hitSyns.length ? "synonym" : "token",
    });
    return matches;
  }, []);
}

export function matchBannedRecords(text, records) {
  return matchRecords(text, records, {
    nameFields: ["Substance Name"],
    pickFields: (f) => ({
      "Substance Name":      f["Substance Name"]      || f["Name"] || "",
      Synonyms:              f["Synonyms"]            || "",
      "Ban Type":            f["Ban Type"]            || "",
      "Banned By":           f["Banned By"]           || "",
      "Dosage Limit":        f["Dosage Limit"]        || "",
      Notes:                 f["Notes"]               || "",
      "Source / Citation":   f["Source / Citation"]   || "",
      Benefits:              f["Benefits"]            || "",
      Weaknesses:            f["Weaknesses"]          || "",
      "Nutrient Antagonism": f["Nutrient Antagonism"] || "",
    }),
  });
}

export function matchIngredientRecords(text, records) {
  return matchRecords(text, records, {
    nameFields: ["Name", "Ingredient Name"],
    pickFields: (f) => ({
      Name:                   f["Name"]                  || f["Ingredient Name"] || "",
      "PubChem CID":          f["PubChem CID"]          || "",
      "Synonyms (Extended)":  f["Synonyms (Extended)"]  || f["Synonyms"] || "",
      "Pharmacology Notes":   f["Pharmacology Notes"]   || "",
      Benefits:               f["Benefits"]              || "",
      Weaknesses:             f["Weaknesses"]            || "",
      "Nutrient Antagonism":  f["Nutrient Antagonism"]  || "",
      "Sources / References": f["Sources / References"] || "",
    }),
  });
}

// Fill missing Benefits/Weaknesses on banned matches from the matching ingredient record.
export function enrichBannedFromIngredients(matchedBanned, matchedIngredients) {
  if (!matchedBanned.length || !matchedIngredients.length) return matchedBanned;
  const byName = new Map();
  for (const ing of matchedIngredients) {
    const name = String(ing.fields?.Name || "").trim().toLowerCase();
    if (name) byName.set(name, ing);
    String(ing.fields?.["Synonyms (Extended)"] || "")
      .split(/[;,\/\|\(\)\[\]\n]/).map((s) => s.trim().toLowerCase()).filter(Boolean)
      .forEach((s) => byName.set(s, ing));
  }
  return matchedBanned.map((b) => {
    const src = byName.get(String(b.fields?.["Substance Name"] || "").trim().toLowerCase());
    if (!src) return b;
    return {
      ...b,
      fields: {
        ...b.fields,
        Benefits:              b.fields.Benefits              || src.fields?.Benefits              || "",
        Weaknesses:            b.fields.Weaknesses            || src.fields?.Weaknesses            || "",
        "Nutrient Antagonism": b.fields["Nutrient Antagonism"] || src.fields?.["Nutrient Antagonism"] || "",
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Severity + verdict
// ---------------------------------------------------------------------------

// "hard" = banned outright; "soft" = restricted (in-competition only, threshold, particular sports, monitored)
export function banSeverity(banned) {
  const bt = String(banned?.fields?.["Ban Type"] || "").toLowerCase();
  if (bt.includes("prohibited") || bt.includes("in-competition") || bt.includes("banned")) return "hard";
  return "soft";
}

export function summarizeBanned(matchedBanned) {
  return matchedBanned.reduce((acc, b) => {
    const bt = String(b.fields?.["Ban Type"] || "").toLowerCase();
    if (bt.includes("prohibited") || bt.includes("in-competition") || bt.includes("banned")) acc.ProhibitedCount++;
    else if (bt.includes("limited") || bt.includes("out of competition") || bt.includes("threshold")) acc.LimitedCount++;
    else acc.OtherBannedCount++;
    return acc;
  }, { ProhibitedCount: 0, LimitedCount: 0, OtherBannedCount: 0 });
}

export const TRUSTED_CERTIFICATIONS = ["NSF Certified for Sport", "Informed Sport", "Informed Choice", "BSCG Certified Drug Free"];

// status: "flagged" | "review" | "no_match"
export function buildVerdict({ matchedBanned = [], blends = [], certifications = [], source = "label" }) {
  const hard = matchedBanned.filter((b) => banSeverity(b) === "hard");
  const soft = matchedBanned.filter((b) => banSeverity(b) === "soft");
  const hiddenBlends = blends.filter((b) => b && b.amounts_disclosed === false);
  const certs = certifications
    .map((c) => c?.name)
    .filter((n) => TRUSTED_CERTIFICATIONS.includes(n));

  const notes = [];
  if (source === "barcode") {
    notes.push("Based on the ingredient list in a public product database, which can be incomplete or out of date. Scanning the label itself is more reliable.");
  }
  if (source === "community") {
    notes.push("Based on a label another CheckPeak user scanned for this barcode. Formulas change, so scan the label yourself if the product looks different.");
  }

  if (hard.length) {
    return {
      status: "flagged",
      headline: hard.length === 1 ? "Banned substance found" : `${hard.length} banned ingredients found`,
      detail: "This product lists an ingredient on a banned-substance list. Don't take it unless your compliance office clears it in writing.",
      certifications: certs,
      notes,
    };
  }

  if (soft.length || hiddenBlends.length) {
    const reasons = [];
    if (soft.length) reasons.push("it contains a restricted substance (for example, banned in competition or above a set amount)");
    if (hiddenBlends.length) reasons.push(`${hiddenBlends.length === 1 ? "a proprietary blend hides" : "proprietary blends hide"} ingredient amounts, so a banned stimulant can't be ruled out`);
    return {
      status: "review",
      headline: soft.length ? "Restricted substance: check before using" : "Needs review before using",
      detail: `Check with your athletic trainer before using this product: ${reasons.join(", and ")}.`,
      certifications: certs,
      notes,
    };
  }

  return {
    status: "no_match",
    headline: "No matches on our banned list",
    detail: certs.length
      ? `None of the listed ingredients matched our banned list, and the label shows a ${certs[0]} seal. Confirm the product is listed on the certifier's website before relying on it.`
      : "None of the listed ingredients matched our banned list. That isn't a guarantee: banned lists cover whole classes of substances, and supplements can be contaminated. Third-party certified products (NSF Certified for Sport, Informed Sport) are the safest choice.",
    certifications: certs,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Structured label check (from vision extraction)
// ---------------------------------------------------------------------------

function ingredientSearchText(ing) {
  return [ing?.name, ...(Array.isArray(ing?.aliases) ? ing.aliases : [])].filter(Boolean).join(", ");
}

// How precisely a database record matched this ingredient: exact name > full name > synonym > single word.
function specificity(hit, ing) {
  const labelNames = [ing?.name, ...(Array.isArray(ing?.aliases) ? ing.aliases : [])].map(normalizeForPhrase);
  const recordName = normalizeForPhrase(hit.fields["Substance Name"] || hit.fields.Name || "");
  if (labelNames.includes(recordName)) return 4;
  return { name: 3, synonym: 2, token: 1 }[hit.matchKind] || 0;
}

function mostSpecific(hits, ing) {
  return hits.reduce((best, h) => (!best || specificity(h, ing) > specificity(best, ing) ? h : best), null);
}

// Matches each extracted ingredient on its own, so marketing copy and neighbouring
// ingredients can never combine into a false match. Each ingredient keeps only its most
// specific record, so one ingredient doesn't show up as several substances.
export function checkExtractedLabel(extraction, { bannedRecords, ingredientRecords }) {
  const ingredients = Array.isArray(extraction?.ingredients) ? extraction.ingredients : [];

  const bannedById = new Map();
  const infoById   = new Map();
  const annotated = ingredients.map((ing) => {
    const text = ingredientSearchText(ing);

    const hits = matchBannedRecords(text, bannedRecords);
    const hardHits = hits.filter((h) => banSeverity(h) === "hard");
    const chosen = mostSpecific(hardHits.length ? hardHits : hits, ing); // a hard ban always wins
    if (chosen && !bannedById.has(chosen.id)) bannedById.set(chosen.id, chosen);

    // Single-word matches ("creatine" -> "Creatine Orotate") are too loose for info cards
    const info = mostSpecific(matchIngredientRecords(text, ingredientRecords), ing);
    if (info && specificity(info, ing) >= 2 && !infoById.has(info.id)) infoById.set(info.id, info);

    return {
      name:    ing.name,
      amount:  ing.amount || null,
      blend:   ing.blend || null,
      flag: chosen ? {
        substance: chosen.fields["Substance Name"],
        severity:  banSeverity(chosen),
        banType:   chosen.fields["Ban Type"],
        bannedBy:  chosen.fields["Banned By"],
      } : null,
    };
  });

  const combinedText = ingredients.map(ingredientSearchText).join(", ");
  const matchedIngredients = Array.from(infoById.values());
  const matchedBanned = enrichBannedFromIngredients(Array.from(bannedById.values()), matchedIngredients);

  const blends         = Array.isArray(extraction?.proprietary_blends) ? extraction.proprietary_blends : [];
  const certifications = Array.isArray(extraction?.certifications)     ? extraction.certifications     : [];

  return {
    ingredients: annotated,
    ingredientsText: combinedText,
    matchedBanned,
    matchedIngredients,
    bannedDetails: summarizeBanned(matchedBanned),
    verdict: buildVerdict({ matchedBanned, blends, certifications, source: "label" }),
  };
}

// Free-text check (barcode database text, SmartStack, pasted ingredient lists)
export function checkIngredientText(text, { bannedRecords, ingredientRecords }, { source = "text" } = {}) {
  const matchedIngredients = matchIngredientRecords(text, ingredientRecords);
  const matchedBanned = enrichBannedFromIngredients(matchBannedRecords(text, bannedRecords), matchedIngredients);
  return {
    matchedBanned,
    matchedIngredients,
    bannedDetails: summarizeBanned(matchedBanned),
    verdict: buildVerdict({ matchedBanned, source }),
  };
}
