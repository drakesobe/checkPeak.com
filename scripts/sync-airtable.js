#!/usr/bin/env node
/**
 * scripts/sync-airtable.js
 *
 * Pulls the banned substances and ingredients tables from Airtable and
 * writes them as static JSON files used by /pages/api/check.js at runtime.
 *
 * Usage:
 *   node scripts/sync-airtable.js
 *
 * Requires the same env vars used by check.js. Load them with dotenv or
 * export them before running:
 *   export BANNED_API_KEY=...  BANNED_BASE_ID=...  BANNED_TABLE_NAME=...
 *   export INGREDIENT_API_KEY=... INGREDIENT_BASE_ID=... INGREDIENT_TABLE_NAME=...
 *
 * Or with dotenv-cli:
 *   npx dotenv -e .env.local -- node scripts/sync-airtable.js
 *
 * Add to package.json scripts:
 *   "sync-db": "npx dotenv -e .env.local -- node scripts/sync-airtable.js"
 *
 * Output:
 *   /data/banned.json
 *   /data/ingredients.json
 *
 * Commit both files to the repo. Redeploy after running.
 * Re-run whenever the Airtable tables are updated (~quarterly).
 */

const Airtable = require("airtable");
const fs       = require("fs");
const path     = require("path");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BANNED_CONFIG = {
  apiKey:    process.env.BANNED_API_KEY,
  baseId:    process.env.BANNED_BASE_ID,
  tableName: process.env.BANNED_TABLE_NAME,
  label:     "Banned substances",
  // Fields needed by check.js for matching + display
  fields: [
    "Substance Name",
    "Synonyms",
    "Synonyms (Extended)",
    "Depositor-Supplied Synonyms",
    "Ban Type",
    "Banned By",
    "Dosage Limit",
    "Notes",
    "Source / Citation",
    // Enrichment fields (may be populated or absent)
    "Benefits",
    "Weaknesses",
    "Nutrient Antagonism",
  ],
};

const INGREDIENTS_CONFIG = {
  apiKey:    process.env.INGREDIENT_API_KEY,
  baseId:    process.env.INGREDIENT_BASE_ID,
  tableName: process.env.INGREDIENT_TABLE_NAME,
  label:     "Ingredients",
  fields: [
    "Name",
    "Ingredient Name",
    "PubChem CID",
    "Synonyms",
    "Synonyms (Extended)",
    "Depositor-Supplied Synonyms",
    "Pharmacology Notes",
    "Benefits",
    "Weaknesses",
    "Nutrient Antagonism",
    "Sources / References",
  ],
};

const OUTPUT_DIR = path.join(__dirname, "..", "data");

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

async function fetchTable(config) {
  const { apiKey, baseId, tableName, label, fields } = config;

  if (!apiKey || !baseId || !tableName) {
    throw new Error(
      `Missing env vars for ${label}. Need: ` +
      [
        config === BANNED_CONFIG      ? "BANNED_API_KEY, BANNED_BASE_ID, BANNED_TABLE_NAME"
                                      : "INGREDIENT_API_KEY, INGREDIENT_BASE_ID, INGREDIENT_TABLE_NAME"
      ].join(", ")
    );
  }

  const base = new Airtable({ apiKey }).base(baseId);

  console.log(`  Fetching ${label} from Airtable...`);

  const records = [];
  await base(tableName)
    .select({
      view:     "Grid view",
      pageSize: 100,
      fields,                 // only pull the fields we actually use
    })
    .eachPage((page, next) => {
      for (const rec of page) {
        // Only include fields that have values — keeps JSON lean
        const cleanFields = {};
        for (const field of fields) {
          const v = rec.fields[field];
          if (v !== undefined && v !== null && v !== "") {
            cleanFields[field] = v;
          }
        }
        records.push({ id: rec.id, fields: cleanFields });
      }
      next();
    });

  return records;
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

function writeJSON(filename, data, label) {
  const outPath = path.join(OUTPUT_DIR, filename);
  const json    = JSON.stringify(data, null, 2);
  fs.writeFileSync(outPath, json, "utf8");

  const kb = (Buffer.byteLength(json, "utf8") / 1024).toFixed(1);
  console.log(`  ✓ Wrote ${data.length} ${label} records → ${path.relative(process.cwd(), outPath)} (${kb} KB)`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("\nCheckPeak — Airtable sync\n");

  // Ensure /data dir exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`  Created ${path.relative(process.cwd(), OUTPUT_DIR)}/`);
  }

  let totalErrors = 0;

  // Banned
  try {
    const banned = await fetchTable(BANNED_CONFIG);
    writeJSON("banned.json", banned, "banned substance");
  } catch (err) {
    console.error(`  ✗ Banned sync failed: ${err.message}`);
    totalErrors++;
  }

  // Ingredients
  try {
    const ingredients = await fetchTable(INGREDIENTS_CONFIG);
    writeJSON("ingredients.json", ingredients, "ingredient");
  } catch (err) {
    console.error(`  ✗ Ingredients sync failed: ${err.message}`);
    totalErrors++;
  }

  if (totalErrors > 0) {
    console.error(`\n${totalErrors} error(s). Fix above issues and re-run.\n`);
    process.exit(1);
  }

  console.log(`
Done. Next steps:
  1. git add data/banned.json data/ingredients.json
  2. git commit -m "chore: sync Airtable banned/ingredients DB"
  3. git push  →  triggers redeploy

Run again whenever the Airtable tables are updated.
`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});