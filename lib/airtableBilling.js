// lib/airtableBilling.js
import Airtable from "airtable";

export const F = {
  // Relationship / lookups
  Organization: "Organization", // linked to Organizations table (linked record ids)
  Token: "Token", // lookup from Organization.Token (often array)
  Created: "Created", // lookup from Organization.Created (often array)

  // Billing Contact
  BillingContactName: "Billing Contact Name",
  BillingEmail: "Billing Email",
  BillingPhone: "Billing Phone",
  BillingRoleTitle: "Billing Role/Title",

  // Address
  BillingAddress1: "Billing Address Line 1",
  BillingAddress2: "Billing Address Line 2",
  BillingCity: "Billing City",
  BillingState: "Billing State/Province",
  BillingPostal: "Billing Postal Code",
  BillingCountry: "Billing Country",

  // Business identity
  LegalBusinessName: "Legal Business Name",
  DBAName: "DBA Name",
  BusinessType: "Business Type",
  TaxIdType: "Tax ID Type",
  TaxIdLast4: "Tax ID (Last 4 only)",
  TaxExempt: "Tax Exempt",
  TaxExemptCertUrl: "Tax Exempt Certificate URL",

  // Plan/subscription
  Plan: "Plan",
  BillingStatus: "Billing Status",
  RenewalDate: "Renewal Date",
  TrialEnds: "Trial Ends",
  CurrentPeriodEnd: "Current Period End",

  // Currency
  Currency: "Currency",

  // Stripe ids
  StripeCustomerId: "Stripe Customer ID",
  StripeSubscriptionId: "Stripe Subscription ID",

  // Payment prefs + terms
  PreferredPaymentMethod: "Preferred Payment Method",
  PaymentTerms: "Payment Terms",
  PORequired: "PO Required",
  PONumber: "PO Number",

  // Optional banking (last4 only)
  BankName: "Bank Name",
  RoutingLast4: "Routing (Last 4)",
  AccountLast4: "Account (Last 4)",
  WireInstructions: "Wire Instructions",

  // System
  LastSynced: "Last Synced From Stripe",
};

// ---- Airtable init ----
const API_KEY = process.env.BILLING_API_KEY;
const BASE_ID = process.env.BILLING_BASE_ID;
const TABLE = process.env.BILLING_TABLE_NAME; // table id (tbl...) is OK

if (!API_KEY || !BASE_ID || !TABLE) {
  console.warn("[airtableBilling] Missing env vars:", {
    BILLING_API_KEY: Boolean(API_KEY),
    BILLING_BASE_ID: Boolean(BASE_ID),
    BILLING_TABLE_NAME: Boolean(TABLE),
  });
}

const base = new Airtable({ apiKey: API_KEY }).base(BASE_ID);

function escapeAirtableString(str = "") {
  return String(str).replace(/'/g, "\\'");
}

function isAirtableRecordId(v = "") {
  // Airtable record ids look like "recXXXXXXXXXXXXXXX"
  return /^rec[a-zA-Z0-9]{14,}$/.test(String(v || "").trim());
}

export function firstLookupValue(v) {
  if (Array.isArray(v)) return v?.[0];
  return v;
}

export function isoDateFromUnixSeconds(unixSeconds) {
  const n = Number(unixSeconds || 0);
  if (!n || Number.isNaN(n)) return "";
  return new Date(n * 1000).toISOString();
}

/**
 * Safer membership test for linked record arrays:
 * FIND("," & id & ",", "," & ARRAYJOIN({Organization}) & ",") > 0
 * Prevents substring false positives.
 */
function linkedContainsFormula(fieldName, recordId) {
  const id = escapeAirtableString(recordId);
  return `FIND(',${id},', ',' & ARRAYJOIN({${fieldName}} & '') & ',') > 0`;
}

/**
 * Find Billing record by Org *record id* (preferred).
 */
export async function findBillingRecordByOrgId(orgRecordId) {
  const id = String(orgRecordId || "").trim();
  if (!id) return null;

  const formula = linkedContainsFormula(F.Organization, id);

  const rows = await base(TABLE)
    .select({ maxRecords: 1, filterByFormula: formula })
    .firstPage();

  return rows?.[0] || null;
}

/**
 * STRICT upsert by Org *record id*.
 * Will throw if orgRecordId is not a valid Airtable record id.
 */
export async function upsertBillingForOrg(orgRecordId, patch = {}) {
  const id = String(orgRecordId || "").trim();
  if (!id) throw new Error("upsertBillingForOrg requires orgRecordId");
  if (!isAirtableRecordId(id)) {
    throw new Error(
      `upsertBillingForOrg expected Airtable org record id (rec...), got: "${id}". Refusing to create duplicate/blank Billing rows.`
    );
  }

  const existing = await findBillingRecordByOrgId(id);

  const fields = { ...(patch || {}) };
  fields[F.Organization] = [id];

  if (existing?.id) {
    return await base(TABLE).update(existing.id, fields);
  }
  return await base(TABLE).create(fields);
}

/**
 * SAFE upsert by Org id:
 * - If orgRecordId is invalid, returns null (no create).
 * Useful for GET routes or any “maybe” org ids.
 */
export async function upsertBillingForOrgSafe(maybeOrgId, patch = {}) {
  const id = String(maybeOrgId || "").trim();
  if (!id || !isAirtableRecordId(id)) return null;
  return await upsertBillingForOrg(id, patch);
}

/**
 * Find Billing record by Stripe Customer ID (used by webhook).
 */
export async function findBillingRecordByStripeCustomerId(stripeCustomerId) {
  const cid = String(stripeCustomerId || "").trim();
  if (!cid) return null;

  const formula = `{${F.StripeCustomerId}}='${escapeAirtableString(cid)}'`;

  const rows = await base(TABLE)
    .select({ maxRecords: 1, filterByFormula: formula })
    .firstPage();

  return rows?.[0] || null;
}

/**
 * Token-based helpers (legacy / debugging).
 * Token often comes from Organization.Token lookup, so it may be an array in Airtable.
 */
export async function findBillingRecordByOrgToken(orgToken) {
  const t = String(orgToken || "").trim();
  if (!t) return null;

  const tokenSafe = escapeAirtableString(t);
  const formula = `OR({${F.Token}}='${tokenSafe}', FIND('${tokenSafe}', ARRAYJOIN({${F.Token}}&''))>0)`;

  const rows = await base(TABLE)
    .select({ maxRecords: 1, filterByFormula: formula })
    .firstPage();

  return rows?.[0] || null;
}

/**
 * Upsert Billing record by Org Token.
 * Use this when you don’t have a guaranteed Airtable org record id.
 *
 * If orgRecordId is valid, we also set Organization link.
 */
export async function upsertBillingForOrgToken(orgToken, patch = {}, orgRecordId = "") {
  const t = String(orgToken || "").trim();
  if (!t) throw new Error("upsertBillingForOrgToken requires orgToken");

  const existing = await findBillingRecordByOrgToken(t);

  const fields = { ...(patch || {}) };

  const maybeOrg = String(orgRecordId || "").trim();
  if (isAirtableRecordId(maybeOrg)) {
    fields[F.Organization] = [maybeOrg];
  }

  if (existing?.id) {
    return await base(TABLE).update(existing.id, fields);
  }
  return await base(TABLE).create(fields);
}
