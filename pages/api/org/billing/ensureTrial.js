// pages/api/org/billing/ensureTrial.js
import { requireOrg } from "@/lib/requireOrg";
import { supabaseAdmin as db } from "@/lib/supabase";
import {
  findBillingRecordByOrgId,
  findBillingRecordByOrgToken,
  upsertBillingForOrg,
  upsertBillingForOrgToken,
  F,
} from "@/lib/airtableBilling";

function asString(v) {
  return String(v ?? "").trim();
}

function lower(v) {
  return asString(v).toLowerCase();
}

function parseDateLoose(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(d, days) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

function normalizeStatus(v) {
  const s = lower(v);
  if (!s) return "";
  if (s === "free") return "Free";
  if (s.includes("sandbox")) return "Sandbox";
  if (s.includes("trial")) return "Trial";
  if (s.includes("active")) return "Active";
  if (s.includes("past")) return "Past Due";
  if (s.includes("cancel")) return "Canceled";
  if (s.includes("suspend") || s.includes("unpaid")) return "Suspended";
  if (s.includes("not started") || s.includes("not_started")) return "Not Started";
  return asString(v);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Route", "billing/ensureTrial");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const method = String(req.method || "GET").toUpperCase();
  if (method !== "POST" && method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  // Supabase UUID from session
  const orgSupabaseId = asString(auth?.org?.id || auth?.orgId || auth?.OrgId);
  if (!orgSupabaseId) return res.status(400).json({ error: "Organization id missing in session." });

  // Resolve Airtable record id (rec...) needed by billing helpers.
  // May be null for orgs created via Supabase-only signup; fall through to token-based path.
  const { data: orgRow } = await db
    .from("organizations")
    .select("airtable_id")
    .eq("id", orgSupabaseId)
    .maybeSingle();
  const orgId = asString(orgRow?.airtable_id);

  // Token is lookup/computed - only used for fallback search/relink, never written.
  const orgToken = asString(auth?.org?.token || auth?.org?.Token || auth?.token || auth?.Token || auth?.orgToken).toUpperCase();

  const SANDBOX_DAYS = 14;

  try {
    const now = new Date();

    const sandboxEndsISO = addDays(now, SANDBOX_DAYS).toISOString();

    let rec;

    if (orgId) {
      // Canonical path: org is linked to an Airtable record
      rec = await findBillingRecordByOrgId(orgId);

      // Fallback: find by token and relink to org
      if (!rec?.id && orgToken) {
        const byToken = await findBillingRecordByOrgToken(orgToken);
        if (byToken?.id) rec = byToken;
      }

      if (!rec?.id) {
        rec = await upsertBillingForOrg(orgId, {
          [F.BillingStatus]: "Sandbox",
          [F.SandboxEnds]: sandboxEndsISO,
        });
      } else {
        const linkedOrgId = Array.isArray(rec?.fields?.[F.Organization]) ? rec.fields[F.Organization]?.[0] : "";
        if (!linkedOrgId || linkedOrgId !== orgId) {
          rec = await upsertBillingForOrg(orgId, {
            ...(asString(rec?.fields?.[F.BillingStatus] || "") ? {} : { [F.BillingStatus]: "Sandbox" }),
            [F.SandboxEnds]: asString(rec?.fields?.[F.SandboxEnds] || "") || sandboxEndsISO,
          });
        } else {
          const statusNorm = normalizeStatus(rec?.fields?.[F.BillingStatus] || "");
          const se = parseDateLoose(rec?.fields?.[F.SandboxEnds] || "");
          if (statusNorm === "Sandbox" && !se) {
            rec = await upsertBillingForOrg(orgId, { [F.SandboxEnds]: sandboxEndsISO });
          }
        }
      }
    } else if (orgToken) {
      // Token-only path: org has no Airtable ID (created via Supabase-only signup)
      rec = await findBillingRecordByOrgToken(orgToken);
      if (!rec?.id) {
        rec = await upsertBillingForOrgToken(orgToken, {
          [F.BillingStatus]: "Sandbox",
          [F.SandboxEnds]: sandboxEndsISO,
        });
      } else {
        const statusNorm = normalizeStatus(rec?.fields?.[F.BillingStatus] || "");
        const se = parseDateLoose(rec?.fields?.[F.SandboxEnds] || "");
        if (statusNorm === "Sandbox" && !se) {
          rec = await upsertBillingForOrgToken(orgToken, { [F.SandboxEnds]: sandboxEndsISO });
        }
      }
    } else {
      return res.status(400).json({ error: "Organization has no Airtable ID or token - billing unavailable." });
    }

    // Post-process: if sandbox expired, flip to Not Started (do not override Trial/Active)
    const f = rec?.fields || {};
    const statusNorm = normalizeStatus(f?.[F.BillingStatus] || "");
    const seRaw = asString(f?.[F.SandboxEnds] || "");
    const se = parseDateLoose(seRaw);

    if (statusNorm === "Sandbox" && se && now.getTime() > se.getTime()) {
      rec = orgId
        ? await upsertBillingForOrg(orgId, { [F.BillingStatus]: "Not Started" })
        : await upsertBillingForOrgToken(orgToken, { [F.BillingStatus]: "Not Started" });
    }

    const out = rec?.fields || {};
    const outStatus = asString(out?.[F.BillingStatus] || "");
    const outSe = asString(out?.[F.SandboxEnds] || "");

    const outStatusNorm = normalizeStatus(outStatus);
    const outSeDate = parseDateLoose(outSe);

    const isPaidOk =
      outStatusNorm === "Free" ||
      (outStatusNorm === "Sandbox" && outSeDate && now.getTime() <= outSeDate.getTime()) ||
      outStatusNorm === "Trial" ||
      outStatusNorm === "Active";

    const lockedReason =
      isPaidOk
        ? ""
        : outStatusNorm === "Not Started"
        ? "Sandbox ended - start your 30-day trial to continue."
        : outStatusNorm === "Past Due"
        ? "Payment failed or trial ended - payment required."
        : outStatusNorm === "Canceled"
        ? "Subscription canceled."
        : outStatusNorm === "Suspended"
        ? "Subscription suspended."
        : "Subscription not active.";

    return res.status(200).json({
      ok: true,
      billing: {
        status: outStatus || outStatusNorm || "Not Started",
        statusNormalized: outStatusNorm || "",
        isPaidOk,
        lockedReason,
        sandboxEnds: outSe || "",
        trialEnds: asString(out?.[F.TrialEnds] || ""),
        currentPeriodEnd: asString(out?.[F.CurrentPeriodEnd] || ""),
        renewalDate: asString(out?.[F.RenewalDate] || ""),
        recordId: rec?.id || "",
      },
    });
  } catch (err) {
    console.error("[billing/ensureTrial] error:", err);
    return res.status(500).json({
      error: "Failed to ensure billing status",
      details: err?.message || String(err),
    });
  }
}