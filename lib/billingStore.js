// lib/billingStore.js
// Organization billing records, stored in the Supabase `billing` table.
//
// This replaced lib/airtableBilling.js. The exported functions keep the same names and return
// records in the same shape ({ id, fields: { "Billing Status": ..., ... } }) so billing routes,
// the Stripe webhook and access checks did not have to change. Field names (F.*) map to columns
// in COLUMN below.
//
// Organization links: `org_id` is the Supabase organizations.id. Legacy Airtable org record ids
// ("rec...") are still accepted and resolved through organizations.airtable_id.

import { supabaseAdmin as db } from "@/lib/supabase";

export const F = {
  Organization: "Organization",
  Token: "Token",
  Created: "Created",

  BillingContactName: "Billing Contact Name",
  BillingEmail: "Billing Email",
  BillingPhone: "Billing Phone",
  BillingRoleTitle: "Billing Role/Title",

  BillingAddress1: "Billing Address Line 1",
  BillingAddress2: "Billing Address Line 2",
  BillingCity: "Billing City",
  BillingState: "Billing State/Province",
  BillingPostal: "Billing Postal Code",
  BillingCountry: "Billing Country",

  LegalBusinessName: "Legal Business Name",
  DBAName: "DBA Name",
  BusinessType: "Business Type",
  TaxIdType: "Tax ID Type",
  TaxIdLast4: "Tax ID (Last 4 only)",
  TaxExempt: "Tax Exempt",
  TaxExemptCertUrl: "Tax Exempt Certificate URL",

  Plan: "Plan",
  BillingStatus: "Billing Status",
  RenewalDate: "Renewal Date",
  TrialEnds: "Trial Ends",
  CurrentPeriodEnd: "Current Period End",
  SandboxEnds: "Sandbox Ends",

  Currency: "Currency",

  StripeCustomerId: "Stripe Customer ID",
  StripeSubscriptionId: "Stripe Subscription ID",

  PreferredPaymentMethod: "Preferred Payment Method",
  PaymentTerms: "Payment Terms",
  PORequired: "PO Required",
  PONumber: "PO Number",

  BankName: "Bank Name",
  RoutingLast4: "Routing (Last 4)",
  AccountLast4: "Account (Last 4)",
  WireInstructions: "Wire Instructions",

  LastSynced: "Last Synced From Stripe",
};

// Field name -> billing column
export const COLUMN = {
  [F.Token]: "token",
  [F.BillingContactName]: "billing_contact_name",
  [F.BillingEmail]: "billing_email",
  [F.BillingPhone]: "billing_phone",
  [F.BillingRoleTitle]: "billing_role",
  [F.BillingAddress1]: "billing_address_1",
  [F.BillingAddress2]: "billing_address_2",
  [F.BillingCity]: "billing_city",
  [F.BillingState]: "billing_state",
  [F.BillingPostal]: "billing_postal_code",
  [F.BillingCountry]: "billing_country",
  [F.LegalBusinessName]: "legal_business_name",
  [F.DBAName]: "dba_name",
  [F.BusinessType]: "business_type",
  [F.TaxIdType]: "tax_id_type",
  [F.TaxIdLast4]: "tax_id_last4",
  [F.TaxExempt]: "tax_exempt",
  [F.TaxExemptCertUrl]: "tax_exempt_cert_url",
  [F.Plan]: "plan",
  [F.BillingStatus]: "billing_status",
  [F.RenewalDate]: "renewal_date",
  [F.TrialEnds]: "trial_ends",
  [F.CurrentPeriodEnd]: "current_period_end",
  [F.SandboxEnds]: "sandbox_ends",
  [F.Currency]: "currency",
  [F.StripeCustomerId]: "stripe_customer_id",
  [F.StripeSubscriptionId]: "stripe_subscription_id",
  [F.PreferredPaymentMethod]: "preferred_payment_method",
  [F.PaymentTerms]: "payment_terms",
  [F.PORequired]: "po_required",
  [F.PONumber]: "po_number",
  [F.BankName]: "bank_name",
  [F.RoutingLast4]: "routing_last4",
  [F.AccountLast4]: "account_last4",
  [F.WireInstructions]: "wire_instructions",
  [F.LastSynced]: "last_synced_from_stripe",
};

const BOOLEAN_COLUMNS = new Set(["tax_exempt", "po_required"]);
const DATE_COLUMNS = new Set(["renewal_date", "trial_ends", "current_period_end", "sandbox_ends", "last_synced_from_stripe"]);

const SELECT = "*, organization:organizations(id, created_at)";

function isAirtableRecordId(v = "") {
  return /^rec[a-zA-Z0-9]{14,}$/.test(String(v || "").trim());
}
function isUuid(v = "") {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || "").trim());
}

export function firstLookupValue(v) {
  return Array.isArray(v) ? v?.[0] : v;
}

