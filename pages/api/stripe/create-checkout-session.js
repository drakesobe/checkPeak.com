// pages/api/stripe/create-checkout-session.js
import stripe from "@/lib/stripe";
import { requireBillingAdmin } from "@/lib/requireBillingAdmin";
import { findBillingRecordByOrgId, upsertBillingForOrg, F } from "@/lib/airtableBilling";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireBillingAdmin(req, res);
  if (!user) return;

  const orgId = String(
    user?.orgId || user?.OrgId || user?.OrganizationId || user?.organizationId || user?.id || ""
  ).trim();
  if (!orgId) return res.status(400).json({ error: "Missing orgId in session." });

  const priceId = process.env.STRIPE_PRICE_YEARLY;
  if (!priceId) return res.status(500).json({ error: "Missing STRIPE_PRICE_YEARLY env var." });

  try {
    const origin =
      req.headers.origin ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    // Try to reuse existing Stripe customer from Airtable
    const billingRec = await findBillingRecordByOrgId(orgId);
    let customerId = String(billingRec?.fields?.[F.StripeCustomerId] || "").trim();

    if (!customerId) {
      const customer = await stripe.customers.create({
        description: "CheckPeak organization customer",
        metadata: { orgId },
      });
      customerId = customer.id;

      // Save customer id immediately (safe)
      await upsertBillingForOrg(orgId, {
        [F.StripeCustomerId]: customerId,
        [F.Plan]: "Organization",
        [F.BillingStatus]: "Trial", // will be corrected by webhook to Trial/Active/etc
        [F.Currency]: "USD",
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 30,
        metadata: { orgId },
      },
      success_url: `${origin}/account?billing=success`,
      cancel_url: `${origin}/account?billing=cancel`,
      allow_promotion_codes: true,
      automatic_tax: { enabled: false },
      metadata: { orgId },
    });

    return res.status(200).json({ ok: true, url: session.url });
  } catch (e) {
    console.error("[stripe/create-checkout-session] error:", e);
    return res.status(500).json({ error: e?.message || "Failed to create checkout session." });
  }
}
