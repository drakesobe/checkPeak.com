// /hooks/dashboard/useAthleteDashboardData.js
"use client";

import { useEffect, useMemo, useState } from "react";

/* -------------------------------------------------------------------------- */
/* Helpers: robust date parsing for ScanName / ScanDate                       */
/* -------------------------------------------------------------------------- */

function parseUsDateTime(str) {
  if (!str) return null;
  const s = String(str).trim();
  const match = s.match(
    /(\d{1,2})\/(\d{1,2})\/(\d{4})[,\s]+(\d{1,2}):(\d{2})(?::(\d{1,2}))?/,
  );
  if (!match) return null;

  const [, mm, dd, yyyy, hh, min, ss] = match;
  const year = Number(yyyy);
  const month = Number(mm) - 1;
  const day = Number(dd);
  const hour = Number(hh);
  const minute = Number(min);
  const second = ss ? Number(ss) : 0;

  const d = new Date(year, month, day, hour, minute, second);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function extractScanDate(scan) {
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

export function useAthleteDashboardData({ user, userEmail, fire }) {
  const [recentActivity, setRecentActivity] = useState([]);
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
          scansData.scans || scansData.records || scansData.items || scansData.data || [];

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

          const scanName = s.ScanName || s.scanName || fields.ScanName || fields["ScanName"];

          const scanDateRaw = s.ScanDate || s.scanDate || fields.ScanDate || fields["ScanDate"];

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

        fire?.("dashboard_data_loaded", {
          eventType: "data",
          totalScans: normalizedScans.length,
          stacksSaved: saved.length,
          flaggedScans: flaggedCount,
        });
      } catch (err) {
        console.error("[Dashboard] Error loading data:", err);
        fire?.("dashboard_data_error", {
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
  }, [userEmail, user?.Name, user?.name, user?.Organization, fire, user]);

  const lastScan = useMemo(() => {
    if (!recentActivity.length) return null;
    const withDates = recentActivity.filter(
      (s) => s.parsedDate && !Number.isNaN(s.parsedDate.getTime()),
    );
    if (!withDates.length) return null;
    return withDates[0];
  }, [recentActivity]);

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
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" },
        ),
        count: 0,
      });
    }

    const countsByDate = scans.reduce((acc, s) => {
      const fields = s.fields || {};

      let d =
        s.parsedDate instanceof Date && !Number.isNaN(s.parsedDate.getTime()) ? s.parsedDate : null;

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

    if (hasAnyDated) return days.map((day) => ({ ...day, count: countsByDate[day.key] || 0 }));

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

  return {
    recentActivity,
    savedStacks,
    loadingScans,
    loadingSaved,
    stats,
    lastScan,
    sparklineData,
    maxSparkCount,
  };
}
