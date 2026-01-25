// pages/dashboard.js
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/router"; // ✅ Pages Router
import { useAuthContext } from "@/hooks/useAuth";
import { trackEvent } from "@/lib/analytics";
import Image from "next/image";
import {
  LogOut,
  Search,
  Folder,
  Settings,
  Bookmark,
  Activity,
  BarChart3,
  AlertTriangle,
  ScanBarcode,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  CalendarDays,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/* Helpers: robust date parsing for ScanName / ScanDate                       */
/* -------------------------------------------------------------------------- */

// Parse strings like "11/15/2025 19:39" or "11/15/2025, 19:39:30"
function parseUsDateTime(str) {
  if (!str) return null;
  const s = String(str).trim();
  const match = s.match(
    /(\d{1,2})\/(\d{1,2})\/(\d{4})[,\s]+(\d{1,2}):(\d{2})(?::(\d{1,2}))?/,
  );
  if (!match) return null;

  const [, mm, dd, yyyy, hh, min, ss] = match;
  const year = Number(yyyy);
  const month = Number(mm) - 1; // 0–11
  const day = Number(dd);
  const hour = Number(hh);
  const minute = Number(min);
  const second = ss ? Number(ss) : 0;

  const d = new Date(year, month, day, hour, minute, second);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// Extract a usable Date from a scan record, preferring ScanDate / ScanName
function extractScanDate(scan) {
  if (!scan) return null;
  const fields = scan.fields || {};

  let raw =
    scan.ScanDate ||
    scan.scanDate ||
    fields.ScanDate ||
    fields["ScanDate"] ||
    scan.ScanName ||
    scan.scanName ||
    fields.ScanName ||
    fields["ScanName"] ||
    scan.date ||
    scan.Date ||
    fields.Date ||
    scan.createdAt ||
    scan.created_at ||
    scan.timestamp ||
    scan.time ||
    scan.scannedAt ||
    scan.ScanTimestamp ||
    scan.DateScanned ||
    scan.created_time ||
    null;

  if (!raw) return null;

  let str = String(raw).trim();

  if (str.toLowerCase().startsWith("scan -")) {
    const idx = str.indexOf("-");
    if (idx !== -1) str = str.slice(idx + 1).trim();
  }

  let d = parseUsDateTime(str);
  if (d) return d;

  d = new Date(str);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout } = useAuthContext();

  const [showWelcome, setShowWelcome] = useState(false);

  // data
  const [recentActivity, setRecentActivity] = useState([]); // normalized scans
  const [savedStacks, setSavedStacks] = useState([]);

  // loading
  const [loadingScans, setLoadingScans] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);

  // ✅ Today summary (wired to your existing /api/athlete/workouts/today)
  const [todaySummary, setTodaySummary] = useState({
    hasWorkout: false,
    title: "",
    status: "",
    itemsCount: 0,
    completedCount: 0,
  });
  const [loadingToday, setLoadingToday] = useState(false);

  const [stats, setStats] = useState({
    totalScans: 0,
    recentSearches: 0,
    stacksSaved: 0,
    accountCompletion: 0,
    flaggedScans: 0,
  });

  const [showAllActionsMobile, setShowAllActionsMobile] = useState(false);

  const userEmail = user?.Email || user?.email || null;

  /* ------------------------------------------------------------------------ */
  /* Routes (centralized)                                                     */
  /* ------------------------------------------------------------------------ */
  const ROUTES = useMemo(
    () => ({
      dashboard: "/dashboard",
      scan: "/nutrition-label-scanner",
      search: "/search",
      scans: "/scans",
      savedStacks: "/saved-stacks",
      smartstack: "/smartstack",
      account: "/account",
      login: "/login",

      // athlete
      today: "/athlete/today",

      // org-side (safety)
      orgDashboard: "/org/dashboard",
    }),
    [],
  );

  /* ------------------------------------------------------------------------ */
  /* Role normalization (safety)                                              */
  /* ------------------------------------------------------------------------ */
  const role = useMemo(() => {
    const raw = String(user?.role || user?.Role || "").trim().toLowerCase();
    if (!raw) return "";
    if (raw === "athlete") return "athlete";
    if (raw === "organization") return "organization";
    if (raw === "admin") return "admin";
    if (raw === "trainer") return "trainer";
    if (raw.includes("org")) return "organization";
    if (raw.includes("admin")) return "admin";
    if (raw.includes("train")) return "trainer";
    if (raw.includes("ath")) return "athlete";
    return raw;
  }, [user]);

  const isOrgSide = role === "organization" || role === "admin" || role === "trainer";

  /* ------------------------------------------------------------------------ */
  /* Analytics helpers                                                        */
  /* ------------------------------------------------------------------------ */
  const fire = useCallback(
    (eventName, payload = {}) => {
      try {
        trackEvent(eventName, {
          eventType: payload?.eventType || "ui",
          userEmail: userEmail || "",
          path: typeof window !== "undefined" ? window.location.pathname : "",
          source: "dashboard",
          device: typeof navigator !== "undefined" ? navigator.userAgent : "",
          payload,
        });
      } catch {}
    },
    [userEmail],
  );

  const navTo = useCallback(
    (to, label, extraPayload = {}) => {
      fire("dashboard_nav_click", { label, to, ...extraPayload });
      router.push(to);
    },
    [fire, router],
  );

  /* ------------------------------------------------------------------------ */
  /* Auth redirect + welcome banner                                           */
  /* ------------------------------------------------------------------------ */
  useEffect(() => {
    if (!user) {
      router.push(ROUTES.login);
      return;
    }

    // ✅ If org-side user hits athlete dashboard, route them away
    if (isOrgSide) {
      router.push(ROUTES.orgDashboard);
      return;
    }

    setShowWelcome(true);
    const timer = setTimeout(() => setShowWelcome(false), 2200);
    return () => clearTimeout(timer);
  }, [user, router, ROUTES.login, ROUTES.orgDashboard, isOrgSide]);

  /* ------------------------------------------------------------------------ */
  /* Track dashboard view                                                     */
  /* ------------------------------------------------------------------------ */
  useEffect(() => {
    if (!user) return;

    fire("dashboard_view", {
      eventType: "page_view",
      role: user?.Role || user?.role || "athlete",
      hasOrganization: !!user?.Organization,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  /* ------------------------------------------------------------------------ */
  /* Fetch scans + saved stacks                                               */
  /* ------------------------------------------------------------------------ */
  useEffect(() => {
    if (!userEmail) return;

    const emailParam = encodeURIComponent(userEmail);
    let cancelled = false;

    async function loadData() {
      try {
        setLoadingScans(true);
        setLoadingSaved(true);

        const [scansRes, savedRes] = await Promise.all([
          fetch(`/api/getScans?userEmail=${emailParam}`),
          fetch(`/api/getSavedStacks?UserEmail=${emailParam}`),
        ]);

        const scansData = scansRes.ok ? await scansRes.json() : { scans: [] };
        const savedData = savedRes.ok ? await savedRes.json() : { savedStacks: [] };

        if (cancelled) return;

        const rawScans =
          scansData.scans ||
          scansData.records ||
          scansData.items ||
          scansData.data ||
          [];

        const normalizedScans = rawScans.map((s, index) => {
          const fields = s.fields || {};

          const id = s.id || s.recordId || fields.id || fields.RecordID || index;

          const productName =
            s.productName ||
            s.ProductName ||
            fields.ProductName ||
            fields["Product Name"] ||
            s.name ||
            fields.Name ||
            "Supplement scan";

          const scanName =
            s.ScanName || s.scanName || fields.ScanName || fields["ScanName"];

          const scanDateRaw =
            s.ScanDate || s.scanDate || fields.ScanDate || fields["ScanDate"];

          const parsedDate = extractScanDate({
            ...s,
            ScanName: scanName,
            ScanDate: scanDateRaw,
          });

          const bannedCount =
            s.bannedCount ||
            s.BannedCount ||
            fields.BannedCount ||
            (Array.isArray(s.bannedSubstances) ? s.bannedSubstances.length : 0);

          const hasBanned =
            s.flagged ||
            s.hasBanned ||
            s.hasFlag ||
            bannedCount > 0 ||
            (Array.isArray(s.flags) && s.flags.length > 0);

          return {
            ...s,
            id,
            displayName: productName,
            ScanName: scanName,
            ScanDate: scanDateRaw,
            parsedDate,
            bannedCount: bannedCount || 0,
            hasBanned: !!hasBanned,
          };
        });

        normalizedScans.sort((a, b) => {
          const ta = a.parsedDate?.getTime?.() || 0;
          const tb = b.parsedDate?.getTime?.() || 0;
          return tb - ta;
        });

        setRecentActivity(normalizedScans);

        const saved = savedData.savedStacks || [];
        setSavedStacks(saved);

        const now = Date.now();
        const LOOKBACK_DAYS = 14;
        const lookbackMs = LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

        const recentCount = normalizedScans.filter((s) => {
          const d = s.parsedDate || extractScanDate(s);
          if (!d) return false;
          const t = d.getTime();
          if (Number.isNaN(t)) return false;
          return now - t <= lookbackMs;
        }).length;

        const flaggedCount = normalizedScans.filter((s) => s.hasBanned).length;

        const orgVal = user?.Organization || user?.organization || null;

        let completion = 40;
        if (user?.Name || user?.name) completion += 20;
        if (userEmail) completion += 20;
        if (orgVal && (Array.isArray(orgVal) ? orgVal.length > 0 : true)) completion += 20;
        completion = Math.min(100, Math.max(0, completion));

        setStats({
          totalScans: normalizedScans.length,
          recentSearches: recentCount,
          stacksSaved: saved.length,
          flaggedScans: flaggedCount,
          accountCompletion: completion,
        });

        fire("dashboard_data_loaded", {
          eventType: "data",
          totalScans: normalizedScans.length,
          stacksSaved: saved.length,
          flaggedScans: flaggedCount,
        });
      } catch (err) {
        console.error("[Dashboard] Error loading data:", err);
        fire("dashboard_data_error", {
          eventType: "error",
          message: String(err?.message || err),
        });
      } finally {
        if (!cancelled) {
          setLoadingScans(false);
          setLoadingSaved(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [userEmail, user?.Name, user?.name, user?.Organization, fire]);

  /* ------------------------------------------------------------------------ */
  /* ✅ Fetch Today summary (matches your API response shape)                  */
  /*   GET /api/athlete/workouts/today -> { dailyWorkout, items }             */
  /* ------------------------------------------------------------------------ */
  useEffect(() => {
    if (!userEmail) return;

    let cancelled = false;

    async function loadToday() {
      setLoadingToday(true);
      try {
        const res = await fetch("/api/athlete/workouts/today", {
          method: "GET",
          credentials: "include",
        });

        const data = res.ok ? await res.json().catch(() => ({})) : null;
        if (cancelled) return;

        const dw = data?.dailyWorkout || null;
        const items = Array.isArray(data?.items) ? data.items : [];

        const completedCount = items.filter((it) => {
          const v = it?.Completed;
          if (v === true) return true;
          const s = String(v || "").toLowerCase();
          return s === "true" || s === "1" || s === "yes";
        }).length;

        setTodaySummary({
          hasWorkout: !!dw,
          title: dw?.Title || "",
          status: dw?.Status || "",
          itemsCount: items.length,
          completedCount,
        });
      } catch {
        if (!cancelled) {
          setTodaySummary({
            hasWorkout: false,
            title: "",
            status: "",
            itemsCount: 0,
            completedCount: 0,
          });
        }
      } finally {
        if (!cancelled) setLoadingToday(false);
      }
    }

    loadToday();

    return () => {
      cancelled = true;
    };
  }, [userEmail]);

  if (!user) return null;

  const accountCompletion = Math.min(100, Math.max(0, stats.accountCompletion || 0));

  const hasAnyScans = stats.totalScans > 0;
  const hasAnySavedStacks = stats.stacksSaved > 0;
  const hasAnyFlagged = stats.flaggedScans > 0;

  const todayHasWork = !!todaySummary?.hasWorkout;

  /* ------------------------------------------------------------------------ */
  /* Derived activity metrics                                                 */
  /* ------------------------------------------------------------------------ */
  const lastScan = useMemo(() => {
    if (!recentActivity.length) return null;
    const withDates = recentActivity.filter(
      (s) => s.parsedDate && !Number.isNaN(s.parsedDate.getTime()),
    );
    if (!withDates.length) return null;
    return withDates[0];
  }, [recentActivity]);

  /* ------------------------------------------------------------------------ */
  /* Sparkline data (last 7 days)                                             */
  /* ------------------------------------------------------------------------ */
  const sparklineData = useMemo(() => {
    const scans = recentActivity || [];
    if (!scans.length) return [];

    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * ONE_DAY);
      const key = d.toISOString().slice(0, 10);
      days.push({
        key,
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        count: 0,
      });
    }

    const countsByDate = scans.reduce((acc, s) => {
      const fields = s.fields || {};

      let d =
        s.parsedDate instanceof Date && !Number.isNaN(s.parsedDate.getTime())
          ? s.parsedDate
          : null;

      if (!d) {
        d = extractScanDate({
          ...s,
          ScanName: s.ScanName || s.scanName || fields.ScanName || fields["ScanName"],
          ScanDate: s.ScanDate || s.scanDate || fields.ScanDate || fields["ScanDate"],
        });
      }

      if (!d || Number.isNaN(d.getTime())) return acc;

      const key = d.toISOString().slice(0, 10);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const hasAnyDated = Object.values(countsByDate).some((c) => c > 0);

    if (hasAnyDated) {
      return days.map((day) => ({ ...day, count: countsByDate[day.key] || 0 }));
    }

    const buckets = days.map((d) => ({ ...d, count: 0 }));
    const latest = scans.slice(-7);
    latest.forEach((_, idx) => {
      const targetIndex = buckets.length - 1 - idx;
      if (targetIndex >= 0) buckets[targetIndex].count += 1;
    });

    return buckets;
  }, [recentActivity]);

  const maxSparkCount =
    sparklineData.length > 0 ? Math.max(...sparklineData.map((d) => d.count), 1) : 1;

  /* ------------------------------------------------------------------------ */
  /* Suggested next actions                                                   */
  /* ------------------------------------------------------------------------ */
  const suggestedActions = [
    todayHasWork && {
      label: "You have workouts assigned for today",
      cta: "Open Today",
      onClick: () => navTo(ROUTES.today, "today_primary_action"),
    },
    !hasAnyScans && {
      label: "Run your first supplement label scan",
      cta: "Scan a label",
      onClick: () => navTo(ROUTES.scan, "scan_first_label"),
    },
    hasAnyScans && !hasAnySavedStacks && {
      label: "Save a SmartStack to track ingredients you trust",
      cta: "Browse SmartStack",
      onClick: () => navTo(ROUTES.smartstack, "browse_smartstack"),
    },
    hasAnyFlagged && {
      label: "Review supplements with flagged substances",
      cta: "Review flagged scans",
      onClick: () => navTo(ROUTES.scans, "review_flagged_scans"),
    },
    accountCompletion < 100 && {
      label: "Finish setting up your account",
      cta: "Complete profile",
      onClick: () => navTo(ROUTES.account, "complete_profile"),
    },
  ].filter(Boolean);

  const primaryAction = suggestedActions[0] || null;
  const extraActions = suggestedActions.slice(1);

  const formatDateShort = (d) =>
    d
      ? d.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

  const handleLogout = async () => {
    fire("dashboard_logout_click", { eventType: "auth" });
    try {
      await logout();
    } catch {}
    router.push(ROUTES.login);
  };

  const openScanDetail = (scan) => {
    const id = scan?.id || scan?.recordId || "";
    const to = id ? `${ROUTES.scans}/${id}` : ROUTES.scans;

    fire("dashboard_scan_click", {
      eventType: "click",
      scanId: id || null,
      hasBanned: !!scan?.hasBanned,
      bannedCount: Number(scan?.bannedCount || 0),
    });

    router.push(to);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <div className="max-w-7xl mx-auto px-4 py-6 lg:py-8">
        <div className="grid gap-6 lg:grid-cols-[260px,1fr]">
          {/* Sidebar (desktop only; keeps mobile clean) */}
          <aside className="hidden lg:flex bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl shadow-sm p-4 flex-col gap-4 h-fit">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center overflow-hidden">
                  <Image
                    src="/apple-touch-icon.png"
                    alt="CheckPeak"
                    width={28}
                    height={28}
                    priority
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                    PEAK
                  </span>
                  <span className="text-xs text-gray-700">Supplement Safety</span>
                </div>
              </div>
            </div>

            <div className="mt-1 mb-2 border-t border-gray-100" />

            <nav className="flex flex-col gap-1.5 text-sm">
              <SidebarLink
                label="Dashboard"
                icon={<BarChart3 className="w-4 h-4" />}
                active
                onClick={() => navTo(ROUTES.dashboard, "dashboard")}
              />
              <SidebarLink
                label="Today"
                icon={<CalendarDays className="w-4 h-4" />}
                onClick={() => navTo(ROUTES.today, "today")}
                badge={todayHasWork ? "!" : null}
              />
              <SidebarLink
                label="Search ingredients"
                icon={<Search className="w-4 h-4" />}
                onClick={() => navTo(ROUTES.search, "search")}
              />
              <SidebarLink
                label="Scan a label"
                icon={<ScanBarcode className="w-4 h-4" />}
                onClick={() => navTo(ROUTES.scan, "scan")}
              />
              <SidebarLink
                label="My scans"
                icon={<Folder className="w-4 h-4" />}
                onClick={() => navTo(ROUTES.scans, "my_scans")}
              />
              <SidebarLink
                label="Saved stacks"
                icon={<Bookmark className="w-4 h-4" />}
                onClick={() => navTo(ROUTES.savedStacks, "saved_stacks")}
              />
              <SidebarLink
                label="SmartStack"
                icon={<Sparkles className="w-4 h-4" />}
                onClick={() => navTo(ROUTES.smartstack, "smartstack")}
              />

              <div className="mt-3 border-t border-gray-100 pt-2">
                <SidebarLink
                  label="Account settings"
                  icon={<Settings className="w-4 h-4" />}
                  onClick={() => navTo(ROUTES.account, "account_settings")}
                />
              </div>
            </nav>

            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-full bg-blue-50 flex items-center justify-center text-[11px] font-semibold text-blue-700">
                  {(user?.Name || user?.name || "U")[0]?.toUpperCase?.() || "U"}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-gray-800 truncate">
                    {user?.Name || user?.name || "Athlete"}
                  </span>
                  <span className="text-[11px] text-gray-500 truncate">
                    {user?.Email || user?.email}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-50 text-red-700 text-xs font-medium px-3 py-2 hover:bg-red-100 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                Logout
              </button>
            </div>
          </aside>

          {/* Main content */}
          <main className="space-y-6 lg:space-y-7">
            {/* Header */}
            <header className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-blue-700/80 font-semibold mb-1">
                    Dashboard
                  </p>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                    Hey {user?.Name || user?.name || "there"},
                    <span className="text-blue-700 font-semibold"> you’re in control.</span>
                  </h1>
                  {user?.Organization && (
                    <p className="mt-1 text-xs sm:text-sm text-gray-600">
                      Viewing activity for{" "}
                      <span className="font-medium text-gray-900">{user.Organization}</span>.
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-start sm:items-end gap-1 text-xs text-gray-500">
                  <span>Account completion</span>
                  <div className="w-44 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500"
                      style={{ width: `${accountCompletion}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-gray-500">{accountCompletion}% complete</span>
                </div>
              </div>

              {showWelcome && (
                <div className="p-4 sm:p-5 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-sm flex items-start gap-3">
                  <div className="mt-0.5 h-7 w-7 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-sm">
                    ✓
                  </div>
                  <div className="text-sm">
                    <h2 className="font-semibold text-emerald-800">
                      Welcome, {user?.Name || user?.name || "athlete"}.
                    </h2>
                    <p className="text-gray-700 mt-0.5">
                      Scan labels, save stacks, and keep your performance clean.
                    </p>
                  </div>
                </div>
              )}
            </header>

            {/* Top row: Today + Next step */}
            <section className="grid gap-4 lg:grid-cols-2">
              {/* Today Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <CalendarDays className="w-4 h-4 text-blue-700" />
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Today
                      </p>
                      {todayHasWork ? (
                        <span className="ml-1 inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                          Assigned
                        </span>
                      ) : (
                        <span className="ml-1 inline-flex items-center rounded-full bg-gray-50 border border-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
                          None
                        </span>
                      )}
                    </div>

                    <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                      {todayHasWork ? "Your workout plan" : "No workout scheduled"}
                    </h2>

                    {loadingToday ? (
                      <p className="mt-1 text-sm text-gray-600">Loading today’s plan…</p>
                    ) : todayHasWork ? (
                      <div className="mt-2 text-sm text-gray-700 space-y-1">
                        <p className="truncate">
                          <span className="font-semibold">{todaySummary.title || "Daily Workout"}</span>
                          {todaySummary.status ? (
                            <span className="text-gray-500"> • {todaySummary.status}</span>
                          ) : null}
                        </p>

                        <p>
                          <span className="font-semibold">{todaySummary.itemsCount}</span> items •{" "}
                          <span className="font-semibold">{todaySummary.completedCount}</span>{" "}
                          completed
                        </p>

                        {todaySummary.itemsCount > 0 ? (
                          <div className="mt-2">
                            <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500"
                                style={{
                                  width: `${Math.round(
                                    (todaySummary.completedCount / Math.max(1, todaySummary.itemsCount)) * 100,
                                  )}%`,
                                }}
                              />
                            </div>
                            <p className="mt-1 text-[11px] text-gray-500">
                              {Math.round(
                                (todaySummary.completedCount / Math.max(1, todaySummary.itemsCount)) * 100,
                              )}
                              % complete
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-gray-600">
                        Open Today to check if your coach assigns something later.
                      </p>
                    )}

                    <p className="mt-3 text-[11px] text-gray-400">Coach schedules. You execute.</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => navTo(ROUTES.today, "open_today")}
                    className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-[#46769B] text-white px-4 py-2 text-sm font-semibold hover:brightness-110 transition"
                  >
                    Open
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Next step */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Next step
                    </p>
                  </div>

                  {extraActions.length > 0 && (
                    <button
                      onClick={() => {
                        setShowAllActionsMobile((v) => !v);
                        fire("dashboard_next_steps_toggle", {
                          eventType: "click",
                          open: !showAllActionsMobile,
                        });
                      }}
                      className="md:hidden text-[11px] font-semibold text-blue-700 hover:underline"
                    >
                      {showAllActionsMobile ? "Less" : "More"}
                    </button>
                  )}
                </div>

                {!primaryAction ? (
                  <p className="text-xs text-gray-600">You’re all caught up.</p>
                ) : (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                    <span className="text-xs text-gray-700">{primaryAction.label}</span>
                    <button
                      onClick={primaryAction.onClick}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 hover:underline shrink-0"
                    >
                      {primaryAction.cta}
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {(showAllActionsMobile || extraActions.length > 0) && (
                  <ul
                    className={classNames(
                      "mt-2 space-y-2",
                      showAllActionsMobile ? "block" : "hidden md:block",
                    )}
                  >
                    {extraActions.map((item, idx) => (
                      <li
                        key={idx}
                        className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5"
                      >
                        <span className="text-xs text-gray-700">{item.label}</span>
                        <button
                          onClick={item.onClick}
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 hover:underline"
                        >
                          {item.cta}
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Mobile quick actions */}
                <div className="mt-4 grid grid-cols-2 gap-2 md:hidden">
                  <button
                    type="button"
                    onClick={() => navTo(ROUTES.scan, "quick_scan")}
                    className="rounded-xl bg-gray-900 text-white px-3 py-3 text-xs font-semibold hover:bg-gray-800 transition"
                  >
                    Scan
                  </button>
                  <button
                    type="button"
                    onClick={() => navTo(ROUTES.search, "quick_search")}
                    className="rounded-xl border border-gray-200 bg-white text-gray-800 px-3 py-3 text-xs font-semibold hover:bg-gray-50 transition"
                  >
                    Search
                  </button>
                </div>
              </div>
            </section>

            {/* Stat cards */}
            <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard
                label="Total scans"
                value={stats.totalScans}
                icon={<ScanBarcode className="w-4 h-4 text-blue-600" />}
                tone="primary"
                subLabel="All-time checks"
              />
              <StatCard
                label="Recent activity"
                value={stats.recentSearches}
                icon={<Activity className="w-4 h-4 text-indigo-600" />}
                tone="neutral"
                subLabel="Last 14 days"
              />
              <StatCard
                label="Saved stacks"
                value={stats.stacksSaved}
                icon={<Bookmark className="w-4 h-4 text-emerald-600" />}
                tone="success"
                subLabel="Tracking"
              />
              <StatCard
                label="Flagged scans"
                value={stats.flaggedScans}
                icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
                tone={stats.flaggedScans > 0 ? "warning" : "neutral"}
                subLabel="Needs review"
              />
            </section>

            {/* Mid layout: activity + risk */}
            <section className="grid gap-6 lg:grid-cols-[1.8fr,1.2fr]">
              {/* Scan activity chart */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                      Scan activity
                    </p>
                    <p className="text-sm text-gray-700">Last 7 days</p>
                  </div>
                  <button
                    onClick={() => navTo(ROUTES.scans, "view_scans_from_chart")}
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-700 hover:underline"
                  >
                    View
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                {sparklineData.length === 0 ? (
                  <div className="mt-1 text-xs text-gray-500">
                    {loadingScans ? "Syncing your scan history…" : "No scans yet."}
                  </div>
                ) : (
                  <div className="mt-1">
                    <div className="flex h-20 sm:h-24 md:h-32 items-end gap-2">
                      {sparklineData.map((day, idx) => {
                        const ratio = day.count / maxSparkCount;
                        const heightPx = Math.max(8, ratio * 72);
                        const showMobileLabel = idx === 0 || idx === sparklineData.length - 1;

                        return (
                          <div key={day.key} className="flex flex-1 flex-col items-center gap-1">
                            <div
                              className={classNames(
                                "w-4 sm:w-6 rounded-t-md transition-all",
                                day.count > 0
                                  ? "bg-gradient-to-t from-blue-600 via-blue-500 to-indigo-400 shadow-md shadow-blue-200/70"
                                  : "bg-gray-200",
                              )}
                              style={{ height: `${heightPx}px` }}
                              title={`${day.label}: ${day.count}`}
                            />
                            <span className="hidden md:block text-[10px] text-gray-500">
                              {day.label}
                            </span>
                            <span
                              className={classNames(
                                "md:hidden text-[10px] text-gray-500",
                                showMobileLabel ? "block" : "invisible",
                              )}
                            >
                              {day.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {lastScan?.parsedDate && (
                      <p className="mt-2 text-[11px] text-gray-400">
                        Last scan: {formatDateShort(lastScan.parsedDate)}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Risk & alerts */}
              <div className="space-y-4">
                {stats.flaggedScans > 0 && (
                  <div className="md:hidden bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Alerts
                      </p>
                    </div>
                    <p className="text-xs text-gray-700">
                      You have{" "}
                      <span className="font-semibold text-amber-700">
                        {stats.flaggedScans} flagged scan{stats.flaggedScans > 1 ? "s" : ""}
                      </span>
                      . Review before using those products.
                    </p>
                    <button
                      onClick={() => navTo(ROUTES.scans, "review_flagged_mobile")}
                      className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 hover:underline"
                    >
                      Review flagged scans
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                )}

                <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Risk & alerts
                    </p>
                  </div>

                  {stats.flaggedScans === 0 ? (
                    <p className="text-xs text-gray-600">
                      No scans currently marked with potential issues based on your history.
                      Always verify with your governing body for official rulings.
                    </p>
                  ) : (
                    <div className="space-y-2 text-xs text-gray-700">
                      <p>
                        You have{" "}
                        <span className="font-semibold text-amber-700">
                          {stats.flaggedScans} scan{stats.flaggedScans > 1 ? "s" : ""} with potential
                          issues
                        </span>{" "}
                        based on ingredient matches.
                      </p>
                      <p>Prioritize reviewing these before use.</p>
                      <button
                        onClick={() => navTo(ROUTES.scans, "go_to_flagged_desktop")}
                        className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 hover:underline"
                      >
                        Go to flagged scans
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <p className="mt-3 text-[10px] text-gray-400">
                    PEAK does not replace official rulings or medical advice.
                  </p>
                </div>

                <div className="hidden md:grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => navTo(ROUTES.scan, "quick_scan_desktop")}
                    className="rounded-xl bg-gray-900 text-white px-3 py-3 text-xs font-semibold hover:bg-gray-800 transition"
                  >
                    Scan a label
                  </button>
                  <button
                    type="button"
                    onClick={() => navTo(ROUTES.search, "quick_search_desktop")}
                    className="rounded-xl border border-gray-200 bg-white text-gray-800 px-3 py-3 text-xs font-semibold hover:bg-gray-50 transition"
                  >
                    Search ingredients
                  </button>
                </div>
              </div>
            </section>

            {/* Lower layout */}
            <section className="grid gap-6 lg:grid-cols-2">
              {/* Recent scans */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm sm:text-base font-semibold text-gray-900">Recent scans</h2>
                  {recentActivity.length > 0 && (
                    <button
                      onClick={() => navTo(ROUTES.scans, "recent_scans_view_all")}
                      className="text-[11px] font-medium text-blue-700 hover:underline"
                    >
                      View all
                    </button>
                  )}
                </div>

                {loadingScans && !recentActivity.length ? (
                  <div className="rounded-2xl border border-gray-200 bg-white/80 p-4 text-xs sm:text-sm text-gray-500">
                    Loading scans…
                  </div>
                ) : recentActivity.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-white/70 p-4 text-xs sm:text-sm text-gray-500">
                    <p className="font-medium text-gray-700 mb-1">No scans yet.</p>
                    <p className="mb-3">Scan a label to start building your history.</p>
                    <button
                      onClick={() => navTo(ROUTES.scan, "scan_first_label_from_empty_state")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 text-white text-[11px] sm:text-xs font-medium hover:bg-blue-500 transition"
                    >
                      <ScanBarcode className="w-3 h-3" />
                      Scan your first label
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Mobile */}
                    <div className="md:hidden bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-2">
                      {recentActivity.slice(0, 3).map((item, idx) => {
                        const fields = item.fields || {};
                        const name =
                          item.displayName ||
                          item.name ||
                          item.productName ||
                          fields.ProductName ||
                          fields["Product Name"] ||
                          "Supplement scan";

                        const parsed = item.parsedDate || extractScanDate(item);
                        const dateLabel =
                          parsed && !Number.isNaN(parsed.getTime())
                            ? formatDateShort(parsed)
                            : "";

                        return (
                          <button
                            key={item.id || idx}
                            type="button"
                            onClick={() => openScanDetail(item)}
                            className="w-full text-left rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-gray-900 truncate">
                                  {name}
                                </p>
                                {dateLabel && (
                                  <p className="text-[11px] text-gray-500 mt-0.5">{dateLabel}</p>
                                )}
                              </div>
                              {item.hasBanned ? (
                                <span className="text-[11px] font-semibold text-amber-700">
                                  Flagged
                                </span>
                              ) : (
                                <span className="text-[11px] text-blue-700 font-semibold">View</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Desktop */}
                    <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
                      <div className="space-y-3">
                        {recentActivity.slice(0, 5).map((item, index) => {
                          const key = item.id || item.recordId || index;
                          const fields = item.fields || {};
                          const name =
                            item.displayName ||
                            item.name ||
                            item.productName ||
                            fields.ProductName ||
                            fields["Product Name"] ||
                            "Supplement scan";

                          const parsed = item.parsedDate || extractScanDate(item);
                          const dateLabel =
                            parsed && !Number.isNaN(parsed.getTime())
                              ? formatDateShort(parsed)
                              : "";

                          const isFlagged = item.hasBanned;

                          return (
                            <div key={key} className="flex items-start gap-3 text-xs sm:text-sm">
                              <div className="flex flex-col items-center pt-1">
                                <span className="h-2 w-2 rounded-full bg-blue-600" />
                                {index < 4 && <span className="flex-1 w-px bg-gray-200 mt-1" />}
                              </div>

                              <div className="flex-1 flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                                <div className="flex flex-col min-w-0">
                                  <span className="font-medium text-gray-900 truncate">{name}</span>
                                  {dateLabel && (
                                    <span className="text-[11px] text-gray-500">{dateLabel}</span>
                                  )}
                                  {isFlagged && (
                                    <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-700">
                                      <AlertTriangle className="w-3 h-3" />
                                      Potential issue detected
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => openScanDetail(item)}
                                  className="text-[11px] font-medium text-blue-700 hover:underline shrink-0"
                                >
                                  View
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Saved stacks */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm sm:text-base font-semibold text-gray-900">Saved stacks</h2>
                  {savedStacks.length > 0 && (
                    <button
                      onClick={() => navTo(ROUTES.savedStacks, "saved_stacks_manage")}
                      className="text-[11px] font-medium text-blue-700 hover:underline"
                    >
                      Manage
                    </button>
                  )}
                </div>

                {loadingSaved && !savedStacks.length ? (
                  <div className="rounded-2xl border border-gray-200 bg-white/80 p-4 text-xs sm:text-sm text-gray-500">
                    Loading saved stacks…
                  </div>
                ) : savedStacks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-white/70 p-4 text-xs sm:text-sm text-gray-500">
                    <p className="font-medium text-gray-700 mb-1">No stacks saved yet.</p>
                    <p>Use SmartStack to explore and save stacks to track.</p>
                    <button
                      onClick={() =>
                        navTo(ROUTES.smartstack, "explore_smartstack_from_empty_saved")
                      }
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-900 text-white text-[11px] sm:text-xs font-medium hover:bg-gray-800 transition"
                    >
                      <Sparkles className="w-3 h-3" />
                      Explore SmartStack
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Mobile */}
                    <div className="md:hidden bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-2">
                      {savedStacks.slice(0, 1).map((stack, idx) => {
                        const fields = stack.fields || {};
                        const key = stack.id || stack.recordId || idx;
                        const title =
                          stack.StackName ||
                          stack.Name ||
                          stack.name ||
                          fields.StackName ||
                          fields.Name ||
                          "Saved stack";

                        const note =
                          stack.Notes || fields.Notes || stack.note || "Saved from SmartStack.";

                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => navTo(ROUTES.savedStacks, "open_saved_stacks_mobile")}
                            className="w-full text-left rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5"
                          >
                            <p className="text-xs font-semibold text-gray-900 truncate">{title}</p>
                            <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{note}</p>
                          </button>
                        );
                      })}

                      {savedStacks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => navTo(ROUTES.savedStacks, "more_saved_stacks_mobile")}
                          className="text-[11px] font-semibold text-blue-700 hover:underline"
                        >
                          + {savedStacks.length - 1} more saved stacks
                        </button>
                      )}
                    </div>

                    {/* Desktop */}
                    <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 space-y-3">
                      {savedStacks.slice(0, 5).map((stack, index) => {
                        const fields = stack.fields || {};
                        const key = stack.id || stack.recordId || stack.StackID || index;
                        const title =
                          stack.StackName ||
                          stack.Name ||
                          stack.name ||
                          fields.StackName ||
                          fields.Name ||
                          "Saved stack";

                        const note =
                          stack.Notes || fields.Notes || stack.note || "Saved from SmartStack.";

                        const category =
                          stack.Category ||
                          stack.category ||
                          fields.Category ||
                          fields["Category"] ||
                          stack.Type ||
                          null;

                        return (
                          <div
                            key={key}
                            className="border border-gray-100 rounded-xl px-3 py-2.5 flex items-center justify-between gap-3 bg-gray-50"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center text-[11px] font-semibold text-blue-700">
                                {title[0]?.toUpperCase?.() || "S"}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                                  {title}
                                </span>
                                <span className="text-[11px] text-gray-500 line-clamp-1">
                                  {note}
                                </span>
                                {category && (
                                  <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-gray-500">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                    {category}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                navTo(ROUTES.savedStacks, "open_saved_stacks_desktop")
                              }
                              className="text-[11px] font-medium text-blue-700 hover:underline shrink-0"
                            >
                              Open
                            </button>
                          </div>
                        );
                      })}
                      {savedStacks.length > 5 && (
                        <p className="text-[11px] text-gray-500">
                          + {savedStacks.length - 5} more stacks saved.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* Mobile-only quick logout */}
            <section className="lg:hidden">
              <button
                onClick={handleLogout}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-red-50 text-red-700 text-sm font-semibold px-4 py-3 hover:bg-red-100 transition"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

/* ----------------- Sidebar link component ----------------- */
function SidebarLink({ label, icon, active = false, onClick, badge = null }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        "w-full inline-flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-medium transition",
        active ? "bg-blue-600 text-white shadow-sm" : "text-gray-700 hover:bg-gray-100",
      )}
    >
      <span className="inline-flex items-center gap-2 min-w-0">
        <span
          className={classNames(
            "h-5 w-5 rounded-md flex items-center justify-center text-[11px]",
            active ? "bg-white/15" : "bg-gray-100 text-gray-700",
          )}
        >
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </span>

      <span className="inline-flex items-center gap-2">
        {badge ? (
          <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold grid place-items-center">
            {badge}
          </span>
        ) : null}
        {active ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
      </span>
    </button>
  );
}

/* ----------------- Stat card component ----------------- */
function StatCard({ label, value, icon, tone = "neutral", subLabel }) {
  const toneClasses =
    tone === "primary"
      ? "bg-blue-50 border-blue-100"
      : tone === "success"
      ? "bg-emerald-50 border-emerald-100"
      : tone === "warning"
      ? "bg-amber-50 border-amber-100"
      : "bg-white border-gray-100";

  return (
    <div className={classNames("rounded-2xl shadow-sm p-4 border flex flex-col justify-between", toneClasses)}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">{label}</p>
        <div className="h-8 w-8 rounded-full bg-white/70 flex items-center justify-center">
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
      {subLabel ? <p className="mt-1 text-[11px] text-gray-500">{subLabel}</p> : null}
    </div>
  );
}
