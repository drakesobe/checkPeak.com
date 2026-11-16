// scripts/sync-billing-from-airtable.mjs
// One-time cutover: copies every Airtable Billing row into the Supabase `billing` table so the
// app can read billing from Supabase only (lib/billingStore.js).
//
//   node scripts/sync-billing-from-airtable.mjs          dry run: prints what would change
//   node scripts/sync-billing-from-airtable.mjs --write  applies it
//
// Merge rule (keeps every org's current access exactly as it is):
// - Supabase already decides access (billing/status reads it first), so a value already in
//   Supabase is kept. Airtable only fills columns that are empty in Supabase.
// - Stripe-owned columns (Stripe ids, period/renewal/trial dates, last sync) were written to
//   Airtable by the old webhook, so Airtable wins for those when it has a value.
// - Supabase rows with no Airtable counterpart are listed but never deleted.
// Run with --write right before deploying and once more right after. Safe to re-run.

import fs from "fs";
import Airtable from "airtable";
import { createClient } from "@supabase/supabase-js";

for (const file of [".env.local", ".env"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

const WRITE = process.argv.includes("--write");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const base = new Airtable({ apiKey: process.env.BILLING_API_KEY }).base(process.env.BILLING_BASE_ID);

// Airtable field -> Supabase column (same map as lib/billingStore.js)
const COLUMN = {
  "Token": "token",
  "Billing Contact Name": "billing_contact_name",
  "Billing Email": "billing_email",
  "Billing Phone": "billing_phone",
  "Billing Role/Title": "billing_role",
  "Billing Address Line 1": "billing_address_1",
  "Billing Address Line 2": "billing_address_2",
  "Billing City": "billing_city",
  "Billing State/Province": "billing_state",
  "Billing Postal Code": "billing_postal_code",
  "Billing Country": "billing_country",
  "Legal Business Name": "legal_business_name",
  "DBA Name": "dba_name",
  "Business Type": "business_type",
  "Tax ID Type": "tax_id_type",
  "Tax ID (Last 4 only)": "tax_id_last4",
  "Tax Exempt": "tax_exempt",
  "Tax Exempt Certificate URL": "tax_exempt_cert_url",
  "Plan": "plan",
  "Billing Status": "billing_status",
  "Renewal Date": "renewal_date",
  "Trial Ends": "trial_ends",
  "Current Period End": "current_period_end",
  "Sandbox Ends": "sandbox_ends",
  "Currency": "currency",
  "Stripe Customer ID": "stripe_customer_id",
  "Stripe Subscription ID": "stripe_subscription_id",
  "Preferred Payment Method": "preferred_payment_method",
  "Payment Terms": "payment_terms",
  "PO Required": "po_required",
  "PO Number": "po_number",
  "Bank Name": "bank_name",
  "Routing (Last 4)": "routing_last4",
  "Account (Last 4)": "account_last4",
  "Wire Instructions": "wire_instructions",
  "Last Synced From Stripe": "last_synced_from_stripe",
};
const BOOLEAN = new Set(["tax_exempt", "po_required"]);
const STRIPE_OWNED = new Set(["stripe_customer_id", "stripe_subscription_id", "current_period_end", "renewal_date", "trial_ends", "last_synced_from_stripe"]);
const DATES = new Set(["renewal_date", "trial_ends", "current_period_end", "sandbox_ends", "last_synced_from_stripe"]);

function columnsFrom(fields) {
  const out = {};
  for (const [field, col] of Object.entries(COLUMN)) {
    let v = fields[field];
    if (Array.isArray(v)) v = v[0];
    if (BOOLEAN.has(col)) out[col] = v === true;
    else if (DATES.has(col)) out[col] = v ? new Date(v).toISOString() : null;
    else out[col] = v === undefined || v === "" ? null : typeof v === "string" ? v.trim() : v;
  }
  if (out.token) out.token = String(out.token).trim().toUpperCase();
  return out;
}

function same(a, b, col) {
  if (DATES.has(col)) return (a ? new Date(a).getTime() : null) === (b ? new Date(b).getTime() : null);
  if (BOOLEAN.has(col)) return !!a === !!b;
  return (a ?? null) === (b ?? null);
}

const [atRows, { data: sbRows, error: sbErr }, { data: orgs, error: orgErr }] = await Promise.all([
  base(process.env.BILLING_TABLE_NAME).select().all(),
  db.from("billing").select("*"),
  db.from("organizations").select("id, airtable_id, token"),
]);
if (sbErr || orgErr) throw new Error((sbErr || orgErr).message);

const orgByAirtable = new Map(orgs.filter((o) => o.airtable_id).map((o) => [o.airtable_id, o.id]));
const orgByToken = new Map(orgs.filter((o) => o.token).map((o) => [String(o.token).trim().toUpperCase(), o.id]));
const sbByAirtable = new Map(sbRows.filter((r) => r.airtable_id).map((r) => [r.airtable_id, r]));
const sbByToken = new Map();
for (const r of sbRows) {
  const t = String(r.token || "").trim().toUpperCase();
  if (t && !sbByToken.has(t)) sbByToken.set(t, r);
}

const matched = new Set();
let inserts = 0, updates = 0, unchanged = 0;

for (const rec of atRows) {
  const cols = columnsFrom(rec.fields);
  if (!cols.token) { console.log(`skip ${rec.id}: no Token`); continue; }

  const linked = Array.isArray(rec.fields.Organization) ? rec.fields.Organization[0] : "";
  cols.org_id = orgByAirtable.get(linked) || orgByToken.get(cols.token) || null;
  cols.airtable_id = rec.id;

  const existing = sbByAirtable.get(rec.id) || sbByToken.get(cols.token);
  if (existing) matched.add(existing.id);

  if (!existing) {
    inserts++;
    console.log(`INSERT ${cols.token} (${rec.id}) plan=${cols.plan} status=${cols.billing_status}`);
    if (WRITE) {
      const { error } = await db.from("billing").insert(cols);
      if (error) console.error("  failed:", error.message);
    }
    continue;
  }

  const empty = (v) => v === null || v === undefined || v === "";
  const changed = Object.keys(cols).filter((c) => {
    if (empty(cols[c]) || cols[c] === false) return false;           // Airtable has nothing to add
    if (same(existing[c], cols[c], c)) return false;
    return empty(existing[c]) || STRIPE_OWNED.has(c) || c === "airtable_id";
  });
  if (!changed.length) { unchanged++; continue; }
  updates++;
  console.log(`UPDATE ${cols.token}: ${changed.map((c) => `${c} ${JSON.stringify(existing[c])} -> ${JSON.stringify(cols[c])}`).join(", ")}`);
  if (WRITE) {
    const patch = Object.fromEntries(changed.map((c) => [c, cols[c]]));
    const { error } = await db.from("billing").update(patch).eq("id", existing.id);
    if (error) console.error("  failed:", error.message);
  }
}

const orphans = sbRows.filter((r) => !matched.has(r.id));
for (const r of orphans) {
  const shadow = atRows.some((a) => String(a.fields.Token || "").trim().toUpperCase() === String(r.token || "").trim().toUpperCase());
  console.log(`not in Airtable: ${r.token} (${r.airtable_id || "no airtable id"}) status=${r.billing_status}${shadow ? "  ** duplicate token **" : ""}`);
}

console.log(`\n${WRITE ? "Applied" : "Dry run"}: ${inserts} insert, ${updates} update, ${unchanged} unchanged, ${orphans.length} Supabase-only`);
if (!WRITE) console.log("Re-run with --write to apply.");
