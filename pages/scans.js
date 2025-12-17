// pages/scans/index.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAuthContext } from "@/hooks/useAuth";
import { trackEvent } from "@/lib/analytics";

export default function ScansPage() {
  const router = useRouter();
  const { user } = useAuthContext();

  // Your current file has activeTab but doesn’t use it :contentReference[oaicite:3]{index=3}
  // Removing it reduces noise.
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(false);

  // UI controls
  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("All"); // All | Prohibited | Limited | Other | Safe
  const [sortBy, setSortBy] = useState("Newest"); // Newest | Oldest | Highest Risk | Lowest Risk

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    // 🔥 Analytics: page view for My Scans
    try {
      trackEvent("page_view_my_scans", {
        eventType: "page_view",
        userEmail: user.Email || user.email || "",
        path: typeof window !== "undefined" ? window.location.pathname : "",
        source: "my_scans_page",
        device: typeof navigator !== "undefined" ? navigator.userAgent : "",
      });
    } catch (err) {
      console.error("page_view_my_scans tracking failed:", err);
    }

    async function fetchScans() {
      try {
        setLoading(true);
        const email = user.Email || user.email;
        if (!email) {
          setScans([]);
          setLoading(false);
          return;
        }

        const res = await fetch(
          `/api/getScans?userEmail=${encodeURIComponent(email)}`
        );
        const data = await res.json().catch(() => ({}));
        setScans(Array.isArray(data?.scans) ? data.scans : []);
      } catch (error) {
        console.error("Failed to fetch scans:", error);
        setScans([]);
      } finally {
        setLoading(false);
      }
    }

    fetchScans();
  }, [user, router]);

  if (!user) return null;

  /* ------------------------------------------------------------------
   * Helpers
   * ------------------------------------------------------------------ */

  const getScanName = (scan) =>
    scan?.name || scan?.scanName || scan?.ScanName || "Unnamed Scan";

  const parseScanDate = (scan) => {
    // Your current file expects scan.date :contentReference[oaicite:4]{index=4}
    // This supports additional likely date fields without breaking existing data.
    const raw =
      scan?.date ||
      scan?.scanDate ||
      scan?.ScanDate ||
      scan?.CreatedAt ||
      scan?.createdAt ||
      scan?.Created ||
      scan?.created ||
      "";

    const d = raw ? new Date(raw) : null;
    return d && !isNaN(d.getTime()) ? d : null;
  };

  const formatScanDate = (scan) => {
    const d = parseScanDate(scan);
    if (!d) return "";
    try {
      return d.toLocaleString();
    } catch {
      return String(d);
    }
  };

  const getRiskCounts = (scan) => {
    const prohibited = Number(scan?.prohibitedCount || 0);
    const limited = Number(scan?.limitedCount || 0);
    const other = Number(scan?.otherCount || 0);
    return { prohibited, limited, other };
  };

  const getRiskClass = (scan) => {
    const { prohibited, limited, other } = getRiskCounts(scan);
    if (prohibited > 0) return "Prohibited";
    if (limited > 0) return "Limited";
    if (other > 0) return "Other";
    return "Safe";
  };

  const getRiskScore = (scan) => {
    // Weighted so Prohibited dominates sorting
    const { prohibited, limited, other } = getRiskCounts(scan);
    return prohibited * 1000 + limited * 100 + other * 10;
  };

  const getStackPreviewText = (scan) => {
    // Matches your current preview approach :contentReference[oaicite:5]{index=5}
    const raw =
      scan?.stackPreview ||
      scan?.stackText ||
      scan?.stackDetails ||
      scan?.resultsSummary ||
      "";

    const text = String(raw || "").replace(/\s+/g, " ").trim();
    return text;
  };

  const renderRiskPill = (scan) => {
    const { prohibited, limited, other } = getRiskCounts(scan);

    let riskLabel = "Safe";
    let classes =
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800";

    if (prohibited > 0) {
      riskLabel = `${prohibited} Prohibited${
        limited ? `, ${limited} Limited` : ""
      }`;
      classes =
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800";
    } else if (limited > 0 || other > 0) {
      const limitedText = limited ? `${limited} Limited` : "";
      const otherText = other ? `${other} Other` : "";
      riskLabel =
        [limitedText, otherText].filter(Boolean).join(", ") || "Limited";
      classes =
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800";
    }

    return <span className={classes}>{riskLabel}</span>;
  };

  const renderRiskBreakdownChips = (scan) => {
    const { prohibited, limited, other } = getRiskCounts(scan);

    return (
      <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-100">
          <span className="w-1.5 h-1.5 rounded-full bg-red-600 mr-1.5" />
          Prohibited: {prohibited}
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-100">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mr-1.5" />
          Limited: {limited}
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mr-1.5" />
          Other: {other}
        </span>
      </div>
    );
  };

  const renderStackPreview = (scan) => {
    const text = getStackPreviewText(scan);
    if (!text) return null;

    const snippet = text.length > 140 ? text.slice(0, 140) + "…" : text;

    return (
      <p className="mt-2 text-xs text-gray-600">
        <span className="font-semibold">Stack preview:</span> {snippet}
      </p>
    );
  };

  /* ------------------------------------------------------------------
   * Derived: summary + filtered list
   * ------------------------------------------------------------------ */

  const summary = useMemo(() => {
    let prohibited = 0,
      limited = 0,
      other = 0,
      safe = 0;

    for (const s of scans) {
      const cls = getRiskClass(s);
      if (cls === "Prohibited") prohibited += 1;
      else if (cls === "Limited") limited += 1;
      else if (cls === "Other") other += 1;
      else safe += 1;
    }

    return {
      total: scans.length,
      prohibited,
      limited,
      other,
      safe,
    };
  }, [scans]);

  const filteredScans = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();

    let out = scans.slice();

    // Filter by risk class
    if (riskFilter !== "All") {
      out = out.filter((s) => getRiskClass(s) === riskFilter);
    }

    // Search by name + preview
    if (q) {
      out = out.filter((s) => {
        const name = getScanName(s).toLowerCase();
        const preview = getStackPreviewText(s).toLowerCase();
        return name.includes(q) || preview.includes(q);
      });
    }

    // Sort
    out.sort((a, b) => {
      if (sortBy === "Newest") {
        const da = parseScanDate(a)?.getTime() || 0;
        const db = parseScanDate(b)?.getTime() || 0;
        return db - da;
      }
      if (sortBy === "Oldest") {
        const da = parseScanDate(a)?.getTime() || 0;
        const db = parseScanDate(b)?.getTime() || 0;
        return da - db;
      }
      if (sortBy === "Highest Risk") {
        return getRiskScore(b) - getRiskScore(a);
      }
      if (sortBy === "Lowest Risk") {
        return getRiskScore(a) - getRiskScore(b);
      }
      return 0;
    });

    return out;
  }, [scans, query, riskFilter, sortBy]);

  /* ------------------------------------------------------------------
   * UI components
   * ------------------------------------------------------------------ */

  const FilterChip = ({ label }) => {
    const active = riskFilter === label;
    return (
      <button
        type="button"
        onClick={() => setRiskFilter(label)}
        className={[
          "px-3 py-1.5 rounded-full text-xs font-semibold border transition",
          active
            ? "bg-[#46769B] text-white border-[#46769B]"
            : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
        ].join(" ")}
      >
        {label}
      </button>
    );
  };

  const SkeletonCard = () => (
    <div className="border rounded-2xl p-5 sm:p-6 bg-white shadow-md">
      <div className="animate-pulse">
        <div className="h-4 w-2/3 bg-gray-200 rounded mb-2" />
        <div className="h-3 w-1/3 bg-gray-200 rounded mb-4" />
        <div className="h-6 w-36 bg-gray-200 rounded mb-3" />
        <div className="h-3 w-3/4 bg-gray-200 rounded mb-2" />
        <div className="h-3 w-2/3 bg-gray-200 rounded" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 font-sans">
      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-1">My Scans</h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Review your past scans, risk levels, and jump into full ingredient
              breakdowns.
            </p>
          </div>

          {/* Summary pills */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-700">
              Total: <span className="font-semibold">{summary.total}</span>
            </span>
            <span className="px-3 py-1.5 rounded-full bg-red-50 border border-red-100 text-red-700">
              Prohibited:{" "}
              <span className="font-semibold">{summary.prohibited}</span>
            </span>
            <span className="px-3 py-1.5 rounded-full bg-orange-50 border border-orange-100 text-orange-700">
              Limited: <span className="font-semibold">{summary.limited}</span>
            </span>
            <span className="px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700">
              Other: <span className="font-semibold">{summary.other}</span>
            </span>
            <span className="px-3 py-1.5 rounded-full bg-green-50 border border-green-100 text-green-700">
              Safe: <span className="font-semibold">{summary.safe}</span>
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="border rounded-2xl bg-white shadow-sm p-4 sm:p-5 mb-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-700">
                Search scans
              </label>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by scan name or stack preview…"
                className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#46769B]"
              />
            </div>

            <div className="sm:w-56">
              <label className="text-xs font-semibold text-gray-700">Sort</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="mt-1 w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#46769B]"
              >
                <option>Newest</option>
                <option>Oldest</option>
                <option>Highest Risk</option>
                <option>Lowest Risk</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 items-center">
            <span className="text-xs font-semibold text-gray-700 mr-1">
              Filter:
            </span>
            <FilterChip label="All" />
            <FilterChip label="Prohibited" />
            <FilterChip label="Limited" />
            <FilterChip label="Other" />
            <FilterChip label="Safe" />
          </div>

          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-[11px] text-gray-500">
              Showing{" "}
              <span className="font-semibold">{filteredScans.length}</span> of{" "}
              <span className="font-semibold">{scans.length}</span> scans
            </p>

            <Link
              href="/ocr"
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-[#46769B] text-white font-semibold text-sm hover:brightness-110 transition"
            >
              New scan →
            </Link>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : filteredScans.length === 0 ? (
          <div className="border rounded-2xl p-6 bg-white shadow-md flex flex-col items-center justify-center text-center">
            <p className="text-gray-800 font-semibold mb-1">
              No scans match your filters.
            </p>
            <p className="text-gray-500 text-sm">
              Try clearing your search, changing the risk filter, or run a new
              scan.
            </p>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setRiskFilter("All");
                  setSortBy("Newest");
                }}
                className="px-5 py-3 rounded-xl border border-gray-200 bg-white text-gray-800 font-semibold text-sm hover:bg-gray-50 transition"
              >
                Clear filters
              </button>
              <Link
                href="/ocr"
                className="px-5 py-3 rounded-xl bg-[#46769B] text-white font-semibold text-sm hover:brightness-110 transition"
              >
                Scan a label
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredScans.map((scan) => {
              const scanName = getScanName(scan);
              const formattedDate = formatScanDate(scan);

              return (
                <div
                  key={scan.id}
                  className="border rounded-2xl p-5 sm:p-6 bg-white shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:shadow-lg hover:-translate-y-0.5 transition"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 font-medium truncate">
                      {scanName}
                    </p>
                    <p className="text-gray-500 text-xs sm:text-sm">
                      {formattedDate || ""}
                    </p>

                    {/* Risk summary pill */}
                    <div className="mt-2 flex items-center gap-2">
                      {renderRiskPill(scan)}
                    </div>

                    {/* Mini breakdown chips */}
                    {renderRiskBreakdownChips(scan)}

                    {/* Stack / ingredient preview */}
                    {renderStackPreview(scan)}
                  </div>

                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={async () => {
                        // 🔥 Analytics: user viewing a specific scan
                        try {
                          await trackEvent("scan_viewed", {
                            eventType: "scan_view",
                            userEmail: user.Email || user.email || "",
                            path:
                              typeof window !== "undefined"
                                ? window.location.pathname
                                : "",
                            source: "my_scans_page",
                            device:
                              typeof navigator !== "undefined"
                                ? navigator.userAgent
                                : "",
                            payload: {
                              scanId: scan.id,
                              scanName,
                              prohibitedCount: scan.prohibitedCount || 0,
                              limitedCount: scan.limitedCount || 0,
                              otherCount: scan.otherCount || 0,
                            },
                          });
                        } catch (err) {
                          console.error("scan_viewed tracking failed:", err);
                        }

                        router.push(`/scans/${scan.id}`);
                      }}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold text-[#46769B] border border-blue-100 bg-blue-50 hover:bg-blue-100 hover:border-blue-200 transition"
                    >
                      View details →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
