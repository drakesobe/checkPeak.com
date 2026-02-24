// /hooks/org/nutrition/useAthleteNutritionProfile.js
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";

import {
  asString,
  normalizeEmail,
  isLikelyOrgToken,
  safeArr,
  sortNewestFirst,
  avgAdherence,
  daysSince,
} from "@/components/org/nutrition/profile/utils";

function isOrgRole(user) {
  const r = String(user?.role || user?.Role || "").toLowerCase();
  return r.includes("org") || r.includes("admin") || r.includes("trainer");
}

function buildAthleteCheckinUrl(origin, athleteToken) {
  // Keeping current behavior (athlete-auth route).
  // If you later add token-based public check-in route, update here only.
  const base = origin || "";
  return `${base}/athlete/nutrition/checkin`;
}

export function useAthleteNutritionProfile(athleteTokenRaw) {
  const router = useRouter();
  const { user, authReady } = useAuthContext();

  // hydration-safe
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const athleteToken = useMemo(() => asString(athleteTokenRaw), [athleteTokenRaw]);

  const role = useMemo(() => (isOrgRole(user) ? "org" : "athlete"), [user]);

  // Kick non-org out
  useEffect(() => {
    if (!authReady) return;
    if (!user) return;
    if (role !== "org") router.push("/dashboard");
  }, [authReady, user, role, router]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [athlete, setAthlete] = useState(null);
  const [plan, setPlan] = useState(null);
  const [checkins, setCheckins] = useState([]);

  const [missedThisWeek, setMissedThisWeek] = useState(true);
  const [lastLoadedAt, setLastLoadedAt] = useState("");

  // Collapsible check-ins
  const [openIds, setOpenIds] = useState({});
  const didAutoExpandRef = useRef(false);

  // prevent races: only apply latest response
  const reqIdRef = useRef(0);

  const toggleOpen = useCallback((id) => {
    setOpenIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const expandLatestOnly = useCallback((sorted) => {
    const first = sorted?.[0];
    if (!first?.id) return;
    setOpenIds({ [first.id]: true });
  }, []);

  const expandAll = useCallback((sorted) => {
    const next = {};
    (sorted || []).forEach((c) => {
      if (c?.id) next[c.id] = true;
    });
    setOpenIds(next);
  }, []);

  const headerName = athlete?.name || athlete?.Name || "Athlete";
  const headerEmail = normalizeEmail(athlete?.email || athlete?.Email || "");
  const headerToken = athleteToken || asString(athlete?.athleteToken || athlete?.AthleteToken || "");

  const goEditPlan = useCallback(() => {
    if (headerToken) {
      router.push(`/org/prescriptions?athleteToken=${encodeURIComponent(headerToken)}`);
      return;
    }
    if (headerEmail) {
      router.push(`/org/prescriptions?athleteEmail=${encodeURIComponent(headerEmail)}`);
      return;
    }
    router.push("/org/prescriptions");
  }, [router, headerToken, headerEmail]);

  const copyAthleteCheckinLink = useCallback(async () => {
    try {
      const origin =
        typeof window !== "undefined" && window?.location?.origin ? window.location.origin : "";
      const url = buildAthleteCheckinUrl(origin, headerToken);
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore silently (or plug in your toast)
    }
  }, [headerToken]);

  const load = useCallback(async () => {
    if (!mounted) return;
    if (!router.isReady) return;
    if (!athleteToken) return;

    // Guard: wrong token type
    if (isLikelyOrgToken(athleteToken)) {
      setError(
        "That looks like an Organization Token (ORG-...). This page expects the athlete’s AthleteToken (ATH-...)."
      );
      setLoading(false);
      return;
    }

    // If user is not org yet, don't fetch (prevents confusing 401s while auth loads)
    if (!authReady || !user) return;
    if (role !== "org") return;

    const myReqId = ++reqIdRef.current;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/org/nutrition/athlete?athleteToken=${encodeURIComponent(athleteToken)}`,
        { credentials: "include" }
      );

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to load athlete");

      // stale response guard
      if (myReqId !== reqIdRef.current) return;

      const a = json?.athlete || null;
      const p = json?.latestPlan || null;
      const c = safeArr(json?.checkins);

      setAthlete(a);
      setPlan(p);
      setCheckins(c);

      const sorted = sortNewestFirst(c);
      const latest = sorted[0] || null;

      // “missed this week” = last checkin older than ~7.5 days OR none.
      const missing = !latest?.createdAt ? true : daysSince(latest.createdAt) > 7.5;
      setMissedThisWeek(missing);

      // Auto-open latest ONLY once (don’t clobber user’s open state on refresh)
      if (!didAutoExpandRef.current) {
        expandLatestOnly(sorted);
        didAutoExpandRef.current = true;
      }

      setLastLoadedAt(new Date().toISOString());
    } catch (e) {
      if (myReqId !== reqIdRef.current) return;

      setError(e?.message || "Failed to load athlete nutrition profile");
      setAthlete(null);
      setPlan(null);
      setCheckins([]);
      setMissedThisWeek(true);
      setOpenIds({});
      didAutoExpandRef.current = false;
      setLastLoadedAt("");
    } finally {
      if (myReqId !== reqIdRef.current) return;
      setLoading(false);
    }
  }, [mounted, router.isReady, athleteToken, authReady, user, role, expandLatestOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const computed = useMemo(() => {
    const sorted = sortNewestFirst(checkins);
    const latest = sorted[0] || null;
    const latestAvg = latest ? avgAdherence(latest) : null;

    const hasPlan = Boolean(
      plan?.createdAt ||
        plan?.prescription ||
        (plan?.planJson && typeof plan.planJson === "object")
    );

    const lastCheckinAt = latest?.createdAt || "";
    const daysAgo = lastCheckinAt ? daysSince(lastCheckinAt) : null;

    return { sorted, latestCheckin: latest, latestAvg, hasPlan, lastCheckinAt, daysAgo };
  }, [checkins, plan]);

  return {
    // environment
    mounted,
    authReady,
    role,

    // data + state
    loading,
    error,
    athlete,
    plan,
    checkins,
    openIds,
    missedThisWeek,
    lastLoadedAt,

    // computed
    computed,
    headerName,
    headerEmail,
    headerToken,

    // actions
    load,
    toggleOpen,
    expandAll,
    expandLatestOnly,
    goEditPlan,
    copyAthleteCheckinLink,
  };
}