export function isoDateFromUnixSeconds(unixSeconds) {
  const n = Number(unixSeconds || 0);
  if (!n || Number.isNaN(n)) return "";
  return new Date(n * 1000).toISOString();
}

// Row -> { id, fields } using the field names callers already use
function toRecord(row) {
  if (!row) return null;
  const fields = {};
  for (const [field, col] of Object.entries(COLUMN)) {
    const v = row[col];
    // Like Airtable: empty values and unchecked checkboxes are omitted
    if (v !== null && v !== undefined && v !== "" && v !== false) fields[field] = v;
  }
  if (row.org_id) fields[F.Organization] = [row.org_id];
  if (row.organization?.created_at) fields[F.Created] = [row.organization.created_at];
  return { id: row.id, fields, get: (name) => fields[name] };
}

// Patch keyed by field names -> column values
function toColumns(patch = {}) {
  const out = {};
  for (const [field, value] of Object.entries(patch || {})) {
    const col = COLUMN[field];
    if (!col) continue; // Organization / Created are handled separately
    if (BOOLEAN_COLUMNS.has(col)) out[col] = value === true || value === "true" || value === 1;
    else if (DATE_COLUMNS.has(col)) out[col] = value ? new Date(value).toISOString() : null;
    else out[col] = value === "" || value === undefined ? null : value;
  }
  return out;
}

// Accepts a Supabase organizations.id or a legacy Airtable org record id
async function resolveOrgUuid(maybeOrgId) {
  const id = String(maybeOrgId || "").trim();
  if (!id) return "";
  if (isUuid(id)) return id;
  if (isAirtableRecordId(id)) {
    const { data } = await db.from("organizations").select("id").eq("airtable_id", id).maybeSingle();
    return data?.id || "";
  }
  return "";
}

async function firstRow(query) {
  const { data, error } = await query.limit(1);
  if (error) throw new Error(`[billing] ${error.message}`);
  return toRecord(data?.[0]);
}

export async function findBillingRecordByOrgId(orgId) {
  const uuid = await resolveOrgUuid(orgId);
  if (!uuid) return null;
  return firstRow(db.from("billing").select(SELECT).eq("org_id", uuid).order("created_at"));
}

export async function findBillingRecordByStripeCustomerId(stripeCustomerId) {
  const cid = String(stripeCustomerId || "").trim();
  if (!cid) return null;
  return firstRow(db.from("billing").select(SELECT).eq("stripe_customer_id", cid).order("created_at"));
}

export async function findBillingRecordByOrgToken(orgToken) {
  const t = String(orgToken || "").trim().toUpperCase();
  if (!t) return null;
  return firstRow(db.from("billing").select(SELECT).eq("token", t).order("created_at"));
}

async function writeRecord(existingId, columns) {
  const q = existingId
    ? db.from("billing").update(columns).eq("id", existingId)
    : db.from("billing").insert(columns);
  const { data, error } = await q.select(SELECT).single();
  if (error) throw new Error(`[billing] ${error.message}`);
  return toRecord(data);
}

// Upsert by organization id (refuses ids that don't match an organization, so no orphan rows)
export async function upsertBillingForOrg(orgId, patch = {}) {
  const uuid = await resolveOrgUuid(orgId);
  if (!uuid) throw new Error(`upsertBillingForOrg: no organization found for id "${orgId}"`);

  const existing = await findBillingRecordByOrgId(uuid);
  const columns = { ...toColumns(patch), org_id: uuid };
  if (!existing && !columns.token) {
    const { data: org } = await db.from("organizations").select("token").eq("id", uuid).maybeSingle();
    columns.token = String(org?.token || "").trim().toUpperCase();
    if (!columns.token) throw new Error("upsertBillingForOrg: organization has no token");
  }
  return writeRecord(existing?.id, columns);
}

// Same as upsertBillingForOrg, but returns null instead of throwing for unknown ids
export async function upsertBillingForOrgSafe(maybeOrgId, patch = {}) {
  const uuid = await resolveOrgUuid(maybeOrgId);
  if (!uuid) return null;
  return upsertBillingForOrg(uuid, patch);
}

// Upsert by team token (canonical key). Links the organization when the id resolves.
export async function upsertBillingForOrgToken(orgToken, patch = {}, orgId = "") {
  const t = String(orgToken || "").trim().toUpperCase();
  if (!t) throw new Error("upsertBillingForOrgToken requires orgToken");

  const existing = await findBillingRecordByOrgToken(t);
  const columns = { ...toColumns(patch), token: t };

  let uuid = await resolveOrgUuid(orgId);
  if (!uuid && !existing?.fields?.[F.Organization]) {
    const { data: org } = await db.from("organizations").select("id").eq("token", t).maybeSingle();
    uuid = org?.id || "";
  }
  if (uuid) columns.org_id = uuid;

  return writeRecord(existing?.id, columns);
}
