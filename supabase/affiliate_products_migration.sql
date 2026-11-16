-- affiliate_products_migration.sql
-- Adds the columns the supplement product catalog needs so it can move off Airtable
-- (SmartStack, the Nutrition product picker, and the Amazon price/variation jobs).
-- Safe to run more than once. After running it: node scripts/sync-products-from-airtable.mjs --write

ALTER TABLE affiliate_products
  ADD COLUMN IF NOT EXISTS servings            numeric,
  ADD COLUMN IF NOT EXISTS nutrition_label_url text,
  ADD COLUMN IF NOT EXISTS short_link          text,      -- "Sh. Amazon/Stripe Link" (amzn.to)
  ADD COLUMN IF NOT EXISTS review_rating       numeric,
  ADD COLUMN IF NOT EXISTS review_count        integer,
  ADD COLUMN IF NOT EXISTS bought_last_month   integer,
  ADD COLUMN IF NOT EXISTS coach_pick          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS supplements         jsonb   NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS variations          jsonb,
  ADD COLUMN IF NOT EXISTS variation_count     integer,
  ADD COLUMN IF NOT EXISTS last_synced_at      timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at          timestamptz NOT NULL DEFAULT now();

-- product_url already exists and holds the full Amazon affiliate link ("Lo. Amazon/Stripe Link").

CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_products_airtable_id ON affiliate_products (airtable_id) WHERE airtable_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_affiliate_products_asin ON affiliate_products (asin);

GRANT SELECT, INSERT, UPDATE, DELETE ON affiliate_products TO service_role;
