// /pages/org/nutrition/athlete/[athleteToken].js
"use client";

import { useMemo, useCallback } from "react";
import { useRouter } from "next/router";

import { asString } from "@/components/org/nutrition/profile/utils";

import { ProfileHeader } from "@/components/org/nutrition/profile/ProfileHeader";
import { SummaryGrid } from "@/components/org/nutrition/profile/SummaryGrid";
import { PlanCard } from "@/components/org/nutrition/profile/PlanCard";
import { CheckinsCard } from "@/components/org/nutrition/profile/CheckinsCard";
import { SkeletonProfile } from "@/components/org/nutrition/profile/ui";
import { StaffActionsCard } from "@/components/org/nutrition/profile/StaffActionsCard";

import { useAthleteNutritionProfile } from "@/hooks/org/nutrition/useAthleteNutritionProfile";

export default function AthleteNutritionProfilePage() {
  const router = useRouter();

  const athleteToken = useMemo(
    () => asString(router?.query?.athleteToken),
    [router?.query?.athleteToken]
  );

  const {
    mounted,
    authReady,

    loading,
    error,

    plan,
    openIds,

    missedThisWeek,
    lastLoadedAt,

    computed,
    headerName,
    headerEmail,
    headerToken,

    load,
    toggleOpen,
    expandAll,
    expandLatestOnly,
    goEditPlan,
  } = useAthleteNutritionProfile(athleteToken);

  const goBack = useCallback(() => router.push("/org/nutrition"), [router]);

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

        <StaffActionsCard
          loading={loading}
          error={error}
          missedThisWeek={missedThisWeek}
          lastCheckinAt={computed.lastCheckinAt}
          daysAgo={computed.daysAgo}
          latestAvg={computed.latestAvg}
          onEditPlan={goEditPlan}
          athleteName={headerName}
          athleteEmail={headerEmail}
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