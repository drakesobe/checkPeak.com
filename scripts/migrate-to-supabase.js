// scripts/migrate-to-supabase.js
// Full platform migration: Airtable → Supabase
// Run: node -r dotenv/config scripts/migrate-to-supabase.js dotenv_config_path=.env.local

const { createClient } = require("@supabase/supabase-js");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── Airtable fetch helpers ───────────────────────────────────────────────────

function atHeaders(apiKey) {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

async function fetchAll(baseId, tableId, apiKey) {
  const records = [];
  let offset = null;
  const headers = atHeaders(apiKey);
  do {
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}${offset ? `?offset=${offset}` : ""}`;
    const res  = await fetch(url, { headers });
    const data = await res.json();
    if (data.error) { console.error("  Airtable error:", data.error); break; }
    records.push(...(data.records ?? []));
    offset = data.offset ?? null;
  } while (offset);
  return records;
}

// Re-usable upsert with logging
async function upsert(table, row, label) {
  const { error } = await sb.from(table).upsert(row, { onConflict: "airtable_id" });
  if (error) { console.error(`  ✗ ${table} [${label}]:`, error.message); return false; }
  return true;
}

function parseJson(v, fallback = {}) {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "object") return v;
  try { return JSON.parse(v); } catch { return fallback; }
}

// ─── ID maps (airtable recXXX → supabase UUID) ────────────────────────────────

const maps = {
  orgs:     {},  // airtable_id → supabase UUID
  athletes: {},
  members:  {},
  trainers: {},
  workouts: {},  // daily_workouts
  items:    {},  // workout_items
  wc:       {},  // workout_completions
};

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log("=== CheckPeak Full Platform Migration: Airtable → Supabase ===\n");

  const MAIN_KEY  = process.env.COMMERCIAL_TRAINERS_API_KEY; // same key for whole main base
  const MAIN_BASE = process.env.COMMERCIAL_TRAINERS_BASE_ID; // appspE640Pggw1VP9

  // ══════════════════════════════════════════════════════════════════════════
  // 1. INGREDIENTS (separate base)
  // ══════════════════════════════════════════════════════════════════════════
  if (process.env.INGREDIENT_BASE_ID && process.env.INGREDIENT_TABLE_NAME) {
    console.log("── Ingredients ──");
    const rows = await fetchAll(process.env.INGREDIENT_BASE_ID, process.env.INGREDIENT_TABLE_NAME, process.env.INGREDIENT_API_KEY);
    console.log(`  ${rows.length} records`);
    for (const r of rows) {
      const f = r.fields ?? {};
      await upsert("ingredients", {
        airtable_id:         r.id,
        name:                f["Name"] ?? f["name"] ?? "",
        synonyms:            f["Synonyms (Extended)"] ?? f["Synonyms"] ?? null,
        pharmacology_notes:  f["Pharmacology Notes"] ?? null,
        benefits:            f["Benefits"] ?? null,
        weaknesses:          f["Weaknesses"] ?? null,
        nutrient_antagonism: f["Nutrient Antagonism"] ?? null,
        sources:             f["Sources / References"] ?? f["Sources"] ?? null,
      }, f["Name"] ?? r.id);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. BANNED SUBSTANCES
  // ══════════════════════════════════════════════════════════════════════════
  if (process.env.BANNED_TABLE_NAME) {
    console.log("\n── Banned Substances ──");
    const rows = await fetchAll(MAIN_BASE, process.env.BANNED_TABLE_NAME, MAIN_KEY);
    console.log(`  ${rows.length} records`);
    for (const r of rows) {
      const f = r.fields ?? {};
      await upsert("banned_substances", {
        airtable_id:   r.id,
        substance_name: f["Substance Name"] ?? f["Name"] ?? "",
        synonyms:      f["Synonyms"] ?? null,
        banned_by:     f["Banned By"] ?? null,
        ban_type:      f["Ban Type"] ?? null,
        dosage_limit:  f["Dosage Limit"] ?? null,
        notes:         f["Notes"] ?? null,
        citation:      f["Source / Citation"] ?? f["Citation"] ?? null,
      }, f["Substance Name"] ?? r.id);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. AFFILIATE PRODUCTS / SMARTSTACK
  // ══════════════════════════════════════════════════════════════════════════
  if (process.env.AFFILIATE_TABLE_NAME) {
    console.log("\n── Affiliate Products ──");
    const rows = await fetchAll(MAIN_BASE, process.env.AFFILIATE_TABLE_NAME, MAIN_KEY);
    console.log(`  ${rows.length} records`);
    for (const r of rows) {
      const f = r.fields ?? {};
      await upsert("affiliate_products", {
        airtable_id: r.id,
        name:        f["Name"] ?? f["Product Name"] ?? null,
        asin:        f["ASIN"] ?? null,
        brand:       f["Brand"] ?? null,
        category:    f["Category"] ?? null,
        price:       f["Price"] ? Number(f["Price"]) : null,
        image_url:   f["Image URL"] ?? f["ImageURL"] ?? null,
        product_url: f["Product URL"] ?? f["URL"] ?? null,
        tags:        parseJson(f["Tags"], []),
        active:      f["Active"] !== false,
      }, f["Name"] ?? r.id);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. ORGANIZATIONS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── Organizations ──");
  const atOrgs = await fetchAll(MAIN_BASE, process.env.ORGANIZATIONS_TABLE_NAME, MAIN_KEY);
  console.log(`  ${atOrgs.length} records`);
  for (const r of atOrgs) {
    const f = r.fields ?? {};
    const row = {
      airtable_id:   r.id,
      name:          f["Name"] ?? "Unnamed",
      email:         f["Email"] ?? null,
      password_hash: f["Password"] ?? null,
      token:         f["Token"] ?? r.id,
      type:          f["Type"] ?? "Organization",
      contact_name:  f["Contact Name"] ?? null,
      phone_number:  f["Phone Number"] ?? null,
      website:       f["Website"] ?? null,
      address:       f["Address"] ?? null,
      notes:         f["Notes"] ?? null,
      status:        f["Status"] ?? "Active",
    };
    const { data, error } = await sb.from("organizations").upsert(row, { onConflict: "airtable_id" }).select("id").single();
    if (error) { console.error(`  ✗ org ${r.id}:`, error.message); continue; }
    maps.orgs[r.id] = data.id;
    console.log(`  ✓ ${f["Name"] ?? r.id}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 5. BILLING
  // ══════════════════════════════════════════════════════════════════════════
  if (process.env.BILLING_TABLE_NAME) {
    console.log("\n── Billing ──");
    const rows = await fetchAll(MAIN_BASE, process.env.BILLING_TABLE_NAME, MAIN_KEY);
    console.log(`  ${rows.length} records`);
    for (const r of rows) {
      const f = r.fields ?? {};
      const orgId = f["Organization"]?.[0] ? maps.orgs[f["Organization"][0]] : null;
      await upsert("billing", {
        airtable_id:             r.id,
        org_id:                  orgId,
        token:                   f["Token"] ?? r.id,
        billing_contact_name:    f["Billing Contact Name"] ?? null,
        billing_email:           f["Billing Email"] ?? null,
        billing_phone:           f["Billing Phone"] ?? null,
        billing_role:            f["Billing Role/Title"] ?? null,
        billing_address_1:       f["Billing Address Line 1"] ?? null,
        billing_address_2:       f["Billing Address Line 2"] ?? null,
        billing_city:            f["Billing City"] ?? null,
        billing_state:           f["Billing State/Province"] ?? null,
        billing_postal_code:     f["Billing Postal Code"] ?? null,
        billing_country:         f["Billing Country"] ?? null,
        legal_business_name:     f["Legal Business Name"] ?? null,
        dba_name:                f["DBA Name"] ?? null,
        business_type:           f["Business Type"] ?? null,
        tax_id_last4:            f["Tax ID (Last 4 only)"] ?? null,
        tax_exempt:              Boolean(f["Tax Exempt"]),
        plan:                    f["Plan"] ?? null,
        billing_status:          f["Billing Status"] ?? "Sandbox",
        renewal_date:            f["Renewal Date"] ?? null,
        trial_ends:              f["Trial Ends"] ?? null,
        current_period_end:      f["Current Period End"] ?? null,
        stripe_customer_id:      f["Stripe Customer ID"] ?? null,
        stripe_subscription_id:  f["Stripe Subscription ID"] ?? null,
        currency:                f["Currency"] ?? "USD",
      }, f["Token"] ?? r.id);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 6. ORG MEMBERS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── Org Members ──");
  const atMembers = await fetchAll(MAIN_BASE, process.env.ORG_MEMBERS_TABLE_ID, MAIN_KEY);
  console.log(`  ${atMembers.length} records`);
  for (const r of atMembers) {
    const f = r.fields ?? {};
    const orgAirtableId = Array.isArray(f["Organization"]) ? f["Organization"][0] : f["Organization"];
    const orgId = orgAirtableId ? maps.orgs[orgAirtableId] : null;
    const row = {
      airtable_id:       r.id,
      org_id:            orgId,
      org_token:         f["OrgToken"] ?? null,
      email:             f["Email"] ?? "",
      name:              f["Name"] ?? null,
      role:              f["Role"] ?? "trainer",
      active:            f["Active"] !== false,
      invite_token:      f["InviteToken"] ?? null,
      invite_expires_at: f["InviteExpiresAt"] ?? null,
      invite_used_at:    f["InviteUsedAt"] ?? null,
      password_hash:     f["PasswordHash"] ?? null,
    };
    const { data, error } = await sb.from("org_members").upsert(row, { onConflict: "airtable_id" }).select("id").single();
    if (error) { console.error(`  ✗ member ${r.id}:`, error.message); continue; }
    maps.members[r.id] = data.id;
    process.stdout.write(".");
  }
  console.log("");

  // ══════════════════════════════════════════════════════════════════════════
  // 7. ATHLETES
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── Athletes ──");
  const atAthletes = await fetchAll(MAIN_BASE, process.env.ATHLETE_TABLE_NAME, MAIN_KEY);
  console.log(`  ${atAthletes.length} records`);
  for (const r of atAthletes) {
    const f = r.fields ?? {};
    const orgAirtableId = Array.isArray(f["Organization"]) ? f["Organization"][0] : f["Organization"];
    const orgId = orgAirtableId ? maps.orgs[orgAirtableId] : null;
    const row = {
      airtable_id:   r.id,
      name:          f["Name"] ?? "Unnamed",
      email:         f["Email"] ?? "",
      password_hash: f["Password"] ?? null,
      athlete_token: f["AthleteToken"] ?? `ATH-${r.id.slice(3, 7)}-${r.id.slice(7, 11)}`,
      org_id:        orgId,
      org_token:     f["Token"] ?? null,
      title:         f["Title"] ?? "Athlete",
      role:          f["Role"] ?? "Athlete",
      type:          f["Type"] ?? "Athlete",
      phone:         f["Phone"] ?? null,
      source:        f["Source"] ?? null,
      plan:          f["Plan"] ?? null,
      created_at:    f["CreatedAt"] ?? f["Created"] ?? new Date().toISOString(),
    };
    const { data, error } = await sb.from("athletes").upsert(row, { onConflict: "airtable_id" }).select("id").single();
    if (error) { console.error(`  ✗ athlete ${r.id} (${f["Email"]}):`, error.message); continue; }
    maps.athletes[r.id] = data.id;
    process.stdout.write(".");
  }
  console.log("");

  // ══════════════════════════════════════════════════════════════════════════
  // 8. SCANS
  // ══════════════════════════════════════════════════════════════════════════
  if (process.env.SCANS_TABLE_NAME) {
    console.log("\n── Scans ──");
    const rows = await fetchAll(MAIN_BASE, process.env.SCANS_TABLE_NAME, MAIN_KEY);
    console.log(`  ${rows.length} records`);
    for (const r of rows) {
      const f = r.fields ?? {};
      await upsert("scans", {
        airtable_id:     r.id,
        user_email:      f["UserEmail"] ?? "",
        scan_name:       f["ScanName"] ?? null,
        scan_date:       f["ScanDate"] ?? null,
        stack_details:   parseJson(f["StackDetails"]),
        results_summary: f["ResultsSummary"] ?? null,
        external_id:     f["ID"] ?? null,
        banned_details:  parseJson(f["BannedDetails"]),
        product_name:    f["ProductName"] ?? null,
        share_token:     f["ShareToken"] ?? null,
        share_enabled:   Boolean(f["ShareEnabled"]),
      }, f["UserEmail"] ?? r.id);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 9. SAVED STACKS
  // ══════════════════════════════════════════════════════════════════════════
  if (process.env.SAVEDSTACKS_TABLE_NAME) {
    console.log("\n── Saved Stacks ──");
    const rows = await fetchAll(MAIN_BASE, process.env.SAVEDSTACKS_TABLE_NAME, MAIN_KEY);
    console.log(`  ${rows.length} records`);
    for (const r of rows) {
      const f = r.fields ?? {};
      await upsert("saved_stacks", {
        airtable_id: r.id,
        user_email:  f["UserEmail"] ?? "",
        stack_id:    f["StackID"] ?? "",
        date_saved:  f["DateSaved"] ?? null,
        notes:       f["Notes"] ?? null,
      }, `${f["UserEmail"]}:${f["StackID"]}`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 10. PLAN TEMPLATES
  // ══════════════════════════════════════════════════════════════════════════
  if (process.env.PLAN_TEMPLATES_TABLE_NAME) {
    console.log("\n── Plan Templates ──");
    const rows = await fetchAll(MAIN_BASE, process.env.PLAN_TEMPLATES_TABLE_NAME, MAIN_KEY);
    console.log(`  ${rows.length} records`);
    for (const r of rows) {
      const f = r.fields ?? {};
      await upsert("plan_templates", {
        airtable_id: r.id,
        org_token:   f["Organization Token"] ?? null,
        name:        f["Name"] ?? f["Template Name"] ?? "Unnamed",
        structured:  parseJson(f["Structured"]),
        created_by:  f["Created By"] ?? null,
        status:      f["Status"] ?? "Active",
        notes:       f["Notes"] ?? null,
        tags:        f["Tags"] ?? null,
      }, f["Name"] ?? r.id);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 11. PRESCRIPTIONS
  // ══════════════════════════════════════════════════════════════════════════
  if (process.env.PRESCRIPTIONS_TABLE_NAME) {
    console.log("\n── Prescriptions ──");
    const rows = await fetchAll(MAIN_BASE, process.env.PRESCRIPTIONS_TABLE_NAME, MAIN_KEY);
    console.log(`  ${rows.length} records`);
    for (const r of rows) {
      const f = r.fields ?? {};
      const athlId  = Array.isArray(f["Athlete"])      ? f["Athlete"][0]      : null;
      const orgAId  = Array.isArray(f["Organization"]) ? f["Organization"][0] : null;
      await upsert("prescriptions", {
        airtable_id:   r.id,
        athlete_id:    athlId  ? maps.athletes[athlId]  : null,
        org_id:        orgAId  ? maps.orgs[orgAId]       : null,
        athlete_token: f["AthleteToken"] ?? null,
        title:         f["Title"] ?? null,
        prescription:  f["Prescription"] ?? null,
        created_by:    f["CreatedBy"] ?? null,
        created_at:    f["CreatedAt"] ?? new Date().toISOString(),
      }, r.id);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 12. NUTRITION PLANS
  // ══════════════════════════════════════════════════════════════════════════
  if (process.env.NUTRITION_TABLE_NAME) {
    console.log("\n── Nutrition Plans ──");
    const rows = await fetchAll(MAIN_BASE, process.env.NUTRITION_TABLE_NAME, MAIN_KEY);
    console.log(`  ${rows.length} records`);
    for (const r of rows) {
      const f = r.fields ?? {};
      const athlId = Array.isArray(f["Athlete"]) ? f["Athlete"][0] : null;
      await upsert("nutrition_plans", {
        airtable_id:     r.id,
        athlete_id:      athlId ? maps.athletes[athlId] : null,
        athlete_token:   Array.isArray(f["AthleteToken"]) ? f["AthleteToken"][0] : (f["AthleteToken"] ?? null),
        status:          f["Status"] ?? "active",
        phase:           f["Phase"] ?? null,
        daily_calories:  f["DailyCalories"] ?? null,
        daily_protein:   f["DailyProtein"] ?? null,
        daily_carbs:     f["DailyCarbs"] ?? null,
        daily_fat:       f["DailyFat"] ?? null,
        daily_hydration: f["DailyHydration"] ?? null,
        plan_json:       parseJson(f["PlanJson"]),
        prescription:    f["Prescription"] ?? null,
        created_by:      f["CreatedBy"] ?? null,
        archived_by:     f["ArchivedBy"] ?? null,
        archived_at:     f["ArchivedAt"] ?? null,
        created_at:      f["CreatedAt"] ?? new Date().toISOString(),
      }, r.id);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 13. NUTRITION COMPLETIONS
  // ══════════════════════════════════════════════════════════════════════════
  if (process.env.NUTRITION_COMPLETIONS_TABLE) {
    console.log("\n── Nutrition Completions ──");
    const rows = await fetchAll(MAIN_BASE, process.env.NUTRITION_COMPLETIONS_TABLE, MAIN_KEY);
    console.log(`  ${rows.length} records`);
    for (const r of rows) {
      const f = r.fields ?? {};
      const athlId = Array.isArray(f["Athlete"]) ? f["Athlete"][0] : null;
      await upsert("nutrition_completions", {
        airtable_id:     r.id,
        athlete_id:      athlId ? maps.athletes[athlId] : null,
        athlete_token:   f["AthleteToken"] ?? null,
        date:            f["Date"] ? new Date(f["Date"]).toISOString().slice(0, 10) : null,
        completion_json: parseJson(f["CompletionJson"]),
        updated_at:      f["UpdatedAt"] ?? new Date().toISOString(),
      }, r.id);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 14. NUTRITION CHECK-INS
  // ══════════════════════════════════════════════════════════════════════════
  if (process.env.NUTRITIONCHECKINS_TABLE_ID) {
    console.log("\n── Nutrition Check-ins ──");
    const rows = await fetchAll(MAIN_BASE, process.env.NUTRITIONCHECKINS_TABLE_ID, MAIN_KEY);
    console.log(`  ${rows.length} records`);
    for (const r of rows) {
      const f = r.fields ?? {};
      const athlId = Array.isArray(f["Athlete"]) ? f["Athlete"][0] : null;
      await upsert("nutrition_checkins", {
        airtable_id:   r.id,
        athlete_id:    athlId ? maps.athletes[athlId] : null,
        athlete_token: f["AthleteToken"] ?? null,
        date:          f["Date"] ? new Date(f["Date"]).toISOString().slice(0, 10) : null,
        data:          parseJson(f["Data"] ?? f["CheckinData"] ?? {}),
        created_at:    f["CreatedAt"] ?? new Date().toISOString(),
      }, r.id);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 15. DAILY WORKOUTS (org scheduling)
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── Daily Workouts ──");
  const atDW = await fetchAll(MAIN_BASE, process.env.DAILYWORKOUTS_TABLE_ID, MAIN_KEY);
  console.log(`  ${atDW.length} records`);
  for (const r of atDW) {
    const f = r.fields ?? {};
    const orgAId    = Array.isArray(f["Organization"]) ? f["Organization"][0] : null;
    const athlAId   = Array.isArray(f["Athlete"])      ? f["Athlete"][0]      : null;
    const memberAId = Array.isArray(f["CreatedBy"])    ? f["CreatedBy"][0]    : null;
    const row = {
      airtable_id:    r.id,
      org_id:         orgAId    ? maps.orgs[orgAId]       : null,
      athlete_id:     athlAId   ? maps.athletes[athlAId]  : null,
      created_by_id:  memberAId ? maps.members[memberAId] : null,
      date:           f["Date"] ?? new Date().toISOString().slice(0, 10),
      title:          f["Title"] ?? null,
      status:         f["Status"] ?? "assigned",
    };
    const { data, error } = await sb.from("daily_workouts").upsert(row, { onConflict: "airtable_id" }).select("id").single();
    if (error) { console.error(`  ✗ daily_workout ${r.id}:`, error.message); continue; }
    maps.workouts[r.id] = data.id;
    process.stdout.write(".");
  }
  console.log("");

  // ══════════════════════════════════════════════════════════════════════════
  // 16. WORKOUT ITEMS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── Workout Items ──");
  const atWI = await fetchAll(MAIN_BASE, process.env.WORKOUTITEMS_TABLE_ID, MAIN_KEY);
  console.log(`  ${atWI.length} records`);
  for (const r of atWI) {
    const f = r.fields ?? {};
    const orgAId = Array.isArray(f["Organization"])   ? f["Organization"][0]   : null;
    const dwAId  = Array.isArray(f["DailyWorkout"])   ? f["DailyWorkout"][0]   : null;
    const row = {
      airtable_id:       r.id,
      org_id:            orgAId ? maps.orgs[orgAId]      : null,
      daily_workout_id:  dwAId  ? maps.workouts[dwAId]   : null,
      sort_order:        Number(f["Order"]) || 0,
      exercise_name:     f["ExerciseName"] ?? null,
      sets:              f["Sets"] ? Number(f["Sets"]) : null,
      reps:              f["Reps"] ?? null,
      weight:            f["Weight"] ?? null,
      rpe:               f["RPE"] ?? null,
      rest:              f["Rest"] ?? null,
      instructions:      f["Instructions"] ?? null,
      video_url:         f["VideoURL"] ?? null,
      evidence_required: f["EvidenceRequired"] ?? "none",
    };
    const { data, error } = await sb.from("workout_items").upsert(row, { onConflict: "airtable_id" }).select("id").single();
    if (error) { console.error(`  ✗ workout_item ${r.id}:`, error.message); continue; }
    maps.items[r.id] = data.id;
    process.stdout.write(".");
  }
  console.log("");

  // ══════════════════════════════════════════════════════════════════════════
  // 17. WORKOUT COMPLETIONS (org)
  // ══════════════════════════════════════════════════════════════════════════
  if (process.env.WORKOUTCOMPLETIONS_TABLE_ID) {
    console.log("\n── Workout Completions ──");
    const rows = await fetchAll(MAIN_BASE, process.env.WORKOUTCOMPLETIONS_TABLE_ID, MAIN_KEY);
    console.log(`  ${rows.length} records`);
    for (const r of rows) {
      const f = r.fields ?? {};
      const orgAId    = Array.isArray(f["Organization"])  ? f["Organization"][0]  : null;
      const itemAId   = Array.isArray(f["WorkoutItem"])   ? f["WorkoutItem"][0]   : null;
      const athlAId   = Array.isArray(f["Athlete"])       ? f["Athlete"][0]       : null;
      const memberAId = Array.isArray(f["ReviewedBy"])    ? f["ReviewedBy"][0]    : null;
      const row = {
        airtable_id:    r.id,
        org_id:         orgAId    ? maps.orgs[orgAId]       : null,
        workout_item_id: itemAId   ? maps.items[itemAId]     : null,
        athlete_id:     athlAId   ? maps.athletes[athlAId]  : null,
        reviewed_by_id: memberAId ? maps.members[memberAId] : null,
        status:         f["Status"] ?? "completed",
        completed_at:   f["CompletedAt"] ?? new Date().toISOString(),
        reviewed_at:    f["ReviewedAt"] ?? null,
        review_note:    f["ReviewNote"] ?? null,
      };
      const { data, error } = await sb.from("workout_completions").upsert(row, { onConflict: "airtable_id" }).select("id").single();
      if (error) { console.error(`  ✗ workout_completion ${r.id}:`, error.message); continue; }
      maps.wc[r.id] = data.id;
      process.stdout.write(".");
    }
    console.log("");
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 18. COMPLETION EVIDENCE
  // ══════════════════════════════════════════════════════════════════════════
  if (process.env.COMPLETIONEVIDENCE_TABLE_ID) {
    console.log("\n── Completion Evidence ──");
    const rows = await fetchAll(MAIN_BASE, process.env.COMPLETIONEVIDENCE_TABLE_ID, MAIN_KEY);
    console.log(`  ${rows.length} records`);
    for (const r of rows) {
      const f = r.fields ?? {};
      const wcAId   = Array.isArray(f["WorkoutCompletion"]) ? f["WorkoutCompletion"][0] : null;
      const athlAId = Array.isArray(f["Athlete"])           ? f["Athlete"][0]           : null;
      await upsert("completion_evidence", {
        airtable_id:            r.id,
        workout_completion_id:  wcAId   ? maps.wc[wcAId]         : null,
        athlete_id:             athlAId ? maps.athletes[athlAId] : null,
        evidence_type:          f["EvidenceType"] ?? f["Type"] ?? "photo",
        url:                    f["URL"] ?? f["PhotoUrl"] ?? null,
        cloudinary_public_id:   f["PublicId"] ?? f["CloudinaryId"] ?? null,
        submitted_at:           f["SubmittedAt"] ?? f["CreatedAt"] ?? new Date().toISOString(),
      }, r.id);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 19. SET LOGS
  // ══════════════════════════════════════════════════════════════════════════
  if (process.env.SET_LOGS_TABLE_NAME) {
    console.log("\n── Set Logs ──");
    const rows = await fetchAll(MAIN_BASE, process.env.SET_LOGS_TABLE_NAME, MAIN_KEY);
    console.log(`  ${rows.length} records`);
    for (const r of rows) {
      const f = r.fields ?? {};
      const itemAId = Array.isArray(f["WorkoutItem"]) ? f["WorkoutItem"][0] : null;
      const athlAId = Array.isArray(f["Athlete"])     ? f["Athlete"][0]     : null;
      await upsert("set_logs", {
        airtable_id:     r.id,
        workout_item_id: itemAId ? maps.items[itemAId]     : null,
        athlete_id:      athlAId ? maps.athletes[athlAId]  : null,
        set_number:      f["SetNumber"]  ? Number(f["SetNumber"])  : null,
        reps_completed:  f["Reps"]       ? Number(f["Reps"])       : null,
        weight_used:     f["Weight"] ?? null,
        rpe_actual:      f["RPE"] ?? null,
        notes:           f["Notes"] ?? null,
        logged_at:       f["LoggedAt"] ?? f["CreatedAt"] ?? new Date().toISOString(),
      }, r.id);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 20. CLASS ATTENDANCE
  // ══════════════════════════════════════════════════════════════════════════
  if (process.env.CLASS_ATTENDANCE_TABLE) {
    console.log("\n── Class Attendance ──");
    const rows = await fetchAll(MAIN_BASE, process.env.CLASS_ATTENDANCE_TABLE, MAIN_KEY);
    console.log(`  ${rows.length} records`);
    for (const r of rows) {
      const f = r.fields ?? {};
      const athlAId = Array.isArray(f["Athlete"]) ? f["Athlete"][0] : null;
      await upsert("class_attendance", {
        airtable_id:   r.id,
        athlete_id:    athlAId ? maps.athletes[athlAId] : null,
        athlete_token: f["AthleteToken"] ?? null,
        org_token:     f["OrgToken"] ?? null,
        class_id:      f["ClassId"] ?? null,
        class_title:   f["ClassTitle"] ?? null,
        date:          f["Date"] ? new Date(f["Date"]).toISOString().slice(0, 10) : null,
        photo_url:     f["PhotoUrl"] ?? null,
        cloudinary_id: f["PublicId"] ?? null,
        attended_at:   f["AttendedAt"] ?? f["Date"] ?? new Date().toISOString(),
        coach_notes:   f["CoachNotes"] ?? null,
      }, r.id);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 21. COMMERCIAL TRAINERS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── Commercial Trainers ──");
  const atTrainers = await fetchAll(MAIN_BASE, process.env.COMMERCIAL_TRAINERS_TABLE_ID, MAIN_KEY);
  console.log(`  ${atTrainers.length} records`);
  for (const r of atTrainers) {
    const f = r.fields ?? {};
    const row = {
      airtable_id:         r.id,
      user_id:             f.userId ?? "",
      name:                f.name ?? "Unnamed",
      slug:                f.slug ?? r.id,
      specialty:           f.specialty ?? null,
      bio:                 f.bio ?? "",
      basic_price:         Number(f.basicPrice)   || 0,
      premium_price:       Number(f.premiumPrice) || 0,
      ultra_price:         Number(f.ultraPrice)   || 0,
      basic_perks:         f.basicPerks   ?? null,
      premium_perks:       f.premiumPerks ?? null,
      ultra_perks:         f.ultraPerks   ?? null,
      active_client_count: Number(f.activeClientCount) || 0,
      client_count:        f.clientCount ?? null,
      org_type:            f.orgType ?? null,
      goal:                f.goal   ?? null,
      sport:               f.sport  ?? null,
      library_locked:      Boolean(f.libraryLocked),
      hero_image_url:      f.heroImageUrl ?? null,
    };
    const { data, error } = await sb.from("trainers").upsert(row, { onConflict: "airtable_id" }).select("id").single();
    if (error) { console.error(`  ✗ trainer ${r.id}:`, error.message); continue; }
    maps.trainers[r.id] = data.id;
    console.log(`  ✓ ${f.name ?? r.id}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 22. VIDEOS
  // ══════════════════════════════════════════════════════════════════════════
  if (process.env.TRAINER_VIDEOS_TABLE_ID) {
    console.log("\n── Trainer Videos ──");
    const rows = await fetchAll(MAIN_BASE, process.env.TRAINER_VIDEOS_TABLE_ID, MAIN_KEY);
    console.log(`  ${rows.length} records`);
    for (const r of rows) {
      const f = r.fields ?? {};
      const trainerId = maps.trainers[f.trainerId];
      if (!trainerId) { console.warn(`  ⚠ video ${r.id}: unknown trainerId`); continue; }
      await upsert("videos", {
        airtable_id:   r.id,
        trainer_id:    trainerId,
        title:         f.title ?? "Untitled",
        description:   f.description ?? "",
        source_type:   f.sourceType ?? "upload",
        embed_url:     f.embedUrl ?? "",
        mux_upload_id: f.muxUploadId ?? "",
        mux_asset_id:  f.muxAssetId ?? "",
        playback_id:   f.playbackId ?? "",
        tier:          f.tier ?? "Basic",
        tags:          parseJson(f.tags),
        status:        f.status ?? "pending",
        published:     Boolean(f.published),
        price:         f.price ? Number(f.price) : null,
        created_at:    f.createdAt ?? new Date().toISOString(),
      }, f.title ?? r.id);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 23. SUBSCRIPTIONS
  // ══════════════════════════════════════════════════════════════════════════
  if (process.env.CLIENT_SUBSCRIPTIONS_TABLE_ID) {
    console.log("\n── Client Subscriptions ──");
    const rows = await fetchAll(MAIN_BASE, process.env.CLIENT_SUBSCRIPTIONS_TABLE_ID, MAIN_KEY);
    console.log(`  ${rows.length} records`);
    for (const r of rows) {
      const f = r.fields ?? {};
      const trainerId = maps.trainers[f.trainerId];
      if (!trainerId) { console.warn(`  ⚠ sub ${r.id}: unknown trainerId`); continue; }
      await upsert("subscriptions", {
        airtable_id:           r.id,
        trainer_id:            trainerId,
        client_email:          f.clientEmail ?? "",
        client_name:           f.clientName  ?? "",
        tier:                  f.tier   ?? "Basic",
        status:                f.status ?? "active",
        stripe_subscription_id: f.stripeSubscriptionId ?? null,
        stripe_customer_id:    f.stripeCustomerId ?? null,
        start_date:            f.startDate ?? null,
        end_date:              f.endDate   ?? null,
      }, f.clientEmail ?? r.id);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 24. PURCHASES
  // ══════════════════════════════════════════════════════════════════════════
  if (process.env.CLIENT_PURCHASES_TABLE_ID) {
    console.log("\n── Client Purchases ──");
    const rows = await fetchAll(MAIN_BASE, process.env.CLIENT_PURCHASES_TABLE_ID, MAIN_KEY);
    console.log(`  ${rows.length} records`);
    for (const r of rows) {
      const f = r.fields ?? {};
      const trainerId = maps.trainers[f.trainerId];
      if (!trainerId) { console.warn(`  ⚠ purchase ${r.id}: unknown trainerId`); continue; }
      await upsert("purchases", {
        airtable_id:   r.id,
        trainer_id:    trainerId,
        client_email:  f.clientEmail ?? "",
        client_name:   f.clientName  ?? "",
        item_id:       f.itemId   ?? "",
        item_type:     f.itemType ?? "video",
        status:        f.status   ?? "active",
        price_paid:    f.pricePaid ? Number(f.pricePaid) : null,
        stripe_session_id: f.stripeSessionId ?? null,
        created_at:    f.createdAt ?? new Date().toISOString(),
      }, r.id);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 25. VIDEO COMPLETIONS (commercial)
  // ══════════════════════════════════════════════════════════════════════════
  if (process.env.VIDEO_COMPLETIONS_TABLE_ID) {
    console.log("\n── Video Completions ──");
    const rows = await fetchAll(MAIN_BASE, process.env.VIDEO_COMPLETIONS_TABLE_ID, MAIN_KEY);
    console.log(`  ${rows.length} records`);
    for (const r of rows) {
      const f = r.fields ?? {};
      const trainerId = maps.trainers[f.trainerId];
      await upsert("video_completions", {
        airtable_id:  r.id,
        trainer_id:   trainerId ?? null,
        video_id:     f.videoId ?? f.itemId ?? null,
        client_email: f.clientEmail ?? "",
        completed_at: f.completedAt ?? f.createdAt ?? new Date().toISOString(),
      }, r.id);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 26. COMMERCIAL WORKOUTS
  // ══════════════════════════════════════════════════════════════════════════
  if (process.env.COMMERCIAL_WORKOUTS_TABLE_ID) {
    console.log("\n── Commercial Workouts ──");
    const rows = await fetchAll(MAIN_BASE, process.env.COMMERCIAL_WORKOUTS_TABLE_ID, MAIN_KEY);
    console.log(`  ${rows.length} records`);
    for (const r of rows) {
      const f = r.fields ?? {};
      const trainerId = maps.trainers[f.trainerId];
      if (!trainerId) { console.warn(`  ⚠ workout ${r.id}: unknown trainerId`); continue; }
      await upsert("commercial_workouts", {
        airtable_id: r.id,
        trainer_id:  trainerId,
        title:       f.title ?? "Untitled",
        description: f.description ?? "",
        tier:        f.tier ?? "Basic",
        published:   Boolean(f.published),
        tags:        parseJson(f.tags),
        exercises:   parseJson(f.exercises, []),
        created_at:  f.createdAt ?? new Date().toISOString(),
      }, f.title ?? r.id);
    }
  }

  console.log("\n\n=== Migration complete ===");
  console.log(`Orgs: ${Object.keys(maps.orgs).length}, Athletes: ${Object.keys(maps.athletes).length}, Members: ${Object.keys(maps.members).length}, Trainers: ${Object.keys(maps.trainers).length}`);
}

run().catch(console.error);
