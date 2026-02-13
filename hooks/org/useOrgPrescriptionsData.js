// hooks/org/useOrgPrescriptionsData.js
"use client";

import { useCallback, useMemo, useState } from "react";

export function useOrgPrescriptionsData({ orgAuthHeaders, orgToken }) {
  const [athletes, setAthletes] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]); // NutritionPlans history
  const [templates, setTemplates] = useState([]);

  const [loadingAthletes, setLoadingAthletes] = useState(false);
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  const [error, setError] = useState("");
  const [templatesError, setTemplatesError] = useState("");

  const activeTemplates = useMemo(() => {
    return (templates || []).filter((t) => {
      const st = String(t?.status || "Active").toLowerCase();
      return !st.includes("arch");
    });
  }, [templates]);

  const fetchAthletes = useCallback(async () => {
    setLoadingAthletes(true);
    setError("");

    try {
      const res = await fetch("/api/org/getAthletes", {
        method: "GET",
        credentials: "include",
        headers: { ...orgAuthHeaders },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data?.airtable?.message || "Failed to load athletes.");

      const list = Array.isArray(data?.athletes) ? data.athletes : [];
      setAthletes(list);
      return list;
    } finally {
      setLoadingAthletes(false);
    }
  }, [orgAuthHeaders]);

  /**
   * ✅ History fetch reads ONLY from NutritionPlans (token required)
   */
  const fetchPrescriptionsForAthlete = useCallback(
    async ({ athleteToken } = {}) => {
      const token = String(athleteToken || "").trim();

      if (!token) {
        setPrescriptions([]);
        throw new Error("athleteToken is required.");
      }

      setLoadingPrescriptions(true);
      setError("");

      try {
        const res = await fetch(
          `/api/org/nutrition/plans/getByAthlete?athleteToken=${encodeURIComponent(token)}`,
          {
            method: "GET",
            credentials: "include",
            headers: { "Content-Type": "application/json", ...orgAuthHeaders },
          }
        );

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || data?.detail || "Failed to load nutrition plans.");

        const plans = Array.isArray(data?.plans) ? data.plans : [];
        const mapped = plans.map((p) => ({
          id: p.id,
          title: p.phase ? `Nutrition Plan • ${p.phase}` : "Nutrition Plan",
          prescription: p.prescription || "",
          createdAt: p.createdAt || "",
          createdBy: p.createdBy || "",
          _raw: p,
        }));

        setPrescriptions(mapped);
        return mapped;
      } finally {
        setLoadingPrescriptions(false);
      }
    },
    [orgAuthHeaders]
  );

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setTemplatesError("");

    try {
      if (!orgToken) {
        setTemplates([]);
        return [];
      }

      const res = await fetch("/api/org/getPlanTemplates", {
        method: "GET",
        credentials: "include",
        headers: { ...orgAuthHeaders },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTemplates([]);
        setTemplatesError(data?.error || "Failed to load templates");
        return [];
      }

      const list = Array.isArray(data?.templates) ? data.templates : [];
      const sorted = list.slice().sort((a, b) => {
        const aSt = String(a?.status || "Active").toLowerCase();
        const bSt = String(b?.status || "Active").toLowerCase();
        const aIsArch = aSt.includes("arch");
        const bIsArch = bSt.includes("arch");
        if (aIsArch !== bIsArch) return aIsArch ? 1 : -1;
        return String(a?.name || "").localeCompare(String(b?.name || ""));
      });

      setTemplates(sorted);
      return sorted;
    } finally {
      setTemplatesLoading(false);
    }
  }, [orgAuthHeaders, orgToken]);

  return {
    athletes,
    prescriptions,
    templates,
    activeTemplates,

    loadingAthletes,
    loadingPrescriptions,
    templatesLoading,

    error,
    templatesError,

    setAthletes,
    setPrescriptions,
    setTemplates,
    setError,
    setTemplatesError,

    fetchAthletes,
    fetchPrescriptionsForAthlete,
    fetchTemplates,
  };
}
