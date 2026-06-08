-- CheckPeak Full Platform Schema
-- Paste this entire file into the Supabase SQL Editor and run it once.
-- Tables are ordered to satisfy foreign key dependencies.

-- ════════════════════════════════════════════════════════════════════════════
-- SUPPLEMENT PLATFORM — reference tables (no FKs)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ingredients (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id         TEXT UNIQUE,
  name                TEXT NOT NULL,
  synonyms            TEXT,
  pharmacology_notes  TEXT,
  benefits            TEXT,
  weaknesses          TEXT,
  nutrient_antagonism TEXT,
  sources             TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ingredients_name_idx ON ingredients(name);

CREATE TABLE IF NOT EXISTS banned_substances (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id    TEXT UNIQUE,
  substance_name TEXT NOT NULL,
  synonyms       TEXT,
  banned_by      TEXT,
  ban_type       TEXT,
  dosage_limit   TEXT,
  notes          TEXT,
  citation       TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS banned_substances_name_idx ON banned_substances(substance_name);

CREATE TABLE IF NOT EXISTS affiliate_products (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id  TEXT UNIQUE,
  name         TEXT,
  asin         TEXT,
  brand        TEXT,
  category     TEXT,
  price        NUMERIC(10,2),
  image_url    TEXT,
  product_url  TEXT,
  tags         JSONB DEFAULT '[]',
  active       BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ════════════════════════════════════════════════════════════════════════════
-- ORG PLATFORM — core tables
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS organizations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id   TEXT UNIQUE,
  name          TEXT NOT NULL,
  email         TEXT,
  password_hash TEXT,
  token         TEXT UNIQUE NOT NULL,  -- ORG-XXXXX-XXXXX
  type          TEXT DEFAULT 'Organization',
  contact_name  TEXT,
  phone_number  TEXT,
  website       TEXT,
  address       TEXT,
  notes         TEXT,
  status        TEXT DEFAULT 'Active',
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS organizations_token_idx ON organizations(token);
CREATE INDEX IF NOT EXISTS organizations_email_idx ON organizations(email);

CREATE TABLE IF NOT EXISTS billing (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id               TEXT UNIQUE,
  org_id                    UUID REFERENCES organizations(id) ON DELETE SET NULL,
  token                     TEXT UNIQUE NOT NULL,  -- org token
  billing_contact_name      TEXT,
  billing_email             TEXT,
  billing_phone             TEXT,
  billing_role              TEXT,
  billing_address_1         TEXT,
  billing_address_2         TEXT,
  billing_city              TEXT,
  billing_state             TEXT,
  billing_postal_code       TEXT,
  billing_country           TEXT,
  legal_business_name       TEXT,
  dba_name                  TEXT,
  business_type             TEXT,
  tax_id_type               TEXT,
  tax_id_last4              TEXT,
  tax_exempt                BOOLEAN DEFAULT false,
  tax_exempt_cert_url       TEXT,
  plan                      TEXT,
  billing_status            TEXT DEFAULT 'Sandbox',
  renewal_date              TIMESTAMPTZ,
  trial_ends                TIMESTAMPTZ,
  current_period_end        TIMESTAMPTZ,
  sandbox_ends              TIMESTAMPTZ,
  stripe_customer_id        TEXT,
  stripe_subscription_id    TEXT,
  preferred_payment_method  TEXT,
  payment_terms             TEXT,
  po_required               BOOLEAN DEFAULT false,
  po_number                 TEXT,
  bank_name                 TEXT,
  routing_last4             TEXT,
  account_last4             TEXT,
  wire_instructions         TEXT,
  currency                  TEXT DEFAULT 'USD',
  last_synced_from_stripe   TIMESTAMPTZ,
  created_at                TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS billing_token_idx ON billing(token);
CREATE INDEX IF NOT EXISTS billing_stripe_customer_idx ON billing(stripe_customer_id);

CREATE TABLE IF NOT EXISTS org_members (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id       TEXT UNIQUE,
  org_id            UUID REFERENCES organizations(id) ON DELETE CASCADE,
  org_token         TEXT,
  email             TEXT NOT NULL,
  name              TEXT,
  role              TEXT DEFAULT 'trainer',  -- trainer | admin
  active            BOOLEAN DEFAULT true,
  invite_token      TEXT,
  invite_expires_at TIMESTAMPTZ,
  invite_used_at    TIMESTAMPTZ,
  password_hash     TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS org_members_org_id_idx ON org_members(org_id);
CREATE INDEX IF NOT EXISTS org_members_email_idx  ON org_members(email);
CREATE INDEX IF NOT EXISTS org_members_org_token_idx ON org_members(org_token);

CREATE TABLE IF NOT EXISTS athletes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id    TEXT UNIQUE,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL,
  password_hash  TEXT,
  athlete_token  TEXT UNIQUE NOT NULL,  -- ATH-XXXX-XXXX
  org_id         UUID REFERENCES organizations(id) ON DELETE SET NULL,
  org_token      TEXT,
  title          TEXT DEFAULT 'Athlete',
  role           TEXT DEFAULT 'Athlete',
  type           TEXT DEFAULT 'Athlete',
  phone          TEXT,
  source         TEXT,
  plan           TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS athletes_email_idx         ON athletes(email);
CREATE INDEX IF NOT EXISTS athletes_athlete_token_idx ON athletes(athlete_token);
CREATE INDEX IF NOT EXISTS athletes_org_id_idx        ON athletes(org_id);
CREATE INDEX IF NOT EXISTS athletes_org_token_idx     ON athletes(org_token);

-- ─── Exercise Library ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exercise_library (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id  TEXT UNIQUE,
  name         TEXT NOT NULL,
  category     TEXT,
  description  TEXT,
  video_url    TEXT,
  muscle_groups JSONB DEFAULT '[]',
  equipment    TEXT,
  instructions TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS exercise_library_name_idx ON exercise_library(name);

-- ─── Workouts (org scheduling) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_workouts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id  TEXT UNIQUE,
  org_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
  athlete_id   UUID REFERENCES athletes(id) ON DELETE CASCADE,
  created_by_id UUID REFERENCES org_members(id) ON DELETE SET NULL,
  org_token    TEXT,
  date         DATE NOT NULL,
  title        TEXT,
  status       TEXT DEFAULT 'assigned',  -- assigned | completed | pending_review | draft
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS daily_workouts_org_id_idx     ON daily_workouts(org_id);
CREATE INDEX IF NOT EXISTS daily_workouts_athlete_id_idx ON daily_workouts(athlete_id);
CREATE INDEX IF NOT EXISTS daily_workouts_date_idx       ON daily_workouts(date);

CREATE TABLE IF NOT EXISTS workout_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id       TEXT UNIQUE,
  org_id            UUID REFERENCES organizations(id) ON DELETE CASCADE,
  daily_workout_id  UUID REFERENCES daily_workouts(id) ON DELETE CASCADE,
  sort_order        INTEGER DEFAULT 0,
  exercise_name     TEXT,
  sets              INTEGER,
  reps              TEXT,
  weight            TEXT,
  rpe               TEXT,
  rest              TEXT,
  instructions      TEXT,
  video_url         TEXT,
  evidence_required TEXT DEFAULT 'none',  -- none | photo | video | photo_or_video
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workout_items_daily_workout_id_idx ON workout_items(daily_workout_id);

CREATE TABLE IF NOT EXISTS workout_completions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id       TEXT UNIQUE,
  org_id            UUID REFERENCES organizations(id) ON DELETE CASCADE,
  workout_item_id   UUID REFERENCES workout_items(id) ON DELETE CASCADE,
  athlete_id        UUID REFERENCES athletes(id) ON DELETE CASCADE,
  reviewed_by_id    UUID REFERENCES org_members(id) ON DELETE SET NULL,
  status            TEXT DEFAULT 'completed',  -- completed | pending_review | rejected
  completed_at      TIMESTAMPTZ DEFAULT now(),
  reviewed_at       TIMESTAMPTZ,
  review_note       TEXT
);
CREATE INDEX IF NOT EXISTS workout_completions_athlete_id_idx      ON workout_completions(athlete_id);
CREATE INDEX IF NOT EXISTS workout_completions_workout_item_id_idx ON workout_completions(workout_item_id);

CREATE TABLE IF NOT EXISTS completion_evidence (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id           TEXT UNIQUE,
  workout_completion_id UUID REFERENCES workout_completions(id) ON DELETE CASCADE,
  athlete_id            UUID REFERENCES athletes(id) ON DELETE CASCADE,
  evidence_type         TEXT DEFAULT 'photo',  -- photo | video
  url                   TEXT,
  cloudinary_public_id  TEXT,
  submitted_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS completion_evidence_completion_id_idx ON completion_evidence(workout_completion_id);

CREATE TABLE IF NOT EXISTS set_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id     TEXT UNIQUE,
  workout_item_id UUID REFERENCES workout_items(id) ON DELETE CASCADE,
  athlete_id      UUID REFERENCES athletes(id) ON DELETE CASCADE,
  set_number      INTEGER,
  reps_completed  INTEGER,
  weight_used     TEXT,
  rpe_actual      TEXT,
  notes           TEXT,
  logged_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS set_logs_athlete_id_idx      ON set_logs(athlete_id);
CREATE INDEX IF NOT EXISTS set_logs_workout_item_id_idx ON set_logs(workout_item_id);

-- ─── Planning / Programming ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id  TEXT UNIQUE,
  org_token    TEXT,
  name         TEXT NOT NULL,
  structured   JSONB DEFAULT '{}',
  created_by   TEXT,
  status       TEXT DEFAULT 'Active',
  notes        TEXT,
  tags         TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plan_templates_org_token_idx ON plan_templates(org_token);

CREATE TABLE IF NOT EXISTS prescriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id  TEXT UNIQUE,
  athlete_id   UUID REFERENCES athletes(id) ON DELETE CASCADE,
  org_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
  athlete_token TEXT,
  title        TEXT,
  prescription TEXT,
  created_by   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS prescriptions_athlete_id_idx ON prescriptions(athlete_id);

-- ─── Nutrition ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nutrition_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id     TEXT UNIQUE,
  athlete_id      UUID REFERENCES athletes(id) ON DELETE CASCADE,
  athlete_token   TEXT,
  status          TEXT DEFAULT 'active',  -- active | archived
  phase           TEXT,  -- Surplus | Maintain | Cut | Game Week | Bye Week
  daily_calories  TEXT,
  daily_protein   TEXT,
  daily_carbs     TEXT,
  daily_fat       TEXT,
  daily_hydration TEXT,
  plan_json       JSONB DEFAULT '{}',
  prescription    TEXT,
  created_by      TEXT,
  archived_by     TEXT,
  archived_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nutrition_plans_athlete_id_idx    ON nutrition_plans(athlete_id);
CREATE INDEX IF NOT EXISTS nutrition_plans_athlete_token_idx ON nutrition_plans(athlete_token);

CREATE TABLE IF NOT EXISTS nutrition_completions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id     TEXT UNIQUE,
  athlete_id      UUID REFERENCES athletes(id) ON DELETE CASCADE,
  athlete_token   TEXT,
  date            DATE NOT NULL,
  completion_json JSONB DEFAULT '{}',
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nutrition_completions_athlete_token_date_idx
  ON nutrition_completions(athlete_token, date);

CREATE TABLE IF NOT EXISTS nutrition_checkins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id   TEXT UNIQUE,
  athlete_id    UUID REFERENCES athletes(id) ON DELETE CASCADE,
  athlete_token TEXT,
  date          DATE NOT NULL,
  data          JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nutrition_checkins_athlete_token_idx ON nutrition_checkins(athlete_token);

-- ─── Other org tables ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS day_planner (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id TEXT UNIQUE,
  athlete_id  UUID REFERENCES athletes(id) ON DELETE CASCADE,
  org_token   TEXT,
  date        DATE NOT NULL,
  data        JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS day_planner_athlete_id_idx ON day_planner(athlete_id);

CREATE TABLE IF NOT EXISTS class_attendance (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id      TEXT UNIQUE,
  athlete_id       UUID REFERENCES athletes(id) ON DELETE CASCADE,
  athlete_token    TEXT,
  org_token        TEXT,
  class_id         TEXT,
  class_title      TEXT,
  date             DATE NOT NULL,
  photo_url        TEXT,
  cloudinary_id    TEXT,
  attended_at      TIMESTAMPTZ DEFAULT now(),
  coach_notes      TEXT
);
CREATE INDEX IF NOT EXISTS class_attendance_athlete_token_idx ON class_attendance(athlete_token);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id TEXT UNIQUE,
  org_token   TEXT,
  actor_email TEXT,
  action      TEXT,
  target      TEXT,
  details     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_org_token_idx ON audit_logs(org_token);

-- ════════════════════════════════════════════════════════════════════════════
-- SUPPLEMENT PLATFORM — user data
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS scans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id     TEXT UNIQUE,
  user_email      TEXT NOT NULL,
  scan_name       TEXT,
  scan_date       TIMESTAMPTZ DEFAULT now(),
  stack_details   JSONB DEFAULT '{}',
  results_summary TEXT,
  external_id     TEXT,
  banned_details  JSONB DEFAULT '{}',
  product_name    TEXT,
  share_token     TEXT UNIQUE,
  share_enabled   BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scans_user_email_idx  ON scans(user_email);
CREATE INDEX IF NOT EXISTS scans_share_token_idx ON scans(share_token);

CREATE TABLE IF NOT EXISTS saved_stacks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id TEXT UNIQUE,
  user_email  TEXT NOT NULL,
  stack_id    TEXT NOT NULL,
  date_saved  TIMESTAMPTZ DEFAULT now(),
  notes       TEXT,
  UNIQUE(user_email, stack_id)
);
CREATE INDEX IF NOT EXISTS saved_stacks_user_email_idx ON saved_stacks(user_email);

-- ════════════════════════════════════════════════════════════════════════════
-- COMMERCIAL TRAINER PLATFORM
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS trainers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id         TEXT UNIQUE,
  user_id             TEXT NOT NULL,
  name                TEXT NOT NULL,
  slug                TEXT UNIQUE NOT NULL,
  specialty           TEXT,
  bio                 TEXT DEFAULT '',
  basic_price         NUMERIC(10,2) DEFAULT 0,
  premium_price       NUMERIC(10,2) DEFAULT 0,
  ultra_price         NUMERIC(10,2) DEFAULT 0,
  basic_perks         TEXT,
  premium_perks       TEXT,
  ultra_perks         TEXT,
  active_client_count INTEGER DEFAULT 0,
  client_count        TEXT,
  org_type            TEXT,
  goal                TEXT,
  sport               TEXT,
  library_locked      BOOLEAN DEFAULT false,
  hero_image_url      TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trainers_user_id_idx ON trainers(user_id);
CREATE INDEX IF NOT EXISTS trainers_slug_idx    ON trainers(slug);

CREATE TABLE IF NOT EXISTS videos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id   TEXT UNIQUE,
  trainer_id    UUID REFERENCES trainers(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT DEFAULT '',
  source_type   TEXT DEFAULT 'upload',
  embed_url     TEXT DEFAULT '',
  mux_upload_id TEXT DEFAULT '',
  mux_asset_id  TEXT DEFAULT '',
  playback_id   TEXT DEFAULT '',
  tier          TEXT NOT NULL DEFAULT 'Basic',
  tags          JSONB DEFAULT '{}',
  status        TEXT DEFAULT 'pending',
  published     BOOLEAN DEFAULT false,
  price         NUMERIC(10,2),
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS videos_trainer_id_idx    ON videos(trainer_id);
CREATE INDEX IF NOT EXISTS videos_mux_upload_id_idx ON videos(mux_upload_id);
CREATE INDEX IF NOT EXISTS videos_mux_asset_id_idx  ON videos(mux_asset_id);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id            TEXT UNIQUE,
  trainer_id             UUID REFERENCES trainers(id) ON DELETE CASCADE,
  client_email           TEXT NOT NULL,
  client_name            TEXT DEFAULT '',
  tier                   TEXT NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'active',
  stripe_subscription_id TEXT,
  stripe_customer_id     TEXT,
  start_date             DATE,
  end_date               DATE,
  created_at             TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_trainer_id_idx   ON subscriptions(trainer_id);
CREATE INDEX IF NOT EXISTS subscriptions_client_email_idx ON subscriptions(client_email);
CREATE INDEX IF NOT EXISTS subscriptions_stripe_sub_idx   ON subscriptions(stripe_subscription_id);

CREATE TABLE IF NOT EXISTS purchases (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id              TEXT UNIQUE,
  trainer_id               UUID REFERENCES trainers(id) ON DELETE CASCADE,
  client_email             TEXT NOT NULL,
  client_name              TEXT DEFAULT '',
  item_id                  TEXT NOT NULL,
  item_type                TEXT DEFAULT 'video',
  status                   TEXT DEFAULT 'active',
  price_paid               NUMERIC(10,2),
  stripe_payment_intent_id TEXT,
  stripe_session_id        TEXT,
  created_at               TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS purchases_trainer_id_idx   ON purchases(trainer_id);
CREATE INDEX IF NOT EXISTS purchases_client_email_idx ON purchases(client_email);
CREATE INDEX IF NOT EXISTS purchases_item_id_idx      ON purchases(item_id);

CREATE TABLE IF NOT EXISTS video_completions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id  TEXT UNIQUE,
  trainer_id   UUID REFERENCES trainers(id) ON DELETE CASCADE,
  video_id     TEXT,
  client_email TEXT NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS video_completions_trainer_client_idx
  ON video_completions(trainer_id, client_email);

CREATE TABLE IF NOT EXISTS commercial_workouts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id TEXT UNIQUE,
  trainer_id  UUID REFERENCES trainers(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT DEFAULT '',
  tier        TEXT DEFAULT 'Basic',
  published   BOOLEAN DEFAULT false,
  tags        JSONB DEFAULT '{}',
  exercises   JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS commercial_workouts_trainer_id_idx ON commercial_workouts(trainer_id);

-- ════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- Service role key (API routes) bypasses RLS. Enabled as safety net.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE ingredients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE banned_substances    ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_products   ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing              ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members          ENABLE ROW LEVEL SECURITY;
ALTER TABLE athletes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_library     ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_workouts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_completions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE completion_evidence  ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_templates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_plans      ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_checkins   ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_planner          ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_attendance     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans                ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_stacks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases            ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_completions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_workouts  ENABLE ROW LEVEL SECURITY;
