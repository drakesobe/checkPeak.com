// /hooks/org/prescriptions/useRosterPlanStatus.js
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAthleteToken, normalizeEmail } from "@/lib/org/prescriptions/prescriptions-utils";

export function useRosterPlanStatus({ athletes, orgAuthHeaders }) {
  const [doneEmailsFromPlans, setDoneEmailsFromPlans] = useState(() => new Set());
  const [statusLoading, setStatusLoading] = useState(false);

  const refreshRosterPlanStatus = useCallback(
    async (athleteList) => {
      const list = Array.isArray(athleteList) ? athleteList : athletes;
      if (!list || list.length === 0) {
        setDoneEmailsFromPlans(new Set());
        return;
      }

      setStatusLoading(true);
      try {
        const tasks = list.map(async (a) => {
          const email = normalizeEmail(a?.email);
          const token = String(getAthleteToken(a) || "").trim();
          if (!email || !token) return { email, has: false };

          const res = await fetch(
            `/api/org/nutrition/plans/getByAthlete?athleteToken=${encodeURIComponent(token)}&pageSize=1`,
            {
              method: "GET",
              credentials: "include",
              headers: { "Content-Type": "application/json", ...orgAuthHeaders },
            }
          );

          const data = await res.json().catch(() => ({}));
          if (!res.ok) return { email, has: false };

          const plans = Array.isArray(data?.plans) ? data.plans : [];
          return { email, has: plans.length > 0 };
        });

        const results = await Promise.all(tasks);

        const next = new Set();
        for (const r of results) {
          if (r?.email && r?.has) next.add(r.email);
        }
        setDoneEmailsFromPlans(next);
      } catch (e) {
        console.warn("[org/prescriptions] refreshRosterPlanStatus failed:", e);
      } finally {
        setStatusLoading(false);
      }
    },
    [athletes, orgAuthHeaders]
  );

  // run once after athletes load (and whenever list changes)
  useEffect(() => {
    if (!athletes || athletes.length === 0) return;
    refreshRosterPlanStatus(athletes);
  }, [athletes, refreshRosterPlanStatus]);

  const markDoneFromPlanStatus = useCallback((athleteEmail) => {
    const email = normalizeEmail(athleteEmail);
    if (!email) return;
    setDoneEmailsFromPlans((prev) => {
      const next = new Set(prev);
      next.add(email);
      return next;
    });
  }, []);

  return {
    doneEmailsFromPlans,
    statusLoading,
    refreshRosterPlanStatus,
    markDoneFromPlanStatus,
  };
}
