// pages/api/stripe/create-checkout-session.js
import stripe from "@/lib/stripe";
import { requireBillingAdmin } from "@/lib/requireBillingAdmin";
import { findBillingRecordByOrgToken, upsertBillingForOrgToken, F } from "@/lib/airtableBilling";

function asString(v) {
  return String(v ?? "").trim();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireBillingAdmin(req, res);
  if (!user) return;

  // ✅ Canonical key now: Billing.Token (single line text)
  const token = asString(user?.Token || user?.token || user?.orgToken).toUpperCase();
  if (!token) return res.status(400).json({ error: "Missing organization token in session." });

  // Optional: org Airtable record id (nice to link Billing->Organization; OK if missing)
  const orgId = asString(
    user?.orgId || user?.OrgId || user?.OrganizationId || user?.organizationId || user?.id || ""
  );

  // Tier + interval → price ID
  // Growth monthly  ($69.99/mo)  → STRIPE_PRICE_GROWTH_MONTHLY
  // Growth annual   ($599.88/yr) → STRIPE_PRICE_GROWTH_YEARLY
  // Pro monthly     ($499/mo)    → STRIPE_PRICE_PRO_MONTHLY
  // Pro annual      ($4,188/yr)  → STRIPE_PRICE_PRO_YEARLY
  // Note: Pro pricing reflects full rate. FOUNDER promo code at Stripe checkout
  //       drops Pro to $99/mo or $1,188/yr — handled entirely by Stripe coupon,
  //       no code changes needed (allow_promotion_codes: true is set below).
  const { tier = "large", interval = "yearly" } = req.body || {};
  const tierKey     = String(tier     || "large").toLowerCase();
  const intervalKey = String(interval || "yearly").toLowerCase() === "monthly" ? "monthly" : "yearly";

  const PRICE_MAP = {
    small_monthly: process.env.STRIPE_PRICE_GROWTH_MONTHLY,
    small_yearly:  process.env.STRIPE_PRICE_GROWTH_YEARLY,
    large_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    large_yearly:  process.env.STRIPE_PRICE_PRO_YEARLY,
  };

  const priceId =
    PRICE_MAP[`${tierKey}_${intervalKey}`] ||
    (intervalKey === "monthly" ? process.env.STRIPE_PRICE_MONTHLY : null) ||
    process.env.STRIPE_PRICE_YEARLY;

  if (!priceId) return res.status(500).json({
    error: `Missing Stripe price ID for ${tierKey}/${intervalKey}. Set STRIPE_PRICE_GROWTH_MONTHLY, STRIPE_PRICE_GROWTH_YEARLY, STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_PRO_YEARLY in env.`,
  });

  try {
    const origin = req.headers.origin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // 1) Find existing Billing row by Token
    const billingRec = await findBillingRecordByOrgToken(token);
    const existingCustomerId = asString(billingRec?.fields?.[F.StripeCustomerId] || "");

    let customerId = existingCustomerId;

    // 2) Create Stripe customer if missing, then upsert INTO SAME BILLING ROW (by token)
    if (!customerId) {
      const customer = await stripe.customers.create({
        description: "CheckPeak organization customer",
        metadata: { orgToken: token },
      });
      customerId = customer.id;

      const planLabel = tierKey === "small" ? "Growth" : "Pro";

      await upsertBillingForOrgToken(
        token,
        {
          [F.Token]: token,
          [F.StripeCustomerId]: customerId,
          [F.Plan]: planLabel,
          [F.BillingStatus]: "Trial",
          [F.Currency]: "USD",
        },
        orgId
      );
    }

    // 3) Create Checkout session (trial starts when they finish checkout)
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 30,
        metadata: { orgToken: token, tier: tierKey, interval: intervalKey },
      },
      success_url: `${origin}/account?billing=success`,
      cancel_url: `${origin}/account?billing=cancel`,
      allow_promotion_codes: true,
      automatic_tax: { enabled: false },
      metadata: { orgToken: token },
    });

    return res.status(200).json({ ok: true, url: session.url });
  } catch (e) {
    console.error("[stripe/create-checkout-session] error:", e);
    return res.status(500).json({ error: e?.message || "Failed to create checkout session." });
  }
}