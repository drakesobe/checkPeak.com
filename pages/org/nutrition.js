// pages/org/nutrition.js
"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import { useBillingGate }   from "@/hooks/org/useBillingGate";
import BillingGateScreen    from "@/components/org/reviewQueue/BillingGateScreen";
import BillingLoadingScreen from "@/components/org/reviewQueue/BillingLoadingScreen";
import OrgNutritionQueuePage from "@/components/org/nutrition/page/OrgNutritionQueuePage";

function deriveRole(user) {
  const r = String(user?.role || user?.Role || "").trim().toLowerCase();
  if (r === "organization" || r.includes("org"))   return "organization";
  if (r === "admin"        || r.includes("admin")) return "admin";
  if (r === "trainer"      || r.includes("train")) return "trainer";
  if (r.includes("ath"))                           return "athlete";
  return r;
}

export default function Page() {
  const router = useRouter();
  const { user, logout } = useAuthContext();

  const role      = useMemo(() => deriveRole(user), [user]);
  const isOrgSide = role === "organization" || role === "admin" || role === "trainer";

  const { billingLoading, billingErr, billing, isPaidOk } = useBillingGate({ user, role, isOrgSide });

  const onLogout = useCallback(async () => {
    try { await logout?.(); } finally { router.push("/"); }
  }, [logout, router]);

  if (billingLoading) return <BillingLoadingScreen />;
  if (billingErr || !isPaidOk) {
    return (
      <BillingGateScreen
        role={role} billing={billing} error={billingErr}
        onLogout={onLogout} onGoAccount={() => router.push("/account")}
      />
    );
  }

  return <OrgNutritionQueuePage />;
}
