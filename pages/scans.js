// pages/scans/index.js (or pages/scans.js)
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import NavBar from "@/components/NavBar";
import { useAuthContext } from "@/hooks/useAuth";

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

    async function fetchScans() {
      try {
        setLoading(true);
        const email = user?.Email || user?.email;
        if (!email) {
          console.warn("No email on user object, cannot load scans");
          setLoading(false);
          return;
        }

        const res = await fetch(
          `/api/getScans?userEmail=${encodeURIComponent(email)}`
        );
        const data = await res.json();

        // 🔍 Normalize bannedDetails into counts so the UI can use them
        const normalizedScans = (data.scans || []).map((scan) => {
          let prohibitedCount = 0;
          let limitedCount = 0;
          let otherCount = 0;

          let bannedDetails = scan.bannedDetails;

          // If Airtable stored it as a JSON string, parse it
          if (bannedDetails) {
            if (typeof bannedDetails === "string") {
              try {
                bannedDetails = JSON.parse(bannedDetails);
              } catch {
                // leave counts as 0 if bad JSON
                bannedDetails = null;
              }
            }

            if (bannedDetails && typeof bannedDetails === "object") {
              prohibitedCount = bannedDetails.ProhibitedCount || 0;
              limitedCount = bannedDetails.LimitedCount || 0;
              otherCount = bannedDetails.OtherBannedCount || 0;
            }
          }

          return {
            ...scan,
            prohibitedCount,
            limitedCount,
            otherCount,
          };
        });

        setScans(normalizedScans);
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
                // keep raw if parsing fails
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
                    onClick={() => router.push(`/scans/${scan.id}`)}
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
