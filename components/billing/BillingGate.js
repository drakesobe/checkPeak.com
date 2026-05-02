// components/billing/BillingGate.js
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function toTime(v) {
  if (!v) return 0;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function fmtDate(v) {
  if (!v) return "—";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return String(v);
  }
}

/**
 * BillingGate
 * Wrap org-side pages:
 * <BillingGate><OrgDashboard /></BillingGate>
 *
 * Props:
 * - role?: string (admin can bypass if you want)
 * - allowAdminBypass?: boolean (default true)
 * - children
 */
export default function BillingGate({ role = "", allowAdminBypass = true, children }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [billing, setBilling] = useState(null);

  const roleNorm  = String(role || "").trim().toLowerCase();
  const isAdmin   = roleNorm === "admin";
  const isTrainer = roleNorm === "trainer";
  const bypass = allowAdminBypass && (isAdmin || isTrainer);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setErr("");

      try {
        const res = await fetch("/api/org/billing/get", { credentials: "include" });
        const json = await safeJson(res);

        if (!res.ok) throw new Error(json?.error || "Failed to load billing.");
        if (mounted) setBilling(json?.billing || null);
      } catch (e) {
        if (mounted) setErr(e?.message || "Failed to load billing.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (!bypass) load();
    else setLoading(false);

    return () => {
      mounted = false;
    };
  }, [bypass]);

  const decision = useMemo(() => {
    if (bypass) return { allow: true, reason: "" };
    if (!billing) return { allow: false, reason: "No billing profile found for this organization." };

    const status = String(billing?.status || "").toLowerCase();
    const now = Date.now();

    const trialEnds = toTime(billing?.trialEnds);
    const cpe = toTime(billing?.currentPeriodEnd);

    const isTrial = status.includes("trial");
    const isActive = status.includes("active");
    const isPastDue = status.includes("past");
    const isCanceled = status.includes("cancel");
    const isSuspended = status.includes("suspend") || status.includes("unpaid");

    if (isPastDue) return { allow: false, reason: "Subscription is past due." };
    if (isCanceled) return { allow: false, reason: "Subscription is canceled." };
    if (isSuspended) return { allow: false, reason: "Subscription is suspended." };

    if (isTrial) {
      if (trialEnds && now > trialEnds) {
        return { allow: false, reason: `Trial expired on ${fmtDate(billing?.trialEnds)}.` };
      }
      return { allow: true, reason: "" };
    }

    if (isActive) {
      // Optional: if you want to enforce CPE presence/validity
      if (cpe && now > cpe) return { allow: false, reason: `Subscription expired on ${fmtDate(billing?.currentPeriodEnd)}.` };
      return { allow: true, reason: "" };
    }

    return { allow: false, reason: "Subscription not started." };
  }, [billing, bypass]);

  if (bypass) return children;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold">Checking subscription…</div>
            <div className="text-[12px] text-gray-600 mt-1">Validating access for this organization.</div>
          </div>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6">
            <div className="text-sm font-semibold text-red-800">Billing check failed</div>
            <div className="text-[12px] text-red-700 mt-1">{err}</div>
            <div className="mt-4">
              <Link
                href="/account"
                className="inline-flex items-center rounded-2xl px-4 py-2 bg-[#46769B] text-white font-semibold hover:brightness-110 transition"
              >
                Go to Account
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!decision.allow) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
            <div className="text-sm font-semibold text-amber-900">Subscription required</div>
            <div className="text-[12px] text-amber-900/90 mt-1">{decision.reason}</div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link
                href="/account"
                className="inline-flex items-center justify-center rounded-2xl px-4 py-2 bg-[#46769B] text-white font-semibold hover:brightness-110 transition"
              >
                Fix billing / start trial
              </Link>
              <div className="rounded-2xl border border-amber-200 bg-white px-4 py-2 text-[12px] text-amber-900/90">
                Trial ends: <span className="font-semibold">{fmtDate(billing?.trialEnds)}</span>
                <br />
                Status: <span className="font-semibold">{String(billing?.status || "—")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
