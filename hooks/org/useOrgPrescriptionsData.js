// hooks/org/useOrgPrescriptionsData.js
"use client";

import { useCallback, useMemo, useState } from "react";
import { normalizeEmail } from "@/lib/org/prescriptions/prescriptions-utils";

/**
 * useOrgPrescriptionsData
 * - Athletes list
 * - Templates list
 * - Prescriptions history list (token-first)
 *
 * ✅ Prescriptions fetch supports:
 *    - athleteToken (preferred)
 *    - athleteEmail (legacy fallback)
 *
 * Endpoint expected:
 *   /api/org/getPrescriptionsForAthlete?athleteToken=ATH-...
 *   OR
 *   /api/org/getPrescriptionsForAthlete?athleteEmail=...
 */
export function useOrgPrescriptionsData({ orgAuthHeaders, orgToken }) {
  const [athletes, setAthletes] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
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

    const res = await fetch("/api/org/getAthletes", {
      method: "GET",
      credentials: "include",
      headers: { ...orgAuthHeaders },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error || data?.airtable?.message || "Failed to load athletes.";
      setLoadingAthletes(false);
      throw new Error(msg);
    }

    const list = Array.isArray(data?.athletes) ? data.athletes : [];
    setAthletes(list);

    setLoadingAthletes(false);
    return list;
  }, [orgAuthHeaders]);

  /**
   * Token-first prescriptions history fetch
   * Usage:
   *   fetchPrescriptionsForAthlete({ athleteToken })
   *   fetchPrescriptionsForAthlete({ athleteEmail }) // legacy fallback
   */
  const fetchPrescriptionsForAthlete = useCallback(
    async ({ athleteToken, athleteEmail } = {}) => {
      const token = String(athleteToken || "").trim();
      const email = normalizeEmail(athleteEmail);

      if (!token && !email) {
        setPrescriptions([]);
        return [];
      }

      setLoadingPrescriptions(true);
      setError("");

      const qs = token
        ? `athleteToken=${encodeURIComponent(token)}`
        : `athleteEmail=${encodeURIComponent(email)}`;

      const res = await fetch(`/api/org/getPrescriptionsForAthlete?${qs}`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...orgAuthHeaders,
        },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          data?.error ||
          data?.airtable?.message ||
          "Failed to load prescriptions.";
        setLoadingPrescriptions(false);
        throw new Error(msg);
      }

      const list = Array.isArray(data?.prescriptions) ? data.prescriptions : [];
      setPrescriptions(list);

      setLoadingPrescriptions(false);
      return list;
    },
    [orgAuthHeaders]
  );

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setTemplatesError("");

    if (!orgToken) {
      setTemplates([]);
      setTemplatesLoading(false);
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
      setTemplatesLoading(false);
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
    setTemplatesLoading(false);
    return sorted;
  }, [orgAuthHeaders, orgToken]);

  return {
    // data
    athletes,
    prescriptions,
    templates,
    activeTemplates,

    // loading states
    loadingAthletes,
    loadingPrescriptions,
    templatesLoading,

    // errors
    error,
    templatesError,

    // setters (sometimes useful for orchestrator pages)
    setAthletes,
    setPrescriptions,
    setTemplates,
    setError,
    setTemplatesError,

    // actions
    fetchAthletes,
    fetchPrescriptionsForAthlete,
    fetchTemplates,
  };
}
