// pages/api/org/billing/status.js
import { requireBillingAdmin } from "@/lib/requireBillingAdmin";
import { findBillingRecordByOrgToken, findBillingRecordByOrgId, F, firstLookupValue } from "@/lib/airtableBilling";
import { supabaseAdmin as db } from "@/lib/supabase";

// In-memory cache - survives across warm serverless invocations.
// Billing status changes infrequently; 5 min TTL is safe.
const _cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;
function cacheGet(key) {
  const e = _cache.get(key);
  if (!e) return null;
  if (Date.now() > e.exp) { _cache.delete(key); return null; }
  return e.val;
}
function cacheSet(key, val) {
  _cache.set(key, { val, exp: Date.now() + CACHE_TTL });
}

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

function iso(date) {
  return date ? new Date(date).toISOString() : "";
}

function lower(v) {
  return String(v || "").trim().toLowerCase();
}

function computeIsPaidOk({ status, sandboxEnds, trialEnds, currentPeriodEnd }) {
  const s = lower(status);

  // Free tier is always OK (no Stripe subscription needed)
  if (s === "free") return true;

  // Explicit locked states always block
  if (s.includes("past") || s.includes("due")) return false;
  if (s.includes("cancel")) return false;
  if (s.includes("unpaid") || s.includes("suspend")) return false;
  if (s.includes("not started") || s.includes("not_started")) return false;

  // ✅ Sandbox: allow if Sandbox Ends exists and is in the future
  const se = toDateOrNull(sandboxEnds);
  if (se) {
    const now = Date.now();
    const end = se.getTime();
    if (!Number.isNaN(end) && now < end) return true;
    // If expired, sandbox is not ok (falls through to false)
  }

  // Stripe states
  if (s.includes("trial")) return true;
  if (s === "active") return true;

  // Legacy date fallbacks (if you still want them)
  const te = toDateOrNull(trialEnds);
  if (te) {
    const now = Date.now();
    const end = te.getTime();
    if (!Number.isNaN(end) && now < end) return true;
  }

  const cpe = toDateOrNull(currentPeriodEnd);
  if (cpe) {
    const now = Date.now();
    const end = cpe.getTime();
    if (!Number.isNaN(end) && now < end) return true;
  }

  return false;
}

