// pages/api/org/billing/get.js
import { requireBillingAdmin } from "@/lib/requireBillingAdmin";
import {
  findBillingRecordByOrgId,
  findBillingRecordByOrgToken,
  upsertBillingForOrg,
  F,
  firstLookupValue,
} from "@/lib/airtableBilling";

function toDateOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addYears(date, years) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function iso(date) {
  return date ? new Date(date).toISOString() : "";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = requireBillingAdmin(req, res);
  if (!user) return;

  // orgId from session (may or may not match Billing base org record id)
  const sessionOrgId = String(
    user?.orgId || user?.OrgId || user?.OrganizationId || user?.organizationId || user?.id || ""
  ).trim();

  // token from session (used for fallback find)
  const sessionToken = String(user?.Token || user?.token || user?.orgToken || "").trim();

  if (!sessionOrgId && !sessionToken) {
    return res.status(400).json({ error: "Missing orgId/token in session." });
  }

  try {
    // 1) Prefer orgId match
    let rec = sessionOrgId ? await findBillingRecordByOrgId(sessionOrgId) : null;

    // 2) Fallback: token match (common when session orgId is from another base/table)
    if (!rec && sessionToken) {
      rec = await findBillingRecordByOrgToken(sessionToken);
    }

    const fields = rec?.fields || {};

    // Determine the correct org record id to use for writeback/upserts:
    // If we found a billing record, use its linked Organization id.
    // Otherwise fall back to sessionOrgId.
    const linkedOrgId = Array.isArray(fields?.[F.Organization]) ? fields[F.Organization]?.[0] : "";
    const effectiveOrgId = String(linkedOrgId || sessionOrgId || "").trim();

    // Lookup fields often return arrays
    const createdRaw = firstLookupValue(fields?.[F.Created]);
    const createdAt = toDateOrNull(createdRaw);

    const statusRaw = String(fields?.[F.BillingStatus] || "").trim();
    const status = statusRaw.toLowerCase();

    const existingTrialEnds = toDateOrNull(fields?.[F.TrialEnds]);
    const existingRenewal = toDateOrNull(fields?.[F.RenewalDate]);
    const existingCPE = toDateOrNull(fields?.[F.CurrentPeriodEnd]);

    // ✅ Compute derived dates
    let computedTrialEnds = existingTrialEnds;
    let computedRenewal = existingRenewal;
    let computedCPE = existingCPE;

    // Assumption: annual after trial
    if (createdAt) {
      if (!computedTrialEnds) computedTrialEnds = addDays(createdAt, 30);
      if (!computedRenewal && computedTrialEnds) computedRenewal = addYears(computedTrialEnds, 1);

      if (!computedCPE) {
        if (status.includes("trial")) computedCPE = computedTrialEnds;
        else if (status.includes("active")) computedCPE = computedRenewal;
        else computedCPE = computedTrialEnds;
      }
    }

    // ✅ Optional writeback so Airtable stays populated.
    // Default ON. Disable via ?writeback=0
    const writeback = String(req.query?.writeback ?? "1").trim() !== "0";

    if (writeback && createdAt && rec?.id && effectiveOrgId) {
      const patch = {};
      let shouldWrite = false;

      if (!existingTrialEnds && computedTrialEnds) {
        patch[F.TrialEnds] = iso(computedTrialEnds);
        shouldWrite = true;
      }
      if (!existingRenewal && computedRenewal) {
        patch[F.RenewalDate] = iso(computedRenewal);
        shouldWrite = true;
      }
      if (!existingCPE && computedCPE) {
        patch[F.CurrentPeriodEnd] = iso(computedCPE);
        shouldWrite = true;
      }

      if (shouldWrite) {
        try {
          await upsertBillingForOrg(effectiveOrgId, patch);
        } catch (e) {
          console.warn("[billing/get] date writeback failed:", e?.message || e);
        }
      }
    }

    const debugEnabled =
      String(req.query?.debug || "").trim() === "1" || String(req.query?.debug || "").trim() === "true";

    return res.status(200).json({
      ok: true,
      orgId: effectiveOrgId || null,
      sessionOrgId: sessionOrgId || null,
      sessionToken: sessionToken || null,
      billingRecordId: rec?.id || null,
      billing: rec
        ? {
            // Billing Contact
            billingName: fields[F.BillingContactName] || "",
            billingEmail: fields[F.BillingEmail] || "",
            billingPhone: fields[F.BillingPhone] || "",
            billingRoleTitle: fields[F.BillingRoleTitle] || "",

            // Address
            billingAddress1: fields[F.BillingAddress1] || "",
            billingAddress2: fields[F.BillingAddress2] || "",
            billingCity: fields[F.BillingCity] || "",
            billingState: fields[F.BillingState] || "",
            billingPostal: fields[F.BillingPostal] || "",
            billingCountry: fields[F.BillingCountry] || "",

            // Business identity
            legalBusinessName: fields[F.LegalBusinessName] || "",
            dbaName: fields[F.DBAName] || "",
            businessType: fields[F.BusinessType] || "",
            taxIdType: fields[F.TaxIdType] || "",
            taxIdLast4: fields[F.TaxIdLast4] || "",
            taxExempt: Boolean(fields[F.TaxExempt]),
            taxExemptCertUrl: fields[F.TaxExemptCertUrl] || "",

            // Plan/subscription
            plan: fields[F.Plan] || "",
            status: fields[F.BillingStatus] || "",
            renewalDate: iso(computedRenewal) || fields[F.RenewalDate] || "",
            trialEnds: iso(computedTrialEnds) || fields[F.TrialEnds] || "",
            currentPeriodEnd: iso(computedCPE) || fields[F.CurrentPeriodEnd] || "",

            // Stripe ids (read-only)
            stripeCustomerId: fields[F.StripeCustomerId] || "",
            stripeSubscriptionId: fields[F.StripeSubscriptionId] || "",

            // Payment prefs + terms
            preferredPaymentMethod: fields[F.PreferredPaymentMethod] || "",
            paymentTerms: fields[F.PaymentTerms] || "",
            poRequired: Boolean(fields[F.PORequired]),
            poNumber: fields[F.PONumber] || "",

            // Optional banking metadata (last4 only)
            bankName: fields[F.BankName] || "",
            routingLast4: fields[F.RoutingLast4] || "",
            accountLast4: fields[F.AccountLast4] || "",
            wireInstructions: fields[F.WireInstructions] || "",

            // Lookups
            created: createdRaw || "",
            token: firstLookupValue(fields?.[F.Token]) || "",
          }
        : null,
      ...(debugEnabled
        ? {
            debug: {
              foundRecord: Boolean(rec?.id),
              effectiveOrgId,
              linkedOrgId: linkedOrgId || null,
              fieldKeys: Object.keys(fields || {}),
            },
          }
        : {}),
    });
  } catch (e) {
    console.error("[billing/get] error:", e);
    return res.status(500).json({ error: e?.message || "Failed to load billing." });
  }
}
