"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { safeJson } from "@/components/org/reviewQueue/reviewQueue.helpers";

export function useBillingGate({ user, role, isOrgSide }) {
  const canInitTrial = role === "organization" || role === "admin";

  // Admins and org owners can always access the page so they can manage billing.
  // They see a warning banner instead of a hard gate screen.
  const isAdminBypass = canInitTrial;

  const [billingLoading,  setBillingLoading]  = useState(true);
  const [billingErr,      setBillingErr]      = useState("");
  const [billing,         setBilling]         = useState(null);
  const [sessionExpired,  setSessionExpired]  = useState(false);

  const ensuredTrialRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function run() {
      if (!user || !isOrgSide) return;

      setBillingLoading(true);
      setBillingErr("");
      setSessionExpired(false);

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

        // 401 = session expired, not a billing problem.
        // Surface a distinct "session expired" state so the gate can show
        // Sign in again / Go to account instead of a billing error.
        if (res.status === 401) {
          if (mounted) {
            setSessionExpired(true);
            setBilling({ statusRaw: "session_expired" });
            setBillingLoading(false);
          }
          return;
        }

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
    // Session expired overrides admin bypass — everyone needs to re-auth.
    const isPaidOk    = sessionExpired ? false : (isAdminBypass || rawIsPaidOk);
    return {
      billingLoading,
      billingErr,
      billing,
      isPaidOk,
      rawIsPaidOk,    // true only when subscription is actually valid
      isAdminBypass,  // consumers can show a "fix billing" banner instead of gating
      sessionExpired,
    };
  }, [billingLoading, billingErr, billing, isAdminBypass, sessionExpired]);
}
