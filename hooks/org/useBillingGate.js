"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { safeJson } from "@/components/org/reviewQueue/reviewQueue.helpers";

export function useBillingGate({ user, role, isOrgSide }) {
  const canInitTrial = role === "organization" || role === "admin";

  // Admins and org owners can always access the page so they can manage billing.
  // They see a warning banner instead of a hard gate screen.
  const isAdminBypass = canInitTrial;

  const [billingLoading, setBillingLoading] = useState(true);
  const [billingErr,     setBillingErr]     = useState("");
  const [billing,        setBilling]        = useState(null);

  const ensuredTrialRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function run() {
      if (!user || !isOrgSide) return;

      setBillingLoading(true);
      setBillingErr("");

      try {
        if (canInitTrial && !ensuredTrialRef.current) {
          ensuredTrialRef.current = true;
          await fetch("/api/org/billing/ensureTrial", {
            method: "POST",
            credentials: "include",
          }).catch(() => null);
        }

        const res  = await fetch("/api/org/billing/status", {
          method: "GET",
          credentials: "include",
        });
        const json = await safeJson(res);
        if (!res.ok) throw new Error(json?.error || "Failed to load billing status.");

        if (mounted) setBilling(json?.billing || null);
      } catch (e) {
        if (mounted) setBillingErr(e?.message || "Failed to load billing status.");
      } finally {
        if (mounted) setBillingLoading(false);
      }
    }

    run();
    return () => { mounted = false; };
  }, [user, isOrgSide, canInitTrial]);

  return useMemo(() => {
    const rawIsPaidOk = Boolean(billing?.isPaidOk);
    // Admins/org bypass the hard gate - they can always enter to fix billing
    const isPaidOk    = isAdminBypass || rawIsPaidOk;
    return {
      billingLoading,
      billingErr,
      billing,
      isPaidOk,
      rawIsPaidOk,    // true only when subscription is actually valid
      isAdminBypass,  // consumers can show a "fix billing" banner instead of gating
    };
  }, [billingLoading, billingErr, billing, isAdminBypass]);
}
