// pages/scans/index.js
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import NavBar from "@/components/NavBar";
import { useAuthContext } from "@/hooks/useAuth";
import { trackEvent } from "@/lib/analytics";

export default function ScansPage() {
  const router = useRouter();
  const { user } = useAuthContext();
  const [activeTab, setActiveTab] = useState("My Scans");
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(false);

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
          setLoading(false);
          return;
        }

        const res = await fetch(
          `/api/getScans?userEmail=${encodeURIComponent(email)}`
        );
        const data = await res.json();
        setScans(data.scans || []);
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

  const renderRiskPill = (scan) => {
    const prohibitedCount = scan.prohibitedCount || 0;
    const limitedCount = scan.limitedCount || 0;
    const otherCount = scan.otherCount || 0;

    let riskLabel = "Safe";
    let classes =
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800";

    if (prohibitedCount > 0) {
      riskLabel = `${prohibitedCount} Prohibited${
        limitedCount ? `, ${limitedCount} Limited` : ""
      }`;
      classes =
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800";
    } else if (limitedCount > 0 || otherCount > 0) {
      const limitedText = limitedCount ? `${limitedCount} Limited` : "";
      const otherText = otherCount ? `${otherCount} Other` : "";
      riskLabel =
        [limitedText, otherText].filter(Boolean).join(", ") || "Limited";
      classes =
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800";
    }

    return <span className={classes}>{riskLabel}</span>;
  };

  const renderRiskBreakdownChips = (scan) => {
    const prohibitedCount = scan.prohibitedCount || 0;
    const limitedCount = scan.limitedCount || 0;
    const otherCount = scan.otherCount || 0;

    return (
      <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-100">
          <span className="w-1.5 h-1.5 rounded-full bg-red-600 mr-1.5" />
          Prohibited: {prohibitedCount}
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-100">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mr-1.5" />
          Limited: {limitedCount}
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mr-1.5" />
          Other: {otherCount}
        </span>
      </div>
    );
  };

  const renderStackPreview = (scan) => {
    // depends on what you return from /api/getScans
    // try StackDetails, stackText, stackPreview, or resultsSummary
    const raw =
      scan.stackPreview ||
      scan.stackText ||
      scan.stackDetails ||
      scan.resultsSummary ||
      "";

    if (!raw) return null;
    const text = String(raw).replace(/\s+/g, " ").trim();
    if (!text) return null;

    const snippet = text.length > 140 ? text.slice(0, 140) + "…" : text;

    return (
      <p className="mt-2 text-xs text-gray-600">
        <span className="font-semibold">Stack preview:</span> {snippet}
      </p>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 font-sans">
      <NavBar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">My Scans</h1>
        <p className="text-gray-600 mb-6 text-sm sm:text-base">
          Review your past scans, risk levels, and quickly jump into the full
          ingredient breakdown.
        </p>

        {loading ? (
          <div className="border rounded-2xl p-6 bg-white shadow-md flex flex-col items-center justify-center">
            <p className="text-gray-500">Loading scans…</p>
          </div>
        ) : scans.length === 0 ? (
          <div className="border rounded-2xl p-6 bg-white shadow-md flex flex-col items-center justify-center text-center">
            <p className="text-gray-500 mb-2">No scans available yet.</p>
            <p className="text-gray-400 text-sm">
              Once you upload or perform scans, they’ll show up here so you can
              track risk over time.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {scans.map((scan) => {
              let formattedDate = scan.date;
              try {
                if (scan.date) {
                  formattedDate = new Date(scan.date).toLocaleString();
                }
              } catch {
                // keep raw
              }

              return (
                <div
                  key={scan.id}
                  className="border rounded-2xl p-5 sm:p-6 bg-white shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:shadow-lg hover:-translate-y-0.5 transition"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 font-medium truncate">
                      {scan.name || "Unnamed Scan"}
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
                              scanName: scan.name || "Unnamed Scan",
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
