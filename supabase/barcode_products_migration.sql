-- barcode_products: ingredient lists learned from users' label scans, keyed by barcode.
-- When a barcode isn't in any public product database and a signed-in user scans the label,
-- the label's ingredient list is saved here so the next scan of that barcode is instant.

CREATE TABLE IF NOT EXISTS barcode_products (
  barcode          TEXT PRIMARY KEY,            -- canonical GTIN (UPC-A as 12 digits)
  product_name     TEXT,
  ingredients_text TEXT NOT NULL,
  source           TEXT NOT NULL DEFAULT 'label_scan',
  contributed_by   TEXT,                        -- email of the user whose label scan filled it
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- Only the server (service role) reads and writes this table.
ALTER TABLE barcode_products ENABLE ROW LEVEL SECURITY;
