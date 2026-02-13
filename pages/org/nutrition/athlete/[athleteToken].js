"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
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

import { ProfileHeader } from "@/components/org/nutrition/profile/ProfileHeader";
import { SummaryGrid } from "@/components/org/nutrition/profile/SummaryGrid";
import { PlanCard } from "@/components/org/nutrition/profile/PlanCard";
import { CheckinsCard } from "@/components/org/nutrition/profile/CheckinsCard";
import { SkeletonProfile } from "@/components/org/nutrition/profile/ui";

export default function AthleteNutritionProfilePage() {
  const router = useRouter();
  const { user } = useAuthContext();

  // ✅ Hydration-safe gating
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const athleteToken = useMemo(
    () => asString(router?.query?.athleteToken),
    [router?.query?.athleteToken]
  );

  const role = useMemo(() => {
    const r = String(user?.role || user?.Role || "").toLowerCase();
    return r.includes("org") || r.includes("admin") || r.includes("trainer") ? "org" : "athlete";
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (role !== "org") router.push("/dashboard");
  }, [user, role, router]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [athlete, setAthlete] = useState(null);
  const [plan, setPlan] = useState(null);
  const [checkins, setCheckins] = useState([]);

  const [missedThisWeek, setMissedThisWeek] = useState(true);
  const [lastLoadedAt, setLastLoadedAt] = useState("");

  // Collapsible check-ins
  const [openIds, setOpenIds] = useState({}); // { [id]: boolean }
  const didAutoExpandRef = useRef(false);

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

  const load = useCallback(async () => {
    if (!mounted) return;
    if (!router.isReady) return;
    if (!athleteToken) return;

    // Guard: wrong token type
    if (isLikelyOrgToken(athleteToken)) {
      setError("That looks like an Organization Token (ORG-...). This page expects the athlete’s AthleteToken (ATH-...).");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/org/nutrition/athlete?athleteToken=${encodeURIComponent(athleteToken)}`,
        { credentials: "include" }
      );

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to load athlete");

      const a = json?.athlete || null;
      const p = json?.latestPlan || null;
      const c = safeArr(json?.checkins);

      setAthlete(a);
      setPlan(p);
      setCheckins(c);

      const sorted = sortNewestFirst(c);
      const latest = sorted[0] || null;

      const missing = !latest?.createdAt ? true : daysSince(latest.createdAt) > 7.5;
      setMissedThisWeek(missing);

      // ✅ Auto-open latest ONLY on first successful load (or when nothing is open)
      // This prevents refresh from collapsing the user’s expanded view every time.
      if (!didAutoExpandRef.current) {
        expandLatestOnly(sorted);
        didAutoExpandRef.current = true;
      }

      setLastLoadedAt(new Date().toISOString());
    } catch (e) {
      setError(e?.message || "Failed to load athlete nutrition profile");
      setAthlete(null);
      setPlan(null);
      setCheckins([]);
      setMissedThisWeek(true);
      setOpenIds({});
      didAutoExpandRef.current = false;
      setLastLoadedAt("");
    } finally {
      setLoading(false);
    }
  }, [mounted, router.isReady, athleteToken, expandLatestOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const computed = useMemo(() => {
    const sorted = sortNewestFirst(checkins);
    const latest = sorted[0] || null;
    const latestAvg = latest ? avgAdherence(latest) : null;
    const hasPlan = Boolean(plan?.createdAt || plan?.prescription);
    return { sorted, latestCheckin: latest, latestAvg, hasPlan };
  }, [checkins, plan]);

  const headerName = athlete?.name || athlete?.Name || "Athlete";
  const headerEmail = normalizeEmail(athlete?.email || athlete?.Email || "");
  const headerToken =
    athleteToken || asString(athlete?.athleteToken || athlete?.AthleteToken || "");

  const goBack = () => router.push("/org/nutrition");

  const goEditPlan = () => {
    if (headerToken) {
      router.push(`/org/prescriptions?athleteToken=${encodeURIComponent(headerToken)}`);
      return;
    }
    if (headerEmail) {
      router.push(`/org/prescriptions?athleteEmail=${encodeURIComponent(headerEmail)}`);
      return;
    }
    router.push("/org/prescriptions");
  };

  // ✅ Hydration-safe initial render
  if (!mounted || !router.isReady) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900">
        <main className="max-w-5xl mx-auto px-4 py-7 space-y-5">
          <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
            <p className="text-sm text-gray-600">Loading…</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900">
      <main className="max-w-5xl mx-auto px-4 py-7 space-y-5">
        <ProfileHeader
          name={headerName}
          email={headerEmail}
          token={headerToken}
          lastLoadedAt={lastLoadedAt}
          hasPlan={computed.hasPlan}
          missedThisWeek={missedThisWeek}
          latestAvg={computed.latestAvg}
          onBack={goBack}
          onRefresh={load}
          onEditPlan={goEditPlan}
        />

        {loading && <SkeletonProfile />}

        {!loading && error && (
          <div className="bg-white rounded-2xl border border-red-200 p-4 shadow-sm">
            <p className="text-sm text-red-700 font-semibold">{error}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={goBack}
                className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
                type="button"
              >
                Back
              </button>
              <button
                onClick={load}
                className="px-4 py-2 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:brightness-110"
                type="button"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {!loading && !error && (
          <>
            <SummaryGrid
              latestCheckin={computed.latestCheckin}
              latestAvg={computed.latestAvg}
              plan={plan}
              hasPlan={computed.hasPlan}
            />

            <PlanCard plan={plan} onEditPlan={goEditPlan} />

            <CheckinsCard
              checkins={computed.sorted}
              openIds={openIds}
              onToggle={toggleOpen}
              onExpandAll={() => expandAll(computed.sorted)}
              onLatestOnly={() => expandLatestOnly(computed.sorted)}
            />
          </>
        )}
      </main>
    </div>
  );
}
