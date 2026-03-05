// pages/dashboard.js
"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";

import { useAthleteDashboardData } from "@/hooks/dashboard/useAthleteDashboardData";
import { useTodaySummary } from "@/hooks/dashboard/useTodaySummary";

import AthleteSidebar from "@/components/dashboard/AthleteSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import TodayPanel from "@/components/dashboard/TodayPanel";
import StatsGrid from "@/components/dashboard/StatsGrid";
import ScanActivityCard from "@/components/dashboard/ScanActivityCard";
import RiskAlertsCard from "@/components/dashboard/RiskAlertsCard";
import RecentScansCard from "@/components/dashboard/RecentScansCard";
import SavedStacksCard from "@/components/dashboard/SavedStacksCard";

const ROUTES = {
  dashboard:    "/dashboard",
  today:        "/athlete/today",
  scan:         "/nutrition-label-scanner",
  search:       "/search",
  scans:        "/scans",
  savedStacks:  "/saved-stacks",
  smartstack:   "/smartstack",
  account:      "/account",
  login:        "/login",
  orgDashboard: "/org/dashboard",
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout } = useAuthContext();

  const role = useMemo(() => {
    const raw = String(user?.role || user?.Role || "").toLowerCase();
    if (raw.includes("org") || raw.includes("admin") || raw.includes("trainer")) return "org";
    if (raw.includes("ath")) return "athlete";
    return null;
  }, [user]);

  const userEmail = user?.Email || user?.email || null;

  const {
    recentActivity, savedStacks, loadingScans, loadingSaved,
    stats, lastScan, sparklineData, maxSparkCount,
  } = useAthleteDashboardData({ user, userEmail });

  const { loadingToday, todaySummary } = useTodaySummary({ userEmail });

  const suggestedActions = useMemo(() => {
    const actions = [];
    if (todaySummary?.hasWorkout)       actions.push({ label: "You have workouts assigned for today",               cta: "Open Today",       to: ROUTES.today      });
    if (!stats.totalScans)              actions.push({ label: "Run your first supplement label scan",               cta: "Scan a label",     to: ROUTES.scan       });
    if (stats.totalScans && !stats.stacksSaved) actions.push({ label: "Save a SmartStack to track trusted ingredients", cta: "Browse SmartStack", to: ROUTES.smartstack });
    if (stats.flaggedScans > 0)         actions.push({ label: "Review supplements with flagged substances",          cta: "Review scans",     to: ROUTES.scans      });
    if (stats.accountCompletion < 100)  actions.push({ label: "Finish setting up your account",                      cta: "Complete profile",  to: ROUTES.account    });
    return actions;
  }, [todaySummary, stats]);

  useEffect(() => {
    if (!user) { router.push(ROUTES.login); return; }
    if (role === "org") router.push(ROUTES.orgDashboard);
  }, [user, role, router]);

  if (!user || role !== "athlete") return null;

  const loading       = loadingScans || loadingSaved;
  const flaggedCount  = stats.flaggedScans;
  const lastScanDate  = lastScan?.parsedDate || null;

  const formatDateShort = (d) =>
    d ? d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

  const nav = (to) => router.push(to);

  const handleLogout = async () => {
    try { await logout(); } catch {}
    router.push(ROUTES.login);
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: "#F8F9FA", fontFamily: "'Barlow', sans-serif", color: "#0f172a" }}
    >
      {/* Subtle top accent line — keeps brand blue present on the light page */}
      <div
        aria-hidden="true"
        className="h-0.5 w-full"
        style={{ background: `linear-gradient(90deg, transparent, ${BRAND} 30%, ${BRAND} 70%, transparent)`, opacity: 0.35 }}
      />

      <div className="max-w-7xl mx-auto px-4 py-6 lg:py-8">
        <div className="grid gap-6 lg:grid-cols-[260px,1fr]">

          {/* Sidebar — hidden on mobile, self-contained card on desktop */}
          <div className="hidden lg:block self-start">
            <AthleteSidebar
              user={user}
              routes={ROUTES}
              onNavigate={nav}
              onLogout={handleLogout}
              activeRoute={ROUTES.dashboard}
              todayHasWork={!!todaySummary?.hasWorkout}
            />
          </div>

          <main className="space-y-6 lg:space-y-7 min-w-0">
            <DashboardHeader user={user} stats={stats} routes={ROUTES} onNavigate={nav} />

            <TodayPanel
              loading={loadingToday}
              summary={todaySummary}
              onOpen={() => nav(ROUTES.today)}
            />

            <StatsGrid stats={stats} />

            <section className="grid gap-6 lg:grid-cols-[1.8fr,1.2fr]">
              <ScanActivityCard
                data={sparklineData}
                max={maxSparkCount}
                loading={loading}
                lastScanDate={lastScanDate}
                formatDate={formatDateShort}
                onView={() => nav(ROUTES.scans)}
              />
              <RiskAlertsCard
                flaggedCount={flaggedCount}
                onReview={() => nav(ROUTES.scans)}
              />
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <RecentScansCard
                scans={recentActivity}
                loading={loading}
                formatDate={formatDateShort}
                onOpen={(scan) => nav(`${ROUTES.scans}/${scan.id}`)}
                onViewAll={() => nav(ROUTES.scans)}
              />
              <SavedStacksCard
                stacks={savedStacks}
                loading={loading}
                onManage={() => nav(ROUTES.savedStacks)}
                onExplore={() => nav(ROUTES.smartstack)}
              />
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

const BRAND = "#5B9EC9";