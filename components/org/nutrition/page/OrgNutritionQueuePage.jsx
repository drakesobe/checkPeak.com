// components/org/nutrition/page/OrgNutritionQueuePage.jsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import { useNutritionQueue } from "@/hooks/org/useNutritionQueue";

import NutritionHeader from "@/components/org/nutrition/NutritionHeader";
import NutritionControls from "@/components/org/nutrition/NutritionControls";
import NutritionTable from "@/components/org/nutrition/NutritionTable";

import TabsBar from "./TabsBar";
import DashboardHero from "./DashboardHero";
import PlaceholderPanel from "./PlaceholderPanel";
import OverviewPanel from "./OverviewPanel";

import {
  normalizeRole,
  isOrgSideRole,
  isLikelyOrgToken,
  filterRows,
  getHeadline,
} from "@/lib/org/nutrition/pageUtils";

/* ---------------- small UI helpers ---------------- */

function InlineHint({ children }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
      {children}
    </div>
  );
}

function ErrorBanner({ title = "Something went wrong", message, onRetry }) {
  if (!message) return null;
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-extrabold text-red-900">{title}</p>
          <p className="text-sm text-red-800 mt-1">{message}</p>
        </div>
        {typeof onRetry === "function" ? (
          <button
            type="button"
            onClick={onRetry}
            className="self-start px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-red-400/35"
          >
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}

function LoadingPanel() {
  return (
    <div className="rounded-2xl border border-blue-100 bg-white shadow-md p-5">
      <div className="animate-pulse space-y-4">
        <div className="h-5 w-48 bg-gray-200 rounded-lg" />
        <div className="h-10 w-full bg-gray-100 rounded-xl" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="h-20 bg-gray-100 rounded-2xl" />
          <div className="h-20 bg-gray-100 rounded-2xl" />
          <div className="h-20 bg-gray-100 rounded-2xl" />
          <div className="h-20 bg-gray-100 rounded-2xl" />
        </div>
        <div className="h-64 bg-gray-100 rounded-2xl" />
      </div>
    </div>
  );
}

function EmptyState({ title, body, ctaLabel, onCta }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-lg font-extrabold text-gray-900">{title}</p>
      {body ? <p className="text-sm text-gray-600 mt-2">{body}</p> : null}
      {ctaLabel && typeof onCta === "function" ? (
        <button
          type="button"
          onClick={onCta}
          className="mt-4 px-4 py-2 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#46769B]/35"
        >
          {ctaLabel}
        </button>
      ) : null}
    </div>
  );
}

/* ---------------- page ---------------- */

export default function OrgNutritionQueuePage() {
  const router = useRouter();
  const { user } = useAuthContext();

  const role = useMemo(() => normalizeRole(user), [user]);
  const isOrgSide = useMemo(() => isOrgSideRole(role), [role]);

  // Route protection
  useEffect(() => {
    if (!user) return;
    if (!isOrgSide) router.push("/dashboard");
  }, [user, isOrgSide, router]);

  // Data
  const { loading, error, rows, counts, meta, lastUpdatedLabel, refresh } = useNutritionQueue({
    enabled: Boolean(user && isOrgSide),
  });

  /**
   * Tabs:
   * - overview: org-level dashboard
   * - queue: operational list (filters/search)
   */
  const [tab, setTab] = useState("overview");

  // Queue UX state
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState("action"); // action | missing_checkin | low_adherence | no_plan | all
  const [sport, setSport] = useState("all");
  const [team, setTeam] = useState("all");

  // ✅ NEW: pagination state (shared with table + controls)
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);

  // ✅ call this whenever filters/search change (resets table to page 1)
  const onAnyFilterChange = useCallback(() => setPage(0), []);

  // When user clicks a KPI/quick card, jump to queue + set filter
  const pickFilter = useCallback(
    (mode) => {
      setFilterMode(mode);
      setTab("queue");
      setPage(0);
    },
    []
  );

  // Filter rows by search + filterMode + sport/team
  const filtered = useMemo(
    () => filterRows(rows, search, filterMode, sport, team),
    [rows, search, filterMode, sport, team]
  );

  const onOpenAthlete = useCallback(
    (row) => {
      const token = String(row?.athleteToken || "").trim();
      if (!token) return;
      if (isLikelyOrgToken(token)) return;
      router.push(`/org/nutrition/athlete/${encodeURIComponent(token)}`);
    },
    [router]
  );

  const headline = useMemo(() => getHeadline(meta), [meta]);

  // Convenience
  const total = Number(counts?.total || 0);
  const needsAction = Number(counts?.needsAction || 0);
  const hasAnyRows = Array.isArray(rows) && rows.length > 0;

  // Meta-derived options for dropdowns (guarded)
  const sports = Array.isArray(meta?.sports) ? meta.sports : [];
  const teams = Array.isArray(meta?.teams) ? meta.teams : [];
  const teamsBySport = meta?.teamsBySport && typeof meta.teamsBySport === "object" ? meta.teamsBySport : {};

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <NutritionHeader
          weekStartISO={meta?.weekStartISO}
          lastUpdatedLabel={lastUpdatedLabel}
          loading={loading}
          error={error}
          onGoDashboard={() => router.push("/org/dashboard")}
          onGoPlans={() => router.push("/org/prescriptions")}
          onRefresh={() => refresh()}
        />

        {/* Error */}
        <ErrorBanner message={error} onRetry={() => refresh()} />

        {/* Hero */}
        <DashboardHero
          headline={headline}
          counts={counts}
          onGoPlans={() => router.push("/org/prescriptions")}
          onSetTabTemplates={() => setTab("templates")}
          onSetTabSafe={() => setTab("safe")}
          onPickFilter={pickFilter}
        />

        {/* Tabs */}
        <TabsBar tab={tab} setTab={setTab} />

        {/* Hint strip */}
        {tab === "overview" ? (
          <InlineHint>
            <span className="font-semibold text-gray-900">Coach workflow:</span>{" "}
            start in <span className="font-semibold">Overview</span> to identify issues, then click athletes to fix plans,
            review check-ins, and add guidance.
          </InlineHint>
        ) : null}

        {/* Loading */}
        {loading && !hasAnyRows ? <LoadingPanel /> : null}

        {/* OVERVIEW TAB */}
        {tab === "overview" && !loading ? (
          <>
            {!hasAnyRows ? (
              <EmptyState
                title="No athletes found for this organization"
                body="Once athletes are added to your org and have an AthleteToken, they’ll appear here. Plans and check-ins will populate automatically."
                ctaLabel="Go to Athletes →"
                onCta={() => router.push("/org/athletes")}
              />
            ) : (
              <OverviewPanel
                loading={loading}
                rows={rows}
                meta={meta}
                onOpenAthlete={onOpenAthlete}
                onGoPlans={() => router.push("/org/prescriptions")}
              />
            )}

            {hasAnyRows && total > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <InlineHint>
                  <span className="font-semibold text-gray-900">Plan coverage:</span>{" "}
                  athletes count as “On a plan” when a plan record exists in{" "}
                  <span className="font-semibold">NutritionPlans</span> and the plan’s{" "}
                  <span className="font-semibold">AthleteToken</span> lookup matches the athlete token.
                </InlineHint>

                <InlineHint>
                  <span className="font-semibold text-gray-900">Check-in compliance:</span>{" "}
                  “Missing check-in” triggers when the athlete has no completion record (or an old one) available to the org view.
                </InlineHint>
              </div>
            ) : null}

            {hasAnyRows && needsAction === 0 ? (
              <InlineHint>
                <span className="font-semibold text-gray-900">All green:</span> no athletes are flagged right now.
              </InlineHint>
            ) : null}
          </>
        ) : null}

        {/* QUEUE TAB */}
        {tab === "queue" && !loading ? (
          <>
            <NutritionControls
              search={search}
              setSearch={(v) => {
                setSearch(v);
                onAnyFilterChange();
              }}
              filterMode={filterMode}
              setFilterMode={(v) => {
                setFilterMode(v);
                onAnyFilterChange();
              }}
              sport={sport}
              setSport={(v) => {
                setSport(v);
                onAnyFilterChange();
              }}
              team={team}
              setTeam={(v) => {
                setTeam(v);
                onAnyFilterChange();
              }}
              sports={sports}
              teams={teams}
              teamsBySport={teamsBySport}

              // ✅ NEW (safe even if your controls ignore these props)
              counts={counts}
              pageSize={pageSize}
              setPageSize={(n) => {
                setPageSize(n);
                onAnyFilterChange();
              }}
              onAnyFilterChange={onAnyFilterChange}
            />

            {!hasAnyRows ? (
              <EmptyState
                title="No athletes to review yet"
                body="Add athletes to your org, and make sure they have an AthleteToken. Then you’ll see plan coverage and check-ins here."
                ctaLabel="Go to Athletes →"
                onCta={() => router.push("/org/athletes")}
              />
            ) : (
              <>
                {/* Contextual coach hints */}
                {filterMode === "action" ? (
                  <InlineHint>
                    Showing athletes who need action (no plan, missing check-in, or low adherence). Expand a row for quick
                    details, or click <span className="font-semibold">Open</span>.
                  </InlineHint>
                ) : null}

                {filterMode === "no_plan" ? (
                  <InlineHint>
                    These athletes have <span className="font-semibold">no plan</span>. Create a plan and ensure the plan’s{" "}
                    <span className="font-semibold">AthleteToken</span> lookup matches the athlete token.
                  </InlineHint>
                ) : null}

                {filterMode === "missing_checkin" ? (
                  <InlineHint>
                    These athletes haven’t submitted a recent completion. Follow up, then review adherence once submitted.
                  </InlineHint>
                ) : null}

                {filterMode === "low_adherence" ? (
                  <InlineHint>
                    These athletes are below your adherence threshold. Open the athlete to see meal vs hydration adherence.
                  </InlineHint>
                ) : null}

                <NutritionTable
                  loading={loading}
                  rows={filtered}
                  onOpenAthlete={onOpenAthlete}

                  // ✅ NEW
                  pageSize={pageSize}
                  page={page}
                  setPage={setPage}
                />

                {!loading && Array.isArray(filtered) && filtered.length === 0 ? (
                  <EmptyState
                    title="No athletes match this filter"
                    body="Try changing the filter, clearing search, switching sport/team back to ‘All’, or using ‘Needs Action’ to see flagged athletes."
                  />
                ) : null}
              </>
            )}
          </>
        ) : null}

        {/* Placeholders */}
        {tab === "templates" ? (
          <PlaceholderPanel
            title="Plan Templates"
            subtitle="Create reusable surplus/maintain/cut templates and apply them to athletes in one click."
            ctaLabel="Build templates in Plans →"
            onCta={() => router.push("/org/prescriptions")}
          >
            <p className="text-sm font-semibold text-gray-900">Coming next</p>
            <ul className="mt-2 text-sm text-gray-700 list-disc pl-5 space-y-1">
              <li>Surplus / Maintain / Cut templates</li>
              <li>Auto meal-split (Breakfast / Lunch / Dinner / Snacks)</li>
              <li>Attach SmartStack safe picks per meal</li>
              <li>Apply template to a team / position group</li>
            </ul>
          </PlaceholderPanel>
        ) : null}

        {tab === "safe" ? (
          <PlaceholderPanel
            title="SmartStack Safe Picks"
            subtitle="Curate approved protein, bars, electrolytes, and energy—then attach to meal blocks."
            ctaLabel="Open SmartStack →"
            onCta={() => router.push("/org/smartstack")}
          >
            <p className="text-sm font-semibold text-gray-900"> Coming soon: Next build</p>
            <p className="mt-1 text-sm text-gray-700">
              Coming soon: This tab will show curated lists (e.g., “Protein powders”, “Bars”, “Electrolytes”, “Energy drinks”) with
              one-click attach into templates and athlete plans.
            </p>
          </PlaceholderPanel>
        ) : null}

        {tab === "insights" ? (
          <PlaceholderPanel title="Insights" subtitle="Team-level adherence trends, missed check-ins, and at-risk athletes.">
            <p className="text-sm text-gray-700">
              Coming soon: week-over-week charts, segmentation (team/sport), and exportable reports for coaches.
            </p>
          </PlaceholderPanel>
        ) : null}
      </main>
    </div>
  );
}