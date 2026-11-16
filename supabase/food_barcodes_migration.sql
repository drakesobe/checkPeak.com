-- food_barcodes_migration.sql
-- Cache of barcode → nutrition (per 100 g + serving) for the athlete food logger.
-- Filled on first lookup from USDA / Nutritionix / Open Food Facts; repeat scans are instant.
-- (Separate from barcode_products, which stores ingredient lists for the supplement scanner.)
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS food_barcodes (
  barcode     text        PRIMARY KEY,          -- canonical GTIN (lib/gtin.js)
  food        jsonb       NOT NULL,             -- { name, brand, cal, pro, carb, fat, measures[] } per 100 g
  source      text        NOT NULL,             -- usda | nutritionix | openfoodfacts
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE food_barcodes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_barcodes TO service_role;
