// pages/org/nutrition/athlete/[athleteToken].js
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

/**
 * Org → Athlete Nutrition Profile
 *
 * Goals (optimized for staff time):
 * ✅ Plan is “suggested” (meal blocks + dining hall rules) not a strict food log
 * ✅ Check-ins are the accountability loop (weekly snapshot)
 * ✅ Org view should make it easy to:
 *   - see status at a glance
 *   - quickly copy an athlete link to submit the weekly check-in
 *   - jump to edit plan
 *   - expand latest check-in by default (without re-collapsing on refresh)
 *
 * NOTE:
 * - We don't assume org can directly submit a check-in for athlete.
 * - Instead, provide a “Copy check-in link” staff can send.
 *   If you later add org-triggered email/SMS, this becomes your CTA.
 */

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function isOrgRole(user) {
  const r = String(user?.role || user?.Role || "").toLowerCase();
  return r.includes("org") || r.includes("admin") || r.includes("trainer");
}

function fmtIsoToNice(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString();
  } catch {
    return String(iso);
  }
}

function buildAthleteCheckinUrl(origin, athleteToken) {
  // Athlete is expected to access their own authenticated check-in route
  // This is a staff-friendly link to share (they still must be logged in as athlete).
  // If you later add a public token-based checkin route, change here.
  const base = origin || "";
  return `${base}/athlete/nutrition/checkin`;
}

export default function AthleteNutritionProfilePage() {
  const router = useRouter();
  const { user, authReady } = useAuthContext();

  // Hydration-safe gating
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const athleteToken = useMemo(
    () => asString(router?.query?.athleteToken),
    [router?.query?.athleteToken]
  );

  const role = useMemo(() => {
    return isOrgRole(user) ? "org" : "athlete";
  }, [user]);

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
  const [openIds, setOpenIds] = useState({}); // { [id]: boolean }
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

  const goBack = useCallback(() => router.push("/org/nutrition"), [router]);

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
      // If you have a toast system, hook it here. For now, silent success.
    } catch {
      // ignore silently
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
  }, [
    mounted,
    router.isReady,
    athleteToken,
    authReady,
    user,
    role,
    expandLatestOnly,
  ]);

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

    return {
      sorted,
      latestCheckin: latest,
      latestAvg,
      hasPlan,
      lastCheckinAt,
      daysAgo,
    };
  }, [checkins, plan]);

  // Hydration-safe initial render
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

  // If auth isn’t ready yet, render a calm shell (prevents flicker/401)
  if (!authReady) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900">
        <main className="max-w-5xl mx-auto px-4 py-7 space-y-5">
          <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
            <p className="text-sm text-gray-600">Checking session…</p>
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

        {/* Staff action strip (keeps workflow fast) */}
        {!loading && !error ? (
          <section className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-gray-900">Staff Actions</p>
                <p className="text-xs text-gray-500 mt-1">
                  Nutrition is “suggested.” Keep it simple: update meal rules, then rely on weekly check-ins for adherence.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={goEditPlan}
                  className="px-4 py-2 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:brightness-110"
                >
                  Edit Plan →
                </button>

                <button
                  type="button"
                  onClick={copyAthleteCheckinLink}
                  className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
                  title="Copy athlete check-in link (athlete must be logged in)"
                >
                  Copy Check-in Link
                </button>

                <button
                  type="button"
                  onClick={load}
                  className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
                >
                  Refresh
                </button>
              </div>
            </div>

            {/* Context nudge (only when missed) */}
            {missedThisWeek ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">
                  Weekly check-in is missing or outdated.
                </p>
                <p className="text-sm text-amber-800 mt-1">
                  Last check-in:{" "}
                  <span className="font-semibold">
                    {computed.lastCheckinAt ? fmtIsoToNice(computed.lastCheckinAt) : "None yet"}
                  </span>
                  {computed.daysAgo != null ? (
                    <span className="text-amber-700"> • {Math.round(computed.daysAgo)} days ago</span>
                  ) : null}
                </p>
                <p className="text-xs text-amber-800 mt-2">
                  Recommended workflow: send the check-in link → athlete self-reports → you adjust 1–2 dining hall rules if
                  adherence is consistently low.
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-900">
                  Check-in looks current.
                </p>
                <p className="text-xs text-emerald-800 mt-1">
                  Last check-in:{" "}
                  <span className="font-semibold">
                    {computed.lastCheckinAt ? fmtIsoToNice(computed.lastCheckinAt) : "—"}
                  </span>
                </p>
              </div>
            )}
          </section>
        ) : null}

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
