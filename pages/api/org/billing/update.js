// pages/api/org/billing/update.js
import { requireBillingAdmin } from "@/lib/requireBillingAdmin";
import { upsertBillingForOrg, F } from "@/lib/airtableBilling";

function cleanText(v) {
  const s = String(v ?? "").trim();
  return s;
}

function cleanSelect(v) {
  // For Airtable single select fields:
  // - empty string can trigger "create new option"
  // Return undefined to "not set" the field
  const s = String(v ?? "").trim();
  return s ? s : undefined;
}

function cleanLast4(v) {
  return String(v || "").replace(/\D/g, "").slice(-4);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireBillingAdmin(req, res);
  if (!user) return;

  // Always trust session orgId (not client input)
  const orgId = String(
    user?.orgId || user?.OrgId || user?.OrganizationId || user?.organizationId || user?.id || ""
  ).trim();
  if (!orgId) return res.status(400).json({ error: "Missing orgId in session." });

  try {
    const { billing = {} } = req.body || {};
    const b = billing || {};

    const patch = {
      // Billing Contact
      [F.BillingContactName]: cleanText(b.billingName),
      [F.BillingEmail]: cleanText(b.billingEmail),
      [F.BillingPhone]: cleanText(b.billingPhone),
      [F.BillingRoleTitle]: cleanText(b.billingRoleTitle),

      // Address
      [F.BillingAddress1]: cleanText(b.billingAddress1),
      [F.BillingAddress2]: cleanText(b.billingAddress2),
      [F.BillingCity]: cleanText(b.billingCity),
      [F.BillingState]: cleanText(b.billingState),
      [F.BillingPostal]: cleanText(b.billingPostal),
      [F.BillingCountry]: cleanText(b.billingCountry),

      // Business identity
      [F.LegalBusinessName]: cleanText(b.legalBusinessName),
      [F.DBAName]: cleanText(b.dbaName),
      [F.BusinessType]: cleanSelect(b.businessType),
      [F.TaxIdType]: cleanSelect(b.taxIdType),
      [F.TaxIdLast4]: cleanLast4(b.taxIdLast4),
      [F.TaxExempt]: Boolean(b.taxExempt),
      [F.TaxExemptCertUrl]: cleanText(b.taxExemptCertUrl),

      // Terms / PO
      [F.PreferredPaymentMethod]: cleanSelect(b.preferredPaymentMethod),
      [F.PaymentTerms]: cleanSelect(b.paymentTerms),
      [F.PORequired]: Boolean(b.poRequired),
      [F.PONumber]: cleanText(b.poNumber),

      // Optional banking metadata (last4 only)
      [F.BankName]: cleanText(b.bankName),
      [F.RoutingLast4]: cleanLast4(b.routingLast4),
      [F.AccountLast4]: cleanLast4(b.accountLast4),
      [F.WireInstructions]: cleanText(b.wireInstructions),

      // NOTE:
      // DO NOT accept StripeCustomerId / StripeSubscriptionId from client.
      // Those should be set by Stripe flows/webhooks only.
    };

    // Remove undefined fields (important for cleanSelect)
    Object.keys(patch).forEach((k) => {
      if (patch[k] === undefined) delete patch[k];
    });

    const updated = await upsertBillingForOrg(orgId, patch);

    return res.status(200).json({
      ok: true,
      billingRecordId: updated?.id || null,
    });
  } catch (e) {
    console.error("[billing/update] error:", e);
    return res.status(500).json({ error: e?.message || "Failed to update billing." });
  }
}
