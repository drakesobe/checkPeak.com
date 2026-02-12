// pages/api/org/billing/update.js
import { requireBillingAdmin } from "@/lib/requireBillingAdmin";
import { upsertBillingForOrgToken, F } from "@/lib/airtableBilling";

function pick(v) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function last4Digits(v) {
  const s = String(v ?? "").replace(/\D/g, "");
  return s ? s.slice(-4) : "";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireBillingAdmin(req, res);
  if (!user) return;

  // ✅ Use Token (stable) from session payload
  const orgToken = String(user?.Token || user?.token || user?.["Organization Token"] || "").trim();
  if (!orgToken) return res.status(400).json({ error: "Missing org Token in session." });

  // Optional: orgId if you want to set the linked Organization field in Airtable
  const orgId = String(
    user?.orgId || user?.OrgId || user?.OrganizationId || user?.organizationId || user?.id || ""
  ).trim();

  try {
    const { billing = {} } = req.body || {};
    const b = billing || {};

    // Start with fields that are safe to blank out
    const patch = {
      // Billing Contact (text/email/phone — safe to set to "")
      [F.BillingContactName]: String(b.billingName || ""),
      [F.BillingEmail]: String(b.billingEmail || ""),
      [F.BillingPhone]: String(b.billingPhone || ""),
      [F.BillingRoleTitle]: String(b.billingRoleTitle || ""),

      // Address (text — safe to set to "")
      [F.BillingAddress1]: String(b.billingAddress1 || ""),
      [F.BillingAddress2]: String(b.billingAddress2 || ""),
      [F.BillingCity]: String(b.billingCity || ""),
      [F.BillingState]: String(b.billingState || ""),
      [F.BillingPostal]: String(b.billingPostal || ""),

      // Business identity (text — safe to set to "")
      [F.LegalBusinessName]: String(b.legalBusinessName || ""),
      [F.DBAName]: String(b.dbaName || ""),
      [F.TaxIdLast4]: String(b.taxIdLast4 || ""),
      [F.TaxExempt]: Boolean(b.taxExempt),
      [F.TaxExemptCertUrl]: String(b.taxExemptCertUrl || ""),

      // PO + banking (text/checkbox/long text — safe to set to "")
      [F.PORequired]: Boolean(b.poRequired),
      [F.PONumber]: String(b.poNumber || ""),
      [F.BankName]: String(b.bankName || ""),
      [F.RoutingLast4]: last4Digits(b.routingLast4),
      [F.AccountLast4]: last4Digits(b.accountLast4),
      [F.WireInstructions]: String(b.wireInstructions || ""),
    };

    // ✅ Single select fields: only set if non-empty (otherwise omit)
    const country = pick(b.billingCountry);
    if (country) patch[F.BillingCountry] = country;

    const businessType = pick(b.businessType);
    if (businessType) patch[F.BusinessType] = businessType;

    const taxIdType = pick(b.taxIdType);
    if (taxIdType) patch[F.TaxIdType] = taxIdType;

    const preferredPaymentMethod = pick(b.preferredPaymentMethod);
    if (preferredPaymentMethod) patch[F.PreferredPaymentMethod] = preferredPaymentMethod;

    const paymentTerms = pick(b.paymentTerms);
    if (paymentTerms) patch[F.PaymentTerms] = paymentTerms;

    // ✅ DO NOT allow client to set subscription fields
    // Plan / BillingStatus / RenewalDate / TrialEnds / Stripe IDs should come ONLY from Stripe webhook sync.
    // So we intentionally do NOT write those fields here.

    const updated = await upsertBillingForOrgToken(orgToken, patch, orgId);

    return res.status(200).json({
      ok: true,
      billingRecordId: updated?.id || null,
    });
  } catch (e) {
    console.error("[billing/update] error:", e);
    return res.status(500).json({ error: "Failed to update billing." });
  }
}
