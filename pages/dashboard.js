// pages/dashboard.js
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/hooks/useAuth";
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

// Extract a usable Date from a scan record, preferring ScanDate / ScanName:
//   ScanName = "Scan - 11/15/2025, 19:39:30"
//   ScanDate = "11/15/2025 19:39"
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
    scan.created_time || // Airtable-style
    null;

  if (!raw) return null;

  let str = String(raw).trim();

  // Strip "Scan - " prefix from ScanName
  if (str.toLowerCase().startsWith("scan -")) {
    const idx = str.indexOf("-");
    if (idx !== -1) {
      str = str.slice(idx + 1).trim();
    }
  }

  // Prefer explicit US date/time parsing
  let d = parseUsDateTime(str);
  if (d) return d;

  // Fallback to native Date
  d = new Date(str);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/* -------------------------------------------------------------------------- */
/* Dashboard Page                                                             */
/* -------------------------------------------------------------------------- */

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout } = useAuthContext();

  const [showWelcome, setShowWelcome] = useState(false);
  const [recentActivity, setRecentActivity] = useState([]); // normalized scans
  const [savedStacks, setSavedStacks] = useState([]);

  const [loadingScans, setLoadingScans] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);

  const [stats, setStats] = useState({
    totalScans: 0,
    recentSearches: 0,
    stacksSaved: 0,
    accountCompletion: 0,
    flaggedScans: 0,
  });

  const userEmail = user?.Email || user?.email || null;
  const displayName = user?.Name || user?.name || "there";

  const handleLogout = useCallback(() => {
    logout();
    // Redirect immediately (and your effect below also covers it)
    router.push("/login");
  }, [logout, router]);

  /* ------------------------------------------------------------------------ */
  /* Auth redirect + welcome banner                                           */
  /* ------------------------------------------------------------------------ */
  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    setShowWelcome(true);
    const timer = setTimeout(() => setShowWelcome(false), 3000);
    return () => clearTimeout(timer);
  }, [user, router]);

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
        const savedData = savedRes.ok
          ? await savedRes.json()
          : { savedStacks: [] };

        if (cancelled) return;

        const rawScans =
          scansData.scans ||
          scansData.records ||
          scansData.items ||
          scansData.data ||
          [];

        // Normalize scans with parsed dates + flagged detection
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

        setRecentActivity(normalizedScans);

        const saved = savedData.savedStacks || [];
        setSavedStacks(saved);

        // Stats + account completion
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

        let completion = 40;
        if (user?.Name || user?.name) completion += 20;
        if (userEmail) completion += 20;
        if (user?.Organization) completion += 20;
        completion = Math.min(100, Math.max(0, completion));

        setStats({
          totalScans: normalizedScans.length,
          recentSearches: recentCount,
          stacksSaved: saved.length,
          flaggedScans: flaggedCount,
          accountCompletion: completion,
        });
      } catch (err) {
        console.error("[Dashboard] Error loading data:", err);
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
  }, [userEmail, user?.Name, user?.name, user?.Organization]);

  /* ------------------------------------------------------------------------ */
  /* Derived activity metrics (HOOK SAFE)                                     */
  /* ------------------------------------------------------------------------ */
  const lastScan = useMemo(() => {
    if (!recentActivity.length) return null;
    const withDates = recentActivity.filter(
      (s) => s.parsedDate && !Number.isNaN(s.parsedDate.getTime()),
    );
    if (!withDates.length) return null;
    return withDates.sort(
      (a, b) => b.parsedDate.getTime() - a.parsedDate.getTime(),
    )[0];
  }, [recentActivity]);

  /* ------------------------------------------------------------------------ */
  /* Sparkline data (last 7 days)                                             */
  /* ------------------------------------------------------------------------ */
  const sparklineData = useMemo(() => {
    const scans = recentActivity || [];
    if (!scans.length) return [];

    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;

    // Last 7 days (oldest → newest)
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * ONE_DAY);
      const key = d.toISOString().slice(0, 10);
      days.push({
        key,
        label: d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        count: 0,
      });
    }

    // Map scans per day using parsedDate, with defensive fallbacks
    const countsByDate = scans.reduce((acc, s) => {
      const fields = s.fields || {};

      // 1) Already-parsed date from normalization
      let d =
        s.parsedDate instanceof Date && !Number.isNaN(s.parsedDate.getTime())
          ? s.parsedDate
          : null;

      // 2) Fallback: run extractScanDate against Airtable-style fields
      if (!d) {
        d = extractScanDate({
          ...s,
          ScanName:
            s.ScanName || s.scanName || fields.ScanName || fields["ScanName"],
          ScanDate:
            s.ScanDate || s.scanDate || fields.ScanDate || fields["ScanDate"],
        });
      }

      // 3) Final fallback: try any existing raw date-ish field
      if (!d) {
        const raw =
          s.date ||
          s.Date ||
          fields.Date ||
          s.createdAt ||
          s.created_at ||
          s.timestamp ||
          s.time ||
          s.scannedAt ||
          s.ScanTimestamp ||
          s.DateScanned ||
          s.created_time ||
          null;

        if (raw) {
          const tmp =
            typeof raw === "string"
              ? parseUsDateTime(raw) || new Date(raw)
              : new Date(raw);
          if (!Number.isNaN(tmp.getTime())) d = tmp;
        }
      }

      if (!d || Number.isNaN(d.getTime())) return acc;

      const key = d.toISOString().slice(0, 10);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const hasAnyDated = Object.values(countsByDate).some((c) => c > 0);

    if (hasAnyDated) {
      // Normal path: fill days with real counts
      return days.map((day) => ({
        ...day,
        count: countsByDate[day.key] || 0,
      }));
    }

    // Fallback: no usable dates → distribute latest scans visually
    const buckets = days.map((d) => ({ ...d, count: 0 }));
    const latest = scans.slice(-7);
    latest.forEach((_, idx) => {
      const targetIndex = buckets.length - 1 - idx;
      if (targetIndex >= 0) {
        buckets[targetIndex].count += 1;
      }
    });

    return buckets;
  }, [recentActivity]);

  const maxSparkCount =
    sparklineData.length > 0
      ? Math.max(...sparklineData.map((d) => d.count), 1)
      : 1;

  const accountCompletion = Math.min(
    100,
    Math.max(0, stats.accountCompletion || 0),
  );

  const hasAnyScans = stats.totalScans > 0;
  const hasAnySavedStacks = stats.stacksSaved > 0;
  const hasAnyFlagged = stats.flaggedScans > 0;

  /* ------------------------------------------------------------------------ */
  /* Suggested next actions                                                   */
  /* ------------------------------------------------------------------------ */
  const suggestedActions = [
    !hasAnyScans && {
      label: "Run your first supplement label scan",
      cta: "Scan a label",
      onClick: () => router.push("/ocr"),
    },
    hasAnyScans && !hasAnySavedStacks && {
      label: "Save a SmartStack to track ingredients you trust",
      cta: "Browse SmartStack",
      onClick: () => router.push("/smartstack"),
    },
    hasAnyFlagged && {
      label: "Review supplements with flagged substances",
      cta: "Review flagged scans",
      onClick: () => router.push("/scans"),
    },
    accountCompletion < 100 && {
      label: "Finish setting up your account & team details",
      cta: "Complete profile",
      onClick: () => router.push("/account"),
    },
  ].filter(Boolean);

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

  /* ------------------------------------------------------------------------ */
  /* ✅ IMPORTANT: no early return before hooks above                         */
  /* ------------------------------------------------------------------------ */
  if (!user) {
    // Your redirect effect will run; this prevents hook mismatch crashes
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50" />
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Render                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <div className="max-w-7xl mx-auto px-4 py-6 lg:py-8">
        {/* Layout: Sidebar + Main */}
        <div className="grid gap-6 lg:grid-cols-[240px,1fr]">
          {/* Sidebar */}
          <aside className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl shadow-sm p-4 flex flex-col gap-4 h-fit">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-slate-900 flex items-center justify-center text-white text-sm font-bold">
                  P
                </div>
                <div className="flex flex-col">
                  <span className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                    PEAK
                  </span>
                  <span className="text-xs text-gray-700">
                    Supplement Safety
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-1 mb-2 border-t border-gray-100" />

            <nav className="flex flex-col gap-1.5 text-sm">
              <SidebarLink
                label="Dashboard"
                icon={<BarChart3 className="w-4 h-4" />}
                active
                onClick={() => router.push("/dashboard")}
              />
              <SidebarLink
                label="Search ingredients"
                icon={<Search className="w-4 h-4" />}
                onClick={() => router.push("/search")}
              />
              <SidebarLink
                label="Scan a label"
                icon={<ScanBarcode className="w-4 h-4" />}
                onClick={() => router.push("/ocr")}
              />
              <SidebarLink
                label="My scans"
                icon={<Folder className="w-4 h-4" />}
                onClick={() => router.push("/scans")}
              />
              <SidebarLink
                label="Saved stacks"
                icon={<Bookmark className="w-4 h-4" />}
                onClick={() => router.push("/saved-stacks")}
              />
              <SidebarLink
                label="SmartStack"
                icon={<Sparkles className="w-4 h-4" />}
                onClick={() => router.push("/smartstack")}
              />
              <div className="mt-3 border-t border-gray-100 pt-2">
                <SidebarLink
                  label="Account settings"
                  icon={<Settings className="w-4 h-4" />}
                  onClick={() => router.push("/account")}
                />
              </div>
            </nav>

            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-full bg-blue-50 flex items-center justify-center text-[11px] font-semibold text-blue-700">
                  {(displayName?.[0] || "U").toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-gray-800 truncate">
                    {displayName}
                  </span>
                  <span className="text-[11px] text-gray-500 truncate">
                    {user?.Email || user?.email || ""}
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
            {/* Header + welcome */}
            <header className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-blue-700/80 font-semibold mb-1">
                    Dashboard
                  </p>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                    Hey {displayName},
                    <span className="text-blue-700 font-semibold">
                      {" "}
                      you’re in control.
                    </span>
                  </h1>
                  {user?.Organization && (
                    <p className="mt-1 text-xs sm:text-sm text-gray-600">
                      Viewing activity for{" "}
                      <span className="font-medium text-gray-900">
                        {user.Organization}
                      </span>
                      .
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-start sm:items-end gap-1 text-xs text-gray-500">
                  <span>Account completion</span>
                  <div className="w-40 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500"
                      style={{ width: `${accountCompletion}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-gray-500">
                    {accountCompletion}% complete
                  </span>
                </div>
              </div>

              {showWelcome && (
                <div className="p-4 sm:p-5 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-sm flex items-start gap-3">
                  <div className="mt-0.5 h-7 w-7 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-sm">
                    ✓
                  </div>
                  <div className="text-sm">
                    <h2 className="font-semibold text-emerald-800">
                      Welcome, {displayName}.
                    </h2>
                    <p className="text-gray-700 mt-0.5">
                      Use PEAK to sanity-check supplements, track stacks, and
                      keep your performance clean.
                    </p>
                  </div>
                </div>
              )}
            </header>

            {/* Top summary strip */}
            <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard
                label="Total scans"
                value={stats.totalScans}
                icon={<ScanBarcode className="w-4 h-4 text-blue-600" />}
                tone="primary"
                subLabel="All-time checks you’ve run"
              />
              <StatCard
                label="Recent activity"
                value={stats.recentSearches}
                icon={<Activity className="w-4 h-4 text-indigo-600" />}
                tone="neutral"
                subLabel="Scans in the last 14 days"
              />
              <StatCard
                label="Saved stacks"
                value={stats.stacksSaved}
                icon={<Bookmark className="w-4 h-4 text-emerald-600" />}
                tone="success"
                subLabel="Stacks you’re tracking"
              />
              <StatCard
                label="Flagged scans"
                value={stats.flaggedScans}
                icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
                tone={stats.flaggedScans > 0 ? "warning" : "neutral"}
                subLabel="Scans with potential issues"
              />
            </section>

            {/* Mid layout: sparkline + next actions + alerts */}
            <section className="grid gap-6 lg:grid-cols-[1.8fr,1.2fr]">
              {/* Scan activity sparkline */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                      Scan activity
                    </p>
                    <p className="text-sm text-gray-700">
                      How often you’ve been verifying supplements.
                    </p>
                  </div>
                  <button
                    onClick={() => router.push("/scans")}
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-700 hover:underline"
                  >
                    View scan history
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                {sparklineData.length === 0 ? (
                  <div className="mt-2 text-xs text-gray-500">
                    {loadingScans
                      ? "Syncing your scan history…"
                      : "When you start scanning, you’ll see your last 7 days of activity here."}
                  </div>
                ) : (
                  <div className="mt-1 space-y-3">
                    <div className="flex h-32 items-end gap-2">
                      {sparklineData.map((day) => {
                        const ratio = day.count / maxSparkCount;
                        const heightPx = Math.max(10, ratio * 72); // 10–72px

                        return (
                          <div
                            key={day.key}
                            className="flex flex-1 flex-col items-center gap-1"
                          >
                            <div
                              className={`w-4 sm:w-6 rounded-t-md ${
                                day.count > 0
                                  ? "bg-gradient-to-t from-blue-600 via-blue-500 to-indigo-400 shadow-md shadow-blue-200/70"
                                  : "bg-gray-200"
                              } transition-all`}
                              style={{ height: `${heightPx}px` }}
                            />
                            <span className="text-[10px] text-gray-500">
                              {day.label}
                            </span>
                            <span className="text-[10px] font-semibold text-gray-700">
                              {day.count || "–"}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <p className="text-[11px] text-gray-500">
                      Bars represent how many scans you ran each day in the last
                      week. Formats like{" "}
                      <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 text-[10px]">
                        Scan - 11/15/2025, 19:39:30
                      </code>{" "}
                      and{" "}
                      <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 text-[10px]">
                        11/15/2025 19:39
                      </code>{" "}
                      are parsed and bucketed automatically.
                    </p>

                    {lastScan?.parsedDate && (
                      <p className="text-[11px] text-gray-400">
                        Last scan: {formatDateShort(lastScan.parsedDate)}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Next steps + alerts */}
              <div className="space-y-4">
                {/* Next best actions */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Next best actions
                    </p>
                  </div>

                  {suggestedActions.length === 0 ? (
                    <p className="text-xs text-gray-600">
                      You’re all caught up. Keep scanning new products to stay
                      ahead of ingredient changes.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {suggestedActions.map((item, idx) => (
                        <li
                          key={idx}
                          className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5"
                        >
                          <span className="text-xs text-gray-700">
                            {item.label}
                          </span>
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
                </div>

                {/* Risk & alerts */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Risk & alerts
                    </p>
                  </div>

                  {stats.flaggedScans === 0 ? (
                    <p className="text-xs text-gray-600">
                      No scans currently marked with potential banned substances
                      based on your history. Always verify with your governing
                      body for official rulings.
                    </p>
                  ) : (
                    <div className="space-y-2 text-xs text-gray-700">
                      <p>
                        You have{" "}
                        <span className="font-semibold text-amber-700">
                          {stats.flaggedScans} scan
                          {stats.flaggedScans > 1 ? "s" : ""} with potential
                          issues
                        </span>{" "}
                        based on the ingredient matches.
                      </p>
                      <p>
                        Prioritize reviewing these products with your athletic
                        trainer, medical professional, or compliance staff.
                      </p>
                      <button
                        onClick={() => router.push("/scans")}
                        className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 hover:underline"
                      >
                        Go to flagged scans
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  <p className="mt-3 text-[10px] text-gray-400">
                    PEAK does not replace official rulings or medical advice.
                    Always confirm with your governing body.
                  </p>
                </div>
              </div>
            </section>

            {/* Bottom layout: recent scans + saved stacks preview */}
            <section className="grid gap-6 lg:grid-cols-2">
              {/* Recent scans timeline */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm sm:text-base font-semibold text-gray-900">
                    Recent scans
                  </h2>
                  {recentActivity.length > 0 && (
                    <button
                      onClick={() => router.push("/scans")}
                      className="text-[11px] font-medium text-blue-700 hover:underline"
                    >
                      View all scans
                    </button>
                  )}
                </div>

                {loadingScans && !recentActivity.length ? (
                  <div className="rounded-2xl border border-gray-200 bg-white/80 p-4 text-xs sm:text-sm text-gray-500">
                    Loading scans…
                  </div>
                ) : recentActivity.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-white/70 p-4 text-xs sm:text-sm text-gray-500">
                    <p className="font-medium text-gray-700 mb-1">
                      No scans yet.
                    </p>
                    <p className="mb-3">
                      When you scan a supplement label, you&apos;ll see your
                      history here as a simple timeline.
                    </p>
                    <button
                      onClick={() => router.push("/ocr")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 text-white text-[11px] sm:text-xs font-medium hover:bg-blue-500 transition"
                    >
                      <ScanBarcode className="w-3 h-3" />
                      Scan your first label
                    </button>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
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

                        const rawDateLabel =
                          item.ScanDate ||
                          item.ScanName ||
                          item.date ||
                          item.Date ||
                          fields.Date ||
                          item.createdAt ||
                          item.created_at ||
                          item.timestamp ||
                          item.time ||
                          item.scannedAt ||
                          item.ScanTimestamp ||
                          item.DateScanned ||
                          item.created_time ||
                          "";

                        const dateLabel =
                          parsed && !Number.isNaN(parsed.getTime())
                            ? formatDateShort(parsed)
                            : rawDateLabel;

                        const isFlagged = item.hasBanned;

                        return (
                          <div
                            key={key}
                            className="flex items-start gap-3 text-xs sm:text-sm"
                          >
                            <div className="flex flex-col items-center pt-1">
                              <span className="h-2 w-2 rounded-full bg-blue-600" />
                              {index < 4 && (
                                <span className="flex-1 w-px bg-gray-200 mt-1" />
                              )}
                            </div>

                            <div className="flex-1 flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                              <div className="flex flex-col">
                                <span className="font-medium text-gray-900">
                                  {name}
                                </span>

                                {dateLabel && (
                                  <span className="text-[11px] text-gray-500">
                                    {dateLabel}
                                  </span>
                                )}

                                {isFlagged && (
                                  <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-700">
                                    <AlertTriangle className="w-3 h-3" />
                                    Potential issue detected
                                  </span>
                                )}
                              </div>

                              <button
                                onClick={() =>
                                  router.push(`/scans/${item.id || ""}`)
                                }
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
                )}
              </div>

              {/* Saved stacks preview */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm sm:text-base font-semibold text-gray-900">
                    Saved stacks
                  </h2>
                  {savedStacks.length > 0 && (
                    <button
                      onClick={() => router.push("/saved-stacks")}
                      className="text-[11px] font-medium text-blue-700 hover:underline"
                    >
                      Manage stacks
                    </button>
                  )}
                </div>

                {loadingSaved && !savedStacks.length ? (
                  <div className="rounded-2xl border border-gray-200 bg-white/80 p-4 text-xs sm:text-sm text-gray-500">
                    Loading saved stacks…
                  </div>
                ) : savedStacks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-white/70 p-4 text-xs sm:text-sm text-gray-500">
                    <p className="font-medium text-gray-700 mb-1">
                      No stacks saved yet.
                    </p>
                    <p>
                      Use SmartStack to explore formulations and save stacks
                      you want to monitor or compare later.
                    </p>
                    <button
                      onClick={() => router.push("/smartstack")}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-900 text-white text-[11px] sm:text-xs font-medium hover:bg-gray-800 transition"
                    >
                      <Sparkles className="w-3 h-3" />
                      Explore SmartStack
                    </button>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 space-y-3">
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
                        stack.Notes ||
                        fields.Notes ||
                        stack.note ||
                        "Saved from SmartStack.";

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
                              {title?.[0]?.toUpperCase?.() || "S"}
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
                            onClick={() => router.push("/saved-stacks")}
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
                )}
              </div>
            </section>

            {/* Small disclaimer */}
            <section className="pt-2">
              <p className="text-[10px] text-gray-500 max-w-xl">
                PEAK is a tool to help you screen supplement labels and
                understand potential risks. It is not a substitute for official
                rulings, lab testing, or medical advice. Always confirm with
                your governing body, team medical staff, or trusted professional
                before consuming any product.
              </p>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

/* ----------------- Sidebar link component ----------------- */

function SidebarLink({ label, icon, active = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full inline-flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-medium transition ${
        active
          ? "bg-blue-600 text-white shadow-sm"
          : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      <span className="inline-flex items-center gap-2 min-w-0">
        <span
          className={`h-5 w-5 rounded-md flex items-center justify-center text-[11px] ${
            active ? "bg-white/15" : "bg-gray-100 text-gray-700"
          }`}
        >
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </span>
      {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
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
    <div
      className={`rounded-2xl shadow-sm p-4 border ${toneClasses} flex flex-col justify-between`}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
          {label}
        </p>
        <div className="h-8 w-8 rounded-full bg-white/70 flex items-center justify-center">
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
      {subLabel && (
        <p className="mt-1 text-[11px] text-gray-500">{subLabel}</p>
      )}
    </div>
  );
}
