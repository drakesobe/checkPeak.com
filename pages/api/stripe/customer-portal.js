// pages/api/stripe/customer-portal.js
import stripe from "@/lib/stripe";
import { requireBillingAdmin } from "@/lib/requireBillingAdmin";
import { findBillingRecordByOrgToken, F } from "@/lib/airtableBilling";

function asString(v) {
  return String(v ?? "").trim();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireBillingAdmin(req, res);
  if (!user) return;

  const token = asString(user?.Token || user?.token || user?.orgToken).toUpperCase();
  if (!token) return res.status(400).json({ error: "Missing organization token in session." });

  try {
    const origin = req.headers.origin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const rec = await findBillingRecordByOrgToken(token);
    const customerId = asString(rec?.fields?.[F.StripeCustomerId] || "");
    if (!customerId) {
      return res.status(400).json({ error: "No Stripe customer found. Start a subscription first." });
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/account`,
    });

    return res.status(200).json({ ok: true, url: portal.url });
  } catch (e) {
    console.error("[stripe/customer-portal] error:", e);
    return res.status(500).json({ error: e?.message || "Failed to create customer portal session." });
  }
}