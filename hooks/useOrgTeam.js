// hooks/useOrgTeam.js
"use client";

import { useCallback, useMemo, useState } from "react";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(value) {
  const d = safeDate(value);
  if (!d) return value ? String(value) : "";
  return d.toLocaleString();
}

export function useOrgTeam() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [trainers, setTrainers] = useState([]);
  const [search, setSearch] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/org/members/list", {
        method: "GET",
        credentials: "include",
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to load trainers");

      const raw = Array.isArray(data?.trainers) ? data.trainers : [];

      const normalized = raw.map((t) => ({
        ...t,
        id: t?.id,
        Name: t?.Name ?? t?.name ?? "",
        Email: t?.Email ?? t?.email ?? "",
        Role: t?.Role ?? t?.role ?? "trainer",
        Active:
          typeof t?.Active === "boolean"
            ? t.Active
            : typeof t?.active === "boolean"
            ? t.active
            : true,
        createdAt:
          t?.createdAt || t?.CreatedAt || t?.createdTime || t?._createdTime || "",
      }));

      setTrainers(normalized);
    } catch (err) {
      console.error("[useOrgTeam] refresh error:", err);
      setError(err?.message || "Failed to load trainers.");
      setTrainers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const filtered = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    let list = Array.isArray(trainers) ? [...trainers] : [];

    if (q) {
      list = list.filter((t) => {
        const hay = [t?.Name, t?.Email, t?.Role, t?.Active ? "active" : "inactive"]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    // admins first, then trainers, inactive last
    list.sort((a, b) => {
      const ar = String(a?.Role || "").toLowerCase();
      const br = String(b?.Role || "").toLowerCase();
      const scoreRole = (r) => (r === "admin" ? 2 : r === "trainer" ? 1 : 0);
      const roleDiff = scoreRole(br) - scoreRole(ar);
      if (roleDiff !== 0) return roleDiff;

      const aActive = !!a?.Active;
      const bActive = !!b?.Active;
      if (aActive !== bActive) return aActive ? -1 : 1;

      const ae = normalizeEmail(a?.Email);
      const be = normalizeEmail(b?.Email);
      return ae.localeCompare(be);
    });

    return list;
  }, [trainers, search]);

  const counts = useMemo(() => {
    const list = Array.isArray(trainers) ? trainers : [];
    const admins = list.filter((t) => String(t?.Role || "").toLowerCase() === "admin").length;
    const coaches = list.filter((t) => String(t?.Role || "").toLowerCase() === "trainer").length;
    const inactive = list.filter((t) => !t?.Active).length;
    const total = list.length;
    return { admins, coaches, inactive, total };
  }, [trainers]);

  return {
    loading,
    error,
    setError,

    trainers,
    setTrainers,

    search,
    setSearch,

    filtered,
    counts,

    refresh,
    fmtDate,
    normalizeEmail,
  };
}