export default async function handler(req, res) {
  // Allow browser/CDN to cache for 5 min; revalidate in background up to 10 min
  res.setHeader("Cache-Control", "private, max-age=300, stale-while-revalidate=600");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = requireBillingAdmin(req, res);
  if (!user) return;

  // Prefer token (now the canonical stable key)
  const sessionToken = String(user?.Token || user?.token || user?.orgToken || "").trim().toUpperCase();

  // Keep orgId as optional fallback
  const sessionOrgId = String(
    user?.orgId || user?.OrgId || user?.OrganizationId || user?.organizationId || user?.id || ""
  ).trim();

  if (!sessionToken && !sessionOrgId) {
    return res.status(400).json({ error: "Missing orgId/token in session." });
  }

  const cacheKey = sessionToken || sessionOrgId;

  // Serve from in-memory cache if available (avoids Airtable on warm instances)
  const cached = cacheGet(cacheKey);
  if (cached) return res.status(200).json(cached);

  try {
    // ✅ Check Supabase billing table first (canonical for orgs created via Supabase signup)
    let sbRow = null;
    if (sessionToken) {
      const { data } = await db.from("billing").select("*").eq("token", sessionToken).maybeSingle();
      sbRow = data;
    }
    if (!sbRow && sessionOrgId) {
      const { data } = await db.from("billing").select("*").eq("org_id", sessionOrgId).maybeSingle();
      sbRow = data;
    }

    if (sbRow) {
      const statusRaw = String(sbRow.billing_status || "").trim();
      const isPaidOk = computeIsPaidOk({
        status:           statusRaw,
        sandboxEnds:      sbRow.sandbox_ends     || "",
        trialEnds:        sbRow.trial_ends        || "",
        currentPeriodEnd: sbRow.current_period_end || "",
      });
      const payload = {
        ok: true,
        billing: {
          isPaidOk,
          status:                statusRaw,
          statusRaw:             statusRaw,
          plan:                  String(sbRow.plan || ""),
          token:                 String(sbRow.token || sessionToken || ""),
          sandboxEnds:           sbRow.sandbox_ends      ? new Date(sbRow.sandbox_ends).toISOString()      : "",
          trialEnds:             sbRow.trial_ends         ? new Date(sbRow.trial_ends).toISOString()         : "",
          currentPeriodEnd:      sbRow.current_period_end ? new Date(sbRow.current_period_end).toISOString() : "",
          renewalDate:           sbRow.renewal_date        ? new Date(sbRow.renewal_date).toISOString()        : "",
          stripeCustomerId:      sbRow.stripe_customer_id      || "",
          stripeSubscriptionId:  sbRow.stripe_subscription_id  || "",
          created:               sbRow.created_at || "",
          billingRecordId:       sbRow.id || "",
          source:                "supabase",
        },
      };
      cacheSet(cacheKey, payload);
      return res.status(200).json(payload);
    }

    // Legacy fallback: Airtable billing (orgs created before Supabase migration)
    let rec = sessionToken ? await findBillingRecordByOrgToken(sessionToken) : null;
    if (!rec?.id && sessionOrgId) rec = await findBillingRecordByOrgId(sessionOrgId);

    if (!rec?.id) {
      return res.status(200).json({
        ok: true,
        billing: {
          isPaidOk: false,
          status: "",
          statusRaw: "",
          token: sessionToken || "",
          sandboxEnds: "",
          trialEnds: "",
          currentPeriodEnd: "",
          renewalDate: "",
          stripeCustomerId: "",
          stripeSubscriptionId: "",
        },
      });
    }

    const f = rec.fields || {};

    const createdRaw = firstLookupValue(f?.[F.Created]);
    const createdAt = toDateOrNull(createdRaw);

    const statusRaw = String(f?.[F.BillingStatus] || "").trim();

    // ✅ Sandbox Ends
    let sandboxEnds = String(f?.[F.SandboxEnds] || "").trim();

    // Stripe/webhook-owned fields
    let trialEnds = String(f?.[F.TrialEnds] || "").trim();
    const currentPeriodEnd = String(f?.[F.CurrentPeriodEnd] || "").trim();
    const renewalDate = String(f?.[F.RenewalDate] || "").trim();

    // READ ONLY fallback: if sandboxEnds missing but createdAt exists, infer +14 days
    // (Optional safeguard; remove if you want ONLY explicit sandboxEnds to count)
    const SANDBOX_DAYS = 14;
    const se = toDateOrNull(sandboxEnds);
    if (!se && createdAt) {
      sandboxEnds = iso(addDays(createdAt, SANDBOX_DAYS));
    }

    // READ ONLY fallback: infer trialEnds if missing (Created + 30 days)
    const trialEndsDate = toDateOrNull(trialEnds);
    if (!trialEndsDate && createdAt) {
      trialEnds = iso(addDays(createdAt, 30));
    }

    const isPaidOk = computeIsPaidOk({
      status: statusRaw,
      sandboxEnds,
      trialEnds,
      currentPeriodEnd,
    });

    const payload = {
      ok: true,
      billing: {
        isPaidOk,
        status: statusRaw || "",
        statusRaw: statusRaw || "",
        plan: String(f?.[F.Plan] || "").trim(),
        token: String(f?.[F.Token] || sessionToken || "").trim(),
        sandboxEnds: sandboxEnds || "",
        trialEnds: trialEnds || "",
        currentPeriodEnd: currentPeriodEnd || "",
        renewalDate: renewalDate || "",
        stripeCustomerId: f?.[F.StripeCustomerId] || "",
        stripeSubscriptionId: f?.[F.StripeSubscriptionId] || "",
        created: createdRaw || "",
        billingRecordId: rec?.id || "",
      },
    };
    cacheSet(cacheKey, payload);
    return res.status(200).json(payload);
  } catch (e) {
    console.error("[billing/status] error:", e);
    return res.status(500).json({ error: e?.message || "Failed to load billing status." });
  }
}