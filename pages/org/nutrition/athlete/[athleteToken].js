// /pages/org/nutrition/athlete/[athleteToken].js
"use client";

import { useMemo, useCallback } from "react";
import { useRouter } from "next/router";

import { asString } from "@/components/org/nutrition/profile/utils";

import { ProfileHeader }    from "@/components/org/nutrition/profile/ProfileHeader";
import { SummaryGrid }      from "@/components/org/nutrition/profile/SummaryGrid";
import { PlanCard }         from "@/components/org/nutrition/profile/PlanCard";
import { CheckinsCard }     from "@/components/org/nutrition/profile/CheckinsCard";
import { SkeletonProfile }  from "@/components/org/nutrition/profile/ui";
import { StaffActionsCard } from "@/components/org/nutrition/profile/StaffActionsCard";

import { useAthleteNutritionProfile } from "@/hooks/org/nutrition/useAthleteNutritionProfile";

const DS = {
  brand:      "#1E3A5F",
  brandBg:    "#EEF3F9",
  brandBorder:"#C0D0E0",
  banned:     "#C8102E",
  bannedBg:   "#FFF0F0",
  bannedBorder:"#FFC8C8",
  border:     "#E8ECF0",
  pageBg:     "#F7F9FC",
  cardBg:     "#FFFFFF",
  bodyText:   "#2D3748",
  labelText:  "#6B7A8D",
  dimText:    "#9BA8B4",
};

// Shared shell for loading/auth states - keeps layout stable during hydration
function Shell({ children }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: DS.pageBg, color: DS.bodyText }}>
      <main className="max-w-5xl mx-auto px-4 py-7 space-y-5">
        {children}
      </main>
    </div>
  );
}

function StatusCard({ children }) {
  return (
    <div
      className="px-5 py-4 text-sm"
      style={{
        backgroundColor: DS.cardBg,
        border: `1px solid ${DS.border}`,
        borderTop: `4px solid ${DS.brand}`,
        color: DS.dimText,
      }}
    >
      {children}
    </div>
  );
}

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

  // Hydration-safe: no content until mounted + router ready
  if (!mounted || !router.isReady) {
    return (
      <Shell>
        <StatusCard>Loading…</StatusCard>
      </Shell>
    );
  }

  // Auth not confirmed yet - calm shell prevents 401 flicker
  if (!authReady) {
    return (
      <Shell>
        <StatusCard>Checking session…</StatusCard>
      </Shell>
    );
  }

  return (
    <Shell>
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
        <div
          className="p-5"
          style={{
            backgroundColor: DS.cardBg,
            border: `1px solid ${DS.bannedBorder}`,
            borderLeft: `4px solid ${DS.banned}`,
          }}
        >
          <p className="text-sm font-bold mb-3" style={{ color: DS.banned }}>
            {error}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={goBack}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wide transition-all rounded-sm"
              style={{ backgroundColor: DS.cardBg, color: DS.bodyText, border: `1px solid ${DS.border}` }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DS.brandBg; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DS.cardBg; }}
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={load}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wide transition-all rounded-sm"
              style={{ backgroundColor: DS.brand, color: "#fff" }}
              onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.12)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
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
    </Shell>
  );
}