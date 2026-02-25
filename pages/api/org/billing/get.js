// pages/api/org/billing/get.js
import { requireBillingAdmin } from "@/lib/requireBillingAdmin";
import {
  findBillingRecordByOrgToken,
  upsertBillingForOrgToken,
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

  // ✅ Token is canonical now — no orgId fallback
  const sessionToken = String(user?.Token || user?.token || user?.orgToken || "").trim();

  if (!sessionToken) {
    return res.status(400).json({ error: "Missing Token in session." });
  }

  try {
    // ✅ Token-only lookup
    const rec = await findBillingRecordByOrgToken(sessionToken);

    const fields = rec?.fields || {};

    // Optional: linked org id if you still link Billing -> Organization in Airtable
    const linkedOrgId = Array.isArray(fields?.[F.Organization]) ? fields[F.Organization]?.[0] : "";

    const createdRaw = firstLookupValue(fields?.[F.Created]);
    const createdAt = toDateOrNull(createdRaw);

    const statusRaw = String(fields?.[F.BillingStatus] || "").trim();
    const status = statusRaw.toLowerCase();

    const existingTrialEnds = toDateOrNull(fields?.[F.TrialEnds]);
    const existingRenewal = toDateOrNull(fields?.[F.RenewalDate]);
    const existingCPE = toDateOrNull(fields?.[F.CurrentPeriodEnd]);

    let computedTrialEnds = existingTrialEnds;
    let computedRenewal = existingRenewal;
    let computedCPE = existingCPE;

    if (createdAt) {
      if (!computedTrialEnds) computedTrialEnds = addDays(createdAt, 30);
      if (!computedRenewal && computedTrialEnds) computedRenewal = addYears(computedTrialEnds, 1);

      if (!computedCPE) {
        if (status.includes("trial")) computedCPE = computedTrialEnds;
        else if (status.includes("active")) computedCPE = computedRenewal;
        else computedCPE = computedTrialEnds;
      }
    }

    // ✅ Writeback is OFF by default. Enable only when requested: ?writeback=1
    const writeback = String(req.query?.writeback ?? "0").trim() === "1";

    if (writeback && createdAt && rec?.id) {
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
          // ✅ Canonical: upsert by token (optionally link org if linkedOrgId is valid)
          await upsertBillingForOrgToken(sessionToken, patch, linkedOrgId);
        } catch (e) {
          console.warn("[billing/get] date writeback failed:", e?.message || e);
        }
      }
    }

    const stripeSubscriptionId = String(fields?.[F.StripeSubscriptionId] || "").trim();

    // ✅ Button rule: if no Stripe Subscription ID, allow starting trial
    const canStartTrial = !stripeSubscriptionId;

    const debugEnabled =
      String(req.query?.debug || "").trim() === "1" || String(req.query?.debug || "").trim() === "true";

    return res.status(200).json({
      ok: true,
      token: sessionToken.toUpperCase(),
      billingRecordId: rec?.id || null,
      orgId: linkedOrgId || null, // optional, from Airtable link only (NOT used for lookup)
      canStartTrial,

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
            renewalDate: iso(computedRenewal) || fields[F.RenewalDate] || "",
            trialEnds: iso(computedTrialEnds) || fields[F.TrialEnds] || "",
            currentPeriodEnd: iso(computedCPE) || fields[F.CurrentPeriodEnd] || "",

            stripeCustomerId: fields[F.StripeCustomerId] || "",
            stripeSubscriptionId,

            preferredPaymentMethod: fields[F.PreferredPaymentMethod] || "",
            paymentTerms: fields[F.PaymentTerms] || "",
            poRequired: Boolean(fields[F.PORequired]),
            poNumber: fields[F.PONumber] || "",

            bankName: fields[F.BankName] || "",
            routingLast4: fields[F.RoutingLast4] || "",
            accountLast4: fields[F.AccountLast4] || "",
            wireInstructions: fields[F.WireInstructions] || "",

            created: createdRaw || "",
            token: String(fields?.[F.Token] || "").trim(),
          }
        : null,

      ...(debugEnabled
        ? {
            debug: {
              foundRecord: Boolean(rec?.id),
              linkedOrgId: linkedOrgId || null,
              fieldKeys: Object.keys(fields || {}),
              writebackEnabled: writeback,
              canStartTrial,
            },
          }
        : {}),
    });
  } catch (e) {
    console.error("[billing/get] error:", e);
    return res.status(500).json({ error: e?.message || "Failed to load billing." });
  }
}