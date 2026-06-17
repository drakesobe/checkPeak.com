// hooks/org/useBillingStatus.js
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { safeJson } from "@/components/org/reviewQueue/reviewQueue.helpers";

export function useBillingStatus({ user, role, isOrgSide, enabled = true } = {}) {
  const canInitTrial = role === "organization" || role === "admin";

  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState("");
  const [billing, setBilling] = useState(null);

  const isPaidOk = Boolean(billing?.isPaidOk);

  // prevent repeated ensureTrial spam
  const ensuredTrialRef = useRef(false);

  // dedupe: prevent double fetch in StrictMode
  const inflightRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    async function run() {
      // If disabled, immediately settle
      if (!enabled) {
        if (mounted) setLoading(false);
        return;
      }

      // If auth hasn't loaded yet, don't get stuck in loading forever.
      // Keep loading true (or set false) based on what you prefer.
      // I recommend "true" while user is null so you don't show the lock screen prematurely.
      if (!user) {
        if (mounted) {
          setError("");
          setBilling(null);
          setLoading(true);
        }
        return;
      }

      // If not org-side, settle loading (page-level routing will redirect anyway)
      if (!isOrgSide) {
        if (mounted) {
          setError("");
          setBilling(null);
          setLoading(false);
        }
        return;
      }

      // Dedupe in-flight request
      if (inflightRef.current) return inflightRef.current;

      if (mounted) {
        setLoading(true);
        setError("");
      }

      const p = (async () => {
        try {
          // Fire ensureTrial in the background - don't await it so it doesn't
          // block the status fetch. On first org load it creates the billing
          // record; subsequent calls are no-ops. Either way the status fetch
          // below is what the UI cares about.
          if (canInitTrial && !ensuredTrialRef.current) {
            ensuredTrialRef.current = true;
            fetch("/api/org/billing/ensureTrial", {
              method: "POST",
              credentials: "include",
            }).catch(() => null);
          }

          // Read billing status immediately (doesn't wait for ensureTrial)
          const res = await fetch("/api/org/billing/status", {
            method: "GET",
            credentials: "include",
          });

          const json = await safeJson(res);
          if (!res.ok) throw new Error(json?.error || "Failed to load billing status.");

          if (mounted) setBilling(json?.billing || null);
        } catch (e) {
          if (mounted) setError(e?.message || "Failed to load billing status.");
        } finally {
          if (mounted) setLoading(false);
          inflightRef.current = null;
        }
      })();

      inflightRef.current = p;
      return p;
    }

    run();

    return () => {
      mounted = false;
      inflightRef.current = null;
    };
  }, [enabled, user, isOrgSide, canInitTrial]);

  return useMemo(
    () => ({
      loading,
      error,
      billing,
      isPaidOk,
    }),
    [loading, error, billing, isPaidOk]
  );
}
