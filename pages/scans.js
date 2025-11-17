// pages/scans/index.js  (or pages/scans.js)
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 font-sans">
      <NavBar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">My Scans</h1>
        <p className="text-gray-600 mb-6">
          Here you can view all your scans and their risk level.
        </p>

        {loading ? (
          <div className="border rounded-2xl p-6 bg-white shadow-md flex flex-col items-center justify-center">
            <p className="text-gray-500">Loading scans…</p>
          </div>
        ) : scans.length === 0 ? (
          <div className="border rounded-2xl p-6 bg-white shadow-md flex flex-col items-center justify-center">
            <p className="text-gray-500 mb-2">No scans available yet.</p>
            <p className="text-gray-400 text-sm">
              Once you upload or perform scans, they will appear here.
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
                  className="border rounded-2xl p-6 bg-white shadow-md flex justify-between items-center hover:shadow-lg transition"
                >
                  <div>
                    <p className="text-gray-800 font-medium">
                      {scan.name || "Unnamed Scan"}
                    </p>
                    <p className="text-gray-500 text-sm">
                      {formattedDate || ""}
                    </p>
                    <div className="mt-2">{renderRiskPill(scan)}</div>
                  </div>
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
                    className="text-blue-600 hover:underline"
                  >
                    View
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
