// pages/api/org/billing/get.js
import { requireBillingAdmin } from "@/lib/requireBillingAdmin";
import { findBillingRecordByOrgToken, F } from "@/lib/airtableBilling";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = requireBillingAdmin(req, res);
  if (!user) return;

  const orgToken = String(user?.Token || user?.token || user?.["Organization Token"] || "").trim();
  if (!orgToken) return res.status(400).json({ error: "Missing Token in session." });

  // Optional (for setting link / debugging only)
  const orgId = String(user?.orgId || user?.OrgId || user?.OrganizationId || user?.organizationId || user?.id || "").trim();

  try {
    const rec = await findBillingRecordByOrgToken(orgToken);
    const fields = rec?.fields || {};

    return res.status(200).json({
      ok: true,
      orgToken,
      orgId: orgId || null,
      billingRecordId: rec?.id || null,
      billing: rec
        ? {
            billingName: fields[F.BillingContactName] || "",
            billingEmail: fields[F.BillingEmail] || "",
            billingPhone: fields[F.BillingPhone] || "",
            billingRoleTitle: fields[F.BillingRoleTitle] || "",

            billingAddress1: fields[F.BillingAddress1] || "",
            billingAddress2: fields[F.BillingAddress2] || "",
            billingCity: fields[F.BillingCity] || "",
            billingState: fields[F.BillingState] || "",
            billingPostal: fields[F.BillingPostal] || "",
            billingCountry: fields[F.BillingCountry] || "",

            legalBusinessName: fields[F.LegalBusinessName] || "",
            dbaName: fields[F.DBAName] || "",
            businessType: fields[F.BusinessType] || "",
            taxIdType: fields[F.TaxIdType] || "",
            taxIdLast4: fields[F.TaxIdLast4] || "",
            taxExempt: Boolean(fields[F.TaxExempt]),
            taxExemptCertUrl: fields[F.TaxExemptCertUrl] || "",

            plan: fields[F.Plan] || "",
            status: fields[F.BillingStatus] || "",
            renewalDate: fields[F.RenewalDate] || "",
            trialEnds: fields[F.TrialEnds] || "",

            stripeCustomerId: fields[F.StripeCustomerId] || "",
            stripeSubscriptionId: fields[F.StripeSubscriptionId] || "",

            preferredPaymentMethod: fields[F.PreferredPaymentMethod] || "",
            paymentTerms: fields[F.PaymentTerms] || "",
            poRequired: Boolean(fields[F.PORequired]),
            poNumber: fields[F.PONumber] || "",

            bankName: fields[F.BankName] || "",
            routingLast4: fields[F.RoutingLast4] || "",
            accountLast4: fields[F.AccountLast4] || "",
            wireInstructions: fields[F.WireInstructions] || "",
          }
        : null,
    });
  } catch (e) {
    console.error("[billing/get] error:", e);
    return res.status(500).json({ error: "Failed to load billing." });
  }
}
