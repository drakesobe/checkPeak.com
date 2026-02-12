// lib/airtableBilling.js
import Airtable from "airtable";

export const F = {
  // Relationship
  Organization: "Organization",

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
// You said BILLING_TABLE_NAME is actually the table id (tbl...), so that's fine
const TABLE = process.env.BILLING_TABLE_NAME;

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

/**
 * Find Billing record by Org Token.
 * We assume Billing table has a linked "Organization" field to Organizations,
 * and that the linked organization record has Token included in the lookup.
 *
 * If your Billing table has a direct "Token" lookup field, update LOOKUP_FIELD below.
 */
const LOOKUP_FIELD = "Token"; // ✅ change only if your lookup field is named differently

export async function findBillingRecordByOrgToken(orgToken) {
  const t = String(orgToken || "").trim();
  if (!t) return null;

  // Works if LOOKUP_FIELD is:
  // - a text field on Billing table, OR
  // - a lookup field that returns an array (from linked Org)
  const formula = `OR({${LOOKUP_FIELD}}='${escapeAirtableString(t)}', FIND('${escapeAirtableString(t)}', ARRAYJOIN({${LOOKUP_FIELD}}&''))>0)`;

  const rows = await base(TABLE)
    .select({ maxRecords: 1, filterByFormula: formula })
    .firstPage();

  return rows?.[0] || null;
}

/**
 * Upsert Billing record by Org Token.
 * - If exists: update
 * - If not: create
 *
 * Optionally sets the "Organization" link using orgId if provided.
 * (Nice for Airtable UX, but not required for correctness.)
 */
export async function upsertBillingForOrgToken(orgToken, patch = {}, orgId = "") {
  const existing = await findBillingRecordByOrgToken(orgToken);

  const fields = { ...(patch || {}) };

  // Optional: set Organization link to keep Airtable nicely connected
  if (orgId) {
    fields[F.Organization] = [orgId];
  }

  // Keep a LastSynced timestamp if you want (optional)
  // fields[F.LastSynced] = new Date().toISOString();

  if (existing?.id) {
    const updated = await base(TABLE).update(existing.id, fields);
    return updated;
  }

  const created = await base(TABLE).create(fields);
  return created;
}